-- Migration 0002 -- for a Supabase project that already ran migration 0001 / the original schema.
-- A fresh install can just run the current schema.sql instead (it already includes all of this).
--
-- Fixes a real bug: freeing an umbrella (checkout done) never marked its booking row as done,
-- so both the client-side conflict check (findUmbrellaConflict/findCustomerConflict) and this
-- database's own exclusion constraint kept treating that umbrella/date range as permanently
-- booked -- a freshly-freed, visibly "Libero" umbrella could never be rebooked for those dates.
--
-- Adds bookings.released (defaults false, set true by StoreContext.tsx's freeUmbrella) and
-- narrows the exclusion constraint to only apply to non-released bookings.

alter table bookings add column if not exists released boolean not null default false;

alter table bookings drop constraint if exists bookings_no_overlap;
alter table bookings
  add constraint bookings_no_overlap
  exclude using gist (
    beach_id with =,
    umbrella_id with =,
    daterange(date_from::date, date_to::date, '[]') with &&
  ) where (not released);
