"""Thin REST client for a NetAlertX instance.

Deliberately dumb: it only issues HTTP requests and parses JSON responses.
It never imports NetAlertX code, so the license boundary described in
docs/LICENSING.md holds regardless of how this client evolves.

The exact endpoint paths/field names below follow NetAlertX's documented
device fields (devMac, devName, devVendor, devLastConnection, devStatus)
and its general "Events" API category. Confirm/adjust
`netalertx_events_path` and `netalertx_devices_path` in Config against the
`/docs` (Swagger) page of your deployed instance before relying on this in
production — API surface can vary by version.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import requests

from .config import Config


@dataclass(frozen=True)
class NetAlertXEvent:
    """Normalized view of one NetAlertX event/alert record."""

    mac: str
    event_type: str
    timestamp: datetime
    device_name: str | None = None
    device_vendor: str | None = None
    additional_info: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)

    @staticmethod
    def from_api(payload: dict[str, Any]) -> "NetAlertXEvent":
        ts_raw = payload.get("eventDateTime") or payload.get("datetime") or payload.get("DateTime")
        timestamp = _parse_timestamp(ts_raw)
        return NetAlertXEvent(
            mac=payload.get("eventMAC") or payload.get("devMac") or payload.get("mac", ""),
            event_type=payload.get("eventType") or payload.get("event_type") or "unknown",
            timestamp=timestamp,
            device_name=payload.get("devName"),
            device_vendor=payload.get("devVendor"),
            additional_info=payload.get("eventInfo") or payload.get("additionalInfo"),
            raw=payload,
        )


def _parse_timestamp(value: Any) -> datetime:
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            pass
    return datetime.now(tz=timezone.utc)


class NetAlertXClient:
    def __init__(self, config: Config) -> None:
        self._config = config
        self._session = requests.Session()
        if config.netalertx_api_token:
            self._session.headers["Authorization"] = f"Bearer {config.netalertx_api_token}"

    def get_events(self, since: datetime | None = None) -> list[NetAlertXEvent]:
        url = self._config.netalertx_base_url.rstrip("/") + self._config.netalertx_events_path
        params = {"since": since.isoformat()} if since else None
        response = self._session.get(url, params=params, timeout=self._config.request_timeout_seconds)
        response.raise_for_status()
        payload = response.json()
        records = payload.get("data", payload) if isinstance(payload, dict) else payload
        return [NetAlertXEvent.from_api(record) for record in records]

    def get_devices(self) -> list[dict[str, Any]]:
        url = self._config.netalertx_base_url.rstrip("/") + self._config.netalertx_devices_path
        response = self._session.get(url, timeout=self._config.request_timeout_seconds)
        response.raise_for_status()
        payload = response.json()
        return payload.get("data", payload) if isinstance(payload, dict) else payload
