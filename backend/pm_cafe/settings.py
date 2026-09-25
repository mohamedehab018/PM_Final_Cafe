from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "change-me-before-production")
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = os.getenv(
    "DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver"
).split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "channels",
    "cafe",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "cafe.middleware.DevelopmentCorsMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

ROOT_URLCONF = "pm_cafe.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

WSGI_APPLICATION = "pm_cafe.wsgi.application"
ASGI_APPLICATION = "pm_cafe.asgi.application"

# PostgreSQL is the production source of truth.
# Set PM_CAFE_SQLITE=1 only for local migration generation without PostgreSQL.
DATABASES = (
    {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "dev.sqlite3",
        }
    }
    if os.getenv("PM_CAFE_SQLITE") == "1"
    else {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB", "pm_cafe"),
            "USER": os.getenv("POSTGRES_USER", "pm_cafe"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", "pm_cafe"),
            "HOST": os.getenv("POSTGRES_HOST", "127.0.0.1"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
        }
    }
)

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Cairo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# ── CORS ──────────────────────────────────────────────────────────────────────
# The DevelopmentCorsMiddleware already handles CORS in DEBUG mode.
# For production, install django-cors-headers and configure CORS_ALLOWED_ORIGINS.
CORS_ALLOWED_ORIGINS = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500",
).split(",")

# Stripe Checkout is optional for local/manual deployments. When configured,
# PAID is set only by the verified webhook in cafe.views.stripe_webhook.
# ── Demo payments ─────────────────────────────────────────────────────────────
# Set DEMO_PAYMENTS_ENABLED=0 in your environment before going live.
# When disabled, POST /api/orders/{id}/demo_pay/ returns 503.
DEMO_PAYMENTS_ENABLED = os.getenv("DEMO_PAYMENTS_ENABLED", "1") == "1"

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_CURRENCY = os.getenv("STRIPE_CURRENCY", "egp").lower()
STRIPE_SUCCESS_URL = os.getenv("STRIPE_SUCCESS_URL", "")
STRIPE_CANCEL_URL = os.getenv("STRIPE_CANCEL_URL", "")
