-- Top Spiagge -- Supabase schema (multi-tenant)
--
-- Run this whole file once in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- to create every table the app needs. IDs are kept as text to match the app's existing
-- string-based id generation (e.g. "u-1", "bk-...-123456"), so no client-side id remapping
-- is needed when moving off the in-memory store.
--
-- Primary keys are (beach_id, id) pairs, not `id` alone: the app's id generation (both the seed
-- script and runtime id minting in the client) produces the same ids for every beach -- e.g.
-- every beach's umbrellas are "u-1".."u-340", every beach's article catalog reuses "art-cabina"
-- etc -- so `id` alone is only unique *within* one beach, never globally.
--
-- Realtime: after running this, go to Database -> Replication (or Table Editor -> each
-- table -> "..." -> Enable Realtime) and turn realtime ON for every table below, so all
-- connected clients see each other's changes live.
--
-- Multi-tenancy: every beach ("lido") is a row in `beaches`, and every other table carries
-- a `beach_id` so many independent beaches can share one Supabase project without seeing
-- each other's data. `beach_operators` maps a Supabase Auth user to the beach(es) they run --
-- that's the only membership model; there are no custom JWT claims involved.

create table if not exists beaches (
  id text primary key,
  name text not null,
  slug text unique not null,
  created_at text not null
);

create table if not exists beach_operators (
  beach_id text not null references beaches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  primary key (beach_id, user_id)
);

create table if not exists umbrellas (
  id text not null,
  beach_id text not null references beaches(id) on delete cascade,
  number int not null,
  side text not null check (side in ('nord', 'sud')),
  row int not null,
  col int not null,
  zone text not null,
  has_cabin boolean not null default false,
  status text not null check (status in ('libero', 'occupato', 'in_arrivo', 'prenotato')),
  current_booking_id text,
  assigned_customer_id text,
  primary key (beach_id, id)
);
create index if not exists umbrellas_beach_id_idx on umbrellas (beach_id);

