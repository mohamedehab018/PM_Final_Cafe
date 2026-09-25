"""
Views for the PM Café REST API.

Roles and access matrix:
  - Public (no auth): menu list/retrieve, categories list/retrieve, QR scan, order create/mine
  - CASHIER (+ MANAGER): order approve/reject/list, payments
  - KITCHEN (+ MANAGER): order start/ready, mark item unavailable
  - WAITER  (+ MANAGER): order deliver, table state updates
  - MANAGER only: full CRUD on menu, categories, tables, offers, staff, analytics

Order flow (Part 3B revision — no cashier-approval gate for normal orders):
  Customer → AWAITING_PAYMENT → online payment / cashier-recorded payment verified
  → APPROVED (now visible to Kitchen) → Kitchen start → PREPARING
  → Kitchen ready → READY → Waiter pickup/deliver → DELIVERED → session close → COMPLETED
  Cashier approve/reject still exist for the exception case of cancelling an
  order before it is paid; they are not required for the normal path.
"""
import uuid
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db.models import Count, Sum, Q, ProtectedError, CharField
from django.db.models.functions import ExtractHour, Replace
from django.db.models import Value
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models import (
    AddOn, Branch, CafeTable, Category, MenuItem, Notification,
    Offer, Order, OrderItem, OrderStatusHistory, Payment, ProductOption, Reservation,
    StaffAttendance, StaffNote, StaffProfile, StaffWorkRecord, TableSession,
)
from .serializers import (
    AddOnWriteSerializer, CategorySerializer, MenuItemSerializer, NotificationSerializer,
    OfferSerializer, KitchenOrderSerializer, OrderItemSerializer, OrderSerializer, PaymentSerializer,
    ProductOptionWriteSerializer,
    ReservationSerializer, StaffAdjustmentSerializer, StaffAttendanceSerializer, StaffNoteSerializer,
    StaffSerializer, StaffWorkRecordSerializer, TableSerializer, TableSessionSerializer,
)
from .permissions import IsCashier, IsKitchen, IsManager, IsStaff, IsWaiter


def _stripe_client():
    """Load Stripe lazily so cash/manual deployments work without Stripe enabled."""
    try:
        import stripe
    except ImportError:
        return None
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe



def _settle_order_after_payment(order):
    """
    Called after any payment is saved as PAID.

    If the order is in AWAITING_PAYMENT (or PENDING_APPROVAL for legacy rows)
    and is now fully paid, automatically transition it to APPROVED so it
    appears on the Kitchen board without requiring manual cashier intervention.
    Returns the (possibly-updated) order.
    """
    if order.status not in (
        Order.Status.AWAITING_PAYMENT,
        Order.Status.PENDING_APPROVAL,
    ):
        return order

    paid = (
        order.payments.filter(status=Payment.Status.PAID)
        .aggregate(total=Sum("amount"))["total"]
        or Decimal("0.00")
    )
    if paid < order.total:
        return order          # partial — wait for the rest

    with transaction.atomic():
        order.status = Order.Status.APPROVED
        order.save(update_fields=["status"])
        OrderStatusHistory.objects.create(
            order=order,
            status=Order.Status.APPROVED,
            changed_by=None,
            note="Auto-approved: payment verified in full.",
        )
        Notification.objects.create(
            order=order,
            audience="CUSTOMER",
            title=f"Order {order.number} confirmed",
            body="Payment verified — your order has been sent to the kitchen.",
        )
        Notification.objects.create(
            order=order,
            audience="KITCHEN",
            title=f"New order {order.number}",
            body=(
                f"Order {order.number}"
                + (f" · Table {order.session.table.number}" if order.session else "")
                + " is paid and ready to prepare."
            ),
        )
    return order


def _customer_session_for_request(request):
    token = request.headers.get("X-Table-Session")
    return TableSession.objects.filter(token=token, closed_at__isnull=True).select_related("table").first()


def _payment_notification(payment, title, body):
    Notification.objects.create(
        order=payment.order,
        audience="CUSTOMER",
        title=title,
        body=body,
    )


# ── Menu ──────────────────────────────────────────────────────────────────────

class MenuViewSet(viewsets.ModelViewSet):
    """
    Public read access; MANAGER-only write.
    Supports filtering: ?category=<id>, ?sold_out=true, ?active=true
    """
    queryset = (
        MenuItem.objects
        .select_related("category")
        .prefetch_related("options", "addons", "offers")
        .order_by("category__position", "name")
    )
    serializer_class = MenuItemSerializer

    def get_permissions(self):
        """
        FIX (Part 1 gap): this method previously ignored the per-action
        permission_classes declared on @action decorators below (mark_sold_out
        was declared IsKitchen but this method returned IsManager() for any
        action other than list/retrieve, silently overriding it). Now it
        checks self.action explicitly so KITCHEN can actually call
        mark_sold_out, matching its own docstring.
        """
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        if self.action in ("mark_sold_out", "restock"):
            return [IsKitchen()]
        return [IsManager()]

    def get_queryset(self):
        qs = super().get_queryset()
        cat = self.request.query_params.get("category")
        sold_out = self.request.query_params.get("sold_out")
        active = self.request.query_params.get("active")
        if cat:
            qs = qs.filter(category_id=cat)
        if sold_out is not None:
            qs = qs.filter(sold_out=sold_out.lower() == "true")
        if active is not None:
            wants_active = active.lower() == "true"
            qs = qs.filter(active=wants_active)
            if wants_active:
                # Part 3A: deactivating a whole category in Menu management hides its
                # dishes from the customer feed too, without touching the items' own flag.
                qs = qs.filter(category__active=True)
        return qs

    def destroy(self, request, *args, **kwargs):
        """
        Part 3A: MANAGER deletes a dish. OrderItem.menu_item is PROTECT so historical
        orders can never lose their product — when the dish has order history it is
        deactivated instead of deleted (same pattern as TableViewSet.destroy) rather
        than surfacing a raw ProtectedError as a 500. A dish with no history is removed.
        """
        item = self.get_object()
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            item.active = False
            item.save(update_fields=["active"])
            return Response(
                {
                    "detail": "This item appears in past orders, so it was deactivated "
                              "instead of deleted to preserve order history.",
                    "item": self.get_serializer(item).data,
                },
                status=200,
            )

    @action(detail=True, methods=["post"], permission_classes=[IsManager])
    def toggle_availability(self, request, pk=None):
        """MANAGER toggles sold_out flag on a single product."""
        item = self.get_object()
        item.sold_out = not item.sold_out
        item.save(update_fields=["sold_out"])
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=["post"], permission_classes=[IsKitchen])
    def mark_sold_out(self, request, pk=None):
        """
        KITCHEN marks an item as sold out during service.
        This never deletes or deactivates the item/its options/add-ons/image —
        it only flips the reversible `sold_out` flag, which immediately hides
        the item from new customer orders (see MenuViewSet.get_queryset /
        the customer menu, which reads this same field). Manager and other
        staff can still see the item everywhere else. Use `restock` below to
        reverse this.
        """
        item = self.get_object()
        item.sold_out = True
        item.save(update_fields=["sold_out"])
        Notification.objects.create(
            audience="CASHIER",
            title="Item sold out",
            body=f"{item.name} has been marked sold out by the kitchen.",
        )
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=["post"], permission_classes=[IsKitchen])
    def restock(self, request, pk=None):
        """
        KITCHEN (or MANAGER) reverses mark_sold_out: AVAILABLE ↔ SOLD_OUT.
        Same DB row, same image/price/options/add-ons — nothing is recreated.
        The item becomes orderable on the customer menu again immediately.
        """
        item = self.get_object()
        item.sold_out = False
        item.save(update_fields=["sold_out"])
        Notification.objects.create(
            audience="CASHIER",
            title="Item back in stock",
            body=f"{item.name} is available again.",
        )
        return Response(self.get_serializer(item).data)


