"""
Serializers for the PM Café API.

Key design principles:
- MenuItemSerializer exposes ingredients so the frontend detail modal shows what's in each dish.
- OrderSerializer snapshots name/price at creation time — historical order data is preserved
  even when the manager later edits product names or prices.
- OfferSerializer exposes is_currently_active so the frontend can hide expired offers without
  any extra logic on the client side.
- AnalyticsSerializer (read-only) is used by the manager dashboard endpoint.
"""
from decimal import Decimal
from django.utils import timezone
from django.utils.text import slugify
from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import (
    AddOn, Branch, CafeTable, Category, MenuItem, Notification,
    Offer, Order, OrderItem, OrderStatusHistory, Payment,
    ProductOption, Reservation, StaffAdjustment, StaffAttendance, StaffNote,
    StaffProfile, StaffWorkRecord, TableSession,
)


# ── Menu ─────────────────────────────────────────────────────────────────────

class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductOption
        fields = ("id", "name", "price_delta", "active")


class AddOnSerializer(serializers.ModelSerializer):
    class Meta:
        model = AddOn
        fields = ("id", "name", "price", "active")


class ProductOptionWriteSerializer(serializers.ModelSerializer):
    """
    Part 3B: MANAGER-only CRUD for a menu item's options (e.g. Regular / Large),
    used by the Manager Menu Builder's Options & Add-ons panel.
    `item` is writable here (unlike the nested read-only OptionSerializer above)
    so the manager can attach a new option to an existing MenuItem.
    """
    class Meta:
        model = ProductOption
        fields = ("id", "item", "name", "price_delta", "active")

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Option name is required.")
        return value


class AddOnWriteSerializer(serializers.ModelSerializer):
    """Part 3B: MANAGER-only CRUD for a menu item's add-ons (e.g. Extra cheese)."""
    class Meta:
        model = AddOn
        fields = ("id", "item", "name", "price", "active")

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Add-on name is required.")
        return value

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Price cannot be negative.")
        return value


def _request_branch(serializer):
    """Branch a new Manager-created record belongs to (same rule the viewsets use in perform_create)."""
    request = serializer.context.get("request")
    profile = getattr(getattr(request, "user", None), "staff_profile", None)
    return getattr(profile, "branch", None) or Branch.objects.first()


class MenuItemSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, read_only=True)
    addons = AddOnSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    image_url = serializers.SerializerMethodField()
    effective_price = serializers.SerializerMethodField()
    active_offer = serializers.SerializerMethodField()

    def get_image_url(self, obj):
        """Expose a directly usable URL while retaining the ImageField value for writes."""
        if not obj.image:
            return ""
        request = self.context.get("request")
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url

    def _best_active_offer(self, obj):
        """Return the highest-priority currently-active offer for this item, or None."""
        best, best_priority = None, -1
        # Direct item offers
        for offer in obj.offers.all():
            if offer.is_currently_active() and offer.priority >= best_priority:
                if offer.priority > best_priority or best is None:
                    best, best_priority = offer, offer.priority
        # Category-level offers
        try:
            for offer in obj.category.offers.all():
                if offer.is_currently_active() and offer.priority > best_priority:
                    best, best_priority = offer, offer.priority
        except Exception:
            pass
        return best

    def get_effective_price(self, obj):
        """Price after applying the best active offer; None when no offer applies."""
        from decimal import Decimal, ROUND_HALF_UP
        offer = self._best_active_offer(obj)
        if not offer:
            return None
        price = Decimal(str(obj.price))
        if offer.fixed_price is not None:
            return float(offer.fixed_price)
        if offer.discount_percent is not None:
            discounted = price * (1 - offer.discount_percent / Decimal("100"))
            return float(discounted.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        return None

    def get_active_offer(self, obj):
        """Offer badge info for the customer menu — None when no offer applies."""
        offer = self._best_active_offer(obj)
        if not offer:
            return None
        return {
            "name": offer.name,
            "discount_percent": str(offer.discount_percent) if offer.discount_percent is not None else None,
            "fixed_price": str(offer.fixed_price) if offer.fixed_price is not None else None,
        }

    # ingredients is displayed on the product detail page
    class Meta:
        model = MenuItem
        fields = (
            "id", "public_id", "category", "category_name",
            "name", "description", "ingredients",
            "price", "effective_price", "active_offer",
            "image", "image_url", "image_source",
            "active", "sold_out", "is_complete_meal",
            "options", "addons",
        )
        # Part 3A: the Manager form never types a slug — it is generated from the name.
        extra_kwargs = {"public_id": {"required": False}}

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Price cannot be negative.")
        return value

    def create(self, validated_data):
        if not validated_data.get("public_id"):
            base = slugify(validated_data.get("name", ""))[:90] or "item"
            candidate, n = base, 2
            while MenuItem.objects.filter(public_id=candidate).exists():
                candidate = f"{base}-{n}"
                n += 1
            validated_data["public_id"] = candidate
        return super().create(validated_data)


class CategorySerializer(serializers.ModelSerializer):
    items = MenuItemSerializer(many=True, read_only=True)

    class Meta:
        model = Category
        fields = ("id", "name", "slug", "active", "position", "image", "items")
        # Part 3A: slug is generated from the name when the Manager form omits it.
        extra_kwargs = {"slug": {"required": False}}

    def validate(self, attrs):
        branch = self.instance.branch if self.instance else _request_branch(self)
        name = attrs.get("name")
        if name is not None:
            clash = Category.objects.filter(branch=branch, name__iexact=name.strip())
            if self.instance:
                clash = clash.exclude(pk=self.instance.pk)
            if clash.exists():
                raise serializers.ValidationError({"name": "A category with this name already exists."})
        slug = attrs.get("slug")
        generated = False
        if not slug and not self.instance:
            slug = slugify(name or "") or "category"
            generated = True
        if slug:
            base, n, candidate = slug, 2, slug
            while True:
                taken = Category.objects.filter(branch=branch, slug=candidate)
                if self.instance:
                    taken = taken.exclude(pk=self.instance.pk)
                if not taken.exists():
                    break
                if not generated:
                    raise serializers.ValidationError({"slug": "This slug is already used by another category."})
                candidate = f"{base}-{n}"
                n += 1
            attrs["slug"] = candidate
        return attrs


# ── Tables & Sessions ─────────────────────────────────────────────────────────

class TableSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TableSession
        fields = ("id", "token", "opened_at", "closed_at", "guest_count")


class TableSerializer(serializers.ModelSerializer):
    sessions = TableSessionSerializer(many=True, read_only=True)

    class Meta:
        model = CafeTable
        fields = "__all__"
        read_only_fields = ("qr_token", "qr_image", "branch")

    def validate_number(self, value):
        """Part 3A: (branch, number) is unique in the DB but branch is read-only here, so DRF
        skips its own validator — check it explicitly to return a 400 instead of a 500."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Table number is required.")
        branch = self.instance.branch if self.instance else _request_branch(self)
        clash = CafeTable.objects.filter(branch=branch, number__iexact=value)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError(f"Table {value} already exists.")
        return value

    def validate_seats(self, value):
        if value < 1:
            raise serializers.ValidationError("A table needs at least 1 seat.")
        return value


# ── Orders ────────────────────────────────────────────────────────────────────

class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = (
            "id", "menu_item", "name_snapshot", "unit_price",
            "quantity", "options", "notes", "line_total",
        )
        read_only_fields = ("name_snapshot", "unit_price", "line_total")


class KitchenOrderItemSerializer(serializers.ModelSerializer):
    """Preparation-only line payload: financial fields must never leave the API."""
    class Meta:
        model = OrderItem
        fields = ("id", "menu_item", "name_snapshot", "quantity", "options", "notes")


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = (
            "id", "order", "amount", "method", "status", "reference_id",
            "gateway", "checkout_session_id", "checkout_url", "failure_reason",
            "paid_at", "payer_phone", "payer_account", "card_last4", "created_at",
        )
        read_only_fields = (
            "reference_id", "status", "gateway", "checkout_session_id",
            "checkout_url", "failure_reason", "paid_at",
        )

    def validate(self, data):
        """
        Method-specific required fields (spec):
          - InstaPay: payer phone + payer/wallet account number.
          - Vodafone Cash: payer phone.
          - Card: hosted gateway only — this serializer never declares a
            field for a full card number/CVV, so there is nowhere for that
            data to land even if a client sent it.
        method is only present in `data` on create, or on partial update if the
        client explicitly changes it — .get() with the instance fallback keeps
        this correct for both create and update.
        """
        method = data.get("method") or getattr(self.instance, "method", None)
        payer_phone = data.get("payer_phone", getattr(self.instance, "payer_phone", ""))
        payer_account = data.get("payer_account", getattr(self.instance, "payer_account", ""))
        if method == Payment.Method.INSTAPAY and not (payer_phone and payer_account):
            raise serializers.ValidationError(
                {"payer_phone": "InstaPay payments require the payer's phone and account number."}
            )
        if method == Payment.Method.VODAFONE_CASH and not payer_phone:
            raise serializers.ValidationError(
                {"payer_phone": "Vodafone Cash payments require the payer's phone number."}
            )
        card_last4 = data.get("card_last4", "")
        if card_last4 and not card_last4.isdigit():
            raise serializers.ValidationError({"card_last4": "Must be up to 4 digits only."})
        return data


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_username = serializers.CharField(
        source="changed_by.username", read_only=True, default=""
    )

    class Meta:
        model = OrderStatusHistory
        fields = ("id", "status", "changed_by_username", "note", "created_at")


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
    payments = PaymentSerializer(many=True, read_only=True)
    history = OrderStatusHistorySerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    service_charge = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    tax = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    # table number for display in all staff views
    table_number = serializers.SerializerMethodField()

    def get_table_number(self, obj):
        if obj.session:
            return obj.session.table.number
        return None

    class Meta:
        model = Order
        fields = (
            "id", "number", "branch", "source", "session",
            "table_number", "status", "priority",
            "custom_request", "cashier_note", "kitchen_note",
            "rejection_reason", "customer_token",
            "subtotal", "service_charge", "tax", "total",
            "created_at", "items", "payments", "history",
        )
        read_only_fields = ("number", "branch", "customer_token")

    @staticmethod
    def create_snapshot_line(order, line):
        """Validate selected option/add-on names and calculate their server-side price."""
        product = line.pop("menu_item")
        # Defense in depth: the customer menu already hides/disables sold-out
        # and inactive items, but a request could still be replayed directly
        # against the API, so the real backend state is the source of truth
        # here too — never trust the client's snapshot of availability.
        if product.sold_out or not product.active:
            raise serializers.ValidationError(
                {"items": f"{product.name} is currently sold out and cannot be ordered."}
            )
        selected = set(line.get("options", []))
        options = {option.name: option for option in product.options.filter(active=True)}
        addons = {addon.name: addon for addon in product.addons.filter(active=True)}
        unknown = selected - set(options) - set(addons)
        if unknown:
            raise serializers.ValidationError({"items": f"Invalid product choices: {', '.join(sorted(unknown))}"})
        unit_price = product.price + sum(option.price_delta for name, option in options.items() if name in selected)
        unit_price += sum(addon.price for name, addon in addons.items() if name in selected)
        return OrderItem.objects.create(
            order=order, menu_item=product, name_snapshot=product.name,
            unit_price=unit_price, **line,
        )

    def create(self, data):
        """
        Create the order and snapshot product name + price on every line.
        The snapshot ensures historical accuracy even when the manager later
        changes product names or prices.
        """
        items_data = data.pop("items")
        # Determine branch from the session's table, or fall back to the first branch
        session = data.get("session")
        session_token = self.context.get("table_session_token")
        if data.get("source") == Order.Source.DINE_IN_QR:
            if not session or not session_token or str(session.token) != str(session_token):
                raise serializers.ValidationError({"session": "A valid table session is required."})
            if session.closed_at:
                raise serializers.ValidationError({"session": "This table session is closed."})
        branch = (
            session.table.branch if session
            else Branch.objects.first()
        )
        # Auto-generate a human-readable order number
        order_count = Order.objects.count()
        number = f"PM-{timezone.now():%y%m%d}-{order_count + 1001}"
        # Part 3B: no cashier-approval gate for normal customer orders — every
        # new order starts AWAITING_PAYMENT and is advanced to APPROVED (and
        # therefore visible to Kitchen) automatically once payment clears the
        # balance in full (see views._settle_order_after_payment).
        order = Order.objects.create(
            branch=branch, number=number, status=Order.Status.AWAITING_PAYMENT, **data
        )

        for line in items_data:
            self.create_snapshot_line(order, line)
        subtotal = sum((line.line_total for line in order.items.all()), Decimal("0.00"))
        service_charge = (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))
        tax = (subtotal * Decimal("0.14")).quantize(Decimal("0.01"))
        order.subtotal = subtotal
        order.service_charge = service_charge
        order.tax = tax
        order.total_amount = subtotal + service_charge + tax
        order.save(update_fields=["subtotal", "service_charge", "tax", "total_amount"])
        # Record the initial status in the history table
        OrderStatusHistory.objects.create(order=order, status=order.status)
        return order


class KitchenOrderSerializer(serializers.ModelSerializer):
    """Kitchen queue representation deliberately excludes totals, payments and prices."""
    items = KitchenOrderItemSerializer(many=True, read_only=True)
    table_number = serializers.SerializerMethodField()

    def get_table_number(self, obj):
        return obj.session.table.number if obj.session else None

    class Meta:
        model = Order
        fields = (
            "id", "number", "source", "session", "table_number", "status", "priority",
            "custom_request", "kitchen_note", "created_at", "items",
        )


# ── Offers ────────────────────────────────────────────────────────────────────

class OfferSerializer(serializers.ModelSerializer):
    items = serializers.PrimaryKeyRelatedField(
        many=True, queryset=MenuItem.objects.all()
    )
    categories = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Category.objects.all()
    )
    # Computed field: True only when the offer is currently applicable
    is_currently_active = serializers.SerializerMethodField()

    def get_is_currently_active(self, obj):
        return obj.is_currently_active()

    class Meta:
        model = Offer
        fields = "__all__"
        read_only_fields = ("branch",)


# ── Staff ─────────────────────────────────────────────────────────────────────

class StaffAdjustmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffAdjustment
        fields = ("id", "staff", "kind", "amount", "reason", "date", "notes", "created_at")
        # staff is set server-side from the URL (StaffViewSet.add_adjustment),
        # the same read_only-FK pattern already used for Offer.branch /
        # CafeTable.branch above — the client never supplies it directly.
        read_only_fields = ("staff",)


class StaffWorkRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffWorkRecord
        fields = "__all__"


class StaffAttendanceSerializer(serializers.ModelSerializer):
    staff_name = serializers.SerializerMethodField()

    def get_staff_name(self, obj):
        return obj.staff.user.get_full_name() or obj.staff.user.username

    class Meta:
        model = StaffAttendance
        fields = ("id", "staff", "staff_name", "date", "status", "notes", "created_at")


class StaffSerializer(serializers.ModelSerializer):
    # Manager-facing fields create/update the linked Django account together
    # with the profile, so staff management is not a disconnected UI-only flow.
    username = serializers.CharField(source="user.username")
    email = serializers.EmailField(source="user.email", required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    full_name = serializers.SerializerMethodField()
    adjustments = StaffAdjustmentSerializer(many=True, read_only=True)
    work_records = StaffWorkRecordSerializer(many=True, read_only=True)
    attendance = StaffAttendanceSerializer(many=True, read_only=True)
    # Payroll summary, computed server-side so the frontend never re-derives
    # financial totals itself (single source of truth for Manager-only data).
    total_bonuses = serializers.SerializerMethodField()
    total_deductions = serializers.SerializerMethodField()
    net_salary = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_total_bonuses(self, obj):
        return sum((a.amount for a in obj.adjustments.all() if a.kind == "BONUS"), Decimal("0"))

    def get_total_deductions(self, obj):
        return sum((a.amount for a in obj.adjustments.all() if a.kind == "DEDUCT"), Decimal("0"))

    def get_net_salary(self, obj):
        return obj.salary + self.get_total_bonuses(obj) - self.get_total_deductions(obj)

    class Meta:
        model = StaffProfile
        fields = (
            "id", "username", "email", "password", "full_name",
            "branch", "role", "phone", "salary", "start_date", "end_date",
            "start_time", "end_time", "active", "notes",
            "adjustments", "work_records", "attendance",
            "total_bonuses", "total_deductions", "net_salary",
        )
        # Part 3A: branch is assigned server-side (StaffViewSet.perform_create) and is
        # never sent by the Manager forms, so it must not be a required input field.
        read_only_fields = ("branch",)

    def validate_salary(self, value):
        if value < 0:
            raise serializers.ValidationError("Salary cannot be negative.")
        return value

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date cannot be before the start date."})
        return attrs

    def create(self, validated_data):
        user_data = validated_data.pop("user")
        password = validated_data.pop("password", None)
        username = user_data["username"]
        User = get_user_model()
        if User.objects.filter(username=username).exists():
            raise serializers.ValidationError({"username": "This username is already in use."})
        user = User.objects.create_user(
            username=username, email=user_data.get("email", ""), password=password or None
        )
        return StaffProfile.objects.create(user=user, **validated_data)

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        password = validated_data.pop("password", None)
        request = self.context.get("request")
        if request is not None and instance.user_id == request.user.id:
            # A Manager must not be able to lock themselves out of the Manager workspace.
            if instance.role == StaffProfile.Role.MANAGER and validated_data.get("role", instance.role) != instance.role:
                raise serializers.ValidationError({"role": "You cannot change your own Manager role."})
            if validated_data.get("active") is False:
                raise serializers.ValidationError({"active": "You cannot deactivate your own account."})
        new_username = user_data.get("username")
        if new_username and new_username != instance.user.username:
            if get_user_model().objects.filter(username=new_username).exists():
                raise serializers.ValidationError({"username": "This username is already in use."})
        for field, value in user_data.items():
            setattr(instance.user, field, value)
        if password:
            instance.user.set_password(password)
        instance.user.save()
        return super().update(instance, validated_data)


# ── Notifications & Notes ─────────────────────────────────────────────────────

class NotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    recipient_staff_names = serializers.SerializerMethodField()
    table_number = serializers.SerializerMethodField()

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.username if obj.sender else "System"

    def get_recipient_staff_names(self, obj):
        return [s.user.get_full_name() or s.user.username for s in obj.recipient_staff.all()]

    def get_table_number(self, obj):
        return obj.table.number if obj.table else (obj.order.session.table.number if obj.order and obj.order.session else None)

    class Meta:
        model = Notification
        fields = (
            "id", "order", "table", "table_number", "sender", "sender_name",
            "audience", "recipient_roles", "recipient_staff", "recipient_staff_names",
            "title", "body", "read_at", "created_at",
        )
        read_only_fields = ("sender",)

    def validate(self, data):
        """
        A staff-authored notification must actually go somewhere: a role
        audience, one or more specific staff members, or CUSTOMER (which also
        requires an order, so the recipient can be scoped to that order's
        table session — the same scoping /api/notifications/?audience=CUSTOMER
        already relies on for polling).
        """
        audience = data.get("audience", "")
        recipient_roles = data.get("recipient_roles", [])
        recipient_staff = data.get("recipient_staff", [])
        if not (audience or recipient_roles or recipient_staff):
            raise serializers.ValidationError(
                "Choose at least one recipient: a role, specific staff member(s), or Customer."
            )
        targets_customer = audience == "CUSTOMER" or "CUSTOMER" in recipient_roles
        if targets_customer and not data.get("order"):
            raise serializers.ValidationError(
                {"order": "A related order is required to notify the customer on that order/table."}
            )
        return data


# ── Reservations ─────────────────────────────────────────────────────────────

class ReservationSerializer(serializers.ModelSerializer):
    """
    CASHIER-authored table reservation for an event (birthday, engagement, …).

    tables is writable (PrimaryKeyRelatedField M2M) so the cashier picks
    specific tables from the live floor plan. validate() rejects:
      - an empty table selection,
      - inactive tables,
      - any table already held by another PENDING/CONFIRMED reservation
        whose [start, end) window overlaps this one on the same date.
    table_numbers / table_count are read-only conveniences for the UI so it
    never has to cross-reference the tables list itself.
    """
    tables = serializers.PrimaryKeyRelatedField(many=True, queryset=CafeTable.objects.all())
    table_numbers = serializers.SerializerMethodField()
    table_count = serializers.SerializerMethodField()
    end_time = serializers.TimeField(read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_table_numbers(self, obj):
        return [t.number for t in obj.tables.all()]

    def get_table_count(self, obj):
        return obj.tables.count()

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.username if obj.created_by else ""

    class Meta:
        model = Reservation
        fields = (
            "id", "branch", "customer_name", "phone", "event_type",
            "date", "start_time", "duration_minutes", "end_time", "guests",
            "tables", "table_numbers", "table_count",
            "price", "deposit_amount", "payment_status",
            "decoration", "notes", "status",
            "created_by", "created_by_name", "created_at", "updated_at",
        )
        read_only_fields = ("branch", "created_by")

    def validate(self, data):
        tables = data.get("tables", list(self.instance.tables.all()) if self.instance else [])
        date = data.get("date", getattr(self.instance, "date", None))
        start_time = data.get("start_time", getattr(self.instance, "start_time", None))
        duration = data.get("duration_minutes", getattr(self.instance, "duration_minutes", 120))
        if not tables:
            raise serializers.ValidationError({"tables": "Select at least one table for this reservation."})
        if not date or not start_time:
            raise serializers.ValidationError("Date and start time are required.")
        for table in tables:
            if not table.active:
                raise serializers.ValidationError(
                    {"tables": f"Table {table.number} is not active and cannot be reserved."}
                )
        from datetime import datetime, timedelta
        start_dt = datetime.combine(date, start_time)
        end_dt = start_dt + timedelta(minutes=duration)
        conflicts = (
            Reservation.objects
            .filter(tables__in=tables, date=date, status__in=[Reservation.Status.PENDING, Reservation.Status.CONFIRMED])
            .distinct()
        )
        if self.instance:
            conflicts = conflicts.exclude(pk=self.instance.pk)
        for other in conflicts:
            other_start = datetime.combine(other.date, other.start_time)
            other_end = other_start + timedelta(minutes=other.duration_minutes)
            if start_dt < other_end and other_start < end_dt:
                raise serializers.ValidationError({
                    "tables": (
                        f"One or more selected tables are already reserved for "
                        f"{other.customer_name} on {other.date} at {other.start_time.strftime('%H:%M')}."
                    )
                })
        return data


class StaffNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(
        source="author.username", read_only=True, default=""
    )
    table_number = serializers.SerializerMethodField()

    def get_table_number(self, obj):
        return obj.table.number if obj.table else None

    class Meta:
        model = StaffNote
        fields = (
            "id", "order", "item", "table", "table_number",
            "author_name", "audience", "text", "created_at",
        )
        read_only_fields = ("author_name",)
