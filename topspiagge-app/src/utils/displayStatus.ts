import { colors } from '../theme';
import { Booking, Umbrella } from '../types';

// The staff floor-plan views (Piantina/Griglia) only need to answer one question at a
// glance: is this umbrella free, occupied, or occupied-but-unpaid? In arrivo, prenotato
// and a seasonal-customer assignment are all still "someone has this umbrella" cases, so
// they collapse into 'occupato' here; only an outstanding balance on the active booking
// promotes a cell to 'da_saldare'.
export type DisplayStatus = 'libero' | 'occupato' | 'da_saldare';

export function displayStatusFor(
  umbrella: Umbrella,
  getBooking: (id?: string) => Booking | undefined
): DisplayStatus {
  if (umbrella.status === 'libero') return 'libero';
  const booking = getBooking(umbrella.currentBookingId);
  if (booking && booking.paid < booking.totalPrice) return 'da_saldare';
  return 'occupato';
}

export const displayStatusColor: Record<DisplayStatus, string> = {
  libero: colors.libero,
  occupato: colors.occupato,
  da_saldare: colors.black,
};

export const displayStatusLabel: Record<DisplayStatus, string> = {
  libero: 'Libero',
  occupato: 'Occupato',
  da_saldare: 'Da saldare',
};

export const DISPLAY_STATUSES: DisplayStatus[] = ['libero', 'occupato', 'da_saldare'];
