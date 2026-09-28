"""JSON shapes. Field names are camelCase to match the frontend
(src/arcade/store/model.js) exactly."""
from django.db import transaction
from django.urls import reverse
from rest_framework import serializers

from . import rules
from .models import Project, ProjectFile


class FileSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=rules.MAX_NAME)
    content = serializers.CharField(allow_blank=True, trim_whitespace=False, max_length=rules.MAX_FILE_CHARS)

    def validate_name(self, value):
        problem = rules.file_name_problem(value)
        if problem:
            raise serializers.ValidationError(problem)
        return value


class AssetSerializer(serializers.Serializer):
    name = serializers.CharField()
    type = serializers.CharField(source="content_type")
    size = serializers.IntegerField()
    url = serializers.SerializerMethodField()

    def get_url(self, asset):
        # A path, not a full URL: behind a TLS-terminating proxy Django may think
        # it's on http://, and the browser would block that as mixed content.
        return reverse("arcade:asset", kwargs={"pk": asset.project_id, "name": asset.name})


class ProjectListSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    fileCount = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ["id", "title", "visibility", "createdAt", "updatedAt", "fileCount"]

    def get_fileCount(self, p):
        # annotated in the view to avoid a query per row
        return getattr(p, "file_count", 0) + getattr(p, "asset_count", 0)


class ProjectSerializer(serializers.ModelSerializer):
    """One project, in full. Used for create (POST), save (PUT) and PATCH."""
    id = serializers.UUIDField(required=False)
    files = FileSerializer(many=True, required=False)
    assets = AssetSerializer(many=True, read_only=True)
    remixOf = serializers.PrimaryKeyRelatedField(source="remix_of", queryset=Project.objects.all(), required=False, allow_null=True)
    version = serializers.IntegerField(required=False)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    isOwner = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ["id", "title", "entry", "files", "assets", "visibility", "remixOf", "version",
                  "createdAt", "updatedAt", "isOwner"]

    def get_isOwner(self, p):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and request.user.pk == p.owner_id)

    def validate_title(self, value):
        return (value or "").strip()[: rules.MAX_TITLE] or "Untitled game"

    def validate_remixOf(self, value):
        request = self.context.get("request")
        if value is not None and request and not value.visible_to(request.user):
            raise serializers.ValidationError("That project isn't shared.")
        return value

    def validate(self, attrs):
        files = attrs.get("files")
        if files is not None:
            if not files:
                raise serializers.ValidationError({"files": "A project needs at least one file."})
            if len(files) > rules.MAX_FILES:
                raise serializers.ValidationError({"files": f"A project can have up to {rules.MAX_FILES} files."})
            names = [f["name"] for f in files]
            if len({n.lower() for n in names}) != len(names):
                raise serializers.ValidationError({"files": "Two files have the same name."})
        entry = attrs.get("entry", getattr(self.instance, "entry", "main.py"))
        known = [f["name"] for f in files] if files is not None else (
            list(self.instance.files.values_list("name", flat=True)) if self.instance else [])
        if files is not None or "entry" in attrs:
            if not entry.endswith(".py") or entry not in known:
                raise serializers.ValidationError({"entry": "The main file must be one of the project's .py files."})
        return attrs

    @staticmethod
    def _write_files(project, files):
        project.files.all().delete()
        ProjectFile.objects.bulk_create(
            ProjectFile(project=project, name=f["name"], content=f["content"], position=i) for i, f in enumerate(files)
        )

    @transaction.atomic
    def create(self, validated):
        files = validated.pop("files", None) or [{"name": "main.py", "content": ""}]
        validated.pop("version", None)
        project = Project.objects.create(**validated)
        self._write_files(project, files)
        return project

    @transaction.atomic
    def update(self, project, validated):
        files = validated.pop("files", None)
        validated.pop("version", None)
        validated.pop("id", None)
        validated.pop("remix_of", None)
        for key, value in validated.items():
            setattr(project, key, value)
        if files is not None:
            self._write_files(project, files)
            project.version += 1
        project.save()
        return project