class ProductOptionViewSet(viewsets.ModelViewSet):
    """
    Part 3B: MANAGER-only CRUD for a dish's options (Regular / Large / …), used by
    the Manager Menu Builder's Options & Add-ons panel. Read access mirrors the
    public menu (options are already embedded read-only in MenuItemSerializer),
    but writes go through this dedicated endpoint so options can be created,
    edited and deactivated independently of the parent MenuItem PATCH.
    Supports ?item=<menu_item_id> to scope the list to one dish.
    """
    queryset = ProductOption.objects.select_related("item").order_by("item", "id")
    serializer_class = ProductOptionWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [IsManager()]

    def get_queryset(self):
        qs = super().get_queryset()
        item = self.request.query_params.get("item")
        if item:
            qs = qs.filter(item_id=item)
        return qs

    def destroy(self, request, *args, **kwargs):
        """
        Options referenced by past OrderItem.options (a JSON snapshot of names,
        not a foreign key) have no DB link, so deleting one can never break order
        history — a hard delete is always safe. Managers who want to hide an
        option from new orders without losing it should deactivate it instead.
        """
        return super().destroy(request, *args, **kwargs)


class AddOnViewSet(viewsets.ModelViewSet):
    """Part 3B: MANAGER-only CRUD for a dish's add-ons (Extra cheese, Extra sauce, …)."""
    queryset = AddOn.objects.select_related("item").order_by("item", "id")
    serializer_class = AddOnWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [IsManager()]

    def get_queryset(self):
        qs = super().get_queryset()
        item = self.request.query_params.get("item")
        if item:
            qs = qs.filter(item_id=item)
        return qs


class CategoryViewSet(viewsets.ModelViewSet):
    """Public read; MANAGER-only write."""
    queryset = (
        Category.objects
        .prefetch_related("items__options", "items__addons")
        .order_by("position")
    )
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [IsManager()]

    def perform_create(self, serializer):
        """Part 3A: Category.branch is not client-writable — new categories belong to the manager's branch."""
        branch = (
            getattr(getattr(self.request.user, "staff_profile", None), "branch", None)
            or Branch.objects.first()
        )
        serializer.save(branch=branch)

    def destroy(self, request, *args, **kwargs):
        """
        Part 3A: MenuItem.category is PROTECT, so a category that still holds dishes
        cannot be hard-deleted. Deactivate it instead (its dishes leave the public
        menu, nothing is lost) rather than returning a raw ProtectedError as a 500.
        An empty category is removed for real.
        """
        category = self.get_object()
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            category.active = False
            category.save(update_fields=["active"])
            return Response(
                {
                    "detail": "This category still contains menu items, so it was deactivated "
                              "instead of deleted. Move or delete its items to remove it fully.",
                    "category": {"id": category.id, "name": category.name, "active": category.active},
                },
                status=200,
            )


# ── Tables ────────────────────────────────────────────────────────────────────

