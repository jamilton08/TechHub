from django.contrib import admin

from .models import Asset, Project, ProjectFile


class FileInline(admin.TabularInline):
    model = ProjectFile
    extra = 0
    fields = ("position", "name", "content")


class AssetInline(admin.TabularInline):
    model = Asset
    extra = 0
    fields = ("name", "content_type", "size", "file")
    readonly_fields = ("content_type", "size")


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "visibility", "version", "updated_at")
    list_filter = ("visibility",)
    search_fields = ("title", "id")
    readonly_fields = ("id", "version", "created_at", "updated_at", "remix_of")
    inlines = [FileInline, AssetInline]
