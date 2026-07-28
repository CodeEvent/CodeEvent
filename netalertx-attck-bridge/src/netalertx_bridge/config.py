from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    """Runtime configuration, sourced from environment variables so no
    NetAlertX or MITRE credentials/URLs are hardcoded into the source.
    """

    # NetAlertX REST API (a separate, already-running instance you deployed
    # yourself under its own GPLv3 terms — this project does not ship it).
    netalertx_base_url: str = os.environ.get("NETALERTX_BASE_URL", "http://localhost:20211")
    netalertx_api_token: str | None = os.environ.get("NETALERTX_API_TOKEN")
    netalertx_events_path: str = os.environ.get("NETALERTX_EVENTS_PATH", "/api/events")
    netalertx_devices_path: str = os.environ.get("NETALERTX_DEVICES_PATH", "/api/devices")
    request_timeout_seconds: float = float(os.environ.get("NETALERTX_TIMEOUT", "10"))

    # MITRE ATT&CK STIX data (fetched at runtime, not vendored — see NOTICE.md).
    attack_domain: str = os.environ.get("ATTACK_DOMAIN", "enterprise-attack")
    attack_stix_url: str = os.environ.get(
        "ATTACK_STIX_URL",
        "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/"
        "{domain}/{domain}.json",
    )
    attack_cache_path: str = os.environ.get(
        "ATTACK_CACHE_PATH", os.path.join(".cache", "attack-stix", "{domain}.json")
    )
    attack_cache_ttl_seconds: int = int(os.environ.get("ATTACK_CACHE_TTL_SECONDS", str(24 * 3600)))

    poll_interval_seconds: int = int(os.environ.get("POLL_INTERVAL_SECONDS", "60"))
    output_path: str = os.environ.get("OUTPUT_PATH", os.path.join("output", "sightings.stix.json"))

    def resolved_attack_stix_url(self) -> str:
        return self.attack_stix_url.format(domain=self.attack_domain)

    def resolved_attack_cache_path(self) -> str:
        return self.attack_cache_path.format(domain=self.attack_domain)
