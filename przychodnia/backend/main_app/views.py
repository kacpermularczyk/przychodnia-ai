from django.shortcuts import render  # jeśli nieużywane, możesz usunąć
from django.contrib.auth import authenticate, get_user_model
from django.utils import timezone
from django.utils.dateparse import parse_date

from django.db.models import Q
from django.db.models import Count

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

import datetime as dt
import joblib
import os
import re

from knox.models import AuthToken

from django.conf import settings
from django.db.models import Case, When, Value, CharField

from ai.predictor import predict_diagnosis
from ai.rf_trainer import retrain_rf_from_db
from ai.nn_trainer import retrain_nn_from_db
from .models import Visit, CustomUser, DiagnosisModel, SystemSettings
from .permissions import IsNotAuthenticated, IsAiEngineer
from .serializers import (
    BusySlotSerializer,
    CustomUserSerializer,
    LoginSerializer,
    RegisterSerializer,
    VisitSerializer,
)

User = get_user_model()

_VALID_LABELS_CACHE = None

def get_valid_labels():
    global _VALID_LABELS_CACHE
    if _VALID_LABELS_CACHE is None:
        le_path = os.path.join(settings.BASE_DIR, "ai", "label_encoder.pkl")
        label_encoder = joblib.load(le_path)
        _VALID_LABELS_CACHE = set(label_encoder.classes_)
    return _VALID_LABELS_CACHE


def parse_bool(v):
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.lower() in ("1", "true", "t", "yes", "y")
    if isinstance(v, int):
        return v == 1
    return None


class LoginViewSet(viewsets.ViewSet):
    permission_classes = [IsNotAuthenticated]
    serializer_class = LoginSerializer

    def create(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]

        user = authenticate(request, email=email, password=password)
        if not user:
            return Response({"error": "Nieprawidłowe dane"}, status=status.HTTP_401_UNAUTHORIZED)

        _, token = AuthToken.objects.create(user)
        return Response(
            {
                "user": self.serializer_class(user).data,  # zostawiam jak było u Ciebie
                "token": token,
            }
        )


