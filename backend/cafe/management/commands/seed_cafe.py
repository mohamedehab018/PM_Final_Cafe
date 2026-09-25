"""
seed_cafe management command
============================
Creates the complete PM Café product catalog: the 125 individual products
photographed in Typess.zip (one per supplied image, zero reuse) plus 7
Complete Meals products (132 total; see cafe/catalog.py header for why this
is 132 rather than the "124" mentioned in the brief -- the real count of
authentic Typess product photos is 125, not 124, and Complete Meals had no
dedicated photography at all).
Also creates default categories, tables, and per-category product
options/add-ons. Offers are NOT seeded (must start empty per spec).
Safe to re-run: all operations use update_or_create / get_or_create.

UNVERIFIED: this command has not been executed. Run it yourself with
    python manage.py migrate
    python manage.py seed_cafe
and check the printed summary line against MenuItem.objects.count().
"""
import uuid
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from cafe.catalog import MENU_CATALOG
from cafe.models import AddOn, Branch, CafeTable, Category, MenuItem, ProductOption, StaffProfile


# The frontend's "Scan table QR" demo button is hard-wired to Table 07's token
# (see initialTables / scanCustomerTable in ts/app.ts and js/app.js).  qr_token
# defaults to a random uuid4, so a freshly seeded database would otherwise answer
# "Unknown QR token" (404).  Pin the demo table's token so the demo always works.
DEMO_TABLE_QR_TOKENS = {
    "07": uuid.UUID("cbbf9ba1-283d-4eb0-8ccd-a292a83026c3"),
}


# ── Default prices by category (EGP) ────────────────────────────────────────
# Manager can change any price later via the API/admin.
CATEGORY_PRICES = {
    "Pizzas":          280,
    "Burgers":         260,
    "BBQ Dishes":      320,
    "Pasta Dishes":    260,
    "Fries":           95,
    "Salads":          140,
    "Soups":           120,
    "Coffee":          85,
    "Desserts":        155,
    "Pastries":        90,
    "Fried Chicken":   220,
    "Baked Potatoes":  150,
    "Sauces":          30,
    "Complete Meals":  380,
}

