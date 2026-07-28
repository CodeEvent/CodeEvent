# Third-Party Notices

This product is proprietary software (see `LICENSE`). It interoperates with,
but does not include or redistribute, the following third-party works:

## NetAlertX

This product does **not** bundle, fork, or modify any NetAlertX source
code. It communicates exclusively with a separately-installed,
separately-licensed NetAlertX instance over its documented REST API /
webhooks (network interoperation only — see `docs/LICENSING.md` for why
that boundary matters).

- Project: https://github.com/netalertx/NetAlertX
- License: GNU General Public License v3.0 (GPLv3) — NOT modified or
  redistributed by this project.

## MITRE ATT&CK® STIX Data

This product downloads MITRE ATT&CK® STIX bundles at runtime from the
official source below and derives a technique lookup index from them.
The dataset itself is not vendored/committed into this repository.

- Project: https://github.com/mitre-attack/attack-stix-data
- License: MITRE non-exclusive, royalty-free license for research,
  development, and commercial use. Full text reproduced verbatim at
  `LICENSES/MITRE-ATTACK-LICENSE.txt`.

> "© 2026 The MITRE Corporation. This work is reproduced and distributed
> with the permission of The MITRE Corporation."

ATT&CK® is a registered trademark of The MITRE Corporation.
