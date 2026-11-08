"""Websockets.

Team room  —  wss://api.hsct.tech/ws/team/<CODE>/?token=<member token>
  server → client
    hello        { team, assignment, members, you, state, version, leaderboard }
    presence     { members, status }                      someone joined / left / (dis)connected
    event        { member, t, kind, data, at }            a teammate did something (HSCT.log)
    state        { version, state, summary, by, stale? }  the shared lesson state changed
    leaderboard  { teams }                                other teams' progress
    submitted    { badge, by, at, envelope, summary }     the team turned in; everyone can download
    closed       { reason }
    error        { detail }
  client → server
    event        { t, kind, data }
    state        { version, state, summary }               version = the one this change was based on
    status       { phase }                                 intro | work | end
    heartbeat    { activeSeconds }                         every ~15 s
    pos          { map, x, y, facing, look, ... }          (kit 1.3) where this member's character is —
                                                           RELAYED to the room as pos {member, ...}, never stored
    ping         {}                                        → pong

Teacher board  —  wss://api.hsct.tech/ws/assignment/<id>/   (Django session, staff)
  server → client
    board        { assignment, teams, at }                 whenever anything in it changes
"""
import json
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Assignment, Member, Team
from .services import assignment_group, assignment_json, board_json, leaderboard_json, member_json, push_board, push_presence, push_to_team, record_event, team_group, team_json, touch_status

STATE_MAX_BYTES = 400_000


class TeamConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.code = self.scope["url_route"]["kwargs"]["code"]
        qs = parse_qs(self.scope.get("query_string", b"").decode())
        token = (qs.get("token") or [""])[0]
        self.member_id = None
        ok = await self._attach(token)
        if not ok:
            await self.close(code=4401)
            return
        self.group = team_group(self.code)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        hello = await self._hello()
        await self.send_json(hello)
        await self._presence_changed()

    async def disconnect(self, close_code):
        if self.member_id is not None:
            await self._detach()
            await self.channel_layer.group_discard(self.group, self.channel_name)
            await self._presence_changed()

    async def receive_json(self, msg, **kwargs):
        if not isinstance(msg, dict):
            return
        kind = msg.get("type")
        if kind == "ping":
            await self.send_json({"type": "pong"})
        elif kind == "heartbeat":
            await self._heartbeat(msg.get("activeSeconds"))
        elif kind == "event":
            await self._event(msg)
        elif kind == "state":
            await self._state(msg)
        elif kind == "status":
            await self._status(msg.get("phase"))
        elif kind == "pos":
            await self._pos(msg)
        else:
            await self.send_json({"type": "error", "detail": f"Unknown message type {kind!r}"})

    # a message pushed to the room by anyone (views or other sockets)
    async def room_message(self, event):
        await self.send_json(event["payload"])

    # ── live positions (kit 1.3 / world kit 0.4): relay only, no database ──
    POS_KEYS = ("map", "x", "y", "facing", "moving", "look", "driving", "car", "in")
    POS_MIN_INTERVAL = 0.04  # 25/s per socket is plenty; anything faster is dropped

    async def _pos(self, msg):
        import time
        now = time.monotonic()
        if now - getattr(self, "_last_pos", 0) < self.POS_MIN_INTERVAL:
            return
        self._last_pos = now
        payload = {"type": "pos", "member": {"id": str(self.member_id), "name": self.member_name}}
        for k in self.POS_KEYS:
            if k in msg:
                v = msg[k]
                if isinstance(v, (str, int, float, bool)) or v is None or (k == "look" and isinstance(v, dict) and len(v) <= 8):
                    payload[k] = v if not isinstance(v, str) else v[:60]
        await self.channel_layer.group_send(self.group, {"type": "room.message", "payload": payload})

    # ── db helpers ───────────────────────────────────────────────────

    @database_sync_to_async
    def _attach(self, token):
        try:
            m = Member.objects.select_related("team").get(token=token, team__code=self.code)
        except Member.DoesNotExist:
            return False
        if m.team.status == Team.Status.CLOSED:
            return False
        self.member_id = m.pk
        self.member_name = m.name
        self.team_id = m.team_id
        self.assignment_id = m.team.assignment_id
        Member.objects.filter(pk=m.pk).update(connections=m.connections + 1, last_seen=timezone.now(), left_at=None)
        return True

    @database_sync_to_async
    def _detach(self):
        m = Member.objects.filter(pk=self.member_id).first()
        if m:
            Member.objects.filter(pk=m.pk).update(connections=max(0, m.connections - 1), last_seen=timezone.now())

    @database_sync_to_async
    def _hello(self):
        team = Team.objects.select_related("assignment__lesson__topic__course").prefetch_related("members").get(pk=self.team_id)
        me = team.members.get(pk=self.member_id)
        a = team.assignment
        return {
            "type": "hello",
            "team": team_json(team, with_state=True), "assignment": assignment_json(a),
            "members": [member_json(m) for m in team.members.all()], "you": member_json(me),
            "state": team.state, "version": team.state_version,
            "leaderboard": leaderboard_json(a) if a.show_leaderboard else None,
            "serverTime": timezone.now().isoformat(),
        }

    @database_sync_to_async
    def _presence_changed(self):
        team = Team.objects.prefetch_related("members").get(pk=self.team_id)
        push_presence(team)
        push_board(team.assignment)

    @database_sync_to_async
    def _heartbeat(self, active):
        try:
            active = max(0, int(active or 0))
        except (TypeError, ValueError):
            active = 0
        Member.objects.filter(pk=self.member_id).update(active_seconds=active, last_seen=timezone.now())

    @database_sync_to_async
    def _event(self, msg):
        team = Team.objects.get(pk=self.team_id)
        me = Member.objects.get(pk=self.member_id)
        data = msg.get("data")
        if data is not None and len(json.dumps(data)) > 20_000:
            data = {"_truncated": True}
        try:
            t = float(msg.get("t") or 0)
        except (TypeError, ValueError):
            t = 0.0
        record_event(team, me, t, msg.get("kind") or "event", data)
        if msg.get("activeSeconds") is not None:
            try:
                Member.objects.filter(pk=me.pk).update(active_seconds=max(0, int(msg["activeSeconds"])))
            except (TypeError, ValueError):
                pass
        push_to_team(team, {"type": "event", "member": {"id": str(me.id), "name": me.name}, "t": t, "kind": str(msg.get("kind") or "event")[:40], "data": data, "at": timezone.now().isoformat()})

    async def _state(self, msg):
        reply = await self._state_db(msg)
        if reply:
            await self.send_json(reply)

    @database_sync_to_async
    def _state_db(self, msg):
        """Store the shared state (last write wins, by version). Returns a
        message for this socket only when its write was stale."""
        state = msg.get("state")
        if state is not None and len(json.dumps(state)) > STATE_MAX_BYTES:
            return {"type": "error", "detail": "State is too large to share."}
        progress_changed = False
        with transaction.atomic():
            team = Team.objects.select_for_update().get(pk=self.team_id)
            me = Member.objects.get(pk=self.member_id)
            if team.status in (Team.Status.CLOSED, Team.Status.SUBMITTED):
                return {"type": "error", "detail": "This team is finished; changes are no longer shared."}
            try:
                base = int(msg.get("version") if msg.get("version") is not None else team.state_version)
            except (TypeError, ValueError):
                base = team.state_version
            if base != team.state_version:
                # someone else saved first: hand this socket the current state instead
                return {"type": "state", "version": team.state_version, "state": team.state, "summary": team.progress, "by": None, "stale": True}
            team.state = state
            team.state_version += 1
            summ = msg.get("summary")
            if isinstance(summ, dict):
                p = {"earned": summ.get("earned"), "possible": summ.get("possible"), "label": summ.get("label")}
                progress_changed = p != team.progress
                team.progress = p
            team.last_activity = timezone.now()
            if team.status == Team.Status.OPEN:
                team.status = Team.Status.WORKING
            team.save()
        push_to_team(team, {"type": "state", "version": team.state_version, "state": team.state, "summary": team.progress, "by": {"id": str(me.id), "name": me.name}})
        if progress_changed:
            push_board(team.assignment)
        return None

    @database_sync_to_async
    def _status(self, phase):
        team = Team.objects.get(pk=self.team_id)
        if touch_status(team, phase):
            push_presence(team)
            push_board(team.assignment)


class AssignmentConsumer(AsyncJsonWebsocketConsumer):
    """The teacher's live board for one assignment."""

    async def connect(self):
        user = self.scope.get("user")
        if not (user and user.is_authenticated and user.is_staff):
            await self.close(code=4403)
            return
        self.pk = self.scope["url_route"]["kwargs"]["pk"]
        board = await self._board()
        if board is None:
            await self.close(code=4404)
            return
        self.group = assignment_group(self.pk)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        await self.send_json({"type": "board", **board})

    async def disconnect(self, close_code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, msg, **kwargs):
        if isinstance(msg, dict) and msg.get("type") == "ping":
            await self.send_json({"type": "pong"})
        elif isinstance(msg, dict) and msg.get("type") == "refresh":
            board = await self._board()
            if board:
                await self.send_json({"type": "board", **board})

    async def room_message(self, event):
        await self.send_json(event["payload"])

    @database_sync_to_async
    def _board(self):
        a = Assignment.objects.select_related("lesson__topic__course").filter(pk=self.pk).first()
        return board_json(a) if a else None
