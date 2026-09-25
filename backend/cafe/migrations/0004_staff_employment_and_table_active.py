from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("cafe", "0003_menuitem_image_upload_to_products")]

    operations = [
        migrations.AddField(
            model_name="staffprofile", name="phone",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="staffprofile", name="start_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="staffprofile", name="end_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="cafetable", name="active",
            field=models.BooleanField(default=True),
        ),
    ]