class RegisterViewSet(viewsets.ViewSet):
    permission_classes = [IsNotAuthenticated]
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

    def create(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        first_name = request.data.get("first_name")
        last_name = request.data.get("last_name")
        phone = request.data.get("phone_number")

        # sprawdzamy czy istnieje gość z tym numerem
        guest = User.objects.filter(phone_number=phone, is_guest=True).first()

        if guest:
            if guest.first_name.lower() != (first_name or "").lower() or guest.last_name.lower() != (last_name or "").lower():
                return Response({"error": "Telefon nie zgadza się z imieniem i nazwiskiem."}, status=status.HTTP_400_BAD_REQUEST)

            temp_data = {
                "email": email,
                "password": password,
                "first_name": first_name,
                "last_name": last_name,
                "phone_number": phone,
            }

            temp_serializer = RegisterSerializer(data=temp_data)
            temp_serializer.is_valid(raise_exception=True)

            guest.email = email
            guest.first_name = first_name
            guest.last_name = last_name
            guest.is_guest = False
            guest.set_password(password)
            guest.save()

            return Response(
                {
                    "id": guest.id,
                    "email": guest.email,
                    "first_name": guest.first_name,
                    "last_name": guest.last_name,
                    "phone_number": guest.phone_number,
                },
                status=status.HTTP_200_OK,
            )

        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ListOfVisitsViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = VisitSerializer

    def get_queryset(self):
        now_local = timezone.localtime()
        today = now_local.date()
        now_time = now_local.time()
        cutoff = dt.time(15, 0)

        qs = Visit.objects.filter(status="accepted")

        # Zawsze: zaległe accepted z poprzednich dni -> absent
        condition = Q(date__lt=today)

        # Dopiero po 15:00: dzisiejsze accepted, których czas już minął -> absent
        if now_time >= cutoff:
            condition |= Q(date=today, time__lt=now_time)

        qs.filter(condition).update(status="absent")

        # 2) Uprawnienia / widoczność
        user = self.request.user

        is_worker = user.groups.filter(name="worker").exists()
        is_doctor = user.groups.filter(name="doctor").exists()

        if is_worker:
            return Visit.objects.all()

        if is_doctor:
            return Visit.objects.filter(
                Q(status="presence") | Q(status="accepted", date=today)
                #Q(status="presence") | Q(status="accepted")
            )

        return Visit.objects.filter(user=user)

    @action(detail=True, methods=["post"])
    def update_status(self, request, pk=None):
        visit = self.get_object()
        user = request.user

        new_status = request.data.get("status")
        new_note = request.data.get("note")
        new_diagnosis = request.data.get("diagnosis")
        is_same = request.data.get("is_same")

        is_worker = user.groups.filter(name="worker").exists()
        is_doctor = user.groups.filter(name="doctor").exists()

        allowed_statuses = ["pending", "accepted", "rejected", "canceled", "presence", "absent"]

        # (1) walidacja statusu (jeśli status jest wysłany)
        if new_status is not None and new_status not in allowed_statuses:
            return Response({"error": "Nieprawidłowy status"}, status=status.HTTP_400_BAD_REQUEST)

        # (2) worker – pełne uprawnienia
        if is_worker:
            # visit.date + visit.time traktujemy jako czas lokalny (Europe/Warsaw),
            # a potem robimy z tego timezone-aware datetime.
            visit_dt_naive = dt.datetime.combine(visit.date, visit.time or dt.time(0, 0))
            visit_dt = timezone.make_aware(visit_dt_naive)

            # Porównuj z "teraz" też w lokalnej strefie (czytelniej + mniej niespodzianek przy debugowaniu)
            now_local = timezone.localtime(timezone.now())

            if new_status == "accepted" and visit_dt < now_local:
                return Response(
                    {"error": "❌ Nie można zaakceptować wizyty, która już się odbyła."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if new_status is not None:
                visit.status = new_status
            visit.save()
            return Response({"message": "✅ Status zaktualizowany pomyślnie!"}, status=status.HTTP_200_OK)

        # (3) doctor – presence + uzupełnianie diagnosis/note
        if is_doctor:
            if new_status is not None and new_status not in ["presence"]:
                return Response(
                    {"error": "⛔ Doctor może ustawić tylko status presence."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            if new_status is not None:
                visit.status = new_status

            if new_diagnosis is not None:
                visit.diagnosis = new_diagnosis

                if visit.predicted_diagnosis_id:
                    DiagnosisModel.objects.filter(
                        id=visit.predicted_diagnosis_id
                    ).update(doctor_diagnosis=new_diagnosis)
                
            if new_note is not None:
                visit.note = new_note

            parsed = parse_bool(is_same)
            if parsed is not None:
                visit.is_same = parsed

            visit.save()

            if parsed is not None and visit.predicted_diagnosis_id:
                DiagnosisModel.objects.filter(
                    id=visit.predicted_diagnosis_id
                ).update(is_correct=visit.is_same)

            return Response(
                {"message": "✅ Wizyta zaktualizowana (status/diagnoza/notatka)."},
                status=status.HTTP_200_OK,
            )

        # (4) zwykły użytkownik – tylko anulowanie
        if new_status != "canceled":
            return Response(
                {"error": "⛔ Możesz jedynie anulować swoją wizytę."},
                status=status.HTTP_403_FORBIDDEN,
            )

        visit.status = "canceled"
        visit.save()
        return Response({"message": "🟡 Wizyta została anulowana."}, status=status.HTTP_200_OK)


class UserAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = CustomUserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class VisitViewSet(viewsets.ModelViewSet):
    serializer_class = VisitSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "list":
            return BusySlotSerializer
        return VisitSerializer

    def get_queryset(self):
        queryset = Visit.objects.exclude(status__in=["rejected", "canceled"])
        date_str = self.request.query_params.get("date")

        if date_str:
            date_obj = parse_date(date_str)
            if not date_obj:
                return Visit.objects.none()
            queryset = queryset.filter(date=date_obj).order_by("time")

        if self.action == "list":
            queryset = queryset.only("date", "time")

        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user

        if user.groups.filter(name="doctor").exists():
            return Response({"error": "Lekarz nie moze rezerwowac wizyt"}, status=status.HTTP_403_FORBIDDEN)
        
        if user.groups.filter(name="AiEngineer").exists():
            return Response({"error": "Inżynier panelu AI nie moze rezerwowac wizyt"}, status=status.HTTP_403_FORBIDDEN)

        if user.groups.filter(name="worker").exists():
            first_name = request.data.get("first_name")
            last_name = request.data.get("last_name")
            phone = request.data.get("phone")

            if not first_name or not last_name:
                return Response({"error": "Imię i nazwisko są wymagane."}, status=status.HTTP_400_BAD_REQUEST)

            if not phone:
                return Response({"error": "Numer telefonu jest wymagany."}, status=status.HTTP_400_BAD_REQUEST)

            if not re.match(r"^\d{9}$", phone):
                return Response({"error": "Numer telefonu musi składać się z 9 cyfr."}, status=status.HTTP_400_BAD_REQUEST)

            existing_user = CustomUser.objects.filter(phone_number=phone).first()

            if existing_user:
                if (
                    existing_user.first_name.lower() != first_name.lower()
                    or existing_user.last_name.lower() != last_name.lower()
                ):
                    return Response(
                        {"error": "User o tym numerze istnieje, ale podane imię i nazwisko nie zgadzają się."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                final_user = existing_user
                diagnosis = None
            else:
                email = f"{phone}@guest.local"
                guest_user = CustomUser.objects.create(
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    phone_number=phone,
                    is_guest=True,
                )
                guest_user.set_unusable_password()
                guest_user.save()

                final_user = guest_user
                diagnosis = None

            visit = serializer.save(
                user=final_user,
                predicted_diagnosis=diagnosis,
                status="accepted",
            )

        else:
            symptoms = request.data.get("symptoms", {})
            final_user = user

            if symptoms:
                predicted = predict_diagnosis(symptoms)
                diagnosis = DiagnosisModel.objects.create(
                    predicted_diagnosis=predicted,
                    is_new_rf=True,
                    is_new_nn=True,
                    **{k.replace(" ", "_"): bool(v) for k, v in symptoms.items()},
                )
            else:
                diagnosis = None

            visit = serializer.save(user=final_user, predicted_diagnosis=diagnosis)

        return Response(VisitSerializer(visit).data, status=status.HTTP_201_CREATED)


class FeaturesListView(APIView):
    """
    Zwraca listę cech (features) użytych w modelu ML.
    """

    def get(self, request):
        try:
            base_dir = os.path.dirname(__file__)
            features_path = os.path.join(base_dir, "../ai/db/features.pkl")

            features = joblib.load(features_path)
            features.sort()

            return Response({"features": features}, status=status.HTTP_200_OK)

        except FileNotFoundError:
            return Response({"error": "Plik features.pkl nie został znaleziony."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": f"Wystąpił błąd: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SystemSettingsAlgorithmView(APIView):
    """
    GET  -> każdy zalogowany
    PUT  -> tylko grupa AiEngineer
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAiEngineer()]

    def get(self, request):
        settings = SystemSettings.get()
        VALID_LABELS = get_valid_labels()

        # -------- NN --------
        nn_base = (
            DiagnosisModel.objects
            .filter(
                Q(is_correct=True) | Q(is_correct=False, doctor_diagnosis__in=VALID_LABELS)
            )
            .annotate(
                train_label=Case(
                    When(is_correct=True, then="predicted_diagnosis"),
                    When(is_correct=False, then="doctor_diagnosis"),
                    output_field=CharField(),
                )
            )
        )

        nn_stats_qs = (
            nn_base
            .values("train_label")
            .annotate(
                count=Count("id", filter=Q(is_new_nn=True)),
                known_count=Count("id", filter=Q(is_new_nn=False)),
            )
        )

        nn_map = {
            row["train_label"]: row
            for row in nn_stats_qs
            if row.get("train_label") is not None
        }

        nn_stats = [
            {
                "train_label": label,
                "count": nn_map.get(label, {}).get("count", 0),
                "known_count": nn_map.get(label, {}).get("known_count", 0),
            }
            for label in VALID_LABELS
        ]
        nn_stats.sort(key=lambda r: (-r["count"], r["train_label"]))

        # -------- RF (query bez zmian, tylko dopisanie zer w Pythonie) --------
        rf_stats_qs = (
            DiagnosisModel.objects
            .filter(
                Q(is_new_rf=True) &
                (Q(is_correct=True) | Q(is_correct=False, doctor_diagnosis__in=VALID_LABELS))
            )
            .annotate(
                train_label=Case(
                    When(is_correct=True, then="predicted_diagnosis"),
                    When(is_correct=False, then="doctor_diagnosis"),
                    output_field=CharField(),
                )
            )
            .values("train_label")
            .annotate(count=Count("id"))
        )

        rf_map = {
            row["train_label"]: row
            for row in rf_stats_qs
            if row.get("train_label") is not None
        }

        rf_stats = [
            {
                "train_label": label,
                "count": rf_map.get(label, {}).get("count", 0),
            }
            for label in VALID_LABELS
        ]
        rf_stats.sort(key=lambda r: (-r["count"], r["train_label"]))

        return Response(
            {
                "diagnosis_algorithm": settings.diagnosis_algorithm,
                "label": settings.get_diagnosis_algorithm_display(),
                "stats_nn": nn_stats,   # zawsze pełna lista z zerami + known_count
                "stats_rf": rf_stats,   # zawsze pełna lista z zerami
            },
            status=status.HTTP_200_OK,
        )


    def put(self, request):
        algo = request.data.get("diagnosis_algorithm")

        allowed = {SystemSettings.NN, SystemSettings.RF}
        if algo not in allowed:
            return Response(
                {"error": "Nieprawidłowy algorytm"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        settings = SystemSettings.get()
        settings.diagnosis_algorithm = algo
        settings.save()

        return Response(
            {"message": "Zapisano algorytm", "diagnosis_algorithm": algo},
            status=status.HTTP_200_OK,
        )

    patch = put

class RetrainRFView(APIView):
    permission_classes = [IsAuthenticated, IsAiEngineer]

    def post(self, request):
        result = retrain_rf_from_db(n_estimators=200, random_state=42)
        if not result["ok"]:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response(result, status=status.HTTP_200_OK)
    
class RetrainNNView(APIView):
    permission_classes = [IsAuthenticated, IsAiEngineer]

    def post(self, request):
        # frontend wysyła: { values: { "choroba": liczba, ... } }
        values = request.data.get("values", {})

        result = retrain_nn_from_db(
            values=values,
            random_state=42,
        )

        if not result.get("ok"):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_200_OK)