# Per-product prices and ingredients (auto-generated from the rebuilt
# catalog in Part 1 -- UNVERIFIED, and deliberately simple/derivative.
# The spec requires Manager CRUD to edit any of this without touching
# source code, so these are safe, honest starting values, not hand-tuned
# menu copy. Recommend a manager content pass before going live.
PRODUCT_PRICES = {
    "pizza-bbq-chicken": 265,
    "pizza-chicken-supreme": 320,
    "pizza-classic-cheese-pizza": 250,
    "pizza-margherita": 250,
    "pizza-hawaian": 280,
    "pizza-meat-lovers": 265,
    "pizza-pepperoni": 295,
    "pizza-veggie": 310,
    "pizza-four-cheese": 310,
    "burger-bbq-burger": 220,
    "burger-bacon-burger": 300,
    "burger-beef-burger": 275,
    "burger-buffalo-burger": 245,
    "burger-chesse-burger": 260,
    "burger-chicken-burger": 220,
    "burger-double-burger": 220,
    "burger-mushroom-swiss-burger": 220,
    "burger-spicy-chicken-burger": 275,
    "burger-veggie-burger": 235,
    "bbq-chicken-drumsticks": 270,
    "bbq-chicken-wings": 335,
    "bbq-beef-brisket": 305,
    "bbq-chicken-skewers": 320,
    "bbq-grilled-chicken-thighs": 290,
    "bbq-smoked-whole-chicken": 290,
    "pasta-alfredo": 260,
    "pasta-bolognese": 235,
    "pasta-lasagna": 275,
    "pasta-mac-and-cheese": 220,
    "pasta-penne-arrabbiata": 220,
    "pasta-pesto": 235,
    "pasta-seafood-pasta": 260,
    "fries-cheesy-fries": 100,
    "fries-classic-french-fries": 100,
    "fries-garlic-parmesan-fries": 95,
    "fries-peri-peri-fries": 105,
    "fries-salt-vinegar-fries": 90,
    "fries-sweet-potato-fries": 105,
    "fries-waffle-fries": 105,
    "salad-caesar-salad": 125,
    "salad-chicken-salad": 120,
    "salad-coleslaw": 120,
    "salad-greek": 145,
    "salad-pasta-salad": 140,
    "salad-potato-salad": 160,
    "salad-sobb": 125,
    "salad-tabbouleh": 125,
    "salad-tuna-salad": 135,
    "soup-beef-soup": 140,
    "soup-chicken-noodle": 120,
    "soup-french-onion-soup": 110,
    "soup-lentil-soup": 110,
    "soup-minestrone-soup": 130,
    "soup-mushroom-soup": 140,
    "soup-seafood-chowder-soup": 130,
    "soup-tomato-soup": 125,
    "soup-vegetable-soup": 110,
    "coffee-ristretto": 75,
    "coffee-americano": 95,
    "coffee-cappuccino": 75,
    "coffee-corretto": 75,
    "coffee-doppio": 80,
    "coffee-espresso-romano": 90,
    "coffee-espresso": 75,
    "coffee-flat-white": 75,
    "coffee-latte": 75,
    "coffee-lungo": 85,
    "coffee-macchiato": 75,
    "coffee-marocchino": 85,
    "coffee-mocha": 85,
    "dessert-apple-pie": 140,
    "dessert-black-forest-cake": 170,
    "dessert-brownies": 140,
    "dessert-carrot-cake": 155,
    "dessert-cheesecake": 155,
    "dessert-chocolate-drizzle-eclair": 150,
    "dessert-chocolate-lava-cake": 140,
    "dessert-chocolate-mousse-cake": 135,
    "dessert-cinnamon-rolls": 160,
    "dessert-classic-cr-me-br-l-e": 175,
    "dessert-creme-caramel": 160,
    "dessert-fresh-fruit-salad": 175,
    "dessert-fruit-custard-tart": 150,
    "dessert-sundae": 175,
    "dessert-tiramisu": 140,
    "pastry-brownie-croissant": 95,
    "pastry-butter-croissant": 95,
    "pastry-chocolate-almond-croissant": 80,
    "pastry-chocolate-babka": 100,
    "pastry-chocolate-walnut-tart": 90,
    "pastry-cr-me-br-l-e-danish": 80,
    "pastry-pain-au-suisse": 85,
    "pastry-toffee-praline-croissant": 90,
    "friedchicken-bbq-fried-chicken": 210,
    "friedchicken-buttermilk-fried-chicken": 230,
    "friedchicken-cajun-fried-chicken": 240,
    "friedchicken-classic-fried-chicken": 200,
    "friedchicken-crispy-chicken-tenders": 210,
    "friedchicken-honey-garlic-fried-chicken": 185,
    "friedchicken-korean-fried-chicken": 200,
    "friedchicken-lemon-pepper-fried-chicken": 185,
    "friedchicken-spicy-fried-chicken": 230,
    "potato-bbq-chicken": 170,
    "potato-bacon-ranch": 170,
    "potato-cheesy": 155,
    "potato-classic-butter": 130,
    "potato-garlic-parmesan": 135,
    "potato-loaded": 130,
    "potato-mexican-style": 145,
    "potato-spinach-feta": 135,
    "sauce-bbq-sauce": 30,
    "sauce-cheese-sauce": 25,
    "sauce-garlic-sauce": 30,
    "sauce-ketchup": 35,
    "sauce-lemon-sauce": 30,
    "sauce-mayonnaise": 30,
    "sauce-mustard-sauce": 30,
    "sauce-pesto": 30,
    "sauce-ranch": 35,
    "sauce-sauce-b-chamel": 30,
    "sauce-sweet-chili-sauce": 30,
    "sauce-tahini": 30,
    "sauce-tartar-sauce": 35,
    "sauce-tomato": 30,
    "sauce-teriyaki-sauce": 30,
    "meal-steak-rice": 380,
    "meal-steak-pasta": 400,
    "meal-chicken-rice": 400,
    "meal-chicken-pasta": 380,
    "meal-fish-rice": 420,
    "meal-fish-sides": 340,
    "meal-seafood-pasta": 435,
}

