"""Run with:  python manage.py test arcade"""
import shutil
import tempfile
import uuid

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Asset, Project

MEDIA = tempfile.mkdtemp(prefix="arcade-test-media-")
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
WAV = b"RIFF" + b"\x00" * 64


def files(main='print("hi")\n', **more):
    out = [{"name": "main.py", "content": main}]
    out += [{"name": n, "content": c} for n, c in more.items()]
    return out


@override_settings(MEDIA_ROOT=MEDIA)
class ArcadeApiTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        User = get_user_model()
        self.ana = User.objects.create_user("ana", password="pw")
        self.ben = User.objects.create_user("ben", password="pw")
        self.a = APIClient()
        self.a.force_authenticate(self.ana)
        self.b = APIClient()
        self.b.force_authenticate(self.ben)
        self.anon = APIClient()

    def create(self, client=None, **data):
        body = {"title": "Dodge", "entry": "main.py", "files": files()}
        body.update(data)
        r = (client or self.a).post("/api/arcade/projects/", body, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()

    # ── who am I ──────────────────────────────────────────────────────
    def test_me(self):
        r = self.anon.get("/api/arcade/me/")
        self.assertEqual(r.json(), {"authenticated": False})
        self.assertIn("csrftoken", r.cookies)
        r = self.a.get("/api/arcade/me/")
        self.assertEqual(r.json()["authenticated"], True)
        self.assertNotIn("username", r.json())  # no names leave the server

    # ── create / read ─────────────────────────────────────────────────
    def test_create_keeps_the_browser_made_id(self):
        pid = str(uuid.uuid4())
        p = self.create(id=pid)
        self.assertEqual(p["id"], pid)
        self.assertEqual(p["version"], 1)
        self.assertTrue(p["isOwner"])
        self.assertEqual([f["name"] for f in p["files"]], ["main.py"])

    def test_id_cannot_be_taken_twice(self):
        pid = str(uuid.uuid4())
        self.create(id=pid)
        r = self.b.post("/api/arcade/projects/", {"id": pid, "title": "x", "files": files()}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_list_shows_only_mine(self):
        self.create(title="Mine")
        self.create(client=self.b, title="Ben's")
        r = self.a.get("/api/arcade/projects/")
        self.assertEqual([p["title"] for p in r.json()], ["Mine"])
        self.assertEqual(r.json()[0]["fileCount"], 1)
        self.assertEqual(self.anon.get("/api/arcade/projects/").json(), [])

    def test_private_projects_are_invisible_to_others(self):
        p = self.create()
        self.assertEqual(self.b.get(f"/api/arcade/projects/{p['id']}/").status_code, 404)
        self.assertEqual(self.anon.get(f"/api/arcade/projects/{p['id']}/").status_code, 404)
        r = self.b.put(f"/api/arcade/projects/{p['id']}/", {"title": "hacked", "files": files(), "version": 1}, format="json")
        self.assertEqual(r.status_code, 404)

    def test_unlisted_projects_are_read_only_for_others(self):
        p = self.create()
        self.a.patch(f"/api/arcade/projects/{p['id']}/", {"visibility": "unlisted"}, format="json")
        r = self.anon.get(f"/api/arcade/projects/{p['id']}/")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["isOwner"])
        r = self.b.put(f"/api/arcade/projects/{p['id']}/", {"title": "hacked", "files": files(), "version": 1}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self.b.delete(f"/api/arcade/projects/{p['id']}/").status_code, 403)

    # ── saving ────────────────────────────────────────────────────────
    def test_save_replaces_files_and_bumps_version(self):
        p = self.create()
        r = self.a.put(f"/api/arcade/projects/{p['id']}/", {
            "title": "Dodge 2", "entry": "main.py", "version": 1,
            "files": files("import helper\n", **{"helper.py": "X = 1\n", "levels.txt": "1 2 3"}),
        }, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        body = r.json()
        self.assertEqual(body["version"], 2)
        self.assertEqual(body["title"], "Dodge 2")
        self.assertEqual([f["name"] for f in body["files"]], ["main.py", "helper.py", "levels.txt"])

    def test_stale_save_is_a_conflict(self):
        p = self.create()
        url = f"/api/arcade/projects/{p['id']}/"
        self.assertEqual(self.a.put(url, {"title": "tab 1", "files": files(), "version": 1}, format="json").status_code, 200)
        r = self.a.put(url, {"title": "tab 2", "files": files(), "version": 1}, format="json")
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json()["version"], 2)

    def test_save_needs_a_version(self):
        p = self.create()
        r = self.a.put(f"/api/arcade/projects/{p['id']}/", {"title": "x", "files": files()}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_patch_is_limited_to_title_and_visibility(self):
        p = self.create()
        url = f"/api/arcade/projects/{p['id']}/"
        self.assertEqual(self.a.patch(url, {"title": "Renamed"}, format="json").json()["title"], "Renamed")
        self.assertEqual(self.a.patch(url, {"files": files()}, format="json").status_code, 400)
        self.assertEqual(self.a.patch(url, {"visibility": "everyone"}, format="json").status_code, 400)

    # ── validation mirrors the frontend ───────────────────────────────
    def test_bad_projects_are_rejected(self):
        bad = [
            {"files": [{"name": "my-game.py", "content": ""}], "entry": "my-game.py"},   # not importable
            {"files": [{"name": "random.py", "content": ""}], "entry": "random.py"},     # shadows stdlib
            {"files": [{"name": "run.exe", "content": ""}], "entry": "run.exe"},
            {"files": files(), "entry": "missing.py"},
            {"files": files(**{"MAIN.py": ""})},                                          # same name twice
            {"files": [{"name": f"f{i}.py", "content": ""} for i in range(31)], "entry": "f0.py"},
            {"files": files("x" * 200_001)},
            {"files": []},
        ]
        for body in bad:
            r = self.a.post("/api/arcade/projects/", {"title": "t", **body}, format="json")
            self.assertEqual(r.status_code, 400, (body.get("entry"), r.content[:200]))

    # ── assets ────────────────────────────────────────────────────────
    def upload(self, pid, name, data, client=None):
        return (client or self.a).post(f"/api/arcade/projects/{pid}/assets/",
                                       {"name": name, "file": SimpleUploadedFile(name, data)}, format="multipart")

    def test_asset_upload_download_replace_delete(self):
        p = self.create()
        r = self.upload(p["id"], "ship.png", PNG)
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["type"], "image/png")
        url = f"/api/arcade/projects/{p['id']}/assets/ship.png/"
        got = self.a.get(url)
        self.assertEqual(got.status_code, 200)
        self.assertEqual(got["Content-Type"], "image/png")
        self.assertEqual(b"".join(got.streaming_content), PNG)
        # replacing keeps one row and removes the old bytes
        old_path = Asset.objects.get(name="ship.png").file.path
        self.assertEqual(self.upload(p["id"], "ship.png", PNG + b"more").status_code, 201)
        self.assertEqual(Asset.objects.filter(project_id=p["id"]).count(), 1)
        import os
        self.assertFalse(os.path.exists(old_path))
        # the project lists it, and the version didn't move (assets aren't code)
        body = self.a.get(f"/api/arcade/projects/{p['id']}/").json()
        self.assertEqual([a["name"] for a in body["assets"]], ["ship.png"])
        self.assertEqual(body["version"], 1)
        self.assertEqual(self.a.delete(url).status_code, 204)
        self.assertEqual(self.a.get(url).status_code, 404)

    def test_asset_rules(self):
        p = self.create()
        self.assertEqual(self.upload(p["id"], "evil.svg", b"<svg onload=alert(1)>").status_code, 400)
        self.assertEqual(self.upload(p["id"], "game.html", b"<script>").status_code, 400)
        self.assertEqual(self.upload(p["id"], "fake.png", b"MZ\x90\x00 not a png").status_code, 400)
        self.assertEqual(self.upload(p["id"], "boom.wav", WAV).status_code, 201)
        self.assertEqual(self.upload(p["id"], "x.png", PNG, client=self.b).status_code, 404)

    def test_assets_of_private_projects_stay_private(self):
        p = self.create()
        self.upload(p["id"], "ship.png", PNG)
        url = f"/api/arcade/projects/{p['id']}/assets/ship.png/"
        self.assertEqual(self.anon.get(url).status_code, 404)
        self.a.patch(f"/api/arcade/projects/{p['id']}/", {"visibility": "unlisted"}, format="json")
        self.assertEqual(self.anon.get(url).status_code, 200)
        self.assertEqual(self.b.delete(url).status_code, 403)

    # ── remix and delete ──────────────────────────────────────────────
    def test_remix_copies_code_and_assets(self):
        p = self.create(files=files("import pygame\n", **{"helper.py": "X = 2\n"}))
        self.upload(p["id"], "ship.png", PNG)
        self.assertEqual(self.b.post(f"/api/arcade/projects/{p['id']}/remix/").status_code, 404)  # still private
        self.a.patch(f"/api/arcade/projects/{p['id']}/", {"visibility": "unlisted"}, format="json")
        r = self.b.post(f"/api/arcade/projects/{p['id']}/remix/")
        self.assertEqual(r.status_code, 201, r.content)
        copy = r.json()
        self.assertTrue(copy["isOwner"])
        self.assertEqual(copy["remixOf"], p["id"])
        self.assertEqual(copy["visibility"], "private")
        self.assertEqual([f["name"] for f in copy["files"]], ["main.py", "helper.py"])
        got = self.b.get(f"/api/arcade/projects/{copy['id']}/assets/ship.png/")
        self.assertEqual(b"".join(got.streaming_content), PNG)

    def test_deleting_a_project_deletes_its_asset_files(self):
        import os
        p = self.create()
        self.upload(p["id"], "ship.png", PNG)
        path = Asset.objects.get(project_id=p["id"]).file.path
        self.assertTrue(os.path.exists(path))
        self.assertEqual(self.a.delete(f"/api/arcade/projects/{p['id']}/").status_code, 204)
        self.assertFalse(Project.objects.filter(pk=p["id"]).exists())
        self.assertFalse(os.path.exists(path))

    # ── CSRF is enforced for signed-in writes ─────────────────────────
    def test_csrf_required(self):
        c = APIClient(enforce_csrf_checks=True)
        c.login(username="ana", password="pw")
        r = c.post("/api/arcade/projects/", {"title": "t", "files": files()}, format="json")
        self.assertEqual(r.status_code, 403)
        token = c.get("/api/arcade/me/").cookies["csrftoken"].value
        r = c.post("/api/arcade/projects/", {"title": "t", "files": files()}, format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(r.status_code, 201)
