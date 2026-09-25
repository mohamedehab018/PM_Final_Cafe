# Generated for Part 3B: remove the mandatory cashier-approval gate from the
# normal customer order flow. Orders now start life as AWAITING_PAYMENT and
# move to APPROVED automatically once payment is verified (see
# cafe.views.OrderViewSet / PaymentViewSet). PENDING_APPROVAL is kept as a
# choice only so historical rows keep loading; nothing assigns it anymore.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cafe', '0009_alter_cafetable_status_reservation'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(
                choices=[
                    ('AWAITING_PAYMENT', 'Awaiting Payment'),
                    ('PENDING_APPROVAL', 'Pending Approval'),
                    ('APPROVED', 'Approved'),
                    ('REJECTED', 'Rejected'),
                    ('PREPARING', 'Preparing'),
                    ('READY', 'Ready'),
                    ('PICKED_UP', 'Picked Up'),
                    ('DELIVERED', 'Delivered'),
                    ('COMPLETED', 'Completed'),
                    ('CANCELLED', 'Cancelled'),
                ],
                default='AWAITING_PAYMENT',
                max_length=20,
            ),
        ),
    ]
