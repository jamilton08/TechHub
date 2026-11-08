"""REST side of assignments and teams.

Students (no account; a member `token` is their identity):
    GET  assignments/open/?lesson=<slug>   open assignments for a lesson
    POST teams/                            create a team  {assignment, name, team?, role?}
    POST teams/join/                       join one       {code, name, role?, token?}
    GET  teams/<code>/?token=…             the team, with its shared state (reconnects)
    POST teams/<code>/submit/              {token, envelope, summary}
    POST teams/<code>/leave/               {token}

Teachers (Django session, staff):
    GET/POST   assignments/                list / create
    GET/PATCH/DELETE assignments/<id>/
    GET  assignments/<id>/board/           every team, live-ish (the websocket pushes the same thing)
    GET  assignments/<id>/submissions/     the sealed envelopes, newest first
    GET  teams/<code>/log/                 members + every event: who did what
    POST teams/<code>/close/               close a team (no more joins or changes)
    DELETE teams/<code>/
"""
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from core.permissions import IsTeacher

from .models import Assignment, Member, Submission, Team
from .serializers import AssignmentWriteSerializer, CreateTeamSerializer, JoinTeamSerializer, MemberTokenSerializer, SubmitSerializer
from .services import assignment_json, board_json, leaderboard_json, member_json, push_board, push_presence, push_to_team, record_event, team_json


class JoinThrottle(AnonRateThrottle):
    rate = "60/min"


def joined_payload(member, team):
    """What the kit gets back from create/join/reconnect."""
    a = team.assignment
    return {
        "token": member.token,
        "member": member_json(member),
        "team": team_json(team, with_state=True),
        "assignment": assignment_json(a),
        "leaderboard": leaderboard_json(a) if a.show_leaderboard else None,
    }


# ── students ──────────────────────────────────────────────────────────

class OpenAssignmentsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        slug = request.query_params.get("lesson", "")
        qs = Assignment.objects.select_related("lesson__topic__course").filter(status=Assignment.Status.OPEN)
        if slug:
            qs = qs.filter(lesson__slug=slug)
        return Response([assignment_json(a) for a in qs if a.is_open])


class CreateTeamView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [JoinThrottle]

    @transaction.atomic
    def post(self, request):
        s = CreateTeamSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        a = get_object_or_404(Assignment.objects.select_related("lesson__topic__course"), pk=d["assignment"])
        if not a.is_open:
            return Response({"detail": "That assignment is not open."}, status=status.HTTP_400_BAD_REQUEST)
        team = Team.objects.create(assignment=a, name=(d.get("team") or "").strip()[:60])
        member = Member.objects.create(team=team, name=d["name"], role=(d.get("role") or "").strip()[:30], connections=0)
        record_event(team, member, 0, "join", {"created": True})
        push_board(a)
        return Response(joined_payload(member, team), status=status.HTTP_201_CREATED)


class JoinTeamView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [JoinThrottle]

    @transaction.atomic
    def post(self, request):
        s = JoinTeamSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        try:
            team = Team.objects.select_for_update().select_related("assignment__lesson__topic__course").get(code=d["code"])
        except Team.DoesNotExist:
            return Response({"detail": "No team has that code. Check it with your teammates."}, status=status.HTTP_404_NOT_FOUND)
        a = team.assignment
        if team.status == Team.Status.CLOSED:
            return Response({"detail": "That team was closed by the teacher."}, status=status.HTTP_400_BAD_REQUEST)
        member = None
        rejoined = False
        # same browser coming back (the kit keeps the token)
        if d.get("token"):
            member = team.members.filter(token=d["token"]).first()
        # same student on another computer: same name, case-insensitive
        if member is None:
            member = team.members.filter(name__iexact=d["name"]).first()
            if member is not None:
                rejoined = True
        if member is None:
            if not a.is_open:
                return Response({"detail": "That assignment is not open any more."}, status=status.HTTP_400_BAD_REQUEST)
            if team.status == Team.Status.SUBMITTED:
                return Response({"detail": "That team already submitted. Ask your teacher."}, status=status.HTTP_400_BAD_REQUEST)
            active = team.members.filter(left_at__isnull=True).count()
            if active >= (a.max_members if a.group_mode else 1):
                return Response({"detail": f"That team is full ({a.max_members} students)."}, status=status.HTTP_400_BAD_REQUEST)
            member = Member.objects.create(team=team, name=d["name"], role=(d.get("role") or "").strip()[:30])
            record_event(team, member, 0, "join")
        else:
            if member.left_at:
                member.left_at = None
            if d.get("role"):
                member.role = d["role"].strip()[:30]
            member.last_seen = timezone.now()
            if rejoined:
                member.rejoins += 1
            member.save()
            if rejoined:
                record_event(team, member, 0, "rejoin")
        push_presence(team)
        push_board(a)
        out = joined_payload(member, team)
        out["rejoined"] = rejoined
        return Response(out)


class TeamView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, code):
        s = MemberTokenSerializer(data={"token": request.query_params.get("token", "")})
        s.is_valid(raise_exception=True)
        member = s.validated_data["token"]
        if member.team.code != code:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(joined_payload(member, member.team))


