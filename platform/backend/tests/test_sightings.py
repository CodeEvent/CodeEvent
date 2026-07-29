import json
import os
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.database import SessionLocal
from app.models import User


def _write_sample_bundle():
    path = settings.sightings_source_path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bundle = {
        "type": "bundle",
        "objects": [
            {"type": "identity", "id": "identity--test", "name": "Test Network"},
            {
                "type": "sighting",
                "id": "sighting--test-1",
                "last_seen": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "x_mitre_attack_id": "T1200",
            },
        ],
    }
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(bundle, fh)
    return path


def test_sightings_returned_for_active_trial_user(client, auth_headers):
    _write_sample_bundle()
    headers = auth_headers("heidi@example.com")
    resp = client.get("/sightings", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert any(obj["type"] == "sighting" for obj in body["objects"])
    assert body["tier_limits"]["history_days"] == 30


def test_sightings_blocked_after_trial_expires(client, auth_headers):
    _write_sample_bundle()
    headers = auth_headers("ivan@example.com")

    db = SessionLocal()
    user = db.query(User).filter(User.email == "ivan@example.com").first()
    user.trial_ends_at = datetime.now(timezone.utc) - timedelta(days=1)
    db.commit()
    db.close()

    resp = client.get("/sightings", headers=headers)
    assert resp.status_code == 402
