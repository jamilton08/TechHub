from django.db import transaction
from django.db.models import Count, Sum
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import rules
from .models import Asset, Project, ProjectFile
from .permissions import OwnerOrSharedReadOnly
from .serializers import AssetSerializer, ProjectListSerializer, ProjectSerializer


@method_decorator(ensure_csrf_cookie, name="dispatch")
class MeView(APIView):
    """Who's signed in. Also hands the page its CSRF cookie.
    Returns an id only — never a name (the site stores no student names)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"authenticated": False})
        return Response({"authenticated": True, "userId": request.user.pk, "isTeacher": request.user.is_staff})


class ProjectViewSet(viewsets.ModelViewSet):
    """
    GET    /arcade/projects/                my projects (summaries)
    POST   /arcade/projects/                create {id?, title, entry, files, remixOf?}
    GET    /arcade/projects/<id>/           one project (mine, or someone's unlisted/public one)
    PUT    /arcade/projects/<id>/           save {title, entry, files, version} → 409 if version is stale
    PATCH  /arcade/projects/<id>/           {title?, visibility?}
    DELETE /arcade/projects/<id>/
    POST   /arcade/projects/<id>/remix/     copy someone's shared project into my account
    POST   /arcade/projects/<id>/assets/    upload (multipart: name, file) — replaces same name
    """
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, OwnerOrSharedReadOnly]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    lookup_value_regex = "[0-9a-fA-F-]{36}"

    def get_queryset(self):
        if self.action == "list":
            if not self.request.user.is_authenticated:
                return Project.objects.none()
            return (Project.objects.filter(owner=self.request.user)
                    .annotate(file_count=Count("files", distinct=True), asset_count=Count("assets", distinct=True)))
        return Project.objects.prefetch_related("files", "assets")

    def get_serializer_class(self):
        return ProjectListSerializer if self.action == "list" else ProjectSerializer

    def get_object(self):
        obj = get_object_or_404(self.get_queryset(), pk=self.kwargs["pk"])
        if not obj.visible_to(self.request.user):
            raise NotFound()  # don't reveal that a private project exists
        self.check_object_permissions(self.request, obj)
        return obj

    def perform_create(self, serializer):
        pid = serializer.validated_data.get("id")
        if pid and Project.objects.filter(pk=pid).exists():
            raise ValidationError({"id": "A project with this id already exists."})
        serializer.save(owner=self.request.user)

    def update(self, request, *args, **kwargs):
        partial = kwargs.get("partial", False)
        with transaction.atomic():
            project = Project.objects.select_for_update().get(pk=self.get_object().pk)
            if not partial:
                sent = request.data.get("version")
                if sent is None:
                    raise ValidationError({"version": "Send the version you started from."})
                if int(sent) != project.version:
                    return Response({"detail": "This project was saved somewhere else since you opened it.",
                                     "version": project.version}, status=status.HTTP_409_CONFLICT)
            else:
                allowed = {"title", "visibility"}
                extra = set(request.data) - allowed
                if extra:
                    raise ValidationError({"detail": f"PATCH can only change {', '.join(sorted(allowed))}."})
            serializer = self.get_serializer(project, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            serializer.save()
        return Response(self.get_serializer(Project.objects.prefetch_related("files", "assets").get(pk=project.pk)).data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def remix(self, request, pk=None):
        src = self.get_object()
        with transaction.atomic():
            copy = Project.objects.create(owner=request.user, title=src.title, entry=src.entry, remix_of=src)
            ProjectFile.objects.bulk_create(
                ProjectFile(project=copy, name=f.name, content=f.content, position=f.position) for f in src.files.all()
            )
            for a in src.assets.all():
                new = Asset(project=copy, name=a.name, content_type=a.content_type, size=a.size)
                with a.file.open("rb") as fh:
                    new.file.save(a.name, fh, save=False)
                new.save()
        return Response(self.get_serializer(copy).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="assets")
    def upload_asset(self, request, pk=None):
        project = self.get_object()
        upload = request.FILES.get("file")
        name = request.data.get("name") or (upload.name if upload else "")
        if not upload:
            raise ValidationError({"file": "Attach the file."})
        ctype = rules.asset_type(name)
        if not ctype:
            raise ValidationError({"name": "Images (png, jpg, gif, webp, bmp), sounds (wav, mp3, ogg, m4a) and fonts (ttf, otf, woff) only."})
        if upload.size > rules.MAX_ASSET_BYTES:
            raise ValidationError({"file": f"Files can be up to {rules.MAX_ASSET_BYTES // (1024 * 1024)} MB."})
        head = upload.read(16)
        upload.seek(0)
        if not rules.looks_like(ctype, head):
            raise ValidationError({"file": "That file's contents don't match its name."})
        others = project.assets.exclude(name=name)
        if others.count() >= rules.MAX_ASSETS:
            raise ValidationError({"file": f"A project can have up to {rules.MAX_ASSETS} assets."})
        used = others.aggregate(total=Sum("size"))["total"] or 0
        if used + upload.size > rules.MAX_PROJECT_ASSET_BYTES:
            raise ValidationError({"file": "This project is out of room for assets."})
        with transaction.atomic():
            project.assets.filter(name=name).delete()  # replacing: the signal removes the old bytes
            asset = Asset(project=project, name=name, content_type=ctype, size=upload.size)
            asset.file.save(name, upload, save=False)
            asset.save()
            # assets don't bump `version` (that's for code), but they do count as an edit
            Project.objects.filter(pk=project.pk).update(updated_at=timezone.now())
        return Response(AssetSerializer(asset, context={"request": request}).data, status=status.HTTP_201_CREATED)


class AssetView(APIView):
    """GET the bytes of one asset (owner, or anyone for shared projects). DELETE (owner)."""
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def _get(self, request, pk, name):
        project = get_object_or_404(Project, pk=pk)
        if not project.visible_to(request.user):
            raise NotFound()
        return project, get_object_or_404(Asset, project=project, name=name)

    def get(self, request, pk, name):
        _, asset = self._get(request, pk, name)
        resp = FileResponse(asset.file.open("rb"), content_type=asset.content_type)
        resp["X-Content-Type-Options"] = "nosniff"
        resp["Content-Security-Policy"] = "default-src 'none'; sandbox"
        resp["Cross-Origin-Resource-Policy"] = "cross-origin"
        resp["Cache-Control"] = "private, max-age=300"
        return resp

    def delete(self, request, pk, name):
        project, asset = self._get(request, pk, name)
        if project.owner_id != request.user.pk:
            raise PermissionDenied()
        asset.delete()
        Project.objects.filter(pk=project.pk).update(updated_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)
