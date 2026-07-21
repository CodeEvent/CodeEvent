import { colors } from '../theme';
import { Booking, Umbrella } from '../types';
import { isoDate } from './format';

// The staff floor-plan views (Piantina/Griglia) only need to answer one question at a
// glance: is this umbrella free, occupied, or occupied-but-unpaid? In arrivo, prenotato
// and a seasonal-customer assignment are all still "someone has this umbrella" cases, so
// they collapse into 'occupato' here; only an outstanding balance on the active booking
// promotes a cell to 'da_saldare'. 'sgombera' additionally flags an occupied, fully-paid
// umbrella whose guest is checking out today -- it still needs its chairs/beds cleared
// before it's truly free for tomorrow, so staff shouldn't read it as plain 'occupato'.
export type DisplayStatus = 'libero' | 'occupato' | 'da_saldare' | 'sgombera';

export function displayStatusFor(
  umbrella: Umbrella,
  getBooking: (id?: string) => Booking | undefined
): DisplayStatus {
  if (umbrella.status === 'libero') return 'libero';
  const booking = getBooking(umbrella.currentBookingId);
  if (booking && booking.paid < booking.totalPrice) return 'da_saldare';
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
  if (includeSgombera && booking.dateTo === isoDate(0)) return 'sgombera';
  return 'occupato';
}

export const displayStatusColor: Record<DisplayStatus, string> = {
  libero: colors.libero,
  occupato: colors.occupato,
  da_saldare: colors.black,
  sgombera: colors.sgombera,
};

export const displayStatusBg: Record<DisplayStatus, string> = {
  libero: colors.liberoBg,
  occupato: colors.occupatoBg,
  da_saldare: '#E5E6E8',
  sgombera: colors.sgomberaBg,
};

export const displayStatusLabel: Record<DisplayStatus, string> = {
  libero: 'Libero',
  occupato: 'Occupato',
  da_saldare: 'Da saldare',
  sgombera: 'Sgombera',
};

export const DISPLAY_STATUSES: DisplayStatus[] = ['libero', 'occupato', 'da_saldare', 'sgombera'];
