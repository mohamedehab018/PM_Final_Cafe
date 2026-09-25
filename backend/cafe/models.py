import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class TimeStamped(models.Model):
    """Abstract base that stamps every model with created_at / updated_at."""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# ── Branch ───────────────────────────────────────────────────────────────────

class Branch(TimeStamped):
    """Physical cafe location. All tables, staff, orders and categories belong to one branch."""
    name = models.CharField(max_length=120)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=32, blank=True)

    def __str__(self):
        return self.name


# ── Staff ────────────────────────────────────────────────────────────────────

class StaffProfile(TimeStamped):
    """
    Extends Django's User with role/salary data.
    Role controls which API endpoints the user can access (see permissions.py).
    MANAGER has full access; CASHIER approves/rejects orders and handles payments;
    KITCHEN marks orders preparing/ready; WAITER delivers orders and updates table state.
    """
    class Role(models.TextChoices):
        MANAGER = "MANAGER"
        CASHIER = "CASHIER"
        KITCHEN = "KITCHEN"
        WAITER = "WAITER"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="staff_profile"
    )
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="staff")
    role = models.CharField(max_length=16, choices=Role.choices)
    phone = models.CharField(max_length=32, blank=True)
    salary = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


class StaffAdjustment(TimeStamped):
    """
    Bonus or deduction applied to a staff member's salary.
    date is the calendar date the bonus/deduction applies to (defaults to today,
    editable by the Manager) — distinct from created_at, which is when the record
    was entered into the system.
    notes lets the Manager attach any extra context beyond the short `reason`.
    """
    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name="adjustments")
    kind = models.CharField(max_length=8, choices=[("BONUS", "Bonus"), ("DEDUCT", "Deduction")])
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.CharField(max_length=255)
    date = models.DateField(default=timezone.localdate)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-date", "-created_at"]


class StaffWorkRecord(TimeStamped):
    """Shift clock-in / clock-out log. ended_at=None means the shift is still running."""
    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name="work_records")
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    note = models.TextField(blank=True)


class StaffAttendance(TimeStamped):
    """
    Daily attendance record: Present / Absent / Late for one employee on one date.
    One record per (staff, date) — marking attendance again for the same day
    updates the existing record instead of creating a duplicate, so the history
    stays a clean one-row-per-day audit trail. Manager/Admin only (see permissions.py).
    """
    class Status(models.TextChoices):
        PRESENT = "PRESENT"
        ABSENT = "ABSENT"
        LATE = "LATE"

    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name="attendance")
    date = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PRESENT)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = [("staff", "date")]
        ordering = ["-date"]

    def __str__(self):
        return f"{self.staff} · {self.date} · {self.status}"


# ── Tables & Sessions ────────────────────────────────────────────────────────

class CafeTable(TimeStamped):
    """
    Physical table in the restaurant.
    qr_token is the UUID that appears in the QR code on the table.
    Scanning the QR calls /api/tables/scan/?token=<uuid> which opens a TableSession.
    A customer is forever locked to their session — they cannot see other tables' data.
    """
    class Status(models.TextChoices):
        AVAILABLE = "AVAILABLE"
        OCCUPIED = "OCCUPIED"
        WAITING_FOOD = "WAITING_FOOD"
        FOOD_READY = "FOOD_READY"
        FINISHED = "FINISHED"
        NEEDS_CLEANING = "NEEDS_CLEANING"
        RESERVED = "RESERVED"

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="tables")
    number = models.CharField(max_length=12)
    seats = models.PositiveSmallIntegerField()
    location = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    active = models.BooleanField(default=True)
    qr_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    qr_image = models.ImageField(upload_to="qrs/", blank=True)

    class Meta:
        unique_together = [("branch", "number")]

    def __str__(self):
        return f"Table {self.number} ({self.branch})"


class TableSession(TimeStamped):
    """
    One seating period at a table.
    token is given to the customer's browser so they can poll only their own orders.
    closed_at is set when the session ends (bill paid, table cleaned).
    Multiple sessions per table are allowed over time (history).
    """
    table = models.ForeignKey(CafeTable, on_delete=models.PROTECT, related_name="sessions")
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    opened_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(null=True, blank=True)
    guest_count = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        return f"{self.table.number} / {self.token}"


# ── Menu ─────────────────────────────────────────────────────────────────────