INGREDIENTS = {
    "pizza-bbq-chicken": "Pizza dough, tomato base, mozzarella, BBQ Chicken",
    "pizza-chicken-supreme": "Pizza dough, tomato base, mozzarella, Chicken Supreme",
    "pizza-classic-cheese-pizza": "Pizza dough, tomato base, mozzarella, Classic Cheese Pizza",
    "pizza-margherita": "Pizza dough, tomato base, mozzarella, Margherita",
    "pizza-hawaian": "Pizza dough, tomato base, mozzarella, Hawaiian",
    "pizza-meat-lovers": "Pizza dough, tomato base, mozzarella, Meat Lovers",
    "pizza-pepperoni": "Pizza dough, tomato base, mozzarella, Pepperoni",
    "pizza-veggie": "Pizza dough, tomato base, mozzarella, Veggie",
    "pizza-four-cheese": "Pizza dough, tomato base, mozzarella, Four Cheese",
    "burger-bbq-burger": "Beef or chicken patty, brioche bun, lettuce, tomato, BBQ Burger",
    "burger-bacon-burger": "Beef or chicken patty, brioche bun, lettuce, tomato, Bacon Burger",
    "burger-beef-burger": "Beef or chicken patty, brioche bun, lettuce, tomato, Beef Burger",
    "burger-buffalo-burger": "Beef or chicken patty, brioche bun, lettuce, tomato, Buffalo Burger",
    "burger-chesse-burger": "Beef or chicken patty, brioche bun, lettuce, tomato, Cheese Burger",
    "burger-chicken-burger": "Beef or chicken patty, brioche bun, lettuce, tomato, Chicken Burger",
    "burger-double-burger": "Beef or chicken patty, brioche bun, lettuce, tomato, Double Burger",
    "burger-mushroom-swiss-burger": "Beef or chicken patty, brioche bun, lettuce, tomato, Mushroom Swiss Burger",
    "burger-spicy-chicken-burger": "Beef or chicken patty, brioche bun, lettuce, tomato, Spicy Chicken Burger",
    "burger-veggie-burger": "Beef or chicken patty, brioche bun, lettuce, tomato, Veggie Burger",
    "bbq-chicken-drumsticks": "BBQ Chicken Drumsticks, house BBQ marinade, garlic, paprika, slow-grilled",
    "bbq-chicken-wings": "BBQ Wings, house BBQ marinade, garlic, paprika, slow-grilled",
    "bbq-beef-brisket": "Beef Brisket, house BBQ marinade, garlic, paprika, slow-grilled",
    "bbq-chicken-skewers": "Chicken Skewers, house BBQ marinade, garlic, paprika, slow-grilled",
    "bbq-grilled-chicken-thighs": "Grilled BBQ Chicken Thighs, house BBQ marinade, garlic, paprika, slow-grilled",
    "bbq-smoked-whole-chicken": "Smoked Whole Chicken, house BBQ marinade, garlic, paprika, slow-grilled",
    "pasta-alfredo": "Pasta, Alfredo, garlic, olive oil, parmesan, herbs",
    "pasta-bolognese": "Pasta, Bolognese, garlic, olive oil, parmesan, herbs",
    "pasta-lasagna": "Pasta, Lasagna, garlic, olive oil, parmesan, herbs",
    "pasta-mac-and-cheese": "Pasta, Mac and Cheese, garlic, olive oil, parmesan, herbs",
    "pasta-penne-arrabbiata": "Pasta, Penne Arrabbiata, garlic, olive oil, parmesan, herbs",
    "pasta-pesto": "Pasta, Pesto, garlic, olive oil, parmesan, herbs",
    "pasta-seafood-pasta": "Pasta, Seafood Pasta, garlic, olive oil, parmesan, herbs",
    "fries-cheesy-fries": "Potatoes, sunflower oil, Cheesy Fries, sea salt",
    "fries-classic-french-fries": "Potatoes, sunflower oil, Classic French Fries, sea salt",
    "fries-garlic-parmesan-fries": "Potatoes, sunflower oil, Garlic Parmesan Fries, sea salt",
    "fries-peri-peri-fries": "Potatoes, sunflower oil, Peri Peri Fries, sea salt",
    "fries-salt-vinegar-fries": "Potatoes, sunflower oil, Salt & Vinegar Fries, sea salt",
    "fries-sweet-potato-fries": "Potatoes, sunflower oil, Sweet Potato Fries, sea salt",
    "fries-waffle-fries": "Potatoes, sunflower oil, Waffle Fries, sea salt",
    "salad-caesar-salad": "Mixed greens, Caesar Salad, olive oil dressing, herbs",
    "salad-chicken-salad": "Mixed greens, Chicken Salad, olive oil dressing, herbs",
    "salad-coleslaw": "Mixed greens, Coleslaw, olive oil dressing, herbs",
    "salad-greek": "Mixed greens, Greek, olive oil dressing, herbs",
    "salad-pasta-salad": "Mixed greens, Pasta Salad, olive oil dressing, herbs",
    "salad-potato-salad": "Mixed greens, Potato Salad, olive oil dressing, herbs",
    "salad-sobb": "Mixed greens, Sobb, olive oil dressing, herbs",
    "salad-tabbouleh": "Mixed greens, Tabbouleh, olive oil dressing, herbs",
    "salad-tuna-salad": "Mixed greens, Tuna Salad, olive oil dressing, herbs",
    "soup-beef-soup": "Beef Soup, stock, onion, garlic, herbs, cream or broth base",
    "soup-chicken-noodle": "Chicken Noodle, stock, onion, garlic, herbs, cream or broth base",
    "soup-french-onion-soup": "French Onion Soup, stock, onion, garlic, herbs, cream or broth base",
    "soup-lentil-soup": "Lentil Soup, stock, onion, garlic, herbs, cream or broth base",
    "soup-minestrone-soup": "Minestrone Soup, stock, onion, garlic, herbs, cream or broth base",
    "soup-mushroom-soup": "Mushroom Soup, stock, onion, garlic, herbs, cream or broth base",
    "soup-seafood-chowder-soup": "Seafood Chowder, stock, onion, garlic, herbs, cream or broth base",
    "soup-tomato-soup": "Tomato Soup, stock, onion, garlic, herbs, cream or broth base",
    "soup-vegetable-soup": "Vegetable Soup, stock, onion, garlic, herbs, cream or broth base",
    "coffee-ristretto": "Espresso-based, Ristretto",
    "coffee-americano": "Espresso-based, Americano",
    "coffee-cappuccino": "Espresso-based, Cappuccino",
    "coffee-corretto": "Espresso-based, Corretto",
    "coffee-doppio": "Espresso-based, Doppio",
    "coffee-espresso-romano": "Espresso-based, Espresso Romano",
    "coffee-espresso": "Espresso-based, Espresso",
    "coffee-flat-white": "Espresso-based, Flat White",
    "coffee-latte": "Espresso-based, Latte",
    "coffee-lungo": "Espresso-based, Lungo",
    "coffee-macchiato": "Espresso-based, Macchiato",
    "coffee-marocchino": "Espresso-based, Marocchino",
    "coffee-mocha": "Espresso-based, Mocha",
    "dessert-apple-pie": "Apple Pie, sugar, eggs, butter, vanilla",
    "dessert-black-forest-cake": "Black Forest Cake, sugar, eggs, butter, vanilla",
    "dessert-brownies": "Brownies, sugar, eggs, butter, vanilla",
    "dessert-carrot-cake": "Carrot Cake, sugar, eggs, butter, vanilla",
    "dessert-cheesecake": "Cheesecake, sugar, eggs, butter, vanilla",
    "dessert-chocolate-drizzle-eclair": "Chocolate Drizzle Eclair, sugar, eggs, butter, vanilla",
    "dessert-chocolate-lava-cake": "Chocolate Lava Cake, sugar, eggs, butter, vanilla",
    "dessert-chocolate-mousse-cake": "Chocolate Mousse Cake, sugar, eggs, butter, vanilla",
    "dessert-cinnamon-rolls": "Cinnamon Rolls, sugar, eggs, butter, vanilla",
    "dessert-classic-cr-me-br-l-e": "Classic Crème Brûlée, sugar, eggs, butter, vanilla",
    "dessert-creme-caramel": "Creme Caramel, sugar, eggs, butter, vanilla",
    "dessert-fresh-fruit-salad": "Fresh Fruit Salad, sugar, eggs, butter, vanilla",
    "dessert-fruit-custard-tart": "Fruit Custard Tart, sugar, eggs, butter, vanilla",
    "dessert-sundae": "Sundae, sugar, eggs, butter, vanilla",
    "dessert-tiramisu": "Tiramisu, sugar, eggs, butter, vanilla",
    "pastry-brownie-croissant": "Laminated dough, butter, Brownie Croissant",
    "pastry-butter-croissant": "Laminated dough, butter, Butter Croissant",
    "pastry-chocolate-almond-croissant": "Laminated dough, butter, Chocolate Almond Croissant",
    "pastry-chocolate-babka": "Laminated dough, butter, Chocolate Babka",
    "pastry-chocolate-walnut-tart": "Laminated dough, butter, Chocolate Walnut Tart",
    "pastry-cr-me-br-l-e-danish": "Laminated dough, butter, Crème Brûlée Danish",
    "pastry-pain-au-suisse": "Laminated dough, butter, Pain au Suisse",
    "pastry-toffee-praline-croissant": "Laminated dough, butter, Toffee Praline Croissant",
    "friedchicken-bbq-fried-chicken": "Chicken, buttermilk marinade, seasoned breading, BBQ Fried Chicken",
    "friedchicken-buttermilk-fried-chicken": "Chicken, buttermilk marinade, seasoned breading, Buttermilk Fried Chicken",
    "friedchicken-cajun-fried-chicken": "Chicken, buttermilk marinade, seasoned breading, Cajun Fried Chicken",
    "friedchicken-classic-fried-chicken": "Chicken, buttermilk marinade, seasoned breading, Classic Fried Chicken",
    "friedchicken-crispy-chicken-tenders": "Chicken, buttermilk marinade, seasoned breading, Crispy Chicken Tenders",
    "friedchicken-honey-garlic-fried-chicken": "Chicken, buttermilk marinade, seasoned breading, Honey Garlic Fried Chicken",
    "friedchicken-korean-fried-chicken": "Chicken, buttermilk marinade, seasoned breading, Korean Fried Chicken",
    "friedchicken-lemon-pepper-fried-chicken": "Chicken, buttermilk marinade, seasoned breading, Lemon Pepper Fried Chicken",
    "friedchicken-spicy-fried-chicken": "Chicken, buttermilk marinade, seasoned breading, Spicy Fried Chicken",
    "potato-bbq-chicken": "Baked potato, butter, BBQ Chicken",
    "potato-bacon-ranch": "Baked potato, butter, Bacon Ranch",
    "potato-cheesy": "Baked potato, butter, Cheesy",
    "potato-classic-butter": "Baked potato, butter, Classic Butter",
    "potato-garlic-parmesan": "Baked potato, butter, Garlic Parmesan",
    "potato-loaded": "Baked potato, butter, Loaded",
    "potato-mexican-style": "Baked potato, butter, Mexican Style",
    "potato-spinach-feta": "Baked potato, butter, Spinach & Feta",
    "sauce-bbq-sauce": "BBQ Sauce, oil or dairy base, seasoning",
    "sauce-cheese-sauce": "Cheese Sauce, oil or dairy base, seasoning",
    "sauce-garlic-sauce": "Garlic Sauce, oil or dairy base, seasoning",
    "sauce-ketchup": "Ketchup, oil or dairy base, seasoning",
    "sauce-lemon-sauce": "Lemon Sauce, oil or dairy base, seasoning",
    "sauce-mayonnaise": "Mayonnaise, oil or dairy base, seasoning",
    "sauce-mustard-sauce": "Mustard Sauce, oil or dairy base, seasoning",
    "sauce-pesto": "Pesto, oil or dairy base, seasoning",
    "sauce-ranch": "Ranch, oil or dairy base, seasoning",
    "sauce-sauce-b-chamel": "Sauce béchamel, oil or dairy base, seasoning",
    "sauce-sweet-chili-sauce": "Sweet Chili Sauce, oil or dairy base, seasoning",
    "sauce-tahini": "Tahini, oil or dairy base, seasoning",
    "sauce-tartar-sauce": "Tartar Sauce, oil or dairy base, seasoning",
    "sauce-tomato": "Tomato Sauce, oil or dairy base, seasoning",
    "sauce-teriyaki-sauce": "Teriyaki Sauce, oil or dairy base, seasoning",
    "meal-steak-rice": "Steak and Rice, served with rice or pasta and a side salad",
    "meal-steak-pasta": "Steak and Pasta, served with rice or pasta and a side salad",
    "meal-chicken-rice": "Chicken and Rice, served with rice or pasta and a side salad",
    "meal-chicken-pasta": "Chicken and Pasta, served with rice or pasta and a side salad",
    "meal-fish-rice": "Fish and Rice, served with rice or pasta and a side salad",
    "meal-fish-sides": "Fish and Sides, served with rice or pasta and a side salad",
    "meal-seafood-pasta": "Seafood Pasta Meal, served with rice or pasta and a side salad",
}

