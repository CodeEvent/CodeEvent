"""Builds STIX 2.1 SDOs by hand (no `stix2` SDK dependency) for the
Sightings this bridge produces.

Objects follow the STIX 2.1 committee spec field-for-field. Sightings
reference ATT&CK attack-pattern objects *by STIX id* rather than embedding
MITRE's objects, so bundles produced here stay small and never redistribute
the ATT&CK dataset itself (see NOTICE.md).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from .attack_data import TechniqueInfo
from .netalertx_client import NetAlertXEvent

STIX_SPEC_VERSION = "2.1"


def _stix_id(stix_type: str) -> str:
    return f"{stix_type}--{uuid.uuid4()}"


def _now() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _stix_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def make_identity(name: str, identity_class: str = "system") -> dict[str, Any]:
    now = _now()
    return {
        "type": "identity",
        "spec_version": STIX_SPEC_VERSION,
        "id": _stix_id("identity"),
        "created": now,
        "modified": now,
        "name": name,
        "identity_class": identity_class,
    }


def make_sighting(
    *,
    event: NetAlertXEvent,
    technique: TechniqueInfo,
    rationale: str,
    where_sighted_ref: str,
    created_by_ref: str | None = None,
) -> dict[str, Any]:
    now = _now()
    seen = _stix_timestamp(event.timestamp)
    sighting: dict[str, Any] = {
        "type": "sighting",
        "spec_version": STIX_SPEC_VERSION,
        "id": _stix_id("sighting"),
        "created": now,
        "modified": now,
        "first_seen": seen,
        "last_seen": seen,
        "count": 1,
        "sighting_of_ref": technique.stix_id,
        "where_sighted_refs": [where_sighted_ref],
        "description": rationale,
        # Custom (x_) properties per STIX 2.1 extension rules for the
        # NetAlertX-specific context of this sighting.
        "x_netalertx_event_type": event.event_type,
        "x_netalertx_device_mac": event.mac,
        "x_netalertx_device_name": event.device_name,
        "x_netalertx_device_vendor": event.device_vendor,
        "x_mitre_attack_id": technique.attack_id,
        "x_mitre_attack_name": technique.name,
    }
    if created_by_ref:
        sighting["created_by_ref"] = created_by_ref
    return sighting


def make_bundle(objects: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "type": "bundle",
        "id": _stix_id("bundle"),
        "objects": objects,
    }
