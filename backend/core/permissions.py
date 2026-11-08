from rest_framework import permissions


class IsTeacher(permissions.BasePermission):
    """A signed-in staff user (superuser or a user with 'staff status' in /admin/)."""
    message = "Teachers only."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_staff)


class IsTeacherOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        u = request.user
        return bool(u and u.is_authenticated and u.is_staff)
