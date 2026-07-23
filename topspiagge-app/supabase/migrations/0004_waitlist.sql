-- Migration 0004 -- for a Supabase project that already ran migrations 0001-0003.
-- A fresh install can just run the current schema.sql instead (it already includes this).
--
-- Adds the waitlist table: a customer's request to be told when a specific umbrella/date range
-- frees up (see WaitlistEntry in src/types/index.ts). No "resolved"/"notified" flag -- whether
-- an entry currently matches is derived at render time from live bookings.

create table if not exists waitlist (
  id text not null,
  beach_id text not null references beaches(id) on delete cascade,
  umbrella_id text not null,
  customer_name text not null,
  customer_phone text not null,
  date_from text not null,
  date_to text not null,
  created_at text not null,
  primary key (beach_id, id),
  foreign key (beach_id, umbrella_id) references umbrellas(beach_id, id) on delete cascade
);
create index if not exists waitlist_beach_id_idx on waitlist (beach_id);

alter table waitlist enable row level security;

drop policy if exists "operators manage waitlist" on waitlist;
create policy "operators manage waitlist" on waitlist for all to authenticated
  using (beach_id in (select beach_id from current_user_beach_ids()))
  with check (beach_id in (select beach_id from current_user_beach_ids()));

drop policy if exists "public creates waitlist entries" on waitlist;
create policy "public creates waitlist entries" on waitlist for insert to anon with check (true);
