from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Settings:
    database_url: str = os.environ.get("DATABASE_URL", "sqlite:///./dev.db")
    jwt_secret: str = os.environ.get("JWT_SECRET", "dev-secret-change-me")
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = int(os.environ.get("JWT_EXPIRES_MINUTES", "60"))

    trial_days: int = int(os.environ.get("TRIAL_DAYS", "7"))

    frontend_url: str = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    stripe_secret_key: str = os.environ.get("STRIPE_SECRET_KEY", "sk_test_placeholder")
    stripe_webhook_secret: str = os.environ.get("STRIPE_WEBHOOK_SECRET", "whsec_placeholder")
    stripe_price_id_standard: str = os.environ.get("STRIPE_PRICE_ID_STANDARD", "price_standard_placeholder")
    stripe_price_id_pro: str = os.environ.get("STRIPE_PRICE_ID_PRO", "price_pro_placeholder")

    # Stripe calls are mocked (no network call, no real key required) unless
    # a real-looking secret key is supplied. This lets the whole signup ->
    # trial -> checkout -> webhook flow be exercised in dev/tests without a
    # live Stripe account. Flip STRIPE_MOCK_MODE=false once real keys are set.
    stripe_mock_mode: bool = field(
        default_factory=lambda: os.environ.get(
            "STRIPE_MOCK_MODE", "true" if os.environ.get("STRIPE_SECRET_KEY", "").endswith("placeholder") or not os.environ.get("STRIPE_SECRET_KEY") else "false"
        ).lower()
        == "true"
    )

    sales_email: str = os.environ.get("SALES_EMAIL", "sale@example-domain.com")

    sightings_source_path: str = os.environ.get(
        "SIGHTINGS_SOURCE_PATH",
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "netalertx-attck-bridge", "output", "sightings.stix.json"),
    )


settings = Settings()
