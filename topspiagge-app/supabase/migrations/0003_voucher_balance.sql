-- Migration 0003 -- for a Supabase project that already ran migrations 0001/0002.
-- A fresh install can just run the current schema.sql instead (it already includes this).
--
-- New cancellation policy: bookings are paid in full at booking time (see
-- utils/cancellation.ts's PREPAYMENT_RATE) and cancelling at least 2 days before arrival earns
-- a voucher (store credit) instead of a cash refund -- see StoreContext.tsx's grantVoucher.
-- This adds the balance that credit is tracked in.

alter table customers add column if not exists voucher_balance numeric not null default 0;
