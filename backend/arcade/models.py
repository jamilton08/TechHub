"""Python Arcade projects.

A project belongs to one user. Nothing here stores a student's name — only
the owner foreign key, so whatever your user model holds (an anonymous id
mapped from Google sign-in, say) is the only link to a person.
"""
import uuid

from django.conf import settings
from django.db import models


class Project(models.Model):
    class Visibility(models.TextChoices):
        PRIVATE = "private", "Only the owner"
        UNLISTED = "unlisted", "Anyone with the link"
        PUBLIC = "public", "Listed in the gallery"

    # The browser makes the id, so a project keeps it when it moves from
    # "saved in this browser" to "saved to your account".
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="arcade_projects")
    title = models.CharField(max_length=80, default="Untitled game")
    entry = models.CharField(max_length=60, default="main.py")
    visibility = models.CharField(max_length=10, choices=Visibility.choices, default=Visibility.PRIVATE)
    remix_of = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="remixes")
    # Bumped by every save of the code. A save must name the version it was
    # based on; if someone saved in between (another tab or computer) it's a 409.
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["owner", "-updated_at"]), models.Index(fields=["visibility", "-updated_at"])]

    def __str__(self):
        return f"{self.title} ({self.id})"

    def visible_to(self, user):
        return self.visibility != self.Visibility.PRIVATE or (user.is_authenticated and user.pk == self.owner_id)


class ProjectFile(models.Model):
    """A code or text file (main.py, helper.py, levels.txt…)."""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="files")
    name = models.CharField(max_length=60)
    content = models.TextField(blank=True, default="")
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]
        constraints = [models.UniqueConstraint(fields=["project", "name"], name="arcade_unique_file_name")]

    def __str__(self):
        return self.name


def asset_path(instance, filename):
    # a random prefix keeps names unguessable and avoids collisions
    return f"arcade/{instance.project_id}/{uuid.uuid4().hex[:12]}-{instance.name}"


class Asset(models.Model):
    """An image, sound or font a project loads by name."""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="assets")
    name = models.CharField(max_length=60)
    file = models.FileField(upload_to=asset_path, max_length=200)
    content_type = models.CharField(max_length=40)
    size = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["project", "name"], name="arcade_unique_asset_name")]

    def __str__(self):
        return self.name
