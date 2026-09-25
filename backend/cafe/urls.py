from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    AddOnViewSet, AttendanceViewSet, CategoryViewSet, MenuViewSet, NotificationViewSet,
    OfferViewSet, OrderViewSet, PaymentViewSet, ProductOptionViewSet, ReservationViewSet,
    StaffNoteViewSet, StaffViewSet, TableViewSet,
    analytics, stripe_webhook,
)

router = DefaultRouter()
router.register("menu", MenuViewSet)
router.register("menu-options", ProductOptionViewSet)
router.register("menu-addons", AddOnViewSet)
router.register("categories", CategoryViewSet)
router.register("tables", TableViewSet)
router.register("orders", OrderViewSet)
router.register("payments", PaymentViewSet)
router.register("offers", OfferViewSet)
router.register("reservations", ReservationViewSet)
router.register("staff", StaffViewSet)
router.register("attendance", AttendanceViewSet)
router.register("notifications", NotificationViewSet)
router.register("notes", StaffNoteViewSet)

urlpatterns = [
    path("payments/stripe-webhook/", stripe_webhook),
    path("", include(router.urls)),
    path("analytics/", analytics),
]
