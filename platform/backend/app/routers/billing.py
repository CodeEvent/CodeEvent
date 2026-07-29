from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import CheckoutSessionRequest, CheckoutSessionResponse, ContactSalesResponse
from ..stripe_client import create_checkout_session, verify_webhook
from ..tiers import Tier

router = APIRouter(prefix="/billing", tags=["billing"])

_PRICE_IDS = {
    Tier.STANDARD.value: settings.stripe_price_id_standard,
    Tier.PRO.value: settings.stripe_price_id_pro,
}


@router.post("/checkout-session", response_model=CheckoutSessionResponse)
def checkout_session(
    payload: CheckoutSessionRequest,
    user: User = Depends(get_current_user),
) -> CheckoutSessionResponse:
    if payload.tier == Tier.ENTERPRISE.value:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Enterprise isn't self-serve — contact {settings.sales_email} to subscribe. "
            "See GET /billing/contact-sales.",
        )
    price_id = _PRICE_IDS.get(payload.tier)
    if price_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown tier '{payload.tier}'")

    session = create_checkout_session(
        customer_email=user.email,
        price_id=price_id,
        success_url=f"{settings.frontend_url}/dashboard?checkout=success",
        cancel_url=f"{settings.frontend_url}/pricing?checkout=cancelled",
    )
    return CheckoutSessionResponse(checkout_url=session.url, mock_mode=settings.stripe_mock_mode)


@router.get("/contact-sales", response_model=ContactSalesResponse)
def contact_sales() -> ContactSalesResponse:
    return ContactSalesResponse(
        message="Enterprise subscriptions are provisioned by our sales team, not self-serve checkout.",
        email=settings.sales_email,
    )


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        event = verify_webhook(payload, sig_header)
    except Exception as exc:  # noqa: BLE001 - Stripe raises several distinct error types here
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid webhook payload: {exc}") from exc

    event_type = event.get("type")
    data = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        email = data.get("customer_email") or data.get("customer_details", {}).get("email")
        tier = data.get("metadata", {}).get("tier", Tier.STANDARD.value)
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.tier = tier
            user.subscription_status = "active"
            user.stripe_customer_id = data.get("customer")
            user.stripe_subscription_id = data.get("subscription")
            db.commit()
    elif event_type in ("customer.subscription.deleted", "customer.subscription.updated"):
        status_map = {"canceled": "canceled", "past_due": "past_due", "active": "active"}
        sub_id = data.get("id")
        user = db.query(User).filter(User.stripe_subscription_id == sub_id).first()
        if user:
            user.subscription_status = status_map.get(data.get("status"), user.subscription_status)
            db.commit()

    return {"received": True}
