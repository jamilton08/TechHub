from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase


class AuthTests(APITestCase):
    def test_login_logout_me(self):
        get_user_model().objects.create_user("cruz", "x@y.z", "pw", is_staff=True)
        r = self.client.get(reverse("auth-me"))
        self.assertEqual(r.data, {"authenticated": False})
        self.assertIn("csrftoken", r.cookies)
        r = self.client.post(reverse("auth-login"), {"username": "cruz", "password": "wrong"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post(reverse("auth-login"), {"username": "cruz", "password": "pw"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["isTeacher"])
        self.assertEqual(self.client.get(reverse("auth-me")).data["username"], "cruz")
        self.client.post(reverse("auth-logout"))
        self.assertFalse(self.client.get(reverse("auth-me")).data["authenticated"])

    def test_healthz(self):
        self.assertEqual(self.client.get("/api/healthz/").json(), {"ok": True})
