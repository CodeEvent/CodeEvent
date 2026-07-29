"""Subscription tier definitions and the feature-gating helper.

Enterprise is deliberately NOT self-serve: there is no Stripe price ID for
it and the checkout endpoint refuses it outright (see billing.py). It is
provisioned manually after a sales conversation.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Tier(str, Enum):
    TRIAL = "trial"
    STANDARD = "standard"
    PRO = "pro"
    ENTERPRISE = "enterprise"


@dataclass(frozen=True)
class TierFeatures:
    max_sites: int
    history_days: int
    webhooks: bool
    taxii_feed: bool
    custom_mapping_rules: bool
    attack_domains: tuple[str, ...]
    pentapi_integration: str  # "none" | "basic" | "full"
    sso: bool
    self_serve: bool


TIER_FEATURES: dict[Tier, TierFeatures] = {
    # Trial mirrors Standard's feature set so a prospect evaluates the real
    # product, just capped at TRIAL_DAYS (see config.py / auth.py).
    Tier.TRIAL: TierFeatures(
        max_sites=1,
        history_days=30,
        webhooks=False,
        taxii_feed=False,
        custom_mapping_rules=False,
        attack_domains=("enterprise-attack",),
        pentapi_integration="none",
        sso=False,
        self_serve=True,
    ),
    Tier.STANDARD: TierFeatures(
        max_sites=1,
        history_days=30,
        webhooks=False,
        taxii_feed=False,
        custom_mapping_rules=False,
        attack_domains=("enterprise-attack",),
        pentapi_integration="none",
        sso=False,
        self_serve=True,
    ),
    Tier.PRO: TierFeatures(
        max_sites=10,
        history_days=365,
        webhooks=True,
        taxii_feed=True,
        custom_mapping_rules=True,
        attack_domains=("enterprise-attack", "mobile-attack", "ics-attack"),
        pentapi_integration="basic",
        sso=False,
        self_serve=True,
    ),
    Tier.ENTERPRISE: TierFeatures(
        max_sites=-1,  # unlimited
        history_days=-1,  # unlimited
        webhooks=True,
        taxii_feed=True,
        custom_mapping_rules=True,
        attack_domains=("enterprise-attack", "mobile-attack", "ics-attack"),
        pentapi_integration="full",
        sso=True,
        self_serve=False,
    ),
}


def features_for(tier: Tier) -> TierFeatures:
    return TIER_FEATURES[tier]
