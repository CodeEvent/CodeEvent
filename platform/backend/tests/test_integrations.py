def test_pentapi_blocked_for_trial_and_standard(client, auth_headers):
    headers = auth_headers("judy@example.com")
    resp = client.get("/integrations/pentapi/status", headers=headers)
    assert resp.status_code == 403


def test_pentapi_available_for_pro_after_upgrade(client, auth_headers):
    headers = auth_headers("kevin@example.com")
    webhook_payload = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer_email": "kevin@example.com",
                "customer": "cus_mock_kevin",
                "subscription": "sub_mock_kevin",
                "metadata": {"tier": "pro"},
            }
        },
    }
    client.post("/billing/webhook", json=webhook_payload)

    resp = client.get("/integrations/pentapi/status", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["integration_level"] == "basic"
    assert body["configured"] is False
    assert body["status"] == "pending_implementation"
