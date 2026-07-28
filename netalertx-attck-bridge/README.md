# netalertx-attck-bridge

Proprietary enrichment layer that watches a [NetAlertX](https://github.com/netalertx/NetAlertX)
instance for network events (new devices, rogue DHCP servers, ARP spoofing,
port scans, ...) and tags them with the relevant
[MITRE ATT&CK®](https://attack.mitre.org/) technique, emitting STIX 2.1
`Sighting` objects.

## Why this can be closed-source

NetAlertX is GPLv3. This project stays outside that copyleft boundary by
only ever talking to a NetAlertX instance over its public REST API/webhooks
— never importing, forking, or vendoring its source. MITRE's ATT&CK STIX
data is separately licensed for commercial/closed-source use provided its
attribution is reproduced, which this repo does in `NOTICE.md` and
`LICENSES/MITRE-ATTACK-LICENSE.txt`. See `docs/LICENSING.md` for the full
rationale and the rules to follow before changing the architecture.

**This repository does not include NetAlertX or MITRE's STIX dataset.**
You need your own running NetAlertX instance, and MITRE's data is
downloaded at runtime.

## How it works

```
NetAlertX (GPLv3, separate process)
        │ REST API / webhooks
        ▼
netalertx_client.py  ──►  mapping.py  ──►  stix_builder.py  ──►  output/sightings.stix.json
                              ▲
                              │ technique lookup
                     attack_data.py (fetches attack-stix-data at runtime)
```

1. `netalertx_client.py` polls NetAlertX's events endpoint for new records.
2. `mapping.py` maps known NetAlertX event types to ATT&CK technique IDs,
   using a small, deliberately conservative rule table — see the module
   docstring for why speculative mappings are avoided.
3. `attack_data.py` downloads the current MITRE ATT&CK STIX bundle for a
   domain (default `enterprise-attack`) and indexes `attack-pattern`
   objects by their public technique ID (e.g. `T1200`).
4. `stix_builder.py` builds STIX 2.1 `Sighting` objects referencing the
   matched `attack-pattern` by STIX id (not embedding MITRE's dataset),
   wraps them in a `Bundle`, and `service.py` writes it to
   `output/sightings.stix.json` on each poll cycle.

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export NETALERTX_BASE_URL="http://your-netalertx-host:20211"
export NETALERTX_API_TOKEN="..."          # if your instance requires auth
export ATTACK_DOMAIN="enterprise-attack"  # or mobile-attack / ics-attack

python -m netalertx_bridge.service
```

Confirm `NETALERTX_EVENTS_PATH` / `NETALERTX_DEVICES_PATH` against the
`/docs` (Swagger) page of your specific NetAlertX version before relying
on this against a live instance — see the docstring in
`netalertx_client.py`.

## Tests

```bash
pip install pytest
pytest
```

## Roadmap ideas

- Swap polling for real-time NetAlertX webhook ingestion.
- Stand up a minimal TAXII 2.1 collection endpoint to serve the generated
  Sightings to downstream SOC/SIEM tooling.
- Add `mobile-attack` / `ics-attack` domains alongside `enterprise-attack`.
- Expand `mapping.py` as NetAlertX plugins add more specific detections
  (dedicated ARP-spoofing/rogue-DHCP plugins, etc.), each with a cited
  rationale.

## License

Proprietary — see `LICENSE`. Third-party attributions in `NOTICE.md`.
