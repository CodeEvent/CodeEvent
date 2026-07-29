from __future__ import annotations

from fastapi import APIRouter

from ..config import settings
from ..tiers import TIER_FEATURES, Tier

router = APIRouter(prefix="/pricing", tags=["pricing"])


@router.get("")
def pricing() -> dict:
    """Public, unauthenticated — powers the landing page pricing table."""
    plans = []
    for tier in (Tier.STANDARD, Tier.PRO, Tier.ENTERPRISE):
        features = TIER_FEATURES[tier]
        plans.append(
            {
                "tier": tier.value,
                "self_serve": features.self_serve,
                "contact_email": None if features.self_serve else settings.sales_email,
                "max_sites": features.max_sites,
                "history_days": features.history_days,
                "webhooks": features.webhooks,
                "taxii_feed": features.taxii_feed,
                "custom_mapping_rules": features.custom_mapping_rules,
                "attack_domains": list(features.attack_domains),
                "pentapi_integration": features.pentapi_integration,
                "sso": features.sso,
            }
        )
    return {"trial_days": settings.trial_days, "plans": plans}
