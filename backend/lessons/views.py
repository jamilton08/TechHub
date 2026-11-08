from django.db import transaction
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsTeacher

from .models import Course, Lesson, Topic
from .serializers import CourseSerializer, LessonSerializer, LessonUploadSerializer


class CatalogView(APIView):
    """GET /api/lessons/ — every course with its topics and lessons, in site order.
    Teachers also see unpublished lessons (flagged `published: false`)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        teacher = bool(request.user.is_authenticated and request.user.is_staff)
        qs = Course.objects.prefetch_related("topics__lessons")
        return Response({"categories": CourseSerializer(qs, many=True, context={"teacher": teacher, "request": request}).data})


class LessonUploadView(APIView):
    """POST /api/lessons/upload/ — teacher adds or replaces a lesson (multipart).
    The HTML goes to storage as <course>/<slug>.html; the catalog entry is
    created or updated. A missing topic is created from `topic_title`."""
    permission_classes = [IsTeacher]
    parser_classes = [MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request):
        s = LessonUploadSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        try:
            course = Course.objects.get(slug=d["course"])
        except Course.DoesNotExist:
            return Response({"detail": f"No course '{d['course']}'. Make it in /admin/ first."}, status=status.HTTP_400_BAD_REQUEST)
        topic, _ = Topic.objects.get_or_create(
            course=course, slug=d["topic"],
            defaults={"title": d.get("topic_title") or d["topic"].replace("-", " ").capitalize(), "position": topic_next_position(course)},
        )
        lesson, created = Lesson.objects.get_or_create(topic=topic, slug=d["slug"], defaults={"title": d["title"], "position": lesson_next_position(topic)})
        if not created and lesson.topic_id != topic.id:
            lesson.topic = topic
        lesson.title = d["title"]
        lesson.description = d.get("description", "")
        lesson.kind = d.get("kind", "lab")
        lesson.minutes = d.get("minutes")
        if d.get("added"):
            lesson.added = d["added"]
        elif created:
            from django.utils import timezone
            lesson.added = timezone.localdate()
        lesson.tags = [t.strip() for t in str(d.get("tags", "")).split(",") if t.strip()]
        lesson.version = d.get("version", "")
        lesson.published = d.get("published", True)
        lesson.external_url = d.get("external_url", "")
        f = d.get("file")
        if f is not None:
            if lesson.file:
                lesson.file.storage.delete(lesson.file.name)   # same key, new bytes
            lesson.file.save(f"{d['slug']}.html", f, save=False)
        elif not lesson.file and not lesson.external_url:
            return Response({"detail": "Upload the lesson's HTML file (or give an external URL)."}, status=status.HTTP_400_BAD_REQUEST)
        lesson.save()
        return Response({"created": created, "course": course.slug, "topic": topic.slug, "lesson": LessonSerializer(lesson, context={"request": request}).data}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class LessonDeleteView(APIView):
    permission_classes = [IsTeacher]

    def delete(self, request, course, slug):
        try:
            lesson = Lesson.objects.get(topic__course__slug=course, slug=slug)
        except Lesson.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if lesson.file:
            lesson.file.delete(save=False)
        lesson.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def topic_next_position(course):
    last = course.topics.order_by("-position").first()
    return (last.position + 1) if last else 0


def lesson_next_position(topic):
    last = topic.lessons.order_by("-position").first()
    return (last.position + 1) if last else 0
