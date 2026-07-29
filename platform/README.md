# Platform — trial, subscriptions, dashboard

The SaaS layer on top of [`../netalertx-attck-bridge`](../netalertx-attck-bridge):
sign up, get a 7-day free trial, subscribe to Standard or Pro self-serve,
or contact sales for Enterprise. This is proprietary code — see
`../netalertx-attck-bridge/docs/LICENSING.md` for why that's fine even
though it wraps a GPLv3 tool.

## Architecture

```
                    ┌───────────────┐
   browser  ───────►│   frontend    │  Next.js — landing/pricing, signup,
                    │  (Next.js)    │  login, dashboard
                    └───────┬───────┘
                            │ /api/*
                            ▼
                    ┌───────────────┐
                    │     Kong      │  API gateway (Kong/kong — highest
                    │ (API gateway) │  starred repo for this, ~44k★)
                    └───────┬───────┘
                            │ strips /api prefix
                            ▼
                    ┌───────────────┐        ┌─────────────────────────┐
                    │   backend     │◄───────┤ netalertx-attck-bridge  │
                    │  (FastAPI)    │  reads  │ (separate process,     │
                    │ auth, tiers,  │  STIX   │ writes sightings.stix  │
                    │ Stripe, ...   │  file   │ .json)                 │
                    └───────┬───────┘        └─────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Postgres    │  users, subscriptions
                    └───────────────┘
```

## Subscription tiers

Defined in `backend/app/tiers.py` (single source of truth — the pricing
page reads it live via `GET /pricing`, and every gated endpoint checks it
via `backend/app/deps.py`):

| | Standard | Pro | Enterprise |
|---|---|---|---|
| Sites | 1 | 10 | unlimited |
| History | 30 days | 365 days | unlimited |
| Ingestion | polling | + webhooks | + webhooks |
| TAXII feed | — | ✓ | ✓ |
| Custom mapping rules | — | ✓ | ✓ |
| ATT&CK domains | enterprise | + mobile, ics | + mobile, ics |
| Pentapi integration | — | basic | full |
| SSO/RBAC/audit logs | — | — | ✓ |
| Self-serve checkout | ✓ | ✓ | **✗ — sales only** |

A signup gets `trial` tier (mirrors Standard's features) for
`TRIAL_DAYS` (7, `backend/app/config.py`). After that, protected endpoints
return `402 Payment Required` until the user subscribes
(`backend/app/deps.py::require_active_access`).

Enterprise deliberately has no Stripe price ID and the checkout endpoint
rejects it outright (`backend/app/routers/billing.py`), pointing to
`SALES_EMAIL` (currently `sale@example-domain.com` — **replace with your
real address before launch**, see `.env.example`).

## What's real vs. stubbed

**Real and tested:**
- Signup/login (JWT), 7-day trial, tier-gated access (16 backend tests,
  all passing — `cd backend && pytest`)
- Stripe Checkout + webhook flow, running in **mock mode** by default (no
  real Stripe account needed to exercise the whole trial→paywall→checkout
  loop; verified end-to-end with a live server + browser test)
- Pricing page, signup, login, and dashboard — built with Next.js 16 /
  React 19, verified in an actual browser (screenshots taken during
  development): pricing renders live tier data, Enterprise shows "Contact
  sales" instead of a checkout button, an expired trial shows a paywall
  banner with working "Subscribe" buttons, and real bridge output renders
  correctly as a Sightings list.
- Sightings endpoint, tier-limited by `history_days`, reading the bridge's
  STIX output.

**Stubbed / needs follow-up:**
- **pentapi integration** (`backend/app/integrations/pentapi.py`): your
  `CodeEvent/pentapi` repo is private and wasn't readable yet when this
  was built. The gating (Pro="basic", Enterprise="full") and an endpoint
  are in place; the actual HTTP calls raise `NotImplementedError` pending
  its real API shape.
- **Kong config** (`kong/kong.yml`): written to Kong's declarative-config
  schema and YAML-validated, but this environment has no Docker daemon to
  actually run it against a live Kong container — validate with
  `docker compose up` before relying on it.
- **`docker-compose.yml`**: same caveat — composed correctly but not
  booted end-to-end here. The dev flow that *was* verified end-to-end
  runs backend (uvicorn) and frontend (`next dev`) directly against
  SQLite, without Kong/Postgres in front.
- **Real Stripe keys**: set `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID_*` /
  `STRIPE_WEBHOOK_SECRET` and `STRIPE_MOCK_MODE=false` to go live — no
  code changes needed.
- **NetAlertX endpoint paths**: `backend`'s sightings come from the bridge
  project, whose own README already flags that its NetAlertX REST paths
  are best-effort and need confirming against a real instance.

## Local dev (without Docker)

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # defaults already run in Stripe mock mode
uvicorn app.main:app --reload --port 8000

# frontend (separate shell)
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Then visit http://localhost:3000.

## With Docker (untested in this environment — see above)

```bash
docker compose up --build
```
