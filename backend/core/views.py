"""Teacher sign-in (Django session) and a health check.

Students never sign in: they join a team with a code and a name. Teachers
are Django users (createsuperuser, or staff users made in /admin/).
"""
from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView


def healthz(request):
    return JsonResponse({"ok": True})


def me_payload(request):
    u = request.user
    if not u.is_authenticated:
        return {"authenticated": False}
    return {"authenticated": True, "userId": u.pk, "username": u.get_username(), "isTeacher": bool(u.is_staff)}


class MeView(APIView):
    """GET /api/auth/me/ — who am I. Also sets the CSRF cookie the site needs for POSTs."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        get_token(request)
        return Response(me_payload(request))


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = str(request.data.get("username", "")).strip()
        password = str(request.data.get("password", ""))
        user = authenticate(request, username=username, password=password)
        if user is None or not user.is_active:
            return Response({"detail": "Wrong username or password."}, status=status.HTTP_400_BAD_REQUEST)
        login(request, user)
        get_token(request)
        return Response(me_payload(request))


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        logout(request)
        return Response({"authenticated": False})