create table if not exists customers (
  id text not null,
  beach_id text not null references beaches(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  notes text,
  vip boolean not null default false,
  booking_history text[] not null default '{}',
  assigned_umbrella_id text,
  created_at text not null,
  tags text[] not null default '{}',
  voucher_balance numeric not null default 0,
  primary key (beach_id, id)
);
create index if not exists customers_beach_id_idx on customers (beach_id);

create table if not exists bookings (
  id text not null,
  beach_id text not null references beaches(id) on delete cascade,
  umbrella_id text not null,
  customer_id text not null,
  date_from text not null,
  date_to text not null,
  total_price numeric not null,
  deposit numeric not null,
  paid numeric not null,
  status text not null,
  created_at text not null,
  guests jsonb,
  beds int,
  chairs int,
  group_id text,
  reference text not null,
  is_student boolean,
  checked_in_at text,
  released boolean not null default false,
  primary key (beach_id, id),
  foreign key (beach_id, umbrella_id) references umbrellas(beach_id, id) on delete cascade,
  foreign key (beach_id, customer_id) references customers(beach_id, id) on delete cascade
);
create index if not exists bookings_beach_id_idx on bookings (beach_id);

-- Enforces "one guest per umbrella per day" at the database level, not just in the client's
-- in-memory conflict check (utils/booking.ts's findUmbrellaConflict) -- two devices creating
-- overlapping bookings for the same umbrella within the same instant both pass the client-side
-- check (each only sees its own optimistic state), but only one of the two inserts can win here;
-- the app must treat that failed insert as "someone else just booked this" and prompt the guest
-- to pick again (see StoreContext.tsx's createBooking onConflict callback). Requires btree_gist
-- for a plain text/int column (umbrella_id) to be usable in an exclusion constraint alongside
-- the date range. Bounds are inclusive on both ends ('[]') to match findUmbrellaConflict's own
-- `dateFrom <= b.dateTo && dateTo >= b.dateFrom` semantics -- a checkout day and the next guest's
-- check-in day on the same umbrella already count as a conflict throughout this app.
-- The `where (not released)` clause mirrors findUmbrellaConflict/findCustomerConflict's own
-- `!b.released` check: once the operator frees an umbrella (checkout done), its old booking row
-- is kept for history but must stop blocking new bookings for the same umbrella/dates.
create extension if not exists btree_gist;
alter table bookings drop constraint if exists bookings_no_overlap;
alter table bookings
  add constraint bookings_no_overlap
  exclude using gist (
    beach_id with =,
    umbrella_id with =,
    daterange(date_from::date, date_to::date, '[]') with &&
  ) where (not released);

create table if not exists equipment_changes (
  id text not null,
  beach_id text not null references beaches(id) on delete cascade,
  type text not null check (type in ('add', 'remove')),
  booking_id text not null,
  umbrella_id text not null,
  beds int not null default 0,
  chairs int not null default 0,
  amount numeric not null,
  created_at text not null,
  resolved boolean not null default false,
  primary key (beach_id, id),
  foreign key (beach_id, booking_id) references bookings(beach_id, id) on delete cascade
);
create index if not exists equipment_changes_beach_id_idx on equipment_changes (beach_id);

create table if not exists articles (
  id text not null,
  beach_id text not null references beaches(id) on delete cascade,
  name text not null,
  category text not null,
  base_price numeric not null,
  unit text not null,
  stock int,
  primary key (beach_id, id)
);
create index if not exists articles_beach_id_idx on articles (beach_id);

create table if not exists price_lists (
  id text not null,
  beach_id text not null references beaches(id) on delete cascade,
  name text not null,
  season text not null,
  prices jsonb not null,
  active_from text not null,
  active_to text not null,
  primary key (beach_id, id)
);
create index if not exists price_lists_beach_id_idx on price_lists (beach_id);

create table if not exists conti (
  id text not null,
  beach_id text not null references beaches(id) on delete cascade,
  umbrella_id text,
  customer_id text,
  items jsonb not null,
  total numeric not null,
  paid_amount numeric not null,
  payment_method text not null,
  doc_type text not null,
  split_count int not null,
  created_at text not null,
  closed boolean not null default false,
  primary key (beach_id, id)
);
create index if not exists conti_beach_id_idx on conti (beach_id);

-- Two beaches will both have a row for the same calendar date, so the primary key has to be
-- the pair, not `date` alone.
create table if not exists daily_stats (
  beach_id text not null references beaches(id) on delete cascade,
  date text not null,
  incasso numeric not null default 0,
  presenze int not null default 0,
  bar numeric not null default 0,
  ombrelloni numeric not null default 0,
  primary key (beach_id, date)
);

-- Row Level Security
--
-- Two roles are relevant here: `authenticated` (a logged-in operator, via Supabase Auth) and
-- `anon` (the public booking site's customers, who never log in). Operators get full CRUD
-- scoped to the beach(es) they belong to per `beach_operators`. Customers get just the
-- operations the booking flow actually performs (read availability/pricing, create/cancel
-- their own booking, upsert their own customer record) -- never access to Conto/Statistiche
-- data, article/price-list editing, or other beaches' data through the UI.
--
-- Caveat worth being explicit about: because customers never authenticate, the `anon` policies
-- below scope by whatever `beach_id` the client sends, same as any public API key -- they stop
-- one beach's dashboard from ever showing another beach's data (the actual bug this schema
-- exists to fix), but they don't stop a deliberately malicious client from crafting requests
-- against a `beach_id` it discovered some other way. Closing that fully would need a
-- server-side proxy (e.g. an Edge Function) rather than client-side RLS alone -- out of scope
-- for now, consistent with this app's existing "operator login is a UI gate, not a security
-- boundary" design.

alter table beaches enable row level security;
alter table beach_operators enable row level security;
alter table umbrellas enable row level security;
alter table customers enable row level security;
alter table bookings enable row level security;
alter table articles enable row level security;
alter table price_lists enable row level security;
alter table conti enable row level security;
alter table daily_stats enable row level security;
alter table equipment_changes enable row level security;

-- Returns every beach_id the calling authenticated user operates. `security definer` so it can
-- read `beach_operators` regardless of that table's own RLS, keeping every other policy a
-- one-line `beach_id in (select beach_id from current_user_beach_ids())` instead of repeating
-- the join.
create or replace function current_user_beach_ids()
returns table (beach_id text)
language sql
security definer
stable
as $$
  select bo.beach_id from beach_operators bo where bo.user_id = auth.uid();
$$;

-- Self-service "create your own beach" signup (Phase 2 onboarding). This has to be a
-- security-definer function rather than two plain client-side inserts: the normal
-- beach_operators policy only lets an operator see/manage a beach they're ALREADY a member
-- of, so a brand-new user has no way to insert their own first membership row (or the
-- beaches row itself) under ordinary RLS -- that's exactly the chicken-and-egg this function
-- exists to break, by doing both inserts atomically as the table owner and making the
-- calling user ('auth.uid()', i.e. whoever is logged in when they call this) the new beach's
-- sole owner. It can never be used to join or modify an existing beach.
create or replace function create_beach_and_become_owner(beach_name text, beach_slug text)
returns text
language plpgsql
security definer
as $$
declare
  new_id text := 'beach-' || beach_slug;
begin
  insert into beaches (id, name, slug, created_at) values (new_id, beach_name, beach_slug, now()::text);
  insert into beach_operators (beach_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end;
$$;

grant execute on function create_beach_and_become_owner(text, text) to authenticated;

create policy "operators manage own beaches" on beaches for all to authenticated
  using (id in (select beach_id from current_user_beach_ids()))
  with check (id in (select beach_id from current_user_beach_ids()));

create policy "operators see own memberships" on beach_operators for select to authenticated
  using (user_id = auth.uid());

create policy "operators manage umbrellas" on umbrellas for all to authenticated
  using (beach_id in (select beach_id from current_user_beach_ids()))
  with check (beach_id in (select beach_id from current_user_beach_ids()));
create policy "public reads umbrellas" on umbrellas for select to anon using (true);
create policy "public updates umbrellas for booking" on umbrellas for update to anon
  using (true) with check (true);

create policy "operators manage customers" on customers for all to authenticated
  using (beach_id in (select beach_id from current_user_beach_ids()))
  with check (beach_id in (select beach_id from current_user_beach_ids()));
create policy "public reads customers" on customers for select to anon using (true);
create policy "public creates customers" on customers for insert to anon with check (true);
create policy "public updates customers" on customers for update to anon
  using (true) with check (true);

create policy "operators manage bookings" on bookings for all to authenticated
  using (beach_id in (select beach_id from current_user_beach_ids()))
  with check (beach_id in (select beach_id from current_user_beach_ids()));
create policy "public reads bookings" on bookings for select to anon using (true);
create policy "public creates bookings" on bookings for insert to anon with check (true);
create policy "public cancels bookings" on bookings for delete to anon using (true);
-- Needed for the guest's own equipment top-up/refund (beds/chairs/total_price/paid) --
-- previously missing entirely, which meant that whole feature could only ever work in
-- local-fallback mode, never against a real Supabase project. Check-in itself is
-- operator-only and already covered by "operators manage bookings" above.
create policy "public updates bookings for equipment changes" on bookings for update to anon
  using (true) with check (true);

create policy "operators manage articles" on articles for all to authenticated
  using (beach_id in (select beach_id from current_user_beach_ids()))
  with check (beach_id in (select beach_id from current_user_beach_ids()));
create policy "public reads articles" on articles for select to anon using (true);

create policy "operators manage price_lists" on price_lists for all to authenticated
  using (beach_id in (select beach_id from current_user_beach_ids()))
  with check (beach_id in (select beach_id from current_user_beach_ids()));
create policy "public reads price_lists" on price_lists for select to anon using (true);

create policy "operators manage conti" on conti for all to authenticated
  using (beach_id in (select beach_id from current_user_beach_ids()))
  with check (beach_id in (select beach_id from current_user_beach_ids()));

create policy "operators manage daily_stats" on daily_stats for all to authenticated
  using (beach_id in (select beach_id from current_user_beach_ids()))
  with check (beach_id in (select beach_id from current_user_beach_ids()));

-- Guests create their own 'add'/'remove' requests from "Gestisci la mia prenotazione" and need
-- to read them back (to show "richiesta in attesa" / the pending-request card) -- but only the
-- operator can mark one resolved (confirming payment was collected, or that an item was
-- physically removed), matching the client's confirmEquipmentAdd/resolveEquipmentChange split.
create policy "operators manage equipment_changes" on equipment_changes for all to authenticated
  using (beach_id in (select beach_id from current_user_beach_ids()))
  with check (beach_id in (select beach_id from current_user_beach_ids()));
create policy "public reads equipment_changes" on equipment_changes for select to anon using (true);
create policy "public creates equipment_changes" on equipment_changes for insert to anon with check (true);
-- The guest can only take back their own not-yet-paid request, never touch a 'remove' record
-- (that one is the operator's audit trail that an item still needs to be physically collected).
create policy "public cancels pending add requests" on equipment_changes for delete to anon
  using (type = 'add' and resolved = false);
