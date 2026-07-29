from app.tiers import TIER_FEATURES, Tier


def test_enterprise_is_not_self_serve():
    assert TIER_FEATURES[Tier.ENTERPRISE].self_serve is False
    assert TIER_FEATURES[Tier.STANDARD].self_serve is True
    assert TIER_FEATURES[Tier.PRO].self_serve is True


def test_pentapi_gating_matches_intended_tiers():
    assert TIER_FEATURES[Tier.TRIAL].pentapi_integration == "none"
    assert TIER_FEATURES[Tier.STANDARD].pentapi_integration == "none"
    assert TIER_FEATURES[Tier.PRO].pentapi_integration == "basic"
    assert TIER_FEATURES[Tier.ENTERPRISE].pentapi_integration == "full"


def test_pricing_endpoint_lists_three_paid_tiers(client):
    resp = client.get("/pricing")
    assert resp.status_code == 200
    body = resp.json()
    tiers = [p["tier"] for p in body["plans"]]
    assert tiers == ["standard", "pro", "enterprise"]
    enterprise = body["plans"][2]
    assert enterprise["self_serve"] is False
    assert enterprise["contact_email"] == "sale@example-domain.com"
