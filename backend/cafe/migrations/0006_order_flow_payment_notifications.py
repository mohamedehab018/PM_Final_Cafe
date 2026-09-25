import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cafe", "0005_staff_adjustment_detail_and_attendance"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Order.status choices gain PICKED_UP — TextChoices is just a CharField
        # with a wider set of valid values, so no column change is needed beyond
        # documenting the new choice (Django doesn't enforce choices at the DB level).
        migrations.AlterField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=[
                    ("PENDING_APPROVAL", "Pending Approval"), ("APPROVED", "Approved"),
                    ("REJECTED", "Rejected"), ("PREPARING", "Preparing"), ("READY", "Ready"),
                    ("PICKED_UP", "Picked Up"), ("DELIVERED", "Delivered"),
                    ("COMPLETED", "Completed"), ("CANCELLED", "Cancelled"),
                ],
                default="PENDING_APPROVAL", max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="payment", name="payer_phone",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="payment", name="payer_account",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="payment", name="card_last4",
            field=models.CharField(blank=True, max_length=4),
        ),
        migrations.AddField(
            model_name="notification", name="table",
            field=models.ForeignKey(
                null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="notifications", to="cafe.cafetable",
            ),
        ),
        migrations.AddField(
            model_name="notification", name="sender",
            field=models.ForeignKey(
                null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="sent_notifications", to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="notification", name="recipient_roles",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="notification", name="recipient_staff",
            field=models.ManyToManyField(
                blank=True, related_name="notifications_received", to="cafe.staffprofile",
            ),
        ),
        migrations.AddField(
            model_name="staffnote", name="item",
            field=models.ForeignKey(
                null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="staff_notes", to="cafe.orderitem",
            ),
        ),
        migrations.AddField(
            model_name="staffnote", name="table",
            field=models.ForeignKey(
                null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="staff_notes", to="cafe.cafetable",
            ),
        ),
    ]
