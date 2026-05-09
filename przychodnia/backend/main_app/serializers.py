from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group  # jeśli nieużywane, możesz usunąć
from django.utils import timezone

import datetime as dt
import re

from .models import *  # możesz rozważyć import konkretnych modeli zamiast *


User = get_user_model()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret.pop("password", None)
        return ret


class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "password",
            "first_name",
            "last_name",
            "phone_number",
        )
        extra_kwargs = {
            "password": {"write_only": True},
        }

    def validate_email(self, value):
        if not value:
            raise serializers.ValidationError("Email jest wymagany.")
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Użytkownik z tym adresem e-mail już istnieje.")
        return value

    def validate_password(self, value):
        if len(value) < 7:
            raise serializers.ValidationError("Hasło musi mieć co najmniej 7 znaków.")
        if not re.search(r"[A-Z]", value):
            raise serializers.ValidationError("Hasło musi zawierać co najmniej jedną dużą literę.")
        if not re.search(r"[a-z]", value):
            raise serializers.ValidationError("Hasło musi zawierać co najmniej jedną małą literę.")
        if not re.search(r"\d", value):
            raise serializers.ValidationError("Hasło musi zawierać co najmniej jedną cyfrę.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", value):
            raise serializers.ValidationError("Hasło musi zawierać co najmniej jeden znak specjalny.")
        return value

    def validate_phone_number(self, value):
        if not value:
            raise serializers.ValidationError("Numer telefonu jest wymagany.")
        if not re.match(r"^\d{9}$", value):
            raise serializers.ValidationError("Numer telefonu musi składać się z dokładnie 9 cyfr.")
        if User.objects.filter(phone_number=value, is_guest=False).exists():
            raise serializers.ValidationError("Użytkownik z tym numerem telefonu już istnieje.")
        return value

    def create(self, validated_data):
        validated_data["is_guest"] = False
        password = validated_data.pop("password")
        user = User.objects.create_user(password=password, **validated_data)
        return user


class CustomUserSerializer(serializers.ModelSerializer):
    groups = serializers.SlugRelatedField(
        many=True,
        read_only=True,
        slug_field="name",
    )

    class Meta:
        model = CustomUser
        fields = (
            "id",
            "email",
            "username",
            "is_staff",
            "groups",
            "first_name",
            "last_name",
            "phone_number",
        )


class DiagnosisModelSerializer(serializers.ModelSerializer):
    """Pod-serializer do wizyty — pokazuje dane diagnozy"""

    class Meta:
        model = DiagnosisModel
        fields = ["predicted_diagnosis"]


class VisitSerializer(serializers.ModelSerializer):
    time = serializers.TimeField(format="%H:%M", required=False)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_first_name = serializers.CharField(source="user.first_name", read_only=True)
    user_last_name = serializers.CharField(source="user.last_name", read_only=True)
    user_phone_number = serializers.CharField(source="user.phone_number", read_only=True)
    user_is_guest = serializers.BooleanField(source="user.is_guest", read_only=True)
    status = serializers.CharField(default="pending")

    predicted_diagnosis = DiagnosisModelSerializer(read_only=True)

    class Meta:
        model = Visit
        fields = [
            "id",
            "date",
            "time",
            "status",
            "user_email",
            "predicted_diagnosis",
            "user_first_name",
            "user_last_name",
            "user_phone_number",
            "user_is_guest",
            "diagnosis",
            "note",
            "is_same",
        ]

    def validate_date(self, value):
        """🔒 Blokuje rezerwacje wizyt w przeszłości i za daleko w przyszłość"""
        today = timezone.localdate()
        if value < today:
            raise serializers.ValidationError("❌ Nie można rezerwować wizyt w przeszłości.")
        if value > today + dt.timedelta(days=30):
            raise serializers.ValidationError("❌ Można rezerwować wizyty maksymalnie 30 dni naprzód.")
        return value

    def validate_time(self, value):
        """🔒 Dozwolone godziny: od 8:00 do 14:30 co 30 minut"""
        allowed_times = [
            dt.time(hour=h, minute=m)
            for h in range(8, 15)
            for m in (0, 30)
            if not (h == 14 and m > 30)
        ]
        if value not in allowed_times:
            raise serializers.ValidationError("⏰ Dozwolone godziny to: 8:00, 8:30, ..., 14:30.")

        chosen_date = self.initial_data.get("date")
        if chosen_date:
            try:
                chosen_date_obj = dt.date.fromisoformat(chosen_date)
                # Porównujemy w lokalnej strefie (Europe/Warsaw) zgodnie z TIME_ZONE
                if chosen_date_obj == timezone.localdate() and value <= timezone.localtime().time():
                    raise serializers.ValidationError("❌ Nie można rezerwować godzin wcześniejszych niż obecna.")
            except ValueError:
                # Jeśli date przyszło w złym formacie, to i tak złapie to walidacja pola "date"
                pass

        return value

    def validate(self, data):
        """🔒 Blokuje rezerwację, jeśli termin (data + godzina) już zajęty"""
        date_val = data.get("date")
        time_val = data.get("time")

        if date_val and time_val:
            if Visit.objects.filter(date=date_val, time=time_val).exclude(
                status__in=["rejected", "canceled"]
            ).exists():
                raise serializers.ValidationError({"detail": "❌ Ten termin jest już zajęty."})

        return data

    def update(self, instance, validated_data):
        """
        - status: worker i doctor
        - diagnosis/note: tylko doctor
        - zwykły user: nic z tego
        """
        request = self.context.get("request")
        user = getattr(request, "user", None)

        is_worker = bool(user and user.groups.filter(name="worker").exists())
        is_doctor = bool(user and user.groups.filter(name="doctor").exists())

        # status: tylko worker/doctor
        if not (is_worker or is_doctor):
            validated_data.pop("status", None)

        # diagnosis & note: tylko doctor
        if not is_doctor:
            validated_data.pop("diagnosis", None)
            validated_data.pop("note", None)

        return super().update(instance, validated_data)


class BusySlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = Visit
        fields = ["date", "time"]