class Category(TimeStamped):
    """
    Menu category (Pizzas, Burgers, …).
    position controls display order in the frontend category bar.
    Only MANAGER can create/edit categories via the API.
    """
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=80)
    slug = models.SlugField()
    image = models.ImageField(upload_to="categories/", blank=True)
    active = models.BooleanField(default=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [("branch", "slug")]

    def __str__(self):
        return self.name


class MenuItem(TimeStamped):
    """
    A single product on the menu.

    public_id is a stable slug used by the frontend and API payloads so product
    identity is consistent across DB → Django → API → Frontend → Order lines.

    image stores the relative path under MEDIA_ROOT (e.g. products/margherita.jpg).
    image_source records which asset pack the image came from for traceability.

    ingredients is a plain-text field displayed on the product detail page.
    description is a short marketing blurb shown on the menu card.

    is_complete_meal marks the product as belonging to the Complete Meals section.

    sold_out / active are set by MANAGER or KITCHEN (sold_out only).
    Price changes by MANAGER do NOT retroactively change historical OrderItem.unit_price
    because unit_price is snapshotted at order creation time.
    """
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="items")
    public_id = models.SlugField(max_length=100, unique=True)
    name = models.CharField(max_length=140)
    description = models.TextField()
    ingredients = models.TextField(
        blank=True,
        help_text="Comma-separated list of ingredients shown on the product detail page."
    )
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to="products/", blank=True)
    image_source = models.CharField(max_length=255, blank=True)
    active = models.BooleanField(default=True)
    sold_out = models.BooleanField(default=False)
    is_complete_meal = models.BooleanField(default=False)

    def __str__(self):
        return self.name


class ProductOption(TimeStamped):
    """
    A named size/variation of a menu item (e.g. Regular, Large).
    price_delta is added to the base price when this option is selected.
    """
    item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name="options")
    name = models.CharField(max_length=100)
    price_delta = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    active = models.BooleanField(default=True)


class AddOn(TimeStamped):
    """
    Optional extra that can be added to a menu item (e.g. Extra sauce, Extra cheese).
    price is charged on top of the item base price.
    """
    item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name="addons")
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    active = models.BooleanField(default=True)


# ── Offers ───────────────────────────────────────────────────────────────────

class Offer(TimeStamped):
    """
    Promotional offer managed exclusively by MANAGER.

    Discount logic (applied in this order):
      1. fixed_price overrides the item price entirely.
      2. discount_percent reduces the item price by that percentage.

    Scheduling:
      starts_at / ends_at define the date range (null = open-ended).
      active_days is a JSON list of weekday numbers (0=Mon … 6=Sun); empty = all days.
      start_time / end_time define the daily time window; null = all day.
      is_permanent=True means the offer never expires regardless of the date fields.

    items is a M2M to MenuItem; categories is a M2M to Category.
    When categories is populated, all active items in those categories are covered.

    is_active() checks all scheduling rules and returns True only when the offer is
    currently applicable. Expired / inactive offers are hidden from customers.
    """
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="offers")
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    is_permanent = models.BooleanField(default=False)
    priority = models.PositiveSmallIntegerField(default=0)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    fixed_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    active_days = models.JSONField(default=list, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    limit = models.PositiveIntegerField(null=True, blank=True)
    # Products directly covered by this offer
    items = models.ManyToManyField(MenuItem, related_name="offers", blank=True)
    # Whole categories covered by this offer (all active items in the category)
    categories = models.ManyToManyField(Category, related_name="offers", blank=True)

    def is_currently_active(self):
        """Return True if this offer should be shown to customers right now."""
        if not self.active:
            return False
        if self.is_permanent:
            return True
        now = timezone.now()
        local_now = timezone.localtime(now)
        if self.starts_at and now < self.starts_at:
            return False
        if self.ends_at and now > self.ends_at:
            return False
        if self.active_days and local_now.weekday() not in self.active_days:
            return False
        local_time = local_now.time()
        if self.start_time and local_time < self.start_time:
            return False
        if self.end_time and local_time > self.end_time:
            return False
        return True

    def __str__(self):
        return self.name


# ── Orders ───────────────────────────────────────────────────────────────────

class Order(TimeStamped):
    """
    A customer order.

    Flow (Part 3B revision — cashier approval removed from the normal path):
      Customer submits      → AWAITING_PAYMENT (no cashier gate; goes straight to payment)
      Customer pays online,
      or Cashier records a
      manual payment in full → APPROVED (payment verified; order is now visible to Kitchen)
      Kitchen starts         → PREPARING
      Kitchen marks          → READY (waiter and customer notified)
      Waiter picks up        → PICKED_UP (claims the order from the kitchen counter)
      Waiter delivers        → DELIVERED
      Session closed         → COMPLETED

      REJECTED is only used for the exception case where a cashier/manager has
      to cancel an order before it is paid (e.g. an ingredient just ran out) —
      it is no longer part of the default happy path. A rejected order can be
      edited and resubmitted by the customer (see OrderViewSet.resubmit), which
      puts it back to AWAITING_PAYMENT.

      PENDING_APPROVAL is kept only for backward compatibility with historical
      data created before this revision; no new order is ever created with it.

    source tells where the order came from (QR scan, website, takeaway counter).
    session links a dine-in order to the specific TableSession (and therefore table).
    customer_token is a UUID sent to the customer browser so they can poll /api/orders/mine/
    without logging in — it is scoped to one order submission.
    rejection_reason is shown to the customer so they know what to fix.
    """
    class Source(models.TextChoices):
        DINE_IN_QR = "DINE_IN_QR"
        WEBSITE = "WEBSITE"
        TAKEAWAY = "TAKEAWAY"

    class Status(models.TextChoices):
        AWAITING_PAYMENT = "AWAITING_PAYMENT"
        PENDING_APPROVAL = "PENDING_APPROVAL"  # legacy value, no longer assigned on create
        APPROVED = "APPROVED"
        REJECTED = "REJECTED"
        PREPARING = "PREPARING"
        READY = "READY"
        PICKED_UP = "PICKED_UP"
        DELIVERED = "DELIVERED"
        COMPLETED = "COMPLETED"
        CANCELLED = "CANCELLED"

    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="orders")
    number = models.CharField(max_length=32, unique=True)
    source = models.CharField(max_length=20, choices=Source.choices)
    session = models.ForeignKey(
        TableSession, null=True, blank=True, on_delete=models.PROTECT, related_name="orders"
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.AWAITING_PAYMENT
    )
    priority = models.PositiveSmallIntegerField(default=0)
    custom_request = models.TextField(blank=True)
    cashier_note = models.TextField(blank=True)
    kitchen_note = models.TextField(blank=True)
    rejection_reason = models.CharField(max_length=80, blank=True)
    customer_token = models.UUIDField(default=uuid.uuid4, editable=False)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    service_charge = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    @property
    def total(self):
        """Sum of all line totals. Uses snapshotted unit_price — immune to price changes."""
        if self.total_amount:
            return self.total_amount
        return sum(line.line_total for line in self.items.all())

    def __str__(self):
        return self.number


