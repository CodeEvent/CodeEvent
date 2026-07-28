"""Polling loop: pull new NetAlertX events, map to ATT&CK techniques,
emit a STIX 2.1 bundle of Sightings.

Run as `python -m netalertx_bridge.service` (see README.md for env vars).
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone

from .attack_data import AttackTechniqueIndex
from .config import Config
from .mapping import map_event_type
from .netalertx_client import NetAlertXClient, NetAlertXEvent
from .stix_builder import make_bundle, make_identity, make_sighting

logger = logging.getLogger("netalertx_bridge")


class Bridge:
    def __init__(self, config: Config | None = None) -> None:
        self.config = config or Config()
        self.client = NetAlertXClient(self.config)
        self.attack_index = AttackTechniqueIndex.load(self.config)
        self.network_identity = make_identity("NetAlertX Monitored Network")
        self._last_poll: datetime | None = None
        logger.info("Loaded %d ATT&CK techniques for domain=%s", len(self.attack_index), self.config.attack_domain)

    def process_events(self, events: list[NetAlertXEvent]) -> list[dict]:
        sightings = []
        for event in events:
            for rule in map_event_type(event.event_type):
                technique = self.attack_index.get(rule.attack_id)
                if technique is None:
                    logger.warning("Mapped technique %s not found in loaded ATT&CK index", rule.attack_id)
                    continue
                sightings.append(
                    make_sighting(
                        event=event,
                        technique=technique,
                        rationale=rule.rationale,
                        where_sighted_ref=self.network_identity["id"],
                    )
                )
        return sightings

    def run_once(self) -> dict:
        events = self.client.get_events(since=self._last_poll)
        self._last_poll = datetime.now(tz=timezone.utc)
        sightings = self.process_events(events)
        bundle = make_bundle([self.network_identity, *sightings])
        self._write_bundle(bundle)
        logger.info("Polled %d events -> %d sightings", len(events), len(sightings))
        return bundle

    def _write_bundle(self, bundle: dict) -> None:
        os.makedirs(os.path.dirname(self.config.output_path) or ".", exist_ok=True)
        with open(self.config.output_path, "w", encoding="utf-8") as fh:
            json.dump(bundle, fh, indent=2)

    def run_forever(self) -> None:
        while True:
            try:
                self.run_once()
            except Exception:
                logger.exception("Poll cycle failed")
            time.sleep(self.config.poll_interval_seconds)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    Bridge().run_forever()


if __name__ == "__main__":
    main()
