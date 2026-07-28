# Licensing Boundary — Read This Before Modifying Architecture

This project is closed-source. That is only defensible because of how it
is architected relative to NetAlertX. Keep these rules when extending it.

## The rule

NetAlertX is GPLv3. GPLv3 is copyleft: if you copy, fork, statically or
dynamically link, or otherwise incorporate NetAlertX source into another
program, the combined work is a derivative work and must itself be
distributed under GPLv3 if distributed at all.

This project avoids that by **never touching NetAlertX source**. It only
talks to a running NetAlertX instance over its documented, arms-length
interfaces:

- REST API (`netalertx_client.py`)
- Webhooks (future: `service.py` ingestion mode)

Communicating with a separate process over HTTP is treated under GPLv3
(and FSF's own guidance) as "mere aggregation" — two independent programs,
not one combined work. That is what lets the code in this repository stay
proprietary.

## What would break this

- Vendoring or copy-pasting any NetAlertX Python module into this repo.
- Installing this project as a NetAlertX "plugin" that gets `import`-ed
  in-process rather than invoked as a subprocess/HTTP call.
- Forking NetAlertX itself to add STIX export directly into its codebase
  and distributing that fork — that fork must stay GPLv3.
- Redistributing NetAlertX's own binaries/containers/source alongside
  this project without also providing that portion under GPLv3.

If a feature ever seems to require modifying NetAlertX's own source, that
piece is a separate GPLv3 deliverable — build it as a plugin/PR upstream,
not inside this repository.

## MITRE ATT&CK data

MITRE's license for `attack-stix-data` is permissive and explicitly
allows commercial and closed-source use, conditioned only on reproducing
their copyright notice and license text in any copy. This project
satisfies that by:

- Fetching the STIX bundles at runtime from the official source rather
  than silently vendoring a modified copy.
- Reproducing MITRE's copyright notice and full license text verbatim in
  `NOTICE.md` and `LICENSES/MITRE-ATTACK-LICENSE.txt`.

This does not make the ATT&CK data itself proprietary — only this
project's own mapping/enrichment/service code is closed-source.
