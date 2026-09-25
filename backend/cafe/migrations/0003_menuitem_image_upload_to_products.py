"""
Migration 0003: correct MenuItem.image's upload_to.

FIX (Part 1 gap — media/image handling): the field previously declared
upload_to="menu/", but every seeded/actual product image on disk lives
under media/products/ (see cafe/catalog.py + seed_cafe.py), matching the
MenuItem.image docstring itself ("e.g. products/margherita.jpg"). Only
NEW images uploaded later through the admin/API were affected by the old
value — all 132 existing rows already store explicit "products/..."
paths and are completely unaffected by this change, since upload_to only
supplies a default prefix for files uploaded from now on.

upload_to is Python-side metadata, not a SQL column definition, so this
migration changes no column type/constraint at the database level.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cafe", "0002_add_ingredients_offer_categories_is_permanent"),
    ]

    operations = [
        migrations.AlterField(
            model_name="menuitem",
            name="image",
            field=models.ImageField(blank=True, upload_to="products/"),
        ),
    ]