class TableViewSet(viewsets.ModelViewSet):
    """
    MANAGER manages tables.
    /api/tables/scan/?token=<uuid>  — public endpoint that opens a new session.
    """
    queryset = CafeTable.objects.prefetch_related("sessions").order_by("number")
    serializer_class = TableSerializer

    def get_permissions(self):
        """
        FIX (Part 1 gap): previously ignored update_status's own IsWaiter
        @action decorator below and fell through to IsManager() for any
        action other than scan/list/retrieve — waiters could not update
        table status, contradicting this class's own docstring.
        """
        if self.action == "scan":
            return [permissions.AllowAny()]
        if self.action in ("list", "retrieve"):
            return [IsStaff()]
        if self.action == "update_status":
            return [IsWaiter()]
        return [IsManager()]

    def perform_create(self, serializer):
        branch = (
            getattr(getattr(self.request.user, "staff_profile", None), "branch", None)
            or Branch.objects.first()
        )
        serializer.save(branch=branch)

    def destroy(self, request, *args, **kwargs):
        """
        Removing a table must preserve historical orders/sessions (spec requirement).
        TableSession.table is on_delete=PROTECT, so Django refuses the hard delete
        outright whenever the table has any session history — that already protects
        the data, but a raw ProtectedError would otherwise surface as a raw 500.
        Catch it and deactivate the table instead: it disappears from the live floor
        plan/QR flow (active=False) while every past order and session stays intact.
        A table with no history at all is removed for real.
        """
        table = self.get_object()
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            table.active = False
            table.status = CafeTable.Status.AVAILABLE
            table.save(update_fields=["active", "status"])
            return Response(
                {
                    "detail": "This table has order/session history, so it was deactivated "
                              "instead of deleted to preserve that history.",
                    "table": TableSerializer(table).data,
                },
                status=200,
            )

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def scan(self, request):
        """
        Customer scans a QR code → receives table info + a fresh session token.
        The session token locks the customer to this table for the duration of
        their visit. They cannot access any other table's orders or bill.
        """
        token = request.query_params.get("token")
        table = CafeTable.objects.filter(qr_token=token).first()
        # Older SQLite demo databases stored UUID QR tokens with hyphens,
        # while UUIDField lookups normalize query parameters to the compact
        # form. Compare both representations so the bundled Table 07 demo QR
        # remains usable after the current migrations are applied.
        if not table and token:
            normalized_token = token.replace("-", "").lower()
            table = (
                CafeTable.objects
                .annotate(
                    qr_token_normalized=Replace(
                        "qr_token", Value("-"), Value(""), output_field=CharField()
                    )
                )
                .filter(qr_token_normalized=normalized_token)
                .first()
            )
        if not table:
            return Response({"detail": "Unknown QR token."}, status=404)
        if not table.active:
            return Response({"detail": "This table is not currently in service. Please ask a staff member for help."}, status=409)
        if table.status == CafeTable.Status.RESERVED:
            return Response(
                {"detail": "This table is reserved for an event right now. Please ask staff to seat you."},
                status=409,
            )
        if table.status == CafeTable.Status.NEEDS_CLEANING:
            return Response(
                {"detail": "This table is being cleaned. Please ask staff for a moment before sitting down."},
                status=409,
            )
        session = TableSession.objects.create(table=table)
        table.status = CafeTable.Status.OCCUPIED
        table.save(update_fields=["status"])
        return Response({
            "table": TableSerializer(table).data,
            "session": TableSessionSerializer(session).data,
            "session_token": str(session.token),
        })

    @action(detail=True, methods=["post"], permission_classes=[IsWaiter])
    def update_status(self, request, pk=None):
        """WAITER updates table status after delivery or cleaning."""
        table = self.get_object()
        new_status = request.data.get("status")
        if new_status not in [s.value for s in CafeTable.Status]:
            return Response({"detail": "Invalid status."}, status=400)
        table.status = new_status
        table.save(update_fields=["status"])
        return Response(TableSerializer(table).data)


# ── Orders ────────────────────────────────────────────────────────────────────

