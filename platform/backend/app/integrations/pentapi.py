"""Integration point for CodeEvent/pentapi ("Self-hosted AI-augmented
penetration testing platform").

STATUS: stubbed out. Wiring this up needs the actual pentapi API surface
(auth model, scan-trigger endpoint, findings format), which wasn't
available yet — the repo is private and access is still pending approval.
Once it's readable, replace the two methods below with real HTTP calls
(same arms-length pattern as netalertx_client.py: this platform should
call pentapi's API, not import its source, in case pentapi ships under a
different/incompatible license later).

Gating: available on Pro ("basic" — trigger scans, pull summary findings)
and Enterprise ("full" — presumably deeper findings/automation, TBD once
the real API is known). Not available on Trial/Standard.
"""

from __future__ import annotations

from dataclasses import dataclass


class PentapiNotConfigured(Exception):
    pass


@dataclass(frozen=True)
class PentapiConfig:
    base_url: str | None = None
    api_key: str | None = None


class PentapiClient:
    def __init__(self, config: PentapiConfig) -> None:
        self._config = config

    def is_configured(self) -> bool:
        return bool(self._config.base_url and self._config.api_key)

    def trigger_scan(self, target: str) -> dict:
        if not self.is_configured():
            raise PentapiNotConfigured(
                "pentapi integration is not wired up yet — see module docstring."
            )
        raise NotImplementedError("Implement once pentapi's real API is available.")

    def get_findings(self, scan_id: str) -> dict:
        if not self.is_configured():
            raise PentapiNotConfigured(
                "pentapi integration is not wired up yet — see module docstring."
            )
        raise NotImplementedError("Implement once pentapi's real API is available.")