# Options/add-ons per category
CATEGORY_OPTIONS = {
    "Pizzas": {
        "options": [("Regular", 0), ("Large", 60), ("Extra Large", 100)],
        "addons": [("Extra cheese", 25), ("Extra olives", 15), ("Extra jalapeño", 15)],
    },
    "Burgers": {
        "options": [("Regular", 0), ("Double patty", 50)],
        "addons": [("Extra cheese", 20), ("Extra bacon", 30), ("Extra sauce", 15)],
    },
    "BBQ Dishes": {
        "options": [("Regular", 0), ("Large portion", 60)],
        "addons": [("Extra BBQ sauce", 20), ("Side salad", 40), ("Extra bread", 20)],
    },
    "Pasta Dishes": {
        "options": [("Regular", 0), ("Large", 50)],
        "addons": [("Extra parmesan", 20), ("Garlic bread", 30), ("Extra sauce", 20)],
    },
    "Fries": {
        "options": [("Regular", 0), ("Large", 25)],
        "addons": [("Extra sauce", 15), ("Extra cheese", 20)],
    },
    "Salads": {
        "options": [("Regular", 0), ("Large", 30)],
        "addons": [("Extra dressing", 15), ("Add croutons", 15), ("Add chicken", 40)],
    },
    "Soups": {
        "options": [("Regular", 0), ("Large", 30)],
        "addons": [("Extra bread", 20), ("Extra cream", 15)],
    },
    "Coffee": {
        "options": [("Regular", 0), ("Large", 20), ("Iced", 15)],
        "addons": [("Extra shot", 20), ("Vanilla syrup", 15), ("Caramel syrup", 15), ("Oat milk", 20)],
    },
    "Desserts": {
        "options": [("Regular", 0)],
        "addons": [("Extra cream", 20), ("Ice cream scoop", 30), ("Chocolate sauce", 20)],
    },
    "Pastries": {
        "options": [("Regular", 0)],
        "addons": [("Butter on the side", 15), ("Jam", 15)],
    },
    "Fried Chicken": {
        "options": [("Regular", 0), ("Large portion", 50)],
        "addons": [("Extra sauce", 15), ("Side fries", 50), ("Coleslaw", 30)],
    },
    "Baked Potatoes": {
        "options": [("Regular", 0), ("Large", 30)],
        "addons": [("Extra cheese", 20), ("Extra bacon", 25), ("Extra sour cream", 15)],
    },
    "Sauces": {
        "options": [("Regular (50 ml)", 0), ("Large (100 ml)", 20)],
        "addons": [],
    },
    "Complete Meals": {
        "options": [("Regular", 0), ("Upgrade sides", 40)],
        "addons": [("Extra sauce", 20), ("Extra bread", 20), ("Add salad", 40)],
    },
}


