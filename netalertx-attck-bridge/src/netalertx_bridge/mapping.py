"""Rules mapping NetAlertX event types to MITRE ATT&CK techniques.

Kept intentionally small and conservative: only event types with a
well-established, defensible ATT&CK correlation are mapped. Everything
else returns no mapping rather than a speculative one — a wrong technique
tag is worse than no tag in a security product.

Extend `EVENT_TECHNIQUE_RULES` as your NetAlertX deployment's plugins add
more specific detections (e.g. a dedicated ARP-spoofing or rogue-DHCP
plugin), citing your rationale for each addition the same way as below.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MappingRule:
    attack_id: str
    rationale: str


EVENT_TECHNIQUE_RULES: dict[str, list[MappingRule]] = {
    # A previously-unseen device joins the network — plausible unauthorized
    # physical connection to the network.
    "new_device": [
        MappingRule(
            attack_id="T1200",
            rationale="Unrecognized device physically connected to the monitored network.",
        )
    ],
    # NetAlertX / a plugin flags a second DHCP server answering on the LAN.
    "rogue_dhcp_server": [
        MappingRule(
            attack_id="T1557.003",
            rationale="Unauthorized DHCP server detected answering client leases (DHCP spoofing).",
        )
    ],
    # Duplicate IP / ARP table conflict indicative of cache poisoning.
    "arp_spoof_detected": [
        MappingRule(
            attack_id="T1557.002",
            rationale="Conflicting ARP resolution for an IP observed on the network (ARP cache poisoning).",
        )
    ],
    # A monitored device is observed port-scanning others on the LAN.
    "port_scan_source": [
        MappingRule(
            attack_id="T1046",
            rationale="Device observed probing multiple hosts/ports on the local network.",
        )
    ],
}


def map_event_type(event_type: str) -> list[MappingRule]:
    return EVENT_TECHNIQUE_RULES.get(event_type, [])
