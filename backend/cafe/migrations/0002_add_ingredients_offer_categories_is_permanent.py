"""
Migration 0002: three additive changes, all backward-compatible.

1. MenuItem.ingredients  — new TextField (blank=True default='')
2. Offer.description     — new TextField (blank=True)
3. Offer.is_permanent    — new BooleanField (default=False)
4. Offer.categories      — new ManyToManyField to Category (blank=True)
5. Category.image        — new ImageField (upload_to='categories/', blank=True)

All new fields have safe defaults so existing rows need no backfill.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("cafe", "0001_initial"),
    ]

    operations = [
        # 1. MenuItem.ingredients
        migrations.AddField(
            model_name="menuitem",
            name="ingredients",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Comma-separated list of ingredients shown on the product detail page.",
            ),
            preserve_default=False,
        ),

        # 2. Offer.description
        migrations.AddField(
            model_name="offer",
            name="description",
            field=models.TextField(blank=True, default=""),
            preserve_default=False,
        ),

        # 3. Offer.is_permanent
        migrations.AddField(
            model_name="offer",
            name="is_permanent",
            field=models.BooleanField(default=False),
        ),

        # 4. Offer.categories  (M2M to Category)
        migrations.AddField(
            model_name="offer",
            name="categories",
            field=models.ManyToManyField(
                blank=True,
                related_name="offers",
                to="cafe.category",
            ),
        ),

        # 5. Category.image
        migrations.AddField(
            model_name="category",
            name="image",
            field=models.ImageField(blank=True, upload_to="categories/"),
        ),
    ]
