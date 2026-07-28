from datetime import datetime, timezone

from netalertx_bridge.attack_data import TechniqueInfo
from netalertx_bridge.netalertx_client import NetAlertXEvent
from netalertx_bridge.stix_builder import make_bundle, make_identity, make_sighting


def _sample_event() -> NetAlertXEvent:
    return NetAlertXEvent(
        mac="AA:BB:CC:DD:EE:FF",
        event_type="new_device",
        timestamp=datetime(2026, 7, 28, 12, 0, 0, tzinfo=timezone.utc),
        device_name="unknown-device",
        device_vendor="Espressif",
    )


def _sample_technique() -> TechniqueInfo:
    return TechniqueInfo(
        attack_id="T1200",
        stix_id="attack-pattern--11111111-1111-1111-1111-111111111111",
        name="Hardware Additions",
        url="https://attack.mitre.org/techniques/T1200/",
        domain="enterprise-attack",
    )


def test_identity_has_required_stix_fields():
    identity = make_identity("NetAlertX Monitored Network")
    assert identity["type"] == "identity"
    assert identity["id"].startswith("identity--")
    assert identity["spec_version"] == "2.1"
    assert identity["name"] == "NetAlertX Monitored Network"


def test_sighting_references_technique_and_carries_context():
    identity = make_identity("NetAlertX Monitored Network")
    sighting = make_sighting(
        event=_sample_event(),
        technique=_sample_technique(),
        rationale="Unrecognized device physically connected to the network.",
        where_sighted_ref=identity["id"],
    )
    assert sighting["type"] == "sighting"
    assert sighting["id"].startswith("sighting--")
    assert sighting["sighting_of_ref"] == "attack-pattern--11111111-1111-1111-1111-111111111111"
    assert sighting["where_sighted_refs"] == [identity["id"]]
    assert sighting["x_mitre_attack_id"] == "T1200"
    assert sighting["x_netalertx_device_mac"] == "AA:BB:CC:DD:EE:FF"


def test_bundle_wraps_objects():
    identity = make_identity("NetAlertX Monitored Network")
    bundle = make_bundle([identity])
    assert bundle["type"] == "bundle"
    assert bundle["id"].startswith("bundle--")
    assert bundle["objects"] == [identity]
