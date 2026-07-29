"""Thin wrapper around the Stripe SDK with a mock mode.

Real Stripe keys aren't available in this environment, so by default
(STRIPE_MOCK_MODE=true, the default whenever STRIPE_SECRET_KEY looks like
a placeholder) this fabricates realistic-looking responses instead of
calling Stripe's API. Set real keys and STRIPE_MOCK_MODE=false to go live
— no other code needs to change.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from urllib.parse import urlencode, urlparse, urlunparse, parse_qsl

from .config import settings

try:
    import stripe

    stripe.api_key = settings.stripe_secret_key
except ImportError:  # pragma: no cover - stripe is in requirements.txt
    stripe = None  # type: ignore


@dataclass
class CheckoutSession:
    url: str
    id: str


def create_checkout_session(*, customer_email: str, price_id: str, success_url: str, cancel_url: str) -> CheckoutSession:
    if settings.stripe_mock_mode:
        fake_id = f"cs_test_mock_{uuid.uuid4().hex[:24]}"
        return CheckoutSession(url=_add_query_params(success_url, session_id=fake_id, mock="true"), id=fake_id)

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer_email=customer_email,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
    )
    return CheckoutSession(url=session.url, id=session.id)


def _add_query_params(url: str, **params: str) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query))
    query.update(params)
    return urlunparse(parsed._replace(query=urlencode(query)))


def verify_webhook(payload: bytes, sig_header: str) -> dict:
    if settings.stripe_mock_mode:
        import json

        return json.loads(payload)

    event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    return event
