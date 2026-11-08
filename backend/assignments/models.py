"""Assignments and teams.

    Assignment  a lesson posted to a class, with a window and a team size.
    Team        a room with a join code. Solo work is a team of one. The team
                holds the lesson's shared state (what every member's screen
                shows) and its own clock.
    Member      a student in a team: a name and a secret rejoin token. No
                account, no email.
    Event       one thing one member did (every HSCT.log call), with the
                lesson clock and the server clock. "Who did what."
    Submission  the sealed .hsct envelope the team turned in (encrypted to the
                teacher's key, so the server can't read the score) plus the
                clear summary the kit sends with it for the board.
"""
import secrets
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"


def make_code():
    s = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
    return f"{s[:3]}-{s[3:]}"


def make_token():
    return secrets.token_urlsafe(24)


class Assignment(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lesson = models.ForeignKey("lessons.Lesson", on_delete=models.PROTECT, related_name="assignments")
    title = models.CharField(max_length=160)
    instructions = models.TextField(blank=True, default="")
    klass = models.CharField("class", max_length=80, blank=True, default="")  # free text: "Period 3", "Web/Game Design"
    group_mode = models.BooleanField(default=True)
    max_members = models.PositiveSmallIntegerField(default=4)
    opens_at = models.DateTimeField(null=True, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    show_leaderboard = models.BooleanField(default=True)  # students see other teams' progress
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="assignments")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    @property
    def is_open(self):
        now = timezone.now()
        if self.status != self.Status.OPEN:
            return False
        if self.opens_at and now < self.opens_at:
            return False
        if self.due_at and now > self.due_at:
            return False
        return True


class Team(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"            # made, nobody has started the work yet
        WORKING = "working", "Working"
        SUBMITTED = "submitted", "Submitted"
        CLOSED = "closed", "Closed"      # teacher closed it

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="teams")
    code = models.CharField(max_length=7, unique=True, default=make_code)
    name = models.CharField(max_length=60, blank=True, default="")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    # the lesson's shared state: whatever HSCT.saveable({ get }) returns, last write wins
    state = models.JSONField(null=True, blank=True)
    state_version = models.PositiveIntegerField(default=0)
    # { earned, possible, label } from the lesson's summary(), for the board
    progress = models.JSONField(null=True, blank=True)
    phase = models.CharField(max_length=10, blank=True, default="")  # intro | work | end, as reported by the kit
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(default=timezone.now)  # the team clock
    submitted_at = models.DateTimeField(null=True, blank=True)
    last_activity = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["assignment", "status"])]

    def __str__(self):
        return f"{self.display_name} ({self.code})"

    @property
    def display_name(self):
        return self.name or f"Team {self.code}"

    @property
    def elapsed_seconds(self):
        end = self.submitted_at or timezone.now()
        return max(0, int((end - self.started_at).total_seconds()))

    @property
    def percent(self):
        p = self.progress or {}
        try:
            poss = float(p.get("possible") or 0)
            return round(100 * float(p.get("earned") or 0) / poss, 1) if poss else None
        except (TypeError, ValueError):
            return None


class Member(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="members")
    name = models.CharField(max_length=60)
    role = models.CharField(max_length=30, blank=True, default="")  # Programmer / Presenter / Project Manager / …
    token = models.CharField(max_length=48, unique=True, default=make_token)
    joined_at = models.DateTimeField(auto_now_add=True)
    left_at = models.DateTimeField(null=True, blank=True)
    last_seen = models.DateTimeField(default=timezone.now)
    connections = models.PositiveSmallIntegerField(default=0)  # open sockets right now
    active_seconds = models.PositiveIntegerField(default=0)    # tab-visible time, reported by the kit
    event_count = models.PositiveIntegerField(default=0)
    rejoins = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["joined_at"]

    def __str__(self):
        return self.name

    @property
    def online(self):
        return self.connections > 0 and self.left_at is None


class Event(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="events")
    member = models.ForeignKey(Member, null=True, on_delete=models.SET_NULL, related_name="events")
    t = models.FloatField(default=0)  # seconds on the lesson clock
    kind = models.CharField(max_length=40)
    data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        indexes = [models.Index(fields=["team", "id"])]


class Submission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="submissions")
    team = models.ForeignKey(Team, null=True, on_delete=models.SET_NULL, related_name="submissions")
    member = models.ForeignKey(Member, null=True, on_delete=models.SET_NULL, related_name="submissions")
    student = models.CharField(max_length=60, blank=True, default="")  # the envelope's clear `student` field
    badge = models.CharField(max_length=12, db_index=True)
    envelope = models.JSONField()  # the whole .hsct file: encrypted to the teacher's key
    summary = models.JSONField(null=True, blank=True)  # { earned, possible, percent, tier, seconds, activeSeconds } — clear, unverified
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.badge} {self.student}"
