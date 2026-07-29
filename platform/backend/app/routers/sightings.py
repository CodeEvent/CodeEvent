"""Serves STIX Sightings produced by ../netalertx-attck-bridge.

Deliberately reads the bridge's output file rather than importing its
package: the bridge is a separate process/service by design (see its
docs/LICENSING.md), and this keeps that boundary intact even within the
same monorepo. In production the bridge would push to a shared store
(S3, a queue, its own API) instead of a local file.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends

from ..config import settings
from ..deps import current_features
from ..tiers import TierFeatures

router = APIRouter(prefix="/sightings", tags=["sightings"])


def _load_bundle() -> dict[str, Any]:
    if not os.path.exists(settings.sightings_source_path):
        return {"type": "bundle", "objects": []}
    with open(settings.sightings_source_path, encoding="utf-8") as fh:
        return json.load(fh)


@router.get("")
def list_sightings(features: TierFeatures = Depends(current_features)) -> dict[str, Any]:
    bundle = _load_bundle()
    objects = bundle.get("objects", [])

    if features.history_days >= 0:
        cutoff = datetime.now(timezone.utc) - timedelta(days=features.history_days)
        objects = [
            obj
            for obj in objects
            if obj.get("type") != "sighting"
            or _parse(obj.get("last_seen")) >= cutoff
        ]

    return {
        "type": "bundle",
        "objects": objects,
        "tier_limits": {
            "history_days": features.history_days,
            "max_sites": features.max_sites,
            "attack_domains": list(features.attack_domains),
        },
    }


def _parse(value: str | None) -> datetime:
    if not value:
        return datetime.min.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
