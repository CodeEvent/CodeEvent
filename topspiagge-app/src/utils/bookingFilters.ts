import { Booking, BeachSide, Customer, Umbrella } from '../types';
import { DisplayStatus, displayStatusFor } from './displayStatus';

// Single shared filter model reused by Piantina, Griglia, Quadro and Archivi's Filtri tab --
// keeping the matching logic in one place avoids the kind of screen-to-screen drift that
// happened when Sgombera's color was fixed in one place but not another.
export interface BookingFilters {
  side: BeachSide | 'tutti';
  status: DisplayStatus | 'tutti';
  onlyVip: boolean;
  onlyUnpaid: boolean;
  checkinToday: boolean;
  checkoutToday: boolean;
  hasCabin: boolean | null; // null = don't care
  hasEquipment: boolean | null; // has any beds/chairs booked
  groupOnly: boolean; // party spread across multiple umbrellas
  minAdults: number; // 0 = no filter
  query: string; // matches customer name/phone/email, booking reference, umbrella number/zone
}

export const DEFAULT_BOOKING_FILTERS: BookingFilters = {
  side: 'tutti',
  status: 'tutti',
  onlyVip: false,
  onlyUnpaid: false,
  checkinToday: false,
  checkoutToday: false,
  hasCabin: null,
  hasEquipment: null,
  groupOnly: false,
  minAdults: 0,
  query: '',
};

export function isDefaultFilters(f: BookingFilters): boolean {
  return JSON.stringify(f) === JSON.stringify(DEFAULT_BOOKING_FILTERS);
}

// The checks that need an actual booking/customer to evaluate -- shared by both the
// umbrella-based (Piantina/Griglia) and booking-based (Quadro/Archivi) matchers below.
function bookingPasses(
  booking: Booking,
  customer: Customer | undefined,
  umbrella: Umbrella | undefined,
  filters: BookingFilters,
  today: string
): boolean {
  if (filters.onlyVip && !customer?.vip) return false;
  if (filters.onlyUnpaid && booking.paid >= booking.totalPrice) return false;
  if (filters.checkinToday && booking.dateFrom !== today) return false;
  if (filters.checkoutToday && booking.dateTo !== today) return false;
  if (filters.minAdults > 0 && (booking.guests?.adults ?? 0) < filters.minAdults) return false;
  if (filters.hasEquipment !== null) {
    const has = !!(booking.beds || booking.chairs);
    if (has !== filters.hasEquipment) return false;
  }
  if (filters.groupOnly && !booking.groupId) return false;
  const q = filters.query.trim().toLowerCase();
  if (q) {
    const hay = [
      customer?.name,
      customer?.phone,
      customer?.email,
      booking.reference,
      umbrella ? String(umbrella.number) : '',
      umbrella?.zone,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function needsBooking(filters: BookingFilters): boolean {
  return (
    filters.onlyVip ||
    filters.onlyUnpaid ||
    filters.checkinToday ||
    filters.checkoutToday ||
    filters.minAdults > 0 ||
    filters.hasEquipment !== null ||
    filters.groupOnly ||
    filters.query.trim().length > 0
  );
}

// For Piantina/Griglia: umbrellas with no booking (libero) still need to pass side/status/
// cabin checks, but automatically fail any filter that requires a booking to evaluate.
export function umbrellaMatchesFilters(
  umbrella: Umbrella,
  filters: BookingFilters,
  getBooking: (id?: string) => Booking | undefined,
  getCustomer: (id?: string) => Customer | undefined,
  today: string
): boolean {
  if (filters.side !== 'tutti' && umbrella.side !== filters.side) return false;
  if (filters.hasCabin !== null && umbrella.hasCabin !== filters.hasCabin) return false;

  const status = displayStatusFor(umbrella, getBooking);
  if (filters.status !== 'tutti' && status !== filters.status) return false;

  if (!needsBooking(filters)) return true;
  const booking = getBooking(umbrella.currentBookingId);
  if (!booking) return false;
  const customer = getCustomer(booking.customerId);
  return bookingPasses(booking, customer, umbrella, filters, today);
}

// For Quadro/Archivi: iterating actual Booking records directly (never 'libero').
export function bookingMatchesFilters(
  booking: Booking,
  umbrella: Umbrella | undefined,
  customer: Customer | undefined,
  filters: BookingFilters,
  today: string,
  includeSgombera = true
): boolean {
  if (filters.side !== 'tutti' && umbrella && umbrella.side !== filters.side) return false;
  if (filters.hasCabin !== null && umbrella && umbrella.hasCabin !== filters.hasCabin) return false;
  if (filters.status !== 'tutti') {
    const status =
      booking.paid < booking.totalPrice
        ? 'da_saldare'
        : includeSgombera && booking.dateTo === today
        ? 'sgombera'
        : 'occupato';
    if (status !== filters.status) return false;
  }
  return bookingPasses(booking, customer, umbrella, filters, today);
}
