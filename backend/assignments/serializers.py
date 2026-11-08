import re

from rest_framework import serializers

from lessons.models import Lesson

from .models import Assignment, Member

NAME_RE = re.compile(r"^[^\x00-\x1f<>]{2,60}$")


def clean_name(value):
    name = re.sub(r"\s+", " ", str(value or "")).strip()
    if not NAME_RE.match(name):
        raise serializers.ValidationError("Enter your full name (2–60 characters).")
    return name


class AssignmentWriteSerializer(serializers.ModelSerializer):
    lesson = serializers.SlugField()  # the lesson's slug, as in the catalog

    class Meta:
        model = Assignment
        fields = ["lesson", "title", "instructions", "klass", "group_mode", "max_members", "opens_at", "due_at", "status", "show_leaderboard"]

    def validate_lesson(self, slug):
        try:
            return Lesson.objects.get(slug=slug)
        except Lesson.DoesNotExist:
            raise serializers.ValidationError("No lesson with that slug.")
        except Lesson.MultipleObjectsReturned:
            return Lesson.objects.filter(slug=slug).first()

    def validate_max_members(self, n):
        if not 1 <= n <= 12:
            raise serializers.ValidationError("Teams are 1 to 12 students.")
        return n


class CreateTeamSerializer(serializers.Serializer):
    assignment = serializers.UUIDField()
    name = serializers.CharField()             # the student's name
    team = serializers.CharField(required=False, allow_blank=True, max_length=60)
    role = serializers.CharField(required=False, allow_blank=True, max_length=30)

    def validate_name(self, v):
        return clean_name(v)


class JoinTeamSerializer(serializers.Serializer):
    code = serializers.CharField()
    name = serializers.CharField()
    role = serializers.CharField(required=False, allow_blank=True, max_length=30)
    token = serializers.CharField(required=False, allow_blank=True)  # a rejoin from the same browser

    def validate_code(self, v):
        v = re.sub(r"[^A-Za-z0-9]", "", str(v)).upper()
        if len(v) != 6:
            raise serializers.ValidationError("Team codes are 6 letters and numbers, like K7P-3QX.")
        return f"{v[:3]}-{v[3:]}"

    def validate_name(self, v):
        return clean_name(v)


class MemberTokenSerializer(serializers.Serializer):
    token = serializers.CharField()

    def validate_token(self, v):
        try:
            return Member.objects.select_related("team__assignment__lesson").get(token=v)
        except Member.DoesNotExist:
            raise serializers.ValidationError("That membership is not valid any more. Rejoin with the team code.")


class SubmitSerializer(serializers.Serializer):
    token = serializers.CharField()
    envelope = serializers.JSONField()
    summary = serializers.JSONField(required=False, allow_null=True)

    def validate_envelope(self, env):
        if not isinstance(env, dict) or env.get("hsct") != 1 or not env.get("data") or not env.get("badge"):
            raise serializers.ValidationError("That is not a result file.")
        if env.get("kind") == "save":
            raise serializers.ValidationError("That is a save file, not a finished result.")
        if len(str(env)) > 2_000_000:
            raise serializers.ValidationError("Result file is too large.")
        return env
