# Deploying to Openship (or any Docker host)

Top Spiagge is an Expo/React Native app. This repo's `Dockerfile`/`docker-compose.yml` build and
serve the **web** export only -- iOS/Android still go through EAS/App Store/Play Store separately,
regardless of where this container runs.

## What gets deployed

- **The app itself**: a static SPA (`expo export --platform web`), served by the tiny
  dependency-free server in `scripts/serve-web.mjs`. `Dockerfile` builds and runs this in one
  image. Verified locally with `docker build . && docker run -p 8080:8080 <image>`.
- **The backend**: the app already speaks the standard Supabase JS client (`src/lib/supabase.ts`)
  and ships a full schema in `supabase/schema.sql` + `supabase/seed.sql` + `supabase/migrations/`.
  It was never connected to a live project during development (this repo's preview sandbox has no
  outbound network at all), but the client code itself has no Openship-specific dependency -- any
  reachable Supabase instance works.

## Step 1 -- stand up a Postgres/Supabase backend

Pick one:

- **Supabase Cloud** (fastest): create a project at supabase.com, then in the SQL editor run
  `supabase/schema.sql` followed by `supabase/seed.sql` (optional, demo data only). Copy the
  Project URL and anon key from Project Settings -> API.
- **Self-hosted Supabase** (keeps everything on your own Openship infra): follow Supabase's own
  self-hosting guide (https://supabase.com/docs/guides/self-hosting/docker) to deploy their
  official docker-compose stack (Postgres + GoTrue Auth + PostgREST + Realtime + Kong). Openship
  supports deploying existing compose files as-is, so that stack can run as its own Openship app
  alongside this one. Run the same `schema.sql`/`seed.sql` against it once it's up.

## Step 2 -- deploy this app on Openship

1. Connect this GitHub repo (or the `topspiagge-app` subdirectory) to Openship.
2. Openship will detect the `Dockerfile` and use it directly.
3. Set two build-time variables (these are inlined into the JS bundle at build time by Metro, so
   they must be build args/build-time env vars, not just runtime env vars):
   - `EXPO_PUBLIC_SUPABASE_URL` -- your Supabase project URL (cloud or self-hosted).
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` -- the anon/public key. Real access control is enforced by
     the Postgres Row Level Security policies in `schema.sql`, not by keeping this key secret --
     it's meant to be public.
4. The container listens on `$PORT` (defaults to 8080) and serves the SPA with client-side-routing
   fallback (`/operator`, `/:beachSlug` etc. all resolve to `index.html`), so Openship's own
   routing/SSL layer just needs to forward to that port.
5. Leaving the two env vars unset still produces a working build -- it runs in the same fully
   local/AsyncStorage fallback mode used throughout development, with no data shared between
   visitors. Fine to sanity-check a deploy; not a real backend.

## Local test

```
docker build --build-arg EXPO_PUBLIC_SUPABASE_URL=... --build-arg EXPO_PUBLIC_SUPABASE_ANON_KEY=... -t topspiagge-web .
docker run -p 8080:8080 topspiagge-web
```

or `docker compose up --build` (reads the same two vars from your shell/`.env`).
