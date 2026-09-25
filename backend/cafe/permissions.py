from rest_framework.permissions import BasePermission

class HasStaffRole(BasePermission):
    """Use profile roles so customer token endpoints remain anonymous."""
    allowed_roles = ()
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and (request.user.is_superuser or getattr(getattr(request.user, "staff_profile", None), "role", None) in self.allowed_roles))

class IsManager(HasStaffRole): allowed_roles = ("MANAGER",)
class IsStaff(HasStaffRole): allowed_roles = ("CASHIER", "KITCHEN", "WAITER", "MANAGER")
class IsCashier(HasStaffRole): allowed_roles = ("CASHIER", "MANAGER")
class IsKitchen(HasStaffRole): allowed_roles = ("KITCHEN", "MANAGER")
class IsWaiter(HasStaffRole): allowed_roles = ("WAITER", "MANAGER")
