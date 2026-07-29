import os
import tempfile

import pytest

_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"
os.environ["STRIPE_MOCK_MODE"] = "true"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import init_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True, scope="session")
def _init_test_db():
    init_db()
    yield
    os.close(_db_fd)
    os.remove(_db_path)


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def auth_headers(client):
    def _signup_and_login(email: str, password: str = "correct horse battery staple"):
        resp = client.post("/auth/signup", json={"email": email, "password": password})
        assert resp.status_code == 201, resp.text
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _signup_and_login
