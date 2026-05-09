from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Visit, SystemSettings
from .forms import CustomUserCreationForm, CustomUserChangeForm


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    model = CustomUser

    # 🔹 Widoczne kolumny na liście użytkowników
    list_display = ("email", "first_name", "last_name", "phone_number", "is_guest", "is_staff", "is_active")
    list_filter = ("is_staff", "is_active", "is_guest")
    search_fields = ("email", "first_name", "last_name", "phone_number")

    # 🔹 Pola edycji użytkownika
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Informacje osobiste", {"fields": ("first_name", "last_name", "phone_number")}),
        ("Uprawnienia", {"fields": ("is_active", "is_staff", "is_superuser", "is_guest", "groups", "user_permissions")}),
        ("Ważne daty", {"fields": ("last_login", "date_joined")}),
    )

    # 🔹 Pola podczas dodawania nowego użytkownika
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": (
                "email",
                "first_name",
                "last_name",
                "phone_number",
                "password1",
                "password2",
                "is_staff",
                "is_active",
                "is_guest",
            ),
        }),
    )

    ordering = ("email",)


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = ("user", "date", "time", "status")
    list_filter = ("date", "status")
    search_fields = ("user__email",)

@admin.register(SystemSettings)
class SystemSettingsAdmin(admin.ModelAdmin):
    list_display = ("diagnosis_algorithm", "updated_at")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
