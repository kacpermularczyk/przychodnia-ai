from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.base_user import BaseUserManager


# 🔹 Niestandardowy menedżer użytkowników
class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        """Tworzy zwykłego użytkownika z adresem e-mail jako loginem."""
        if not email:
            raise ValueError("Adres e-mail jest wymagany")

        email = self.normalize_email(email)
        extra_fields.setdefault('is_active', True)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Tworzy superużytkownika z uprawnieniami administratora."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if not extra_fields.get('is_staff'):
            raise ValueError("Superużytkownik musi mieć is_staff=True")
        if not extra_fields.get('is_superuser'):
            raise ValueError("Superużytkownik musi mieć is_superuser=True")

        return self.create_user(email, password, **extra_fields)


# 🔹 Niestandardowy model użytkownika
class CustomUser(AbstractUser):
    username = models.CharField(max_length=150, null=True, blank=True)
    email = models.EmailField(max_length=150, unique=True)
    phone_number = models.CharField(max_length=9, null=True, blank=True)
    is_guest = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    def __str__(self):
        return self.email


# 🔹 Model wizyty
class Visit(models.Model):
    STATUS_CHOICES = [
        ("pending", "Oczekuje"),
        ("accepted", "Zaakceptowano"),
        ("rejected", "Odrzucono"),
        ("canceled", "Anulowano"),
        ("presence", "Obecność"),
        ("absent", "Nieobecność"),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="visits")
    date = models.DateField()
    time = models.TimeField(null=True, blank=True)
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default="pending",
        verbose_name="Status wizyty"
    )

    predicted_diagnosis = models.ForeignKey(
        "DiagnosisModel",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="predicted_visits",
        verbose_name="Diagnoza_Ai"
    )

    diagnosis = models.TextField(
        null=True,
        blank=True,
        verbose_name="Diagnoza"
    )

    note = models.TextField(
        null=True,
        blank=True,
        verbose_name="Notatka"
    )

    is_same = models.BooleanField(default=0)

    class Meta:
        ordering = ["date", "time"]
        verbose_name = "Wizyta"
        verbose_name_plural = "Wizyty"
        indexes = [
            models.Index(fields=["date"]),
        ]

    def __str__(self):
        if self.time:
            return f"Wizyta {self.user.email} dnia {self.date} o {self.time.strftime('%H:%M')} ({self.get_status_display()})"
        return f"Wizyta {self.user.email} dnia {self.date} ({self.get_status_display()})"
    




class DiagnosisModel(models.Model):
    bol_przy_nagryzaniu = models.BooleanField(default=0)
    bol_na_zimno = models.BooleanField(default=0)
    obrzek_policzka = models.BooleanField(default=0)
    wysoka_temperatura = models.BooleanField(default=0)
    zab_sie_rusza = models.BooleanField(default=0)
    zab_zciemnial = models.BooleanField(default=0)
    reakcja_na_slodkie = models.BooleanField(default=0)
    bol_samoistny = models.BooleanField(default=0)
    silny_bol_podczas_picia_goracych_napojow = models.BooleanField(default=0)
    bol_dziasla = models.BooleanField(default=0)
    nadwrazliwy_zab = models.BooleanField(default=0)
    bol_na_slodkie = models.BooleanField(default=0)
    reakcja_na_zimno = models.BooleanField(default=0)
    bol_na_cieplo = models.BooleanField(default=0)
    bol_zeba_od_kilku_dni = models.BooleanField(default=0)
    krwawienie_z_dziasel = models.BooleanField(default=0)
    silne_bole_samoistne_ktore_lagodzi_zimny_napoj = models.BooleanField(default=0)
    reakcja_na_cieplo = models.BooleanField(default=0)
    brzydki_zapach_z_ust = models.BooleanField(default=0)
    krwawienie_z_dziasel_przy_myciu_zebow = models.BooleanField(default=0)
    wrazliwosc_na_zimno = models.BooleanField(default=0)

    predicted_diagnosis = models.CharField(max_length=255)
    doctor_diagnosis = models.TextField(
        null=True,
        blank=True,
    )
    is_correct = models.BooleanField(default=0)
    is_new_rf = models.BooleanField(default=0)
    is_new_nn = models.BooleanField(default=0)

    def __str__(self):
        return (
            f"{self.predicted_diagnosis} "
            f"(NEW FOR RF: {self.is_new_rf}, NEW FOR NN: {self.is_new_nn})"
        )





class SystemSettings(models.Model):
    NN = "nn"
    RF = "rf"

    ALGORITHM_CHOICES = [
        (NN, "Neural Network"),
        (RF, "Random Forest"),
    ]

    diagnosis_algorithm = models.CharField(
        max_length=2,
        choices=ALGORITHM_CHOICES,
        default=NN,
        verbose_name="Algorytm diagnozy"
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Ustawienia systemu"
        verbose_name_plural = "Ustawienia systemu"

    def save(self, *args, **kwargs):
        # wymuszamy jeden rekord (singleton)
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"SystemSettings (diagnosis_algorithm={self.get_diagnosis_algorithm_display()})"
