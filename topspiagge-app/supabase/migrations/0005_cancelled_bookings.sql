-- Migration 0005 -- for a Supabase project that already ran migrations 0001-0004.
-- A fresh install can just run the current schema.sql instead (it already includes this).
--
-- Adds bookings.cancelled: set (together with released, which already exists) by an operator's
-- cancellation from Archivi -- see Booking.cancelled in src/types/index.ts and the
-- CANCEL_BOOKING_KEEP_RECORD reducer case in StoreContext.tsx. The row is kept as a visible
-- record (Archivi/CRM) instead of being deleted; a customer's own self-service cancellation
-- still deletes the row outright, unaffected by this migration.
--
-- No change needed to the bookings_no_overlap exclusion constraint added in a previous
-- migration -- it's already scoped `where (not released)`, and a cancelled booking always has
-- released = true too, so it's already excluded from that guard.

alter table bookings add column if not exists cancelled boolean not null default false;
