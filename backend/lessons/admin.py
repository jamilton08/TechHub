from django.contrib import admin

from .models import Course, Lesson, Topic


class TopicInline(admin.TabularInline):
    model = Topic
    extra = 0
    fields = ["slug", "title", "position"]


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ["title", "slug", "tone", "position"]
    list_editable = ["position"]
    inlines = [TopicInline]


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ["title", "slug", "topic", "kind", "minutes", "added", "published", "position"]
    list_filter = ["topic__course", "kind", "published"]
    list_editable = ["published", "position"]
    search_fields = ["title", "slug", "description"]
    readonly_fields = ["file_url", "created_at", "updated_at"]
