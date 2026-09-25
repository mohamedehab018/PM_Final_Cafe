from django.db import migrations, models
from decimal import Decimal


def populate_order_totals(apps, schema_editor):
    Order = apps.get_model("cafe", "Order")
    for order in Order.objects.all().iterator():
        subtotal = sum(
            (item.unit_price * item.quantity for item in order.items.all()),
            Decimal("0.00"),
        )
        service_charge = (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))
        tax = (subtotal * Decimal("0.14")).quantize(Decimal("0.01"))
        order.subtotal = subtotal
        order.service_charge = service_charge
        order.tax = tax
        order.total_amount = subtotal + service_charge + tax
        order.save(update_fields=["subtotal", "service_charge", "tax", "total_amount"])


class Migration(migrations.Migration):
    dependencies = [
        ("cafe", "0007_alter_offer_items"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="subtotal",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="order",
            name="service_charge",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="order",
            name="tax",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="order",
            name="total_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="payment",
            name="checkout_session_id",
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="payment",
            name="checkout_url",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="payment",
            name="failure_reason",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="payment",
            name="gateway",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="payment",
            name="idempotency_key",
            field=models.CharField(blank=True, max_length=64, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="payment",
            name="paid_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(populate_order_totals, migrations.RunPython.noop),
    ]