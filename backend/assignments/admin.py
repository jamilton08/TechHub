from django.contrib import admin

from .models import Assignment, Event, Member, Submission, Team


class MemberInline(admin.TabularInline):
    model = Member
    extra = 0
    fields = ["name", "role", "joined_at", "left_at", "last_seen", "connections", "active_seconds", "event_count"]
    readonly_fields = ["joined_at", "last_seen", "connections", "active_seconds", "event_count"]


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ["title", "lesson", "klass", "group_mode", "max_members", "status", "due_at", "created_at"]
    list_filter = ["status", "group_mode", "lesson__topic__course"]
    search_fields = ["title", "klass"]


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "assignment", "status", "phase", "percent", "started_at", "submitted_at"]
    list_filter = ["status", "assignment"]
    search_fields = ["code", "name"]
    inlines = [MemberInline]
    readonly_fields = ["state_version", "created_at"]


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ["team", "member", "t", "kind", "created_at"]
    list_filter = ["kind"]
    raw_id_fields = ["team", "member"]


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ["badge", "student", "assignment", "team", "created_at"]
    search_fields = ["badge", "student"]
    readonly_fields = ["envelope", "summary", "created_at"]
