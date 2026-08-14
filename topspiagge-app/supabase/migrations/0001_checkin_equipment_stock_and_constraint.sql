-- Migration 0001 -- for a Supabase project that already ran the original supabase/schema.sql.
-- A fresh install can just run the current schema.sql instead (it already includes all of this).
--
-- Adds:
--   1. bookings.checked_in_at (reception check-in confirmation)
--   2. equipment_changes table (guest-initiated beds/chairs add requests + self-service refunds)
--   3. articles.stock (nullable -- null keeps meaning "not tracked", matching every article
--      seeded before this migration)
--   4. a database-level exclusion constraint stopping two overlapping bookings on the same
--      umbrella from both being inserted, even from two different clients at the same instant
--   5. RLS policies the equipment-change and beds/chairs-editing features need, which the
--      original schema.sql never granted (that feature could only ever work in local-fallback
--      mode until now)

alter table bookings add column if not exists checked_in_at text;
alter table articles add column if not exists stock int;

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
alter table equipment_changes enable row level security;

create extension if not exists btree_gist;
alter table bookings drop constraint if exists bookings_no_overlap;
alter table bookings
  add constraint bookings_no_overlap
  exclude using gist (
    beach_id with =,
    umbrella_id with =,
    daterange(date_from::date, date_to::date, '[]') with &&
  );

drop policy if exists "public updates bookings for equipment changes" on bookings;
create policy "public updates bookings for equipment changes" on bookings for update to anon
  using (true) with check (true);

drop policy if exists "operators manage equipment_changes" on equipment_changes;
create policy "operators manage equipment_changes" on equipment_changes for all to authenticated
  using (beach_id in (select beach_id from current_user_beach_ids()))
  with check (beach_id in (select beach_id from current_user_beach_ids()));

drop policy if exists "public reads equipment_changes" on equipment_changes;
create policy "public reads equipment_changes" on equipment_changes for select to anon using (true);

drop policy if exists "public creates equipment_changes" on equipment_changes;
create policy "public creates equipment_changes" on equipment_changes for insert to anon with check (true);

drop policy if exists "public cancels pending add requests" on equipment_changes;
create policy "public cancels pending add requests" on equipment_changes for delete to anon
  using (type = 'add' and resolved = false);

-- Remember to turn Realtime ON for equipment_changes too (Table Editor -> equipment_changes ->
-- "..." -> Enable Realtime), same as every other table -- see schema.sql's top-of-file note.