class SubmitView(APIView):
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def post(self, request, code):
        s = SubmitSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        member = Member.objects.select_related("team__assignment").filter(token=d["token"]).first()
        if member is None or member.team.code != code:
            return Response({"detail": "Not a member of that team."}, status=status.HTTP_403_FORBIDDEN)
        team = Team.objects.select_for_update().get(pk=member.team_id)
        if team.status == Team.Status.CLOSED:
            return Response({"detail": "That team is closed."}, status=status.HTTP_400_BAD_REQUEST)
        env = d["envelope"]
        sub, created = Submission.objects.get_or_create(
            assignment=team.assignment, badge=str(env.get("badge"))[:12],
            defaults={"team": team, "member": member, "student": str(env.get("student", ""))[:60], "envelope": env, "summary": d.get("summary")},
        )
        now = timezone.now()
        if team.status != Team.Status.SUBMITTED:
            team.status = Team.Status.SUBMITTED
            team.submitted_at = now
            team.phase = "end"
        summ = d.get("summary") or {}
        if isinstance(summ, dict) and summ.get("possible"):
            team.progress = {"earned": summ.get("earned"), "possible": summ.get("possible"), "label": summ.get("tier") or "Submitted"}
        team.last_activity = now
        team.save()
        record_event(team, member, (summ.get("seconds") if isinstance(summ, dict) else 0) or 0, "submit", {"badge": sub.badge})
        push_to_team(team, {"type": "submitted", "badge": sub.badge, "by": member_json(member), "at": now.isoformat(), "envelope": env, "summary": d.get("summary")})
        push_board(team.assignment)
        return Response({"ok": True, "badge": sub.badge, "created": created, "team": team_json(team)}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class LeaveView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, code):
        s = MemberTokenSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        member = s.validated_data["token"]
        if member.team.code != code:
            return Response(status=status.HTTP_404_NOT_FOUND)
        member.left_at = timezone.now()
        member.save(update_fields=["left_at"])
        record_event(member.team, member, 0, "leave")
        push_presence(member.team)
        push_board(member.team.assignment)
        return Response({"ok": True})


# ── teachers ──────────────────────────────────────────────────────────

class AssignmentListView(APIView):
    permission_classes = [IsTeacher]

    def get(self, request):
        qs = Assignment.objects.select_related("lesson__topic__course")
        return Response([assignment_json(a, teacher=True) for a in qs])

    def post(self, request):
        s = AssignmentWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        a = s.save(created_by=request.user)
        return Response(assignment_json(a, teacher=True), status=status.HTTP_201_CREATED)


class AssignmentDetailView(APIView):
    permission_classes = [IsTeacher]

    def get(self, request, pk):
        a = get_object_or_404(Assignment.objects.select_related("lesson__topic__course"), pk=pk)
        return Response(assignment_json(a, teacher=True))

    def patch(self, request, pk):
        a = get_object_or_404(Assignment, pk=pk)
        s = AssignmentWriteSerializer(a, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        a = s.save()
        push_board(a)
        return Response(assignment_json(a, teacher=True))

    def delete(self, request, pk):
        a = get_object_or_404(Assignment, pk=pk)
        a.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BoardView(APIView):
    permission_classes = [IsTeacher]

    def get(self, request, pk):
        a = get_object_or_404(Assignment.objects.select_related("lesson__topic__course"), pk=pk)
        return Response(board_json(a))


class SubmissionsView(APIView):
    permission_classes = [IsTeacher]

    def get(self, request, pk):
        a = get_object_or_404(Assignment, pk=pk)
        subs = a.submissions.select_related("team", "member")
        return Response([{
            "id": str(s.id), "badge": s.badge, "student": s.student, "summary": s.summary,
            "team": s.team.code if s.team else None, "teamName": s.team.display_name if s.team else None,
            "by": s.member.name if s.member else None, "createdAt": s.created_at.isoformat(), "envelope": s.envelope,
        } for s in subs])


class TeamLogView(APIView):
    permission_classes = [IsTeacher]

    def get(self, request, code):
        team = get_object_or_404(Team.objects.select_related("assignment__lesson"), code=code)
        events = team.events.select_related("member").order_by("id")
        return Response({
            "team": team_json(team, full=True),
            "assignment": assignment_json(team.assignment),
            "events": [{"id": e.id, "t": e.t, "kind": e.kind, "data": e.data, "at": e.created_at.isoformat(), "member": e.member.name if e.member else None, "memberId": str(e.member_id) if e.member_id else None} for e in events],
            "submissions": [{"badge": s.badge, "student": s.student, "by": s.member.name if s.member else None, "createdAt": s.created_at.isoformat(), "summary": s.summary, "envelope": s.envelope} for s in team.submissions.select_related("member")],
        })


class TeamCloseView(APIView):
    permission_classes = [IsTeacher]

    def post(self, request, code):
        team = get_object_or_404(Team, code=code)
        team.status = Team.Status.CLOSED
        team.save(update_fields=["status"])
        push_to_team(team, {"type": "closed", "reason": "Your teacher closed this team."})
        push_board(team.assignment)
        return Response(team_json(team, full=True))

    def delete(self, request, code):
        team = get_object_or_404(Team, code=code)
        a = team.assignment
        push_to_team(team, {"type": "closed", "reason": "Your teacher removed this team."})
        team.delete()
        push_board(a)
        return Response(status=status.HTTP_204_NO_CONTENT)
