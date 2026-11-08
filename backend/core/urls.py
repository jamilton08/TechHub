from django.urls import path

from .views import LoginView, LogoutView, MeView, healthz

urlpatterns = [
    path("healthz/", healthz),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
]
