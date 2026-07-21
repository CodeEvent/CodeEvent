-- Top Spiagge -- Supabase schema
--
-- Run this whole file once in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- to create every table the app needs. IDs are kept as text to match the app's existing
-- string-based id generation (e.g. "u-1", "bk-...-123456"), so no client-side id remapping
-- is needed when moving off the in-memory store.
--
-- Realtime: after running this, go to Database -> Replication (or Table Editor -> each
-- table -> "..." -> Enable Realtime) and turn realtime ON for every table below, so all
-- connected clients see each other's changes live.

create table if not exists umbrellas (
  id text primary key,
  number int not null,
  side text not null check (side in ('nord', 'sud')),
  row int not null,
  col int not null,
  zone text not null,
  has_cabin boolean not null default false,
  status text not null check (status in ('libero', 'occupato', 'in_arrivo', 'prenotato')),
  current_booking_id text,
  assigned_customer_id text
);

create table if not exists customers (
  id text primary key,
  name text not null,
  phone text not null,
  email text,
  notes text,
  vip boolean not null default false,
  booking_history text[] not null default '{}',
  assigned_umbrella_id text,
  created_at text not null
);

create table if not exists bookings (
  id text primary key,
  umbrella_id text not null references umbrellas(id) on delete cascade,
  customer_id text not null references customers(id) on delete cascade,
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
  is_student boolean
);

create table if not exists articles (
  id text primary key,
  name text not null,
  category text not null,
  base_price numeric not null,
  unit text not null
);

create table if not exists price_lists (
  id text primary key,
  name text not null,
  season text not null,
  prices jsonb not null,
  active_from text not null,
  active_to text not null
);

create table if not exists conti (
  id text primary key,
  umbrella_id text,
  customer_id text,
  items jsonb not null,
  total numeric not null,
  paid_amount numeric not null,
  payment_method text not null,
  doc_type text not null,
  split_count int not null,
  created_at text not null,
  closed boolean not null default false
);

create table if not exists daily_stats (
  date text primary key,
  incasso numeric not null default 0,
  presenze int not null default 0,
  bar numeric not null default 0,
  ombrelloni numeric not null default 0
);

-- Row Level Security: this app has no per-row ownership concept (any operator can see/edit
-- everything, same as the current admin/admin-gated but otherwise fully-open in-memory
-- store), so policies just allow all access to anyone using the public anon key. The app's
-- own operator login (admin/admin) is the only gate in front of the write actions in the UI;
-- this does NOT add real user-level auth at the database layer.
alter table umbrellas enable row level security;
alter table customers enable row level security;
alter table bookings enable row level security;
alter table articles enable row level security;
alter table price_lists enable row level security;
alter table conti enable row level security;
alter table daily_stats enable row level security;

create policy "allow all umbrellas" on umbrellas for all using (true) with check (true);
create policy "allow all customers" on customers for all using (true) with check (true);
create policy "allow all bookings" on bookings for all using (true) with check (true);
create policy "allow all articles" on articles for all using (true) with check (true);
create policy "allow all price_lists" on price_lists for all using (true) with check (true);
create policy "allow all conti" on conti for all using (true) with check (true);
create policy "allow all daily_stats" on daily_stats for all using (true) with check (true);
