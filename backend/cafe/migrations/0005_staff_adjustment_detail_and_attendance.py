import django.db.models.deletion
from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):
    dependencies = [("cafe", "0004_staff_employment_and_table_active")]

    operations = [
        migrations.AddField(
            model_name="staffadjustment", name="date",
            field=models.DateField(default=timezone.localdate),
        ),
        migrations.AddField(
            model_name="staffadjustment", name="notes",
            field=models.TextField(blank=True),
        ),
        migrations.AlterModelOptions(
            name="staffadjustment",
            options={"ordering": ["-date", "-created_at"]},
        ),
        migrations.CreateModel(
            name="StaffAttendance",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("date", models.DateField(default=timezone.localdate)),
                (
                    "status",
                    models.CharField(
                        choices=[("PRESENT", "Present"), ("ABSENT", "Absent"), ("LATE", "Late")],
                        default="PRESENT", max_length=10,
                    ),
                ),
                ("notes", models.TextField(blank=True)),
                (
                    "staff",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attendance", to="cafe.staffprofile",
                    ),
                ),
            ],
            options={"ordering": ["-date"]},
        ),
        migrations.AlterUniqueTogether(
            name="staffattendance",
            unique_together={("staff", "date")},
        ),
    ]
