"""python manage.py test assignments lessons core"""
import json

from channels.db import database_sync_to_async
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import TransactionTestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from lessons.models import Course, Lesson, Topic

from .models import Assignment, Event, Member, Submission, Team
from .routing import websocket_urlpatterns

TEST_SETTINGS = {"CHANNEL_LAYERS": {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}}

ENVELOPE = {"hsct": 1, "kit": "1.2", "lesson": "demo-lesson", "title": "Demo", "student": "Ana Lopez", "finished": "2026-11-08T01:00:00Z", "badge": "ABCD-EFGH", "key": "k", "iv": "i", "data": "d"}


def make_lesson():
    c = Course.objects.create(slug="computer-science", title="Computer Science", tone="maroon")
    t = Topic.objects.create(course=c, slug="basics", title="Basics")
    l = Lesson.objects.create(topic=t, slug="demo-lesson", title="Demo lesson", kind="lab", minutes=30)
    l.file.save("demo-lesson.html", ContentFile(b"<!doctype html><html><body>hi</body></html>"))
    return l


def make_teacher():
    return get_user_model().objects.create_user("cruz", "x@y.z", "pw", is_staff=True)


@override_settings(**TEST_SETTINGS)
class StudentFlowTests(APITestCase):
    def setUp(self):
        self.lesson = make_lesson()
        self.a = Assignment.objects.create(lesson=self.lesson, title="Boss fight", group_mode=True, max_members=2, created_by=make_teacher())

    def test_open_assignments_for_lesson(self):
        r = self.client.get(reverse("assignments-open"), {"lesson": "demo-lesson"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]["title"], "Boss fight")
        self.assertEqual(r.data[0]["maxMembers"], 2)
        self.a.status = "closed"; self.a.save()
        self.assertEqual(self.client.get(reverse("assignments-open"), {"lesson": "demo-lesson"}).data, [])

    def test_create_join_full_and_rejoin(self):
        r = self.client.post(reverse("team-create"), {"assignment": str(self.a.id), "name": "Ana  Lopez", "team": "The Bytes"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        code, tok1 = r.data["team"]["code"], r.data["token"]
        self.assertEqual(r.data["member"]["name"], "Ana Lopez")
        self.assertEqual(r.data["team"]["name"], "The Bytes")
        self.assertRegex(code, r"^[A-Z0-9]{3}-[A-Z0-9]{3}$")

        r = self.client.post(reverse("team-join"), {"code": code.lower().replace("-", ""), "name": "Ben Ortiz", "role": "Programmer"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(len(r.data["team"]["members"]), 2)
        self.assertEqual(r.data["member"]["role"], "Programmer")

        r = self.client.post(reverse("team-join"), {"code": code, "name": "Cara Diaz"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("full", r.data["detail"])

        # Ana on another computer: same name → same member, counted as a rejoin
        r = self.client.post(reverse("team-join"), {"code": code, "name": "ana lopez"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data["rejoined"])
        self.assertEqual(r.data["token"], tok1)
        self.assertEqual(Member.objects.get(token=tok1).rejoins, 1)
        self.assertEqual(Event.objects.filter(kind="rejoin").count(), 1)

        r = self.client.post(reverse("team-join"), {"code": "ZZZ-ZZZ", "name": "Nobody Here"}, format="json")
        self.assertEqual(r.status_code, 404)

    def test_solo_assignment_is_a_team_of_one(self):
        self.a.group_mode = False; self.a.save()
        r = self.client.post(reverse("team-create"), {"assignment": str(self.a.id), "name": "Ana Lopez"}, format="json")
        code = r.data["team"]["code"]
        r = self.client.post(reverse("team-join"), {"code": code, "name": "Ben Ortiz"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_submit_marks_team_and_broadcast_shape(self):
        r = self.client.post(reverse("team-create"), {"assignment": str(self.a.id), "name": "Ana Lopez"}, format="json")
        code, tok = r.data["team"]["code"], r.data["token"]
        r = self.client.post(reverse("team-submit", args=[code]), {"token": tok, "envelope": ENVELOPE, "summary": {"earned": 18, "possible": 20, "tier": "Gold", "seconds": 900}}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        team = Team.objects.get(code=code)
        self.assertEqual(team.status, "submitted")
        self.assertEqual(team.percent, 90.0)
        self.assertEqual(Submission.objects.count(), 1)
        self.assertEqual(Submission.objects.get().student, "Ana Lopez")
        # same badge again is idempotent
        r = self.client.post(reverse("team-submit", args=[code]), {"token": tok, "envelope": ENVELOPE}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Submission.objects.count(), 1)
        # a save file is refused
        r = self.client.post(reverse("team-submit", args=[code]), {"token": tok, "envelope": {**ENVELOPE, "kind": "save", "badge": "X"}}, format="json")
        self.assertEqual(r.status_code, 400)
        # wrong token
        r = self.client.post(reverse("team-submit", args=[code]), {"token": "nope", "envelope": ENVELOPE}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_team_detail_needs_token(self):
        r = self.client.post(reverse("team-create"), {"assignment": str(self.a.id), "name": "Ana Lopez"}, format="json")
        code, tok = r.data["team"]["code"], r.data["token"]
        self.assertEqual(self.client.get(reverse("team-detail", args=[code])).status_code, 400)
        r = self.client.get(reverse("team-detail", args=[code]), {"token": tok})
        self.assertEqual(r.status_code, 200)
        self.assertIn("state", r.data["team"])


@override_settings(**TEST_SETTINGS)
class TeacherTests(APITestCase):
    def setUp(self):
        self.lesson = make_lesson()
        self.teacher = make_teacher()
        self.client.force_authenticate(self.teacher)

    def test_crud_and_board_and_log(self):
        r = self.client.post(reverse("assignments-list"), {"lesson": "demo-lesson", "title": "Boss fight", "klass": "Period 3", "group_mode": True, "max_members": 4}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        aid = r.data["id"]
        self.assertEqual(r.data["lessonTitle"], "Demo lesson")

        anon = APIClient()
        r = anon.post(reverse("team-create"), {"assignment": aid, "name": "Ana Lopez", "team": "Alpha"}, format="json")
        code, tok = r.data["team"]["code"], r.data["token"]
        anon.post(reverse("team-join"), {"code": code, "name": "Ben Ortiz"}, format="json")

        r = self.client.get(reverse("assignments-board", args=[aid]))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data["teams"]), 1)
        self.assertEqual(r.data["teams"][0]["code"], code)
        self.assertEqual([m["name"] for m in r.data["teams"][0]["members"]], ["Ana Lopez", "Ben Ortiz"])

        anon.post(reverse("team-submit", args=[code]), {"token": tok, "envelope": ENVELOPE, "summary": {"earned": 5, "possible": 10}}, format="json")
        r = self.client.get(reverse("assignments-submissions", args=[aid]))
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]["envelope"]["badge"], "ABCD-EFGH")
        self.assertEqual(r.data[0]["by"], "Ana Lopez")

        r = self.client.get(reverse("team-log", args=[code]))
        kinds = [e["kind"] for e in r.data["events"]]
        self.assertEqual(kinds, ["join", "join", "submit"])
        self.assertEqual(r.data["events"][1]["member"], "Ben Ortiz")

        r = self.client.patch(reverse("assignments-detail", args=[aid]), {"status": "closed"}, format="json")
        self.assertEqual(r.data["status"], "closed")
        r = self.client.post(reverse("team-close", args=[code]))
        self.assertEqual(r.data["status"], "closed")
        self.assertEqual(self.client.delete(reverse("assignments-detail", args=[aid])).status_code, 204)
        self.assertEqual(Team.objects.count(), 0)

    def test_students_cannot_use_teacher_endpoints(self):
        a = Assignment.objects.create(lesson=self.lesson, title="x")
        anon = APIClient()
        self.assertEqual(anon.get(reverse("assignments-list")).status_code, 403)
        self.assertEqual(anon.get(reverse("assignments-board", args=[a.id])).status_code, 403)
        self.assertEqual(anon.get(reverse("team-log", args=["AAA-AAA"])).status_code, 403)
        self.assertEqual(anon.post(reverse("lessons-upload")).status_code, 403)


@override_settings(**TEST_SETTINGS)
class TeamSocketTests(TransactionTestCase):
    """Two students in one room: events are relayed and stored, state syncs,
    a stale write gets the current state back, a submit reaches everyone."""

    def setUp(self):
        self.lesson = make_lesson()
        self.a = Assignment.objects.create(lesson=self.lesson, title="Boss fight", group_mode=True, max_members=4)
        self.team = Team.objects.create(assignment=self.a, name="Alpha")
        self.ana = Member.objects.create(team=self.team, name="Ana Lopez")
        self.ben = Member.objects.create(team=self.team, name="Ben Ortiz")
        self.app = URLRouter(websocket_urlpatterns)

    async def _connect(self, member):
        c = WebsocketCommunicator(self.app, f"/ws/team/{self.team.code}/?token={member.token}")
        ok, _ = await c.connect()
        self.assertTrue(ok)
        hello = await c.receive_json_from()
        self.assertEqual(hello["type"], "hello")
        return c, hello

    async def _drain_until(self, c, kind, limit=10):
        for _ in range(limit):
            m = await c.receive_json_from(timeout=2)
            if m["type"] == kind:
                return m
        self.fail(f"never got {kind}")

    async def test_room(self):
        c1, hello = await self._connect(self.ana)
        self.assertEqual(hello["you"]["name"], "Ana Lopez")
        self.assertEqual(hello["version"], 0)
        await self._drain_until(c1, "presence")  # Ana's own connect

        c2, _ = await self._connect(self.ben)
        p = await self._drain_until(c1, "presence")
        self.assertEqual([m["online"] for m in p["members"]], [True, True])

        # Ana logs an answer → Ben sees it, and it's stored against Ana
        await c1.send_json_to({"type": "event", "t": 12.5, "kind": "answer", "data": {"q": 1, "right": True}})
        e = await self._drain_until(c2, "event")
        self.assertEqual(e["member"]["name"], "Ana Lopez")
        self.assertEqual(e["data"]["q"], 1)
        n = await database_sync_to_async(Event.objects.filter(member=self.ana, kind="answer").count)()
        self.assertEqual(n, 1)

        # Ana shares state v0→v1; Ben receives it
        await c1.send_json_to({"type": "state", "version": 0, "state": {"i": 1}, "summary": {"earned": 5, "possible": 30, "label": "working"}})
        s = await self._drain_until(c2, "state")
        self.assertEqual(s["version"], 1)
        self.assertEqual(s["state"], {"i": 1})
        self.assertEqual(s["by"]["name"], "Ana Lopez")
        lb = await self._drain_until(c2, "leaderboard")
        self.assertEqual(lb["teams"][0]["percent"], 16.7)

        # Ben writes from a stale base (v0): he gets the current v1 back, nothing else changes
        await c2.send_json_to({"type": "state", "version": 0, "state": {"i": 99}})
        s = await self._drain_until(c2, "state")
        self.assertTrue(s.get("stale"))
        self.assertEqual(s["version"], 1)
        self.assertEqual(s["state"], {"i": 1})

        # status + heartbeat
        await c2.send_json_to({"type": "status", "phase": "work"})
        await c2.send_json_to({"type": "heartbeat", "activeSeconds": 42})
        await c2.send_json_to({"type": "ping"})
        await self._drain_until(c2, "pong")
        ben = await database_sync_to_async(Member.objects.get)(pk=self.ben.pk)
        self.assertEqual(ben.active_seconds, 42)
        team = await database_sync_to_async(Team.objects.get)(pk=self.team.pk)
        self.assertEqual(team.phase, "work")
        self.assertEqual(team.status, "working")

        await c1.disconnect()
        p = await self._drain_until(c2, "presence")
        self.assertEqual([m["online"] for m in p["members"]], [False, True])
        await c2.disconnect()

    async def test_bad_token_rejected(self):
        c = WebsocketCommunicator(self.app, f"/ws/team/{self.team.code}/?token=nope")
        ok, code = await c.connect()
        self.assertFalse(ok)
        self.assertEqual(code, 4401)
