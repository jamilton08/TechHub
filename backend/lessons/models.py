"""The lesson catalog, in the same three levels the site has always used:

    Course  → /lessons/<slug>            (IT Network, Computer Science, …)
    Topic   → a section on the course page
    Lesson  → /lessons/<course>/<lesson>  one self-contained HTML file

The HTML file itself lives in object storage (Cloudflare R2 on the server,
a folder on disk in dev) under <course>/<lesson>.html, and the site's iframe
loads it from LESSON_FILES_BASE (https://lessons.hsct.tech). Nothing here
stores anything about a student.
"""
from django.conf import settings
from django.core.files.storage import storages
from django.db import models


def lesson_storage():
    return storages["lessons"]


class Course(models.Model):
    TONES = [("blue", "blue"), ("maroon", "maroon"), ("peri", "peri"), ("ink", "ink")]
    slug = models.SlugField(max_length=60, unique=True)
    title = models.CharField(max_length=80)
    tone = models.CharField(max_length=12, choices=TONES, default="blue")
    blurb = models.TextField(blank=True, default="")
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "title"]

    def __str__(self):
        return self.title


class Topic(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="topics")
    slug = models.SlugField(max_length=60)  # the `id` the site uses for #anchors
    title = models.CharField(max_length=100)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]
        constraints = [models.UniqueConstraint(fields=["course", "slug"], name="lessons_unique_topic_slug")]

    def __str__(self):
        return f"{self.course.title} / {self.title}"


def lesson_file_path(instance, filename):
    return f"{instance.topic.course.slug}/{instance.slug}.html"


class Lesson(models.Model):
    KINDS = [("game", "Game"), ("lab", "Lab"), ("reading", "Reading"), ("quiz", "Quiz")]
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="lessons")
    slug = models.SlugField(max_length=80)  # == HSCT.lesson({ id }) inside the file
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True, default="")
    kind = models.CharField(max_length=10, choices=KINDS, default="lab")
    minutes = models.PositiveSmallIntegerField(null=True, blank=True)
    added = models.DateField(null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)
    version = models.CharField(max_length=20, blank=True, default="")  # mirrors the lesson's own version string
    file = models.FileField(upload_to=lesson_file_path, storage=lesson_storage, max_length=200, blank=True)
    external_url = models.URLField(blank=True, default="")  # a lesson hosted elsewhere, instead of a file
    published = models.BooleanField(default=True)
    position = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "id"]
        constraints = [models.UniqueConstraint(fields=["topic", "slug"], name="lessons_unique_lesson_slug")]

    def __str__(self):
        return self.title

    @property
    def course(self):
        return self.topic.course

    @property
    def file_url(self):
        """What the site's iframe loads. Empty = 'coming soon'."""
        if self.external_url:
            return self.external_url
        if not self.file:
            return ""
        base = settings.LESSON_FILES_BASE.rstrip("/")
        if base:
            return f"{base}/{self.file.name}"
        return self.file.url
