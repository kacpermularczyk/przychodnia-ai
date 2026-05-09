from rest_framework import permissions
from rest_framework.permissions import BasePermission

class IsNotAuthenticated(permissions.BasePermission):
    
    #Pozwala tylko niezalogowanym użytkownikom
    def has_permission(self, request, view):
        return not request.user or not request.user.is_authenticated

class IsAiEngineer(BasePermission):
    message = "Dostęp tylko dla użytkowników z grupy AiEngineer."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        return user.groups.filter(name="AiEngineer").exists()