class Command(BaseCommand):
    help = "Seeds the complete PM Café menu (132 products), tables, options, add-ons. Offers start empty. Safe to re-run."

    def handle(self, *args, **options):
        # 1. Ensure the main branch exists
        branch, _ = Branch.objects.get_or_create(
            name="PM Café · Cairo",
            defaults={"address": "Cairo, Egypt", "phone": "+20 100 000 0000"},
        )

        # 2. Create all required categories in display order
        required_categories = [
            "Pizzas", "Burgers", "BBQ Dishes", "Pasta Dishes", "Fries",
            "Salads", "Soups", "Coffee", "Desserts", "Pastries",
            "Fried Chicken", "Baked Potatoes", "Sauces", "Complete Meals",
        ]
        for position, cat_name in enumerate(required_categories):
            slug = cat_name.lower().replace(" ", "-")
            Category.objects.update_or_create(
                branch=branch,
                slug=slug,
                defaults={"name": cat_name, "position": position, "active": True},
            )

        # 3. Seed all 124 products from the catalog
        created = updated = 0
        for public_id, category_name, name, image_path, source_note in MENU_CATALOG:
            category = Category.objects.get(branch=branch, name=category_name)
            price = Decimal(
                PRODUCT_PRICES.get(public_id, CATEGORY_PRICES.get(category_name, 100))
            )
            ingredients = INGREDIENTS.get(public_id, "")
            description = f"{name} — {ingredients.split(',')[0].strip()}." if ingredients else f"PM Café {name}."
            is_meal = category_name == "Complete Meals"

            _, was_created = MenuItem.objects.update_or_create(
                public_id=public_id,
                defaults={
                    "category": category,
                    "name": name,
                    "description": description,
                    "ingredients": ingredients,
                    "price": price,
                    "image": image_path,
                    "image_source": source_note,
                    "active": True,
                    "sold_out": False,
                    "is_complete_meal": is_meal,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

            # 4. Attach options and add-ons from the category defaults
            item = MenuItem.objects.get(public_id=public_id)
            cat_cfg = CATEGORY_OPTIONS.get(category_name, {})
            for opt_name, delta in cat_cfg.get("options", [("Regular", 0)]):
                ProductOption.objects.get_or_create(
                    item=item,
                    name=opt_name,
                    defaults={"price_delta": Decimal(str(delta))},
                )
            for addon_name, addon_price in cat_cfg.get("addons", [("Extra sauce", 20)]):
                AddOn.objects.get_or_create(
                    item=item,
                    name=addon_name,
                    defaults={"price": Decimal(str(addon_price))},
                )

        # 5. Create default tables
        for number, seats, location in (
            ("01", 4, "Main Hall"), ("02", 2, "Window"), ("03", 6, "Outdoor"),
            ("04", 4, "VIP"),       ("05", 4, "Main Hall"), ("06", 2, "Window"),
            ("07", 4, "Terrace"),   ("08", 6, "Garden"),    ("09", 2, "Bar"),
            ("10", 8, "Private Room"),
        ):
            table, _ = CafeTable.objects.get_or_create(
                branch=branch,
                number=number,
                defaults={"seats": seats, "location": location},
            )
            demo_token = DEMO_TABLE_QR_TOKENS.get(number)
            if demo_token and table.qr_token != demo_token:
                table.qr_token = demo_token
                table.save(update_fields=["qr_token"])

        # 6. Offers are intentionally NOT seeded here.
        # The spec requires the Offers section to start EMPTY by default with
        # no fake/sample offers -- the previous version of this command
        # created a "Happy Hour" offer automatically, which violated that.
        # Manager/Admin create real offers later via the Offers API/CRUD.

        # 7. Seed one login account per role so the staff workspace (JWT login,
        # Part 2 Manager tools included) works immediately after a fresh seed
        # without a manual `createsuperuser` step. Idempotent: re-running never
        # resets an existing password, only creates missing accounts.
        User = get_user_model()
        for username, role, password in (
            ("manager", StaffProfile.Role.MANAGER, "manager12345"),
            ("cashier", StaffProfile.Role.CASHIER, "cashier12345"),
            ("kitchen", StaffProfile.Role.KITCHEN, "kitchen12345"),
            ("waiter", StaffProfile.Role.WAITER, "waiter12345"),
        ):
            user, user_created = User.objects.get_or_create(
                username=username, defaults={"is_staff": role == StaffProfile.Role.MANAGER}
            )
            if user_created:
                user.set_password(password)
                user.save()
            StaffProfile.objects.get_or_create(
                user=user,
                defaults={"branch": branch, "role": role, "active": True},
            )

        total = MenuItem.objects.filter(category__branch=branch).count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded complete menu: {created} created, {updated} updated. "
                f"Total products in DB: {total}. "
                f"Tables: {CafeTable.objects.filter(branch=branch).count()}. "
                f"Staff logins ready: manager/manager12345, cashier/cashier12345, "
                f"kitchen/kitchen12345, waiter/waiter12345 (change these before production)."
            )
        )