class OrderViewSet(viewsets.ModelViewSet):
    """
    Full order lifecycle endpoint.
    - create / mine: public (customer)
    - approve / reject / list: CASHIER+
    - start / ready: KITCHEN+
    - deliver: WAITER+
    """
    queryset = (
        Order.objects
        .select_related("session__table", "branch")
        .prefetch_related("items", "payments", "history")
        .order_by("priority", "created_at")
    )
    serializer_class = OrderSerializer

    def get_serializer_class(self):
        # Enforce the financial boundary server-side. Kitchen users cannot
        # obtain unit_price, line_total, order total, payments or cashier data.
        profile = getattr(self.request.user, "staff_profile", None)
        if profile and profile.role == StaffProfile.Role.KITCHEN:
            return KitchenOrderSerializer
        return OrderSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["table_session_token"] = self.request.headers.get("X-Table-Session")
        return context

    def get_permissions(self):
        """
        FIX (Part 1 gap): previously returned IsCashier() for every action
        other than create/mine, silently overriding the IsKitchen/IsWaiter
        @action decorators on start/ready/deliver/add_kitchen_note below.
        That meant kitchen staff could not start or ready an order, and
        waiters could not mark one delivered, despite this class's own
        docstring saying otherwise. Now each action's own declared role
        is actually enforced.
        """
        if self.action in ("create", "mine", "resubmit", "demo_pay"):
            return [permissions.AllowAny()]
        if self.action == "list":
            return [IsStaff()]
        if self.action in ("approve", "reject", "complete"):
            return [IsCashier()]
        if self.action in ("start", "ready", "add_kitchen_note"):
            return [IsKitchen()]
        if self.action in ("pickup", "deliver"):
            return [IsWaiter()]
        return [IsStaff()]

    def get_queryset(self):
        """
        Optional ?status=A,B,C filter so Cashier/Waiter boards can ask for just
        the slice they act on (e.g. ?status=PENDING_APPROVAL, ?status=READY,PICKED_UP)
        instead of always pulling every order and filtering client-side.
        Kitchen's existing call with no status param is unaffected.
        """
        qs = super().get_queryset()
        statuses = self.request.query_params.get("status")
        if statuses:
            qs = qs.filter(status__in=[s.strip() for s in statuses.split(",") if s.strip()])
        return qs

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def mine(self, request):
        """
        Customer polls their own orders using the customer_token from the
        order submission response. Token is UUID-scoped; customers cannot
        enumerate other tables' orders.
        """
        session_token = request.headers.get("X-Table-Session")
        session = TableSession.objects.filter(token=session_token, closed_at__isnull=True).first()
        if not session:
            return Response({"detail": "A valid table session is required."}, status=403)
        orders = self.get_queryset().filter(session=session)
        return Response(self.get_serializer(orders, many=True).data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.AllowAny])
    def resubmit(self, request, pk=None):
        """Replace items on a rejected order, scoped to its original table session."""
        order = self.get_object()
        session_token = request.headers.get("X-Table-Session")
        if not order.session or str(order.session.token) != str(session_token):
            return Response({"detail": "This order does not belong to the active table session."}, status=403)
        if order.status != Order.Status.REJECTED:
            return Response({"detail": "Only rejected orders can be edited and resubmitted."}, status=400)
        line_serializer = OrderItemSerializer(data=request.data.get("items", []), many=True)
        line_serializer.is_valid(raise_exception=True)
        lines = line_serializer.validated_data
        if not lines:
            return Response({"items": "At least one item is required."}, status=400)
        with transaction.atomic():
            order.items.all().delete()
            for line in lines:
                OrderSerializer.create_snapshot_line(order, line)
            subtotal = sum((line.line_total for line in order.items.all()), Decimal("0.00"))
            service_charge = (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))
            tax = (subtotal * Decimal("0.14")).quantize(Decimal("0.01"))
            order.subtotal = subtotal
            order.service_charge = service_charge
            order.tax = tax
            order.total_amount = subtotal + service_charge + tax
            order.custom_request = request.data.get("custom_request", order.custom_request)
            order.status = Order.Status.AWAITING_PAYMENT
            order.rejection_reason = ""
            order.cashier_note = ""
            order.save()
            OrderStatusHistory.objects.create(order=order, status=order.status, note="Customer resubmitted order")
            Notification.objects.create(
                order=order, audience="CUSTOMER", title=f"Order {order.number}",
                body="Your updated order is ready for payment.",
            )
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=["post"], permission_classes=[IsCashier])
    def approve(self, request, pk=None):
        """CASHIER approves the order → customer is notified to proceed to payment."""
        return self._transition(self.get_object(), "APPROVED", request)

    @action(detail=True, methods=["post"], permission_classes=[IsCashier])
    def reject(self, request, pk=None):
        """
        CASHIER rejects with a reason → customer is notified and can edit/resubmit.
        Rejection reasons include: Sold out, Unavailable, Ingredient unavailable,
        Cannot prepare, Not on menu, Not offered, Kitchen issue, Temporary unavailable, Other.
        """
        order = self.get_object()
        reason = request.data.get("reason", "Other")
        note = request.data.get("note", "")
        return self._transition(order, "REJECTED", request, reason=reason, note=note)

    @action(detail=True, methods=["post"], permission_classes=[IsKitchen])
    def start(self, request, pk=None):
        """KITCHEN starts preparing an approved order."""
        return self._transition(self.get_object(), "PREPARING", request)

    @action(detail=True, methods=["post"], permission_classes=[IsKitchen])
    def ready(self, request, pk=None):
        """KITCHEN marks the order ready → waiter and customer are notified."""
        order = self.get_object()
        result = self._transition(order, "READY", request)
        # Notify the waiter to pick up the order from the kitchen
        table_num = order.session.table.number if order.session else "—"
        Notification.objects.create(
            order=order,
            audience="WAITER",
            title=f"Table {table_num} order is ready",
            body=f"Table {table_num} order #{order.number} is ready — pick it up from kitchen.",
        )
        return result

    @action(detail=True, methods=["post"], permission_classes=[IsWaiter])
    def pickup(self, request, pk=None):
        """WAITER claims a ready order from the kitchen counter (Part 3B)."""
        return self._transition(self.get_object(), "PICKED_UP", request)

    @action(detail=True, methods=["post"], permission_classes=[IsWaiter])
    def deliver(self, request, pk=None):
        """WAITER marks the order delivered/served to the table."""
        return self._transition(self.get_object(), "DELIVERED", request)

    @action(detail=True, methods=["post"], permission_classes=[IsCashier])
    def complete(self, request, pk=None):
        """CASHIER/MANAGER closes the order after payment is confirmed."""
        return self._transition(self.get_object(), "COMPLETED", request)

    @action(detail=True, methods=["post"], permission_classes=[IsKitchen])
    def add_kitchen_note(self, request, pk=None):
        """MANAGER or KITCHEN adds a note visible to the kitchen team.
        FIX (Part 1): was permission_classes=[IsManager], which contradicted
        the docstring and blocked KITCHEN from adding its own notes.
        IsKitchen.allowed_roles = ("KITCHEN", "MANAGER") so both still work.
        """
        order = self.get_object()
        order.kitchen_note = request.data.get("note", "")
        order.save(update_fields=["kitchen_note"])
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.AllowAny], url_path="demo_pay")
    def demo_pay(self, request, pk=None):
        """
        DEMO-ONLY: simulate a completed payment without a real payment gateway.

        Security:
        - Gated by settings.DEMO_PAYMENTS_ENABLED (set DEMO_PAYMENTS_ENABLED=0
          to disable before production; returns 503).
        - Caller must supply the X-Table-Session header whose session owns the
          order, so a random visitor cannot pay someone else's order.
        - The Payment record is stamped gateway="DEMO" and reference DEMO-…
          so cashier/manager reports can always distinguish it from real money.
        - Already-paid orders are rejected with 400 to prevent double-booking.
        """
        from django.conf import settings as django_settings
        if not getattr(django_settings, "DEMO_PAYMENTS_ENABLED", True):
            return Response(
                {"detail": "Demo payments are disabled on this server."},
                status=503,
            )

        order = self.get_object()

        # Verify the table session owns this order
        session_token = request.headers.get("X-Table-Session")
        session = TableSession.objects.filter(token=session_token, closed_at__isnull=True).first()
        if not session or order.session_id != session.id:
            return Response(
                {"detail": "A valid table session for this order is required."},
                status=403,
            )

        # Block double-payment
        already_paid = (
            order.payments.filter(status=Payment.Status.PAID)
            .aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        if already_paid >= order.total:
            return Response({"detail": "This order has already been paid."}, status=400)

        if order.status not in (
            Order.Status.AWAITING_PAYMENT,
            Order.Status.PENDING_APPROVAL,
            Order.Status.APPROVED,
        ):
            return Response(
                {"detail": f"Payment is not available for an order in status '{order.status}'."},
                status=400,
            )

        with transaction.atomic():
            remaining = (order.total - already_paid).quantize(Decimal("0.01"))
            payment = Payment.objects.create(
                order=order,
                amount=remaining,
                method=Payment.Method.CASH,
                status=Payment.Status.PAID,
                gateway="DEMO",
                reference_id=f"DEMO-{uuid.uuid4().hex[:16].upper()}",
                paid_at=timezone.now(),
            )
            order.refresh_from_db()
            _settle_order_after_payment(order)

        order.refresh_from_db()
        return Response({
            **self.get_serializer(order).data,
            "_demo": True,
            "_payment_id": payment.id,
            "_reference": payment.reference_id,
        })

    def _transition(self, order, new_status, request, reason="", note=""):
        """
        Central status transition helper.
        - Updates order status and rejection_reason/cashier_note fields.
        - Appends a status history record (audit trail).
        - Creates a CUSTOMER notification for visibility.
        """
        order.status = new_status
        if reason:
            order.rejection_reason = reason
        if note:
            order.cashier_note = note
        order.save()
        OrderStatusHistory.objects.create(
            order=order,
            status=new_status,
            changed_by=request.user if request.user.is_authenticated else None,
            note=note,
        )
        Notification.objects.create(
            order=order,
            audience="CUSTOMER",
            title=f"Order {order.number}",
            body=f"Your order status is now: {new_status.replace('_', ' ').title()}."
            + (f" Reason: {reason}" if reason else ""),
        )
        return Response(self.get_serializer(order).data)


# ── Payments ──────────────────────────────────────────────────────────────────

class PaymentViewSet(viewsets.ModelViewSet):
    """
    CASHIER records payments.
    Methods: CASH, CARD, INSTAPAY, VODAFONE_CASH.
    Each payment record can cover partial or full amount (split-bill support).
    """
    queryset = Payment.objects.select_related("order").order_by("-created_at")
    serializer_class = PaymentSerializer
    def get_permissions(self):
        if self.action in ("create", "checkout_status", "checkout"):
            return [permissions.AllowAny()]
        return [IsCashier()]

    def _validate_customer_order(self, request, order):
        session = _customer_session_for_request(request)
        if not session or order.session_id != session.id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("A valid table session for this order is required.")
        return session

    @action(detail=False, methods=["post"], permission_classes=[permissions.AllowAny])
    def checkout(self, request):
        """
        Create or reuse a Stripe Checkout Session.

        The browser only receives Stripe's hosted checkout URL. It can never
        mark a Payment PAID; the webhook below is the only path that does so.
        """
        stripe = _stripe_client()
        if not settings.STRIPE_SECRET_KEY or stripe is None:
            return Response(
                {"detail": "Online card payments are not configured. Use cash/manual payment or configure Stripe."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        order = Order.objects.filter(pk=request.data.get("order")).first()
        if not order:
            return Response({"detail": "Order not found."}, status=404)
        self._validate_customer_order(request, order)
        if order.status not in (Order.Status.AWAITING_PAYMENT, Order.Status.APPROVED):
            return Response({"detail": "Online payment is not available for this order."}, status=400)

        paid = (
            order.payments.filter(status=Payment.Status.PAID)
            .aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        remaining = (order.total - paid).quantize(Decimal("0.01"))
        if remaining <= 0:
            return Response({"detail": "This order is already fully paid."}, status=400)

        existing = order.payments.filter(
            method=Payment.Method.CARD,
            gateway="STRIPE",
            status=Payment.Status.PENDING,
            checkout_session_id__isnull=False,
        ).order_by("-created_at").first()
        if existing and existing.checkout_url:
            return Response({
                "payment_id": existing.id,
                "checkout_session_id": existing.checkout_session_id,
                "checkout_url": existing.checkout_url,
                "status": existing.status,
            })

        idempotency_key = uuid.uuid4().hex
        payment = Payment.objects.create(
            order=order,
            amount=remaining,
            method=Payment.Method.CARD,
            status=Payment.Status.PENDING,
            gateway="STRIPE",
            idempotency_key=idempotency_key,
        )
        line_items = []
        for item in order.items.all():
            line_items.append({
                "price_data": {
                    "currency": settings.STRIPE_CURRENCY,
                    "product_data": {"name": item.name_snapshot},
                    "unit_amount": int(
                        (item.unit_price * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
                    ),
                },
                "quantity": item.quantity,
            })
        if order.service_charge:
            line_items.append({
                "price_data": {
                    "currency": settings.STRIPE_CURRENCY,
                    "product_data": {"name": "Service charge"},
                    "unit_amount": int((order.service_charge * Decimal("100")).quantize(Decimal("1"))),
                },
                "quantity": 1,
            })
        if order.tax:
            line_items.append({
                "price_data": {
                    "currency": settings.STRIPE_CURRENCY,
                    "product_data": {"name": "Tax"},
                    "unit_amount": int((order.tax * Decimal("100")).quantize(Decimal("1"))),
                },
                "quantity": 1,
            })

        success_url = settings.STRIPE_SUCCESS_URL or f"{request.headers.get('Origin', 'http://127.0.0.1:5510')}/?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = settings.STRIPE_CANCEL_URL or f"{request.headers.get('Origin', 'http://127.0.0.1:5510')}/?payment=cancelled"
        try:
            checkout_session = stripe.checkout.Session.create(
                mode="payment",
                line_items=line_items,
                success_url=success_url,
                cancel_url=cancel_url,
                client_reference_id=str(payment.id),
                metadata={"payment_id": str(payment.id), "order_id": str(order.id)},
                payment_intent_data={"metadata": {"payment_id": str(payment.id), "order_id": str(order.id)}},
                idempotency_key=idempotency_key,
            )
        except Exception as exc:
            payment.status = Payment.Status.FAILED
            payment.failure_reason = str(exc)[:1000]
            payment.save(update_fields=["status", "failure_reason"])
            return Response({"detail": "Stripe could not start checkout.", "error": str(exc)}, status=502)

        payment.checkout_session_id = checkout_session.id
        payment.checkout_url = checkout_session.url or ""
        payment.save(update_fields=["checkout_session_id", "checkout_url"])
        return Response({
            "payment_id": payment.id,
            "checkout_session_id": payment.checkout_session_id,
            "checkout_url": payment.checkout_url,
            "status": payment.status,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny], url_path="checkout-status")
    def checkout_status(self, request):
        payment = Payment.objects.select_related("order", "order__session").filter(
            checkout_session_id=request.query_params.get("session_id"),
        ).first()
        if not payment:
            return Response({"detail": "Checkout payment not found."}, status=404)
        self._validate_customer_order(request, payment.order)
        return Response({
            "payment_id": payment.id,
            "order": payment.order_id,
            "status": payment.status,
            "reference_id": payment.reference_id,
            "failure_reason": payment.failure_reason,
        })

    def perform_create(self, serializer):
        order = serializer.validated_data["order"]
        if not getattr(self.request.user, "is_authenticated", False):
            self._validate_customer_order(self.request, order)
            if order.status not in (
                Order.Status.AWAITING_PAYMENT, Order.Status.APPROVED,
                Order.Status.PREPARING, Order.Status.READY,
                Order.Status.PICKED_UP, Order.Status.DELIVERED,
            ):
                from rest_framework.exceptions import ValidationError
                raise ValidationError("This order is not ready for payment.")
        if serializer.validated_data.get("method") == Payment.Method.CARD and not getattr(
            self.request.user, "is_authenticated", False
        ):
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Use hosted online checkout for card payments.")
        if serializer.validated_data.get("method") == Payment.Method.CARD:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Card payments must use the hosted Stripe Checkout flow.")
        paid = (
            order.payments.filter(status=Payment.Status.PAID)
            .aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        amount = serializer.validated_data["amount"]
        if amount <= 0 or amount > order.total - paid:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Payment amount exceeds the order balance.")
        payment = serializer.save(
            status=Payment.Status.PAID,
            reference_id=f"MANUAL-{uuid.uuid4().hex[:16].upper()}",
            paid_at=timezone.now(),
        )
        _settle_order_after_payment(payment.order)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def stripe_webhook(request):
    """
    Stripe's signed server-to-server callback.

    Checkout return URLs are deliberately not trusted for payment state. This
    endpoint verifies Stripe's signature and is idempotent: replaying an event
    never creates a second payment or notification.
    """
    stripe = _stripe_client()
    if stripe is None or not settings.STRIPE_WEBHOOK_SECRET:
        return Response({"detail": "Stripe webhook is not configured."}, status=503)
    signature = request.headers.get("Stripe-Signature", "")
    try:
        event = stripe.Webhook.construct_event(
            request.body, signature, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        return Response({"detail": "Invalid webhook payload."}, status=400)
    except Exception:
        return Response({"detail": "Invalid webhook signature."}, status=400)

    event_type = event.get("type", "")
    session = event.get("data", {}).get("object", {})
    if event_type not in {
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "checkout.session.expired",
    }:
        return Response({"received": True})

    metadata = session.get("metadata") or {}
    payment_id = metadata.get("payment_id") or session.get("client_reference_id")
    if not payment_id:
        return Response({"received": True})

    try:
        with transaction.atomic():
            payment = Payment.objects.select_for_update().select_related("order").get(pk=payment_id)
            if payment.checkout_session_id and payment.checkout_session_id != session.get("id"):
                return Response({"detail": "Checkout session mismatch."}, status=400)
            if payment.status == Payment.Status.PAID:
                return Response({"received": True, "status": payment.status})

            if event_type in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
                # A completed Checkout Session can still represent an async
                # payment. Only Stripe's paid signal is allowed to move PAID.
                if event_type == "checkout.session.completed" and session.get("payment_status") != "paid":
                    return Response({"received": True, "status": payment.status})
                payment.status = Payment.Status.PAID
                payment.reference_id = session.get("payment_intent") or session.get("id", "")
                payment.paid_at = timezone.now()
                payment.save(update_fields=["status", "reference_id", "paid_at"])
                _settle_order_after_payment(payment.order)
                _payment_notification(
                    payment,
                    "Payment confirmed",
                    f"Payment for order {payment.order.number} was confirmed securely.",
                )
            else:
                payment.status = Payment.Status.FAILED
                payment.failure_reason = (
                    "Stripe checkout expired."
                    if event_type == "checkout.session.expired"
                    else "Stripe reported that the payment failed."
                )
                payment.save(update_fields=["status", "failure_reason"])
    except Payment.DoesNotExist:
        return Response({"received": True})

    return Response({"received": True})


# ── Reservations ──────────────────────────────────────────────────────────────

class ReservationViewSet(viewsets.ModelViewSet):
    """
    CASHIER (+ MANAGER) manages café reservations end-to-end.

    - list/retrieve/create/update: CASHIER+, filtered by ?status=, ?date=.
    - confirm: PENDING → CONFIRMED. Any assigned table that is currently
      AVAILABLE flips to CafeTable.Status.RESERVED so it cannot be seated as
      a normal walk-in during the reservation window.
    - cancel / complete: releases any RESERVED table back to AVAILABLE.
    Overlap and inactive-table checks live in ReservationSerializer.validate()
    so they are enforced on create AND update, not just in this view.
    """
    queryset = Reservation.objects.select_related("branch", "created_by").prefetch_related("tables")
    serializer_class = ReservationSerializer
    permission_classes = [IsCashier]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get("status")
        date = self.request.query_params.get("date")
        date_from = self.request.query_params.get("from")
        date_to = self.request.query_params.get("to")
        if status_param:
            qs = qs.filter(status__in=[s.strip() for s in status_param.split(",") if s.strip()])
        if date:
            qs = qs.filter(date=date)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs

    def perform_create(self, serializer):
        branch = (
            getattr(getattr(self.request.user, "staff_profile", None), "branch", None)
            or Branch.objects.first()
        )
        serializer.save(branch=branch, created_by=self.request.user)

    def _release_tables(self, reservation):
        """Only release tables this reservation actually put into RESERVED —
        a table already OCCUPIED by a live walk-in session is left untouched."""
        for table in reservation.tables.all():
            if table.status == CafeTable.Status.RESERVED:
                table.status = CafeTable.Status.AVAILABLE
                table.save(update_fields=["status"])

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        reservation = self.get_object()
        if reservation.status != Reservation.Status.PENDING:
            return Response({"detail": "Only pending reservations can be confirmed."}, status=400)
        reservation.status = Reservation.Status.CONFIRMED
        reservation.save(update_fields=["status"])
        for table in reservation.tables.all():
            if table.status == CafeTable.Status.AVAILABLE:
                table.status = CafeTable.Status.RESERVED
                table.save(update_fields=["status"])
        Notification.objects.create(
            audience="CASHIER",
            title="Reservation confirmed",
            body=f"{reservation.customer_name}'s {reservation.get_event_type_display()} reservation on "
                 f"{reservation.date} at {reservation.start_time.strftime('%H:%M')} is confirmed.",
        )
        return Response(self.get_serializer(reservation).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        reservation = self.get_object()
        if reservation.status in (Reservation.Status.COMPLETED, Reservation.Status.CANCELLED):
            return Response({"detail": "This reservation is already closed."}, status=400)
        reservation.status = Reservation.Status.CANCELLED
        reservation.save(update_fields=["status"])
        self._release_tables(reservation)
        return Response(self.get_serializer(reservation).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        reservation = self.get_object()
        if reservation.status != Reservation.Status.CONFIRMED:
            return Response({"detail": "Only confirmed reservations can be marked completed."}, status=400)
        reservation.status = Reservation.Status.COMPLETED
        reservation.save(update_fields=["status"])
        self._release_tables(reservation)
        return Response(self.get_serializer(reservation).data)


# ── Offers ────────────────────────────────────────────────────────────────────

class OfferViewSet(viewsets.ModelViewSet):
    """
    MANAGER manages offers (create/edit/delete/activate/deactivate).
    Public read returns all offers; the frontend filters with is_currently_active.
    """
    queryset = Offer.objects.prefetch_related("items", "categories").order_by("-priority")
    serializer_class = OfferSerializer

    def get_permissions(self):
        """
        FIX (Part 1 gap): previously returned IsManager() for every action
        other than list/retrieve, which silently overrode the AllowAny
        @action decorator on `active` below. That locked the public
        "active offers" endpoint — the one the customer-facing menu is
        meant to call — behind manager auth. Now `active` is actually public.
        """
        if self.action in ("list", "retrieve", "active"):
            return [permissions.AllowAny()]
        return [IsManager()]

    def perform_create(self, serializer):
        branch = (
            getattr(getattr(self.request.user, "staff_profile", None), "branch", None)
            or Branch.objects.first()
        )
        serializer.save(branch=branch)

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def active(self, request):
        """Returns only currently active offers for the customer menu."""
        offers = [o for o in self.get_queryset() if o.is_currently_active()]
        return Response(self.get_serializer(offers, many=True).data)


# ── Staff ─────────────────────────────────────────────────────────────────────

class StaffViewSet(viewsets.ModelViewSet):
    """MANAGER-only CRUD for staff profiles, adjustments and work records."""
    queryset = (
        StaffProfile.objects
        .select_related("user", "branch")
        .prefetch_related("adjustments", "work_records")
        .order_by("user__last_name")
    )
    serializer_class = StaffSerializer
    permission_classes = [IsManager]

    def perform_create(self, serializer):
        """New employees always belong to the manager's branch."""
        branch = getattr(self.request.user.staff_profile, "branch", None) or Branch.objects.first()
        serializer.save(branch=branch)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        """
        Any signed-in staff member fetches their own profile + role here.
        Used right after JWT login so the frontend knows which workspace
        (and which permissions) to open without trusting a client-side guess.
        """
        profile = getattr(request.user, "staff_profile", None)
        if not profile:
            return Response({"detail": "This account has no staff profile."}, status=404)
        return Response(self.get_serializer(profile).data)

    @action(detail=True, methods=["post"])
    def clock_in(self, request, pk=None):
        """Start a work record (clock in) for a staff member."""
        staff = self.get_object()
        record = StaffWorkRecord.objects.create(staff=staff, started_at=timezone.now())
        return Response(StaffWorkRecordSerializer(record).data)

    @action(detail=True, methods=["post"])
    def clock_out(self, request, pk=None):
        """End the most recent open work record (clock out)."""
        staff = self.get_object()
        record = (
            StaffWorkRecord.objects
            .filter(staff=staff, ended_at__isnull=True)
            .order_by("-started_at")
            .first()
        )
        if not record:
            return Response({"detail": "No active shift found."}, status=400)
        record.ended_at = timezone.now()
        record.save(update_fields=["ended_at"])
        return Response(StaffWorkRecordSerializer(record).data)

    @action(detail=True, methods=["post"])
    def add_adjustment(self, request, pk=None):
        """
        FIX (Part 1 gap): this class's own docstring claims CRUD for
        "staff profiles, adjustments and work records," but no endpoint
        actually created a StaffAdjustment — StaffAdjustmentSerializer
        was only ever used read-only, nested inside StaffSerializer.
        MANAGER adds a bonus or deduction to a staff member's salary here,
        following the same pattern as clock_in/clock_out above.
        Body: {"kind": "BONUS"|"DEDUCT", "amount": "50.00", "reason": "..."}
        """
        staff = self.get_object()
        serializer = StaffAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(staff=staff)
        return Response(self.get_serializer(staff).data)

    @action(detail=True, methods=["post"])
    def toggle_active(self, request, pk=None):
        """MANAGER activates or deactivates a staff member."""
        staff = self.get_object()
        staff.active = not staff.active
        staff.save(update_fields=["active"])
        return Response(self.get_serializer(staff).data)


# ── Attendance ────────────────────────────────────────────────────────────────

class AttendanceViewSet(viewsets.ModelViewSet):
    """
    MANAGER-only attendance board: Present / Absent / Late per employee per day.
    Filters: ?staff=<id>, ?date=<YYYY-MM-DD>, ?from=<YYYY-MM-DD>&to=<YYYY-MM-DD>.
    create()/mark() both upsert on (staff, date) so re-marking the same day
    updates that day's record instead of creating a duplicate.
    """
    queryset = StaffAttendance.objects.select_related("staff__user").all()
    serializer_class = StaffAttendanceSerializer
    permission_classes = [IsManager]

    def get_queryset(self):
        qs = super().get_queryset()
        staff = self.request.query_params.get("staff")
        date = self.request.query_params.get("date")
        date_from = self.request.query_params.get("from")
        date_to = self.request.query_params.get("to")
        if staff:
            qs = qs.filter(staff_id=staff)
        if date:
            qs = qs.filter(date=date)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs

    def create(self, request, *args, **kwargs):
        """Upsert: marking the same staff+date again overwrites that day's record."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        record, _ = StaffAttendance.objects.update_or_create(
            staff=data["staff"],
            date=data.get("date") or timezone.localdate(),
            defaults={
                "status": data.get("status", StaffAttendance.Status.PRESENT),
                "notes": data.get("notes", ""),
            },
        )
        return Response(self.get_serializer(record).data, status=status.HTTP_201_CREATED)


# ── Notifications ─────────────────────────────────────────────────────────────

class NotificationViewSet(viewsets.ModelViewSet):
    """
    Notification stream + authoring.
    - list: public for ?audience=CUSTOMER (session-scoped); IsStaff otherwise,
      with results further scoped to what that staff member is actually a
      recipient of (see get_queryset) — MANAGER sees everything.
    - create: any signed-in staff member (Manager/Cashier/Kitchen/Waiter) can
      send a notification and choose its recipients (role(s), specific staff,
      and/or the customer on a given order).
    - mark_read: any signed-in staff member.
    """
    queryset = Notification.objects.select_related("sender", "order", "table").prefetch_related("recipient_staff").order_by("-created_at")
    serializer_class = NotificationSerializer

    def get_permissions(self):
        if self.action == "list" and self.request.query_params.get("audience") == "CUSTOMER":
            return [permissions.AllowAny()]
        return [IsStaff()]

    def get_queryset(self):
        qs = super().get_queryset()
        audience = self.request.query_params.get("audience")
        if audience:
            qs = qs.filter(audience=audience)
        if audience == "CUSTOMER":
            session_token = self.request.headers.get("X-Table-Session")
            session = TableSession.objects.filter(token=session_token, closed_at__isnull=True).first()
            if not session:
                return qs.none()
            return qs.filter(order__session=session)[:50]

        # Staff request: MANAGER (and Django superusers) see the full staff
        # stream; every other role only sees notifications actually addressed
        # to them, so e.g. a Waiter cannot read Cashier-only notifications
        # through this endpoint — enforced here, not just hidden by the UI.
        profile = getattr(self.request.user, "staff_profile", None)
        if self.request.user.is_superuser or (profile and profile.role == StaffProfile.Role.MANAGER):
            return qs[:50]
        if not profile:
            return qs.none()
        recent = list(qs[:200])
        visible_ids = [
            n.id for n in recent
            if n.audience in (profile.role, "ALL")
            or profile.role in (n.recipient_roles or [])
            or profile.id in {s.id for s in n.recipient_staff.all()}
            or n.sender_id == self.request.user.id
        ]
        return qs.filter(id__in=visible_ids)

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.read_at = timezone.now()
        notif.save(update_fields=["read_at"])
        return Response({"status": "read"})


# ── Staff Notes ───────────────────────────────────────────────────────────────

class StaffNoteViewSet(viewsets.ModelViewSet):
    """
    Internal handover notes on orders, items, tables, or kitchen/service
    activity in general. Manager, Cashier, Kitchen and Waiter can all read and
    write these (audience narrows who a given note is *for*, e.g. "KITCHEN" —
    it does not further restrict who may post one; financial data never lives
    in free-text notes, so this is safe to open to every staff role).
    Filters: ?order=<id>, ?table=<id>.
    """
    queryset = StaffNote.objects.select_related("author", "order", "table", "item").order_by("-created_at")
    serializer_class = StaffNoteSerializer
    permission_classes = [IsStaff]

    def get_queryset(self):
        qs = super().get_queryset()
        order = self.request.query_params.get("order")
        table = self.request.query_params.get("table")
        if order:
            qs = qs.filter(order_id=order)
        if table:
            qs = qs.filter(table_id=table)
        return qs

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


# ── Analytics (Manager dashboard) ─────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsManager])
def analytics(request):
    """
    Aggregated data for the Manager dashboard.

    Returns:
      - revenue: total paid amount
      - revenue_today: paid amount for today
      - order_count: all non-rejected orders
      - active_tables: tables not AVAILABLE
      - best_sellers: top 10 products by quantity sold
      - best_categories: top 5 categories by quantity sold
      - table_revenue: per-table revenue breakdown
      - hourly_distribution: order count per hour (for busy/slow hour chart)
      - orders_by_source: breakdown by DINE_IN_QR / WEBSITE / TAKEAWAY
      - staff_count: total active staff members
    """
    today = timezone.now().date()
    all_orders = Order.objects.exclude(status="REJECTED")
    paid_payments = Payment.objects.filter(status="PAID")

    revenue = paid_payments.aggregate(total=Sum("amount"))["total"] or 0
    revenue_today = (
        paid_payments.filter(created_at__date=today)
        .aggregate(total=Sum("amount"))["total"] or 0
    )

    best_sellers = list(
        OrderItem.objects
        .values("name_snapshot")
        .annotate(qty=Sum("quantity"))
        .order_by("-qty")[:10]
    )
    best_categories = list(
        OrderItem.objects
        .values("menu_item__category__name")
        .annotate(qty=Sum("quantity"))
        .order_by("-qty")[:5]
    )
    table_revenue = list(
        Payment.objects
        .filter(status="PAID", order__session__isnull=False)
        .values("order__session__table__number")
        .annotate(revenue=Sum("amount"))
        .order_by("-revenue")
    )
    hourly = list(
        all_orders
        .annotate(hour=ExtractHour("created_at"))
        .values("hour")
        .annotate(count=Count("id"))
        .order_by("hour")
    )
    source_breakdown = list(
        all_orders
        .values("source")
        .annotate(count=Count("id"))
    )

    return Response({
        "revenue": revenue,
        "revenue_today": revenue_today,
        "order_count": all_orders.count(),
        "active_tables": CafeTable.objects.exclude(status="AVAILABLE").count(),
        "best_sellers": best_sellers,
        "best_categories": best_categories,
        "table_revenue": table_revenue,
        "hourly_distribution": hourly,
        "orders_by_source": source_breakdown,
        "staff_count": StaffProfile.objects.filter(active=True).count(),
    })
