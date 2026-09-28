from rest_framework import permissions


class OwnerOrSharedReadOnly(permissions.BasePermission):
    """Owners can do anything. Anyone can read an unlisted or public project."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return obj.visible_to(request.user)
        return request.user.is_authenticated and obj.owner_id == request.user.pk
