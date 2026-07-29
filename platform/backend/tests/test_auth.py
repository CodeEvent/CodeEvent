def test_signup_then_me_returns_trial_tier(client, auth_headers):
    headers = auth_headers("alice@example.com")
    resp = client.get("/auth/me", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["tier"] == "trial"
    assert body["trial_active"] is True
    assert body["subscription_status"] == "trialing"


def test_duplicate_signup_rejected(client):
    client.post("/auth/signup", json={"email": "bob@example.com", "password": "x" * 12})
    resp = client.post("/auth/signup", json={"email": "bob@example.com", "password": "y" * 12})
    assert resp.status_code == 409


def test_login_wrong_password_rejected(client):
    client.post("/auth/signup", json={"email": "carol@example.com", "password": "correct-password"})
    resp = client.post("/auth/login", json={"email": "carol@example.com", "password": "wrong-password"})
    assert resp.status_code == 401


def test_me_requires_auth(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401
