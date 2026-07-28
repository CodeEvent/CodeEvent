"""Loads MITRE ATT&CK STIX bundles and indexes attack-pattern objects by
their public ATT&CK technique ID (e.g. "T1200", "T1557.002").

The bundle is fetched at runtime from the official attack-stix-data
source and cached to disk — it is not committed/vendored into this repo,
per NOTICE.md and docs/LICENSING.md.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from typing import Any

import requests

from .config import Config


@dataclass(frozen=True)
class TechniqueInfo:
    attack_id: str
    stix_id: str
    name: str
    url: str | None
    domain: str


class AttackTechniqueIndex:
    def __init__(self, techniques: dict[str, TechniqueInfo]) -> None:
        self._techniques = techniques

    def get(self, attack_id: str) -> TechniqueInfo | None:
        return self._techniques.get(attack_id)

    def __contains__(self, attack_id: str) -> bool:
        return attack_id in self._techniques

    def __len__(self) -> int:
        return len(self._techniques)

    @classmethod
    def load(cls, config: Config) -> "AttackTechniqueIndex":
        bundle = _load_bundle(config)
        techniques: dict[str, TechniqueInfo] = {}
        for obj in bundle.get("objects", []):
            if obj.get("type") != "attack-pattern":
                continue
            if obj.get("revoked") or obj.get("x_mitre_deprecated"):
                continue
            attack_id, url = _external_ref(obj)
            if not attack_id:
                continue
            techniques[attack_id] = TechniqueInfo(
                attack_id=attack_id,
                stix_id=obj["id"],
                name=obj.get("name", attack_id),
                url=url,
                domain=config.attack_domain,
            )
        return cls(techniques)


def _external_ref(obj: dict[str, Any]) -> tuple[str | None, str | None]:
    for ref in obj.get("external_references", []):
        if ref.get("source_name") == "mitre-attack":
            return ref.get("external_id"), ref.get("url")
    return None, None


def _load_bundle(config: Config) -> dict[str, Any]:
    cache_path = config.resolved_attack_cache_path()
    if _cache_is_fresh(cache_path, config.attack_cache_ttl_seconds):
        with open(cache_path, encoding="utf-8") as fh:
            return json.load(fh)

    url = config.resolved_attack_stix_url()
    response = requests.get(url, timeout=config.request_timeout_seconds * 6)
    response.raise_for_status()
    bundle = response.json()

    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as fh:
        json.dump(bundle, fh)
    return bundle


def _cache_is_fresh(cache_path: str, ttl_seconds: int) -> bool:
    if not os.path.exists(cache_path):
        return False
    age = time.time() - os.path.getmtime(cache_path)
    return age < ttl_seconds
