import { colors } from '../theme';
import { Booking, Umbrella } from '../types';
import { daysBetween, isoDate } from './format';

// A "stagionale" booking is a long-stay: booked for at least a full month. These are already
// paid in full up front and effectively lock the umbrella for the whole season, so they get
// their own status (a red/blue split on the map) and extra guard rails before an operator can
// free them -- see the double-confirm sites. Derived purely from the booking's date span, so
// there's no stored flag to keep in sync.
export const STAGIONALE_MIN_DAYS = 30;

export function isStagionaleBooking(booking: Booking): boolean {
  return daysBetween(booking.dateFrom, booking.dateTo) >= STAGIONALE_MIN_DAYS;
}

// The staff floor-plan views (Piantina/Griglia) only need to answer one question at a
// glance: is this umbrella free, occupied, or occupied-but-unpaid? In arrivo, prenotato
// and a seasonal-customer assignment are all still "someone has this umbrella" cases, so
// they collapse into 'occupato' here; only an outstanding balance on the active booking
// promotes a cell to 'da_saldare'. 'sgombera' additionally flags an occupied, fully-paid
// umbrella whose guest is checking out today -- it still needs its chairs/beds cleared
// before it's truly free for tomorrow, so staff shouldn't read it as plain 'occupato'.
// 'stagionale' is a long-stay booking (30+ days) -- shown ahead of sgombera so a season-long
// guest doesn't read as "checking out" just because today happens to be their last day.
export type DisplayStatus = 'libero' | 'occupato' | 'da_saldare' | 'sgombera' | 'stagionale';

export function displayStatusFor(
  umbrella: Umbrella,
  getBooking: (id?: string) => Booking | undefined
): DisplayStatus {
  if (umbrella.status === 'libero') return 'libero';
  const booking = getBooking(umbrella.currentBookingId);
  if (booking && booking.paid < booking.totalPrice) return 'da_saldare';
  if (booking && isStagionaleBooking(booking)) return 'stagionale';
  if (booking && booking.dateTo === isoDate(0)) return 'sgombera';
  return 'occupato';
}

// For screens iterating over a specific Booking record directly (Gantt bars, arrival/
// departure lists) rather than an umbrella's current live state -- a booking is never
// 'libero' on its own. `includeSgombera` is opt-in because it's a staff/housekeeping
// concept: staff-facing lists (Archivi, Quadro) pass true, the customer-facing booking
// lookup leaves it off so a guest never sees internal "needs clearing" language.
export function displayStatusForBooking(booking: Booking, includeSgombera = false): DisplayStatus {
  if (booking.paid < booking.totalPrice) return 'da_saldare';
  if (isStagionaleBooking(booking)) return 'stagionale';
  if (includeSgombera && booking.dateTo === isoDate(0)) return 'sgombera';
  return 'occupato';
}

export const displayStatusColor: Record<DisplayStatus, string> = {
  libero: colors.libero,
  occupato: colors.occupato,
  da_saldare: colors.black,
  sgombera: colors.sgombera,
  stagionale: colors.prenotato,
};

// Same hues as displayStatusColor but darkened until each reaches >=4.5:1 contrast against its
// own displayStatusBg -- the raw dot colors above read fine as a small dot, but at 1.7-2.9:1
// they fail as 12px badge text. Dots keep the vivid color; only text uses this map.
export const displayStatusTextColor: Record<DisplayStatus, string> = {
  libero: '#0E7050',
  occupato: '#A32E20',
  da_saldare: colors.black,
  sgombera: '#9A5E0A',
  stagionale: '#3548B4',
};

export const displayStatusBg: Record<DisplayStatus, string> = {
  libero: colors.liberoBg,
  occupato: colors.occupatoBg,
  da_saldare: '#E5E6E8',
  sgombera: colors.sgomberaBg,
  stagionale: colors.prenotatoBg,
};

export const displayStatusLabel: Record<DisplayStatus, string> = {
  libero: 'Libero',
  occupato: 'Occupato',
  da_saldare: 'Da saldare',
  sgombera: 'Sgombera',
  stagionale: 'Stagionale',
};

export const DISPLAY_STATUSES: DisplayStatus[] = ['libero', 'occupato', 'da_saldare', 'sgombera', 'stagionale'];

// Piantina reserves black for a small "unpaid" dot overlay rather than recoloring the whole
// umbrella -- red/green/orange should always show the real occupancy state at a glance, with
// the payment flag layered on top instead of replacing it. These two helpers give that base
// status (never 'da_saldare') plus a separate boolean for the dot.
export type BaseDisplayStatus = 'libero' | 'occupato' | 'sgombera' | 'stagionale';

export function baseDisplayStatusFor(
  umbrella: Umbrella,
  getBooking: (id?: string) => Booking | undefined
): BaseDisplayStatus {
  if (umbrella.status === 'libero') return 'libero';
  const booking = getBooking(umbrella.currentBookingId);
  if (booking && isStagionaleBooking(booking)) return 'stagionale';
  if (booking && booking.dateTo === isoDate(0)) return 'sgombera';
  return 'occupato';
}

export function hasOutstandingBalance(
  umbrella: Umbrella,
  getBooking: (id?: string) => Booking | undefined
): boolean {
  const booking = getBooking(umbrella.currentBookingId);
  return !!booking && booking.paid < booking.totalPrice;
}

// Booking-record equivalents (Quadro's Gantt bars, Archivi's lists) -- a booking is always
// occupied, so this only ever resolves to 'occupato'/'sgombera'/'stagionale', never 'libero'.
export function baseDisplayStatusForBooking(booking: Booking, includeSgombera = true): BaseDisplayStatus {
  if (isStagionaleBooking(booking)) return 'stagionale';
  if (includeSgombera && booking.dateTo === isoDate(0)) return 'sgombera';
  return 'occupato';
}

export function bookingHasOutstandingBalance(booking: Booking): boolean {
  return booking.paid < booking.totalPrice;
}
