from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Course, Lesson, Topic

HTML = b"<!doctype html><html><head><title>t</title></head><body><script>HSCT.lesson({id:'x'})</script></body></html>"


class CatalogTests(APITestCase):
    def setUp(self):
        self.c = Course.objects.create(slug="it-network", title="IT Network", tone="blue", blurb="Cables.", position=0)
        self.t = Topic.objects.create(course=self.c, slug="how-networks-work", title="How networks work", position=0)
        self.teacher = get_user_model().objects.create_user("cruz", "x@y.z", "pw", is_staff=True)

    def test_catalog_shape_matches_lessons_js(self):
        l = Lesson.objects.create(topic=self.t, slug="packet-run", title="Packet Run", kind="game", minutes=60, added="2026-09-23", tags=["packets"])
        l.file.save("packet-run.html", SimpleUploadedFile("packet-run.html", HTML))
        Lesson.objects.create(topic=self.t, slug="hidden", title="Hidden", published=False)
        r = self.client.get(reverse("lessons-catalog"))
        self.assertEqual(r.status_code, 200)
        cat = r.data["categories"]
        self.assertEqual(cat[0]["slug"], "it-network")
        self.assertEqual(cat[0]["topics"][0]["id"], "how-networks-work")
        lessons = cat[0]["topics"][0]["lessons"]
        self.assertEqual(len(lessons), 1)  # unpublished hidden from students
        self.assertEqual(lessons[0]["slug"], "packet-run")
        self.assertEqual(lessons[0]["added"], "2026-09-23")
        self.assertTrue(lessons[0]["file"].endswith("/it-network/packet-run.html"), lessons[0]["file"])
        self.client.force_authenticate(self.teacher)
        r = self.client.get(reverse("lessons-catalog"))
        self.assertEqual(len(r.data["categories"][0]["topics"][0]["lessons"]), 2)

    @override_settings(LESSON_FILES_BASE="https://lessons.hsct.tech")
    def test_file_url_uses_custom_domain(self):
        l = Lesson.objects.create(topic=self.t, slug="a", title="A")
        l.file.save("a.html", SimpleUploadedFile("a.html", HTML))
        self.assertEqual(l.file_url, "https://lessons.hsct.tech/it-network/a.html")

    def test_upload_creates_then_replaces(self):
        self.client.force_authenticate(self.teacher)
        data = {"course": "it-network", "topic": "cabling", "topic_title": "Cabling & Wi-Fi", "slug": "home-net", "title": "Home net", "kind": "lab", "minutes": 45, "tags": "router, DHCP", "file": SimpleUploadedFile("home-net.html", HTML)}
        r = self.client.post(reverse("lessons-upload"), data, format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["created"])
        self.assertEqual(Topic.objects.get(slug="cabling").title, "Cabling & Wi-Fi")
        l = Lesson.objects.get(slug="home-net")
        self.assertEqual(l.tags, ["router", "DHCP"])
        self.assertEqual(l.file.name, "it-network/home-net.html")
        self.assertIsNotNone(l.added)
        data["title"] = "Home net v2"; data["file"] = SimpleUploadedFile("home-net.html", HTML + b"<!--v2-->")
        r = self.client.post(reverse("lessons-upload"), data, format="multipart")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Lesson.objects.get(slug="home-net").title, "Home net v2")
        self.assertEqual(Lesson.objects.filter(slug="home-net").count(), 1)
        with Lesson.objects.get(slug="home-net").file.open("rb") as f:
            self.assertIn(b"<!--v2-->", f.read())

    def test_upload_rejects_non_html_and_unknown_course(self):
        self.client.force_authenticate(self.teacher)
        r = self.client.post(reverse("lessons-upload"), {"course": "it-network", "topic": "t", "slug": "s", "title": "S", "file": SimpleUploadedFile("x.html", b"MZ\x90\x00 not html")}, format="multipart")
        self.assertEqual(r.status_code, 400)
        r = self.client.post(reverse("lessons-upload"), {"course": "nope", "topic": "t", "slug": "s", "title": "S", "file": SimpleUploadedFile("x.html", HTML)}, format="multipart")
        self.assertEqual(r.status_code, 400)

    def test_delete(self):
        l = Lesson.objects.create(topic=self.t, slug="a", title="A")
        self.client.force_authenticate(self.teacher)
        self.assertEqual(self.client.delete(reverse("lessons-delete", args=["it-network", "a"])).status_code, 204)
        self.assertFalse(Lesson.objects.filter(pk=l.pk).exists())
