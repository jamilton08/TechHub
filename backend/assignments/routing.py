from django.urls import re_path

from .consumers import AssignmentConsumer, TeamConsumer

websocket_urlpatterns = [
    re_path(r"^ws/team/(?P<code>[A-Z0-9]{3}-[A-Z0-9]{3})/$", TeamConsumer.as_asgi()),
    re_path(r"^ws/assignment/(?P<pk>[0-9a-f-]{36})/$", AssignmentConsumer.as_asgi()),
]
