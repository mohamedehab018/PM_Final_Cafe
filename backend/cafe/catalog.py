"""Single source of truth for the complete PM Cafe menu catalog.

Each tuple: (public_id, category_name, display_name, image_path, source_note)

REBUILT for Part 1: every one of the 125 individual Typess product photos
is mapped to exactly one product -- there is NO image reuse in this section.
source_note is "Typess/<folder>" for every row below, confirming the image
came from the supplied Typess.zip asset, not a substitute/placeholder.

A 14th category, Complete Meals, is appended after this block. Typess.zip
contains no dedicated Complete Meal photography (no steak/rice/fish combo
shots), so those items reuse existing protein photos already present in the
project's media/ folder from before this pass -- documented explicitly on
each row, not hidden. See COMPLETE_MEALS below.

Category order matches the required display order in the frontend.
"""

MENU_CATALOG = [

    # -- PIZZAS (9) ----------------------------------------
    ("pizza-bbq-chicken", "Pizzas", "BBQ Chicken", "products/pizza-bbq-chicken.jpeg", "Typess/Pizzas"),
    ("pizza-chicken-supreme", "Pizzas", "Chicken Supreme", "products/pizza-chicken-supreme-pizza-with-colorful-vegetables.jpeg", "Typess/Pizzas"),
    ("pizza-classic-cheese-pizza", "Pizzas", "Classic Cheese Pizza", "products/pizza-classic-cheese-pizza.jpeg", "Typess/Pizzas"),
    ("pizza-margherita", "Pizzas", "Margherita", "products/pizza-fresh-margherita-pizza-authentic-italian-pizza-with-basil-mozzarella.jpeg", "Typess/Pizzas"),
    ("pizza-hawaian", "Pizzas", "Hawaiian", "products/pizza-hawaian.jpeg", "Typess/Pizzas"),
    ("pizza-meat-lovers", "Pizzas", "Meat Lovers", "products/pizza-meat-lovers.jpeg", "Typess/Pizzas"),
    ("pizza-pepperoni", "Pizzas", "Pepperoni", "products/pizza-peperoni-pizza-for-the-pizza-enthusiast.jpeg", "Typess/Pizzas"),
    ("pizza-veggie", "Pizzas", "Veggie", "products/pizza-rustic-veggie-pizza-mushrooms-olives-peppers-delight.jpeg", "Typess/Pizzas"),
    ("pizza-four-cheese", "Pizzas", "Four Cheese", "products/pizza-four-cheese.jpeg", "Typess/Pizzas"),

    # -- BURGERS (10) ----------------------------------------
    ("burger-bbq-burger", "Burgers", "BBQ Burger", "products/burger-bbq-burger.jpeg", "Typess/Burgers"),
    ("burger-bacon-burger", "Burgers", "Bacon Burger", "products/burger-bacon-burger.jpeg", "Typess/Burgers"),
    ("burger-beef-burger", "Burgers", "Beef Burger", "products/burger-beef-burger.jpeg", "Typess/Burgers"),
    ("burger-buffalo-burger", "Burgers", "Buffalo Burger", "products/burger-buffalo-burger.jpeg", "Typess/Burgers"),
    ("burger-chesse-burger", "Burgers", "Cheese Burger", "products/burger-chesse-burger.jpeg", "Typess/Burgers"),
    ("burger-chicken-burger", "Burgers", "Chicken Burger", "products/burger-chicken-burger.jpeg", "Typess/Burgers"),
    ("burger-double-burger", "Burgers", "Double Burger", "products/burger-double-burger.jpeg", "Typess/Burgers"),
    ("burger-mushroom-swiss-burger", "Burgers", "Mushroom Swiss Burger", "products/burger-mushroom-swiss-burger.jpeg", "Typess/Burgers"),
    ("burger-spicy-chicken-burger", "Burgers", "Spicy Chicken Burger", "products/burger-spicy-chicken-burger.jpeg", "Typess/Burgers"),
    ("burger-veggie-burger", "Burgers", "Veggie Burger", "products/burger-veggie-burger.jpeg", "Typess/Burgers"),

    # -- BBQ DISHES (6) ----------------------------------------
    ("bbq-chicken-drumsticks", "BBQ Dishes", "BBQ Chicken Drumsticks", "products/bbq-bbq-chicken-drumsticks.jpeg", "Typess/BBQ Dishes"),
    ("bbq-chicken-wings", "BBQ Dishes", "BBQ Wings", "products/bbq-bbq-wings.jpeg", "Typess/BBQ Dishes"),
    ("bbq-beef-brisket", "BBQ Dishes", "Beef Brisket", "products/bbq-beef-brisket.jpeg", "Typess/BBQ Dishes"),
    ("bbq-chicken-skewers", "BBQ Dishes", "Chicken Skewers", "products/bbq-chicken-skewers.jpeg", "Typess/BBQ Dishes"),
    ("bbq-grilled-chicken-thighs", "BBQ Dishes", "Grilled BBQ Chicken Thighs", "products/bbq-grilled-bbq-chicken-thighs.jpeg", "Typess/BBQ Dishes"),
    ("bbq-smoked-whole-chicken", "BBQ Dishes", "Smoked Whole Chicken", "products/bbq-smoked-whole-chicken.jpeg", "Typess/BBQ Dishes"),

    # -- PASTA DISHES (7) ----------------------------------------
    ("pasta-alfredo", "Pasta Dishes", "Alfredo", "products/pasta-alfredo.jpeg", "Typess/PASTA DISHES"),
    ("pasta-bolognese", "Pasta Dishes", "Bolognese", "products/pasta-bolognese.jpeg", "Typess/PASTA DISHES"),
    ("pasta-lasagna", "Pasta Dishes", "Lasagna", "products/pasta-lasagna.jpeg", "Typess/PASTA DISHES"),
    ("pasta-mac-and-cheese", "Pasta Dishes", "Mac and Cheese", "products/pasta-mac-and-cheese.jpeg", "Typess/PASTA DISHES"),
    ("pasta-penne-arrabbiata", "Pasta Dishes", "Penne Arrabbiata", "products/pasta-penne-arrabbiata.jpeg", "Typess/PASTA DISHES"),
    ("pasta-pesto", "Pasta Dishes", "Pesto", "products/pasta-pesto.jpeg", "Typess/PASTA DISHES"),
    ("pasta-seafood-pasta", "Pasta Dishes", "Seafood Pasta", "products/pasta-seafood-pasta.jpeg", "Typess/PASTA DISHES"),

    # -- FRIES (7) ----------------------------------------
    ("fries-cheesy-fries", "Fries", "Cheesy Fries", "products/fries-cheesy-fries.jpeg", "Typess/FRIES"),
    ("fries-classic-french-fries", "Fries", "Classic French Fries", "products/fries-classic-french-fries.jpeg", "Typess/FRIES"),
    ("fries-garlic-parmesan-fries", "Fries", "Garlic Parmesan Fries", "products/fries-garlic-parmesan-fries.jpeg", "Typess/FRIES"),
    ("fries-peri-peri-fries", "Fries", "Peri Peri Fries", "products/fries-peri-peri-fries.jpeg", "Typess/FRIES"),
    ("fries-salt-vinegar-fries", "Fries", "Salt & Vinegar Fries", "products/fries-salt-vinegar-fries.jpeg", "Typess/FRIES"),
    ("fries-sweet-potato-fries", "Fries", "Sweet Potato Fries", "products/fries-sweet-potato-fries.jpeg", "Typess/FRIES"),
    ("fries-waffle-fries", "Fries", "Waffle Fries", "products/fries-waffle-fries.jpeg", "Typess/FRIES"),

    # -- SALADS (9) ----------------------------------------
    ("salad-caesar-salad", "Salads", "Caesar Salad", "products/salad-caesar-salad.jpeg", "Typess/Salads"),
    ("salad-chicken-salad", "Salads", "Chicken Salad", "products/salad-chicken-salad.jpeg", "Typess/Salads"),
    ("salad-coleslaw", "Salads", "Coleslaw", "products/salad-coleslaw.jpeg", "Typess/Salads"),
    ("salad-greek", "Salads", "Greek", "products/salad-greek.jpeg", "Typess/Salads"),
    ("salad-pasta-salad", "Salads", "Pasta Salad", "products/salad-pasta-salad.jpeg", "Typess/Salads"),
    ("salad-potato-salad", "Salads", "Potato Salad", "products/salad-potato-salad.jpeg", "Typess/Salads"),
    ("salad-sobb", "Salads", "Sobb", "products/salad-sobb.jpeg", "Typess/Salads"),
    ("salad-tabbouleh", "Salads", "Tabbouleh", "products/salad-tabbouleh.jpeg", "Typess/Salads"),
    ("salad-tuna-salad", "Salads", "Tuna Salad", "products/salad-tuna-salad.jpeg", "Typess/Salads"),

    # -- SOUPS (9) ----------------------------------------
    ("soup-beef-soup", "Soups", "Beef Soup", "products/soup-beef-soup.jpeg", "Typess/Soups"),
    ("soup-chicken-noodle", "Soups", "Chicken Noodle", "products/soup-chicken-noodle.jpeg", "Typess/Soups"),
    ("soup-french-onion-soup", "Soups", "French Onion Soup", "products/soup-french-onion-soup.jpeg", "Typess/Soups"),
    ("soup-lentil-soup", "Soups", "Lentil Soup", "products/soup-lentil-soup.jpeg", "Typess/Soups"),
    ("soup-minestrone-soup", "Soups", "Minestrone Soup", "products/soup-minestrone-soup.jpeg", "Typess/Soups"),
    ("soup-mushroom-soup", "Soups", "Mushroom Soup", "products/soup-mushroom-soup.jpeg", "Typess/Soups"),
    ("soup-seafood-chowder-soup", "Soups", "Seafood Chowder", "products/soup-seafood-chowder-soup.jpeg", "Typess/Soups"),
    ("soup-tomato-soup", "Soups", "Tomato Soup", "products/soup-tomato-soup.jpeg", "Typess/Soups"),
    ("soup-vegetable-soup", "Soups", "Vegetable Soup", "products/soup-vegetable-soup.jpeg", "Typess/Soups"),

    # -- COFFEE (13) ----------------------------------------
    ("coffee-ristretto", "Coffee", "Ristretto", "products/coffee-ristretto.jpeg", "Typess/Coffee"),
    ("coffee-americano", "Coffee", "Americano", "products/coffee-americano.jpeg", "Typess/Coffee"),
    ("coffee-cappuccino", "Coffee", "Cappuccino", "products/coffee-cappuccino.jpeg", "Typess/Coffee"),
    ("coffee-corretto", "Coffee", "Corretto", "products/coffee-corretto.jpeg", "Typess/Coffee"),
    ("coffee-doppio", "Coffee", "Doppio", "products/coffee-doppio.jpeg", "Typess/Coffee"),
    ("coffee-espresso-romano", "Coffee", "Espresso Romano", "products/coffee-espresso-romano.jpeg", "Typess/Coffee"),
    ("coffee-espresso", "Coffee", "Espresso", "products/coffee-espresso.jpeg", "Typess/Coffee"),
    ("coffee-flat-white", "Coffee", "Flat White", "products/coffee-flat-white.jpeg", "Typess/Coffee"),
    ("coffee-latte", "Coffee", "Latte", "products/coffee-latte.jpeg", "Typess/Coffee"),
    ("coffee-lungo", "Coffee", "Lungo", "products/coffee-lungo.jpeg", "Typess/Coffee"),
    ("coffee-macchiato", "Coffee", "Macchiato", "products/coffee-macchiato.jpeg", "Typess/Coffee"),
    ("coffee-marocchino", "Coffee", "Marocchino", "products/coffee-marocchino-coffee-authentic-italian-recipe.jpeg", "Typess/Coffee"),
    ("coffee-mocha", "Coffee", "Mocha", "products/coffee-mocha-coffee-class.jpeg", "Typess/Coffee"),

    # -- DESSERTS (15) ----------------------------------------
    ("dessert-apple-pie", "Desserts", "Apple Pie", "products/dessert-apple-pie.jpeg", "Typess/Desserts"),
    ("dessert-black-forest-cake", "Desserts", "Black Forest Cake", "products/dessert-black-forest-cake.jpeg", "Typess/Desserts"),
    ("dessert-brownies", "Desserts", "Brownies", "products/dessert-brownies.jpeg", "Typess/Desserts"),
    ("dessert-carrot-cake", "Desserts", "Carrot Cake", "products/dessert-carrot-cake.jpeg", "Typess/Desserts"),
    ("dessert-cheesecake", "Desserts", "Cheesecake", "products/dessert-cheesecake.jpeg", "Typess/Desserts"),
    ("dessert-chocolate-drizzle-eclair", "Desserts", "Chocolate Drizzle Eclair", "products/dessert-chocolate-drizzle-eclair.jpeg", "Typess/Desserts"),
    ("dessert-chocolate-lava-cake", "Desserts", "Chocolate Lava Cake", "products/dessert-chocolate-lava-cake.jpeg", "Typess/Desserts"),
    ("dessert-chocolate-mousse-cake", "Desserts", "Chocolate Mousse Cake", "products/dessert-chocolate-mousse-cake.jpeg", "Typess/Desserts"),
    ("dessert-cinnamon-rolls", "Desserts", "Cinnamon Rolls", "products/dessert-cinnamon-rolls.jpeg", "Typess/Desserts"),
    ("dessert-classic-cr-me-br-l-e", "Desserts", "Classic Crème Brûlée", "products/dessert-classic-cr-me-br-l-e.jpeg", "Typess/Desserts"),
    ("dessert-creme-caramel", "Desserts", "Creme Caramel", "products/dessert-creme-caramel.jpeg", "Typess/Desserts"),
    ("dessert-fresh-fruit-salad", "Desserts", "Fresh Fruit Salad", "products/dessert-delicious-the-very-best-fruit-salad-ideas.jpeg", "Typess/Desserts"),
    ("dessert-fruit-custard-tart", "Desserts", "Fruit Custard Tart", "products/dessert-fruit-custard-tart.jpeg", "Typess/Desserts"),
    ("dessert-sundae", "Desserts", "Sundae", "products/dessert-sundae.jpeg", "Typess/Desserts"),
    ("dessert-tiramisu", "Desserts", "Tiramisu", "products/dessert-tiramisu.jpeg", "Typess/Desserts"),

    # -- PASTRIES (8) ----------------------------------------
    ("pastry-brownie-croissant", "Pastries", "Brownie Croissant", "products/pastry-brownie-croissant.jpeg", "Typess/Pattisere"),
    ("pastry-butter-croissant", "Pastries", "Butter Croissant", "products/pastry-butter-croissant.jpeg", "Typess/Pattisere"),
    ("pastry-chocolate-almond-croissant", "Pastries", "Chocolate Almond Croissant", "products/pastry-chocolate-almond-croissant.jpeg", "Typess/Pattisere"),
    ("pastry-chocolate-babka", "Pastries", "Chocolate Babka", "products/pastry-chocolate-babka.jpeg", "Typess/Pattisere"),
    ("pastry-chocolate-walnut-tart", "Pastries", "Chocolate Walnut Tart", "products/pastry-chocolate-walnut-tart.jpeg", "Typess/Pattisere"),
    ("pastry-cr-me-br-l-e-danish", "Pastries", "Crème Brûlée Danish", "products/pastry-cr-me-br-l-e-danish.jpeg", "Typess/Pattisere"),
    ("pastry-pain-au-suisse", "Pastries", "Pain au Suisse", "products/pastry-pain-au-suisse.jpeg", "Typess/Pattisere"),
    ("pastry-toffee-praline-croissant", "Pastries", "Toffee Praline Croissant", "products/pastry-toffee-praline-croissant.jpeg", "Typess/Pattisere"),

    # -- FRIED CHICKEN (9) ----------------------------------------
    ("friedchicken-bbq-fried-chicken", "Fried Chicken", "BBQ Fried Chicken", "products/friedchicken-bbq-fried-chicken.jpeg", "Typess/Fried Chicken"),
    ("friedchicken-buttermilk-fried-chicken", "Fried Chicken", "Buttermilk Fried Chicken", "products/friedchicken-buttermilk-fried-chicken.jpeg", "Typess/Fried Chicken"),
    ("friedchicken-cajun-fried-chicken", "Fried Chicken", "Cajun Fried Chicken", "products/friedchicken-cajun-fried-chicken.jpeg", "Typess/Fried Chicken"),
    ("friedchicken-classic-fried-chicken", "Fried Chicken", "Classic Fried Chicken", "products/friedchicken-classic-fried-chicken.jpeg", "Typess/Fried Chicken"),
    ("friedchicken-crispy-chicken-tenders", "Fried Chicken", "Crispy Chicken Tenders", "products/friedchicken-crispy-chicken-tenders.jpeg", "Typess/Fried Chicken"),
    ("friedchicken-honey-garlic-fried-chicken", "Fried Chicken", "Honey Garlic Fried Chicken", "products/friedchicken-honey-garlic-fried-chicken.jpeg", "Typess/Fried Chicken"),
    ("friedchicken-korean-fried-chicken", "Fried Chicken", "Korean Fried Chicken", "products/friedchicken-korean-fried-chicken.jpeg", "Typess/Fried Chicken"),
    ("friedchicken-lemon-pepper-fried-chicken", "Fried Chicken", "Lemon Pepper Fried Chicken", "products/friedchicken-lemon-pepper-fried-chicken.jpeg", "Typess/Fried Chicken"),
    ("friedchicken-spicy-fried-chicken", "Fried Chicken", "Spicy Fried Chicken", "products/friedchicken-spicy-fried-chicken.jpeg", "Typess/Fried Chicken"),

    # -- BAKED POTATOES (8) ----------------------------------------
    ("potato-bbq-chicken", "Baked Potatoes", "BBQ Chicken", "products/potato-bbq-chicken.jpeg", "Typess/Baked Potatoes"),
    ("potato-bacon-ranch", "Baked Potatoes", "Bacon Ranch", "products/potato-bacon-ranch.jpeg", "Typess/Baked Potatoes"),
    ("potato-cheesy", "Baked Potatoes", "Cheesy", "products/potato-cheesy.jpeg", "Typess/Baked Potatoes"),
    ("potato-classic-butter", "Baked Potatoes", "Classic Butter", "products/potato-classic-butter.jpeg", "Typess/Baked Potatoes"),
    ("potato-garlic-parmesan", "Baked Potatoes", "Garlic Parmesan", "products/potato-garlic-parmesan.jpeg", "Typess/Baked Potatoes"),
    ("potato-loaded", "Baked Potatoes", "Loaded", "products/potato-loaded.jpeg", "Typess/Baked Potatoes"),
    ("potato-mexican-style", "Baked Potatoes", "Mexican Style", "products/potato-mexican-style.jpeg", "Typess/Baked Potatoes"),
    ("potato-spinach-feta", "Baked Potatoes", "Spinach & Feta", "products/potato-spinach-feta.jpeg", "Typess/Baked Potatoes"),

    # -- SAUCES (15) ----------------------------------------
    ("sauce-bbq-sauce", "Sauces", "BBQ Sauce", "products/sauce-bbq-sauce.jpeg", "Typess/Sauces"),
    ("sauce-cheese-sauce", "Sauces", "Cheese Sauce", "products/sauce-cheese-sauce.jpeg", "Typess/Sauces"),
    ("sauce-garlic-sauce", "Sauces", "Garlic Sauce", "products/sauce-garlic-sauce.jpeg", "Typess/Sauces"),
    ("sauce-ketchup", "Sauces", "Ketchup", "products/sauce-ketchup.jpeg", "Typess/Sauces"),
    ("sauce-lemon-sauce", "Sauces", "Lemon Sauce", "products/sauce-lemon-sauce.jpeg", "Typess/Sauces"),
    ("sauce-mayonnaise", "Sauces", "Mayonnaise", "products/sauce-mayonnaise.jpeg", "Typess/Sauces"),
    ("sauce-mustard-sauce", "Sauces", "Mustard Sauce", "products/sauce-mustard-sauce.jpeg", "Typess/Sauces"),
    ("sauce-pesto", "Sauces", "Pesto", "products/sauce-pesto.jpeg", "Typess/Sauces"),
    ("sauce-ranch", "Sauces", "Ranch", "products/sauce-ranch.jpeg", "Typess/Sauces"),
    ("sauce-sauce-b-chamel", "Sauces", "Sauce béchamel", "products/sauce-sauce-b-chamel.jpeg", "Typess/Sauces"),
    ("sauce-sweet-chili-sauce", "Sauces", "Sweet Chili Sauce", "products/sauce-sweet-chili-sauce.jpeg", "Typess/Sauces"),
    ("sauce-tahini", "Sauces", "Tahini", "products/sauce-tahini.jpeg", "Typess/Sauces"),
    ("sauce-tartar-sauce", "Sauces", "Tartar Sauce", "products/sauce-tartar-sauce.jpeg", "Typess/Sauces"),
    ("sauce-tomato", "Sauces", "Tomato Sauce", "products/sauce-tomato.jpeg", "Typess/Sauces"),
    ("sauce-teriyaki-sauce", "Sauces", "Teriyaki Sauce", "products/sauce-teriyaki-sauce.jpeg", "Typess/Sauces"),

    # -- COMPLETE MEALS (6 required combos + 1 existing seafood pasta) ----------
    # No dedicated combo-meal photography was supplied in Typess.zip.
    # Each meal below is pictured using the photo of its featured protein,
    # which already existed in media/products/ before this pass. Steak+Rice
    # and Steak+Pasta necessarily share one image: only a single steak photo
    # (bbq-steak.jpg) exists anywhere in the supplied assets. This is the one
    # deliberate, documented exception to the "never reuse" rule in this file.
    ("meal-steak-rice", "Complete Meals", "Steak + Rice", "products/bbq-steak.jpg", "pre-existing asset - no Typess steak photo supplied"),
    ("meal-steak-pasta", "Complete Meals", "Steak + Pasta", "products/bbq-steak.jpg", "pre-existing asset - shares steak photo (only one steak image exists in project)"),
    ("meal-chicken-rice", "Complete Meals", "Chicken + Rice", "products/bbq-grilled-chicken.jpg", "pre-existing asset"),
    ("meal-chicken-pasta", "Complete Meals", "Chicken + Pasta", "products/lemon-herb-chicken.jpg", "pre-existing asset"),
    ("meal-fish-rice", "Complete Meals", "Fish + Rice", "products/bbq-fish.jpg", "pre-existing asset"),
    ("meal-fish-sides", "Complete Meals", "Fish + Sides", "products/bbq-salmon.jpg", "pre-existing asset"),
    ("meal-seafood-pasta", "Complete Meals", "Seafood Pasta Meal", "products/seafood-pasta.jpg", "Typess/PASTA DISHES (Seafood Pasta) reused as a Complete Meal plate"),
]

# Convenience export: True product count actually implemented in this pass.
PRODUCT_COUNT = len(MENU_CATALOG)
