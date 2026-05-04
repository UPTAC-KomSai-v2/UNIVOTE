from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import Admin, Auditor, Voter


class CannotVoteUntilPasswordChanged(BasePermission):
    """Deny voting if the user must change their password first (e.g. CSV import)."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return not getattr(user, "must_change_password", False)


class IsAdmin(BasePermission):
    """Allows access only to users registered as Admin."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return Admin.objects.filter(user=user).exists()


class IsAdminOrReadOnly(BasePermission):
    """Read access for any authenticated user; write access only for Admins."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return Admin.objects.filter(user=user).exists()


class IsAuditor(BasePermission):
    """Allows access only to users registered as an Auditor."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return Auditor.objects.filter(user=user).exists()


class IsVoterRole(BasePermission):
    """Allows ballot flow for anyone with a voter profile (voters and candidates).

    Admin and auditor accounts are excluded. Candidates use the same ``Voter``
    row as registered voters and may load the ballot, cast a vote, and read
    their receipt.
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if Admin.objects.filter(user=user).exists():
            return False
        if Auditor.objects.filter(user=user).exists():
            return False
        return Voter.objects.filter(user=user).exists()