class OrderItem(TimeStamped):
    """
    One line of an order.
    name_snapshot and unit_price are copied from MenuItem at order creation time.
    This ensures old order history remains correct even after the manager edits prices or names.
    options is a JSON list of chosen ProductOption/AddOn names.
    """
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    menu_item = models.ForeignKey(MenuItem, on_delete=models.PROTECT)
    name_snapshot = models.CharField(max_length=140)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveSmallIntegerField()
    options = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)

    @property
    def line_total(self):
        return self.unit_price * self.quantity


class OrderStatusHistory(TimeStamped):
    """Audit trail of every status change on an order."""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="history")
    status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    note = models.TextField(blank=True)


# ── Payments ─────────────────────────────────────────────────────────────────

class Payment(TimeStamped):
    """
    Payment record linked to an order.
    One order can have multiple payment records (partial payments, split bills).
    method is stored so the cashier payment board can filter by method.
    reference_id holds an external gateway reference for real integrations.
    """
    class Method(models.TextChoices):
        CASH = "CASH"
        CARD = "CARD"
        INSTAPAY = "INSTAPAY"
        VODAFONE_CASH = "VODAFONE_CASH"

    class Status(models.TextChoices):
        UNPAID = "UNPAID"
        PENDING = "PENDING"
        PAID = "PAID"
        PARTIALLY_PAID = "PARTIALLY_PAID"
        FAILED = "FAILED"

    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=Method.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reference_id = models.CharField(max_length=100, blank=True)
    gateway = models.CharField(max_length=32, blank=True)
    checkout_session_id = models.CharField(max_length=255, null=True, blank=True, unique=True)
    checkout_url = models.URLField(blank=True)
    idempotency_key = models.CharField(max_length=64, null=True, blank=True, unique=True)
    failure_reason = models.TextField(blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    # InstaPay records the payer's phone + the account/wallet number they paid from.
    # Vodafone Cash records only the payer's phone. Both are plain contact details,
    # never a card/bank credential, so they are safe to store as-is.
    payer_phone = models.CharField(max_length=32, blank=True)
    payer_account = models.CharField(max_length=64, blank=True)
    # We deliberately never define a field for a full card number, expiry or CVV.
    # Hosted Stripe Checkout receives those values. card_last4 is the masked
    # last four digits only, if a manual receipt needs it.
    card_last4 = models.CharField(max_length=4, blank=True)


# ── Notifications ─────────────────────────────────────────────────────────────

class Notification(TimeStamped):
    """
    In-app notification. Two ways it gets created:
      1. Automatically by the order-status machine (OrderViewSet._transition etc.),
         always audience="CUSTOMER" or a single role like "WAITER" — unchanged
         from Part 3A, this keeps working exactly as before.
      2. Directly by a staff member (Manager/Cashier/Kitchen/Waiter) choosing
         who should see it: a role, one or more specific staff members, or the
         customer on a given order/table.
    recipient_roles is a JSON list of role codes and/or "CUSTOMER"/"ALL" so one
    notification can target several audiences at once without extra rows.
    recipient_staff targets specific named staff members.
    sender is null for the system-generated ones in case (1) above.
    read_at is set when the (first) recipient dismisses the notification —
    a simple single flag is enough at this prototype's scale.
    """
    order = models.ForeignKey(
        Order, null=True, blank=True, on_delete=models.CASCADE, related_name="notifications"
    )
    table = models.ForeignKey(
        CafeTable, null=True, blank=True, on_delete=models.SET_NULL, related_name="notifications"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="sent_notifications",
    )
    # Legacy single-audience field, still set by every automatic system notification.
    audience = models.CharField(max_length=20)
    # New: lets a staff-authored notification target several roles and/or specific people.
    recipient_roles = models.JSONField(default=list, blank=True)
    recipient_staff = models.ManyToManyField(
        StaffProfile, blank=True, related_name="notifications_received"
    )
    title = models.CharField(max_length=150)
    body = models.TextField()
    read_at = models.DateTimeField(null=True, blank=True)


# ── Staff Notes ───────────────────────────────────────────────────────────────

class StaffNote(TimeStamped):
    """
    Internal handover or operational note.
    audience restricts visibility: Manager/Admin, Cashier, Kitchen, Floor team.
    Can be linked to a specific order, item, and/or table, or be a general note —
    covers "notes on orders, items, tables and kitchen/service activity".
    """
    order = models.ForeignKey(
        Order, null=True, blank=True, on_delete=models.CASCADE, related_name="staff_notes"
    )
    item = models.ForeignKey(
        OrderItem, null=True, blank=True, on_delete=models.SET_NULL, related_name="staff_notes"
    )
    table = models.ForeignKey(
        CafeTable, null=True, blank=True, on_delete=models.SET_NULL, related_name="staff_notes"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    audience = models.CharField(max_length=30)
    text = models.TextField()


# ── Reservations (Cashier) ──────────────────────────────────────────────────

class Reservation(TimeStamped):
    """
    A booked event/table reservation, managed by CASHIER (and MANAGER).

    tables is a M2M to CafeTable — the specific tables held for this booking.
    Overlap between two PENDING/CONFIRMED reservations sharing a table is
    rejected server-side in ReservationSerializer.validate() (see
    serializers.py), never trusted to the frontend alone.

    Lifecycle:
      PENDING   → cashier created the booking, awaiting confirmation.
      CONFIRMED → cashier confirmed it; assigned tables (if currently
                  AVAILABLE) flip to CafeTable.Status.RESERVED so they cannot
                  be seated as a normal walk-in during the reservation.
      COMPLETED → the event took place; tables are released back to AVAILABLE.
      CANCELLED → booking called off before the event; tables are released
                  back to AVAILABLE the same way.
    """
    class EventType(models.TextChoices):
        BIRTHDAY = "BIRTHDAY", "Birthday"
        ENGAGEMENT = "ENGAGEMENT", "Engagement"
        ANNIVERSARY = "ANNIVERSARY", "Anniversary"
        GRADUATION = "GRADUATION", "Graduation"
        PRIVATE_GATHERING = "PRIVATE_GATHERING", "Private Gathering"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        PENDING = "PENDING"
        CONFIRMED = "CONFIRMED"
        COMPLETED = "COMPLETED"
        CANCELLED = "CANCELLED"

    class PaymentStatus(models.TextChoices):
        UNPAID = "UNPAID", "Unpaid"
        DEPOSIT_PAID = "DEPOSIT_PAID", "Deposit paid"
        PAID = "PAID", "Fully paid"

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="reservations")
    customer_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=32)
    event_type = models.CharField(max_length=24, choices=EventType.choices, default=EventType.OTHER)
    date = models.DateField()
    start_time = models.TimeField()
    duration_minutes = models.PositiveIntegerField(default=120)
    guests = models.PositiveSmallIntegerField(default=1)
    tables = models.ManyToManyField(CafeTable, related_name="reservations", blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deposit_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID
    )
    decoration = models.CharField(max_length=150, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="reservations_created"
    )

    class Meta:
        ordering = ["-date", "-start_time"]

    @property
    def end_time(self):
        """Local time the booking is expected to end, for overlap checks & display."""
        from datetime import datetime, timedelta
        start_dt = datetime.combine(self.date, self.start_time)
        return (start_dt + timedelta(minutes=self.duration_minutes)).time()

    def __str__(self):
        return f"{self.customer_name} · {self.date} {self.start_time} ({self.status})"
