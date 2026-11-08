"""The JSON the site reads: exactly the shape of src/site/lessons.js, so the
frontend code that renders courses, topics and cards doesn't change."""
from rest_framework import serializers

from .models import Course, Lesson, Topic


class LessonSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()
    added = serializers.DateField(format="%Y-%m-%d", required=False, allow_null=True)

    class Meta:
        model = Lesson
        fields = ["slug", "title", "description", "file", "kind", "minutes", "added", "tags", "version", "published"]

    def get_file(self, obj):
        url = obj.file_url
        req = self.context.get("request")
        if url.startswith("/") and req is not None:   # dev: files served by Django itself
            url = req.build_absolute_uri(url)
        return url


class TopicSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="slug")
    lessons = serializers.SerializerMethodField()

    class Meta:
        model = Topic
        fields = ["id", "title", "lessons"]

    def get_lessons(self, obj):
        qs = obj.lessons.all()
        if not self.context.get("teacher"):
            qs = qs.filter(published=True)
        return LessonSerializer(qs, many=True, context=self.context).data


class CourseSerializer(serializers.ModelSerializer):
    topics = TopicSerializer(many=True, read_only=True)

    class Meta:
        model = Course
        fields = ["slug", "title", "tone", "blurb", "topics"]


class LessonUploadSerializer(serializers.Serializer):
    """POST /api/lessons/upload/ (multipart). Creates or replaces one lesson."""
    course = serializers.SlugField()
    topic = serializers.SlugField()
    topic_title = serializers.CharField(required=False, allow_blank=True)
    slug = serializers.SlugField()
    title = serializers.CharField(max_length=160)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    kind = serializers.ChoiceField(choices=[k for k, _ in Lesson.KINDS], default="lab")
    minutes = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=600)
    added = serializers.DateField(required=False, allow_null=True)
    tags = serializers.CharField(required=False, allow_blank=True, default="")  # comma separated
    version = serializers.CharField(required=False, allow_blank=True, default="")
    published = serializers.BooleanField(required=False, default=True)
    file = serializers.FileField(required=False)
    external_url = serializers.URLField(required=False, allow_blank=True, default="")

    def validate_file(self, f):
        if f.size > 6 * 1024 * 1024:
            raise serializers.ValidationError("Lesson files are at most 6 MB.")
        head = f.read(4096).lower()
        f.seek(0)
        if b"<html" not in head and b"<!doctype" not in head:
            raise serializers.ValidationError("That doesn't look like an HTML file.")
        return f
