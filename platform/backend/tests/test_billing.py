def test_checkout_session_standard_returns_mock_url(client, auth_headers):
    headers = auth_headers("dave@example.com")
    resp = client.post("/billing/checkout-session", json={"tier": "standard"}, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["mock_mode"] is True
    assert "checkout_url" in body


def test_checkout_session_pro_returns_mock_url(client, auth_headers):
    headers = auth_headers("erin@example.com")
    resp = client.post("/billing/checkout-session", json={"tier": "pro"}, headers=headers)
    assert resp.status_code == 200


def test_enterprise_is_not_self_serve(client, auth_headers):
    headers = auth_headers("frank@example.com")
    resp = client.post("/billing/checkout-session", json={"tier": "enterprise"}, headers=headers)
    assert resp.status_code == 400
    assert "sale@example-domain.com" in resp.json()["detail"]


def test_contact_sales_endpoint_returns_configured_email(client):
    resp = client.get("/billing/contact-sales")
    assert resp.status_code == 200
    assert resp.json()["email"] == "sale@example-domain.com"


def test_webhook_checkout_completed_upgrades_user(client, auth_headers):
    headers = auth_headers("grace@example.com")
    payload = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer_email": "grace@example.com",
                "customer": "cus_mock_123",
                "subscription": "sub_mock_123",
                "metadata": {"tier": "pro"},
            }
        },
    }
    resp = client.post("/billing/webhook", json=payload)
    assert resp.status_code == 200

    me = client.get("/auth/me", headers=headers).json()
    assert me["tier"] == "pro"
    assert me["subscription_status"] == "active"
