"""Shared logic for the REST views and the websocket consumers: how a team,
a member and a board look as JSON, and how to push updates to the rooms."""
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Count
from django.utils import timezone

from .models import Assignment, Event, Member, Team


def team_group(code):
    return f"team_{code}"


def assignment_group(assignment_id):
    return f"assignment_{assignment_id}"


# ── JSON shapes ───────────────────────────────────────────────────────

def member_json(m, full=False):
    d = {
        "id": str(m.id), "name": m.name, "role": m.role,
        "online": m.online, "joinedAt": m.joined_at.isoformat(),
        "events": m.event_count, "activeSeconds": m.active_seconds,
    }
    if m.left_at:
        d["leftAt"] = m.left_at.isoformat()
    if full:
        d["lastSeen"] = m.last_seen.isoformat()
        d["rejoins"] = m.rejoins
    return d


def assignment_json(a, teacher=False):
    d = {
        "id": str(a.id), "title": a.title, "instructions": a.instructions, "klass": a.klass,
        "lesson": a.lesson.slug, "lessonTitle": a.lesson.title, "course": a.lesson.topic.course.slug,
        "groupMode": a.group_mode, "maxMembers": a.max_members if a.group_mode else 1,
        "opensAt": a.opens_at.isoformat() if a.opens_at else None,
        "dueAt": a.due_at.isoformat() if a.due_at else None,
        "status": a.status, "isOpen": a.is_open, "showLeaderboard": a.show_leaderboard,
        "createdAt": a.created_at.isoformat(),
    }
    if teacher:
        d["teams"] = a.teams.count()
        d["submitted"] = a.teams.filter(status=Team.Status.SUBMITTED).count()
    return d


def team_json(team, full=False, with_state=False):
    members = list(team.members.all())
    d = {
        "code": team.code, "name": team.display_name, "status": team.status, "phase": team.phase,
        "startedAt": team.started_at.isoformat(), "elapsedSeconds": team.elapsed_seconds,
        "submittedAt": team.submitted_at.isoformat() if team.submitted_at else None,
        "version": team.state_version, "progress": team.progress, "percent": team.percent,
        "members": [member_json(m, full=full) for m in members],
        "online": sum(1 for m in members if m.online),
    }
    if with_state:
        d["state"] = team.state
    if full:
        d["lastActivity"] = team.last_activity.isoformat()
        d["events"] = team.events.count()
    return d


def leaderboard_json(assignment):
    """What students see: team names and progress, never codes or member names."""
    teams = assignment.teams.prefetch_related("members").exclude(status=Team.Status.CLOSED)
    rows = []
    for t in teams:
        rows.append({
            "name": t.display_name, "status": t.status, "phase": t.phase,
            "members": t.members.filter(left_at__isnull=True).count(), "online": sum(1 for m in t.members.all() if m.online),
            "percent": t.percent, "label": (t.progress or {}).get("label"),
            "elapsedSeconds": t.elapsed_seconds, "submittedAt": t.submitted_at.isoformat() if t.submitted_at else None,
        })
    rows.sort(key=lambda r: (-(r["percent"] or 0), r["status"] != "submitted", r["elapsedSeconds"]))
    return rows


def board_json(assignment):
    """What the teacher sees: everything, live."""
    teams = assignment.teams.prefetch_related("members").annotate(n_events=Count("events"))
    out = []
    for t in teams:
        d = team_json(t, full=True)
        d["events"] = t.n_events
        out.append(d)
    return {"assignment": assignment_json(assignment, teacher=True), "teams": out, "at": timezone.now().isoformat()}


# ── pushes ────────────────────────────────────────────────────────────

def _send(group, message):
    layer = get_channel_layer()
    if layer is None:
        return
    async_to_sync(layer.group_send)(group, message)


def push_to_team(team, payload):
    """Send one JSON message to every socket in the team's room."""
    _send(team_group(team.code), {"type": "room.message", "payload": payload})


def push_board(assignment):
    """The teacher's live board, and (if allowed) the leaderboard to every team in it."""
    board = board_json(assignment)
    _send(assignment_group(assignment.id), {"type": "room.message", "payload": {"type": "board", **board}})
    if assignment.show_leaderboard:
        rows = leaderboard_json(assignment)
        for t in board["teams"]:
            _send(team_group(t["code"]), {"type": "room.message", "payload": {"type": "leaderboard", "teams": rows}})


def push_presence(team):
    push_to_team(team, {"type": "presence", "members": [member_json(m) for m in team.members.all()], "status": team.status})


# ── actions used by both REST and websocket code ──────────────────────

def record_event(team, member, t, kind, data=None, cap=None):
    """Store one event (up to the cap) and count it on the member."""
    from django.conf import settings
    cap = cap or settings.TEAM_EVENT_CAP
    stored = False
    if team.events.count() < cap:
        Event.objects.create(team=team, member=member, t=float(t or 0), kind=str(kind)[:40], data=data)
        stored = True
    if member is not None:
        Member.objects.filter(pk=member.pk).update(event_count=member.event_count + 1, last_seen=timezone.now())
        member.event_count += 1
    Team.objects.filter(pk=team.pk).update(last_activity=timezone.now())
    return stored


def touch_status(team, phase=None):
    """Move a fresh team to 'working' once someone starts; record the phase the kit reports."""
    changed = False
    if phase and phase != team.phase and phase in ("intro", "work", "end"):
        team.phase = phase
        changed = True
    if team.status == Team.Status.OPEN and phase in ("work", "end"):
        team.status = Team.Status.WORKING
        changed = True
    if changed:
        team.save(update_fields=["phase", "status"])
    return changed
