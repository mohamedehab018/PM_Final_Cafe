# PM Café Django API

1. Create PostgreSQL database and user matching `.env.example`.
2. `python -m venv .venv` then activate it and run `pip install -r requirements.txt`.
3. Export the variables in `.env.example`, then run `python manage.py migrate`, `python manage.py seed_cafe`, and `python manage.py createsuperuser`. The included migrations are the real PostgreSQL schema, including order totals and payment gateway state.
4. Start with `python manage.py runserver`.

The API is under `/api/`. Staff authenticate with `/api/auth/token/`; anonymous customers use menu endpoints and receive a per-order `customer_token`. The included launcher uses `http://127.0.0.1:8010/api/` so it does not collide with earlier local runs.

When Stripe test-mode variables are configured, customers use
`POST /api/payments/checkout/` with `X-Table-Session`; Stripe calls
`POST /api/payments/stripe-webhook/` to confirm payment. The frontend never
marks an online payment successful. Cash, InstaPay and Vodafone Cash remain
manual cashier-recorded methods.
