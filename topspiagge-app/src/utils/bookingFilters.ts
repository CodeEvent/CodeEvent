import { Booking, BeachSide, Customer, Umbrella } from '../types';
import { findUmbrellaConflict } from './booking';
import { DisplayStatus, displayStatusFor, isStagionaleBooking } from './displayStatus';

// Single shared filter model reused by Piantina, Griglia, Quadro and Archivi's Filtri tab --
// keeping the matching logic in one place avoids the kind of screen-to-screen drift that
// happened when Sgombera's color was fixed in one place but not another.
export interface BookingFilters {
  side: BeachSide | 'tutti';
  // 'da_saldare' here already means "has an outstanding balance" -- there is deliberately no
  // separate "unpaid" toggle, since that would just be the same condition asked twice.
  status: DisplayStatus | 'tutti';
  onlyVip: boolean;
  checkinToday: boolean;
  checkoutToday: boolean;
  hasCabin: boolean | null; // null = don't care
  hasEquipment: boolean | null; // has any beds/chairs booked
  groupOnly: boolean; // party spread across multiple umbrellas
  minAdults: number; // 0 = no filter
  query: string; // matches customer name/phone/email, booking reference, umbrella number/zone
  // The period the operator wants to look at -- a booking matches if its stay overlaps this
  // range at all, not just if it starts/ends inside it. Either bound alone means open-ended.
  rangeFrom: string | null;
  rangeTo: string | null;
}

export const DEFAULT_BOOKING_FILTERS: BookingFilters = {
  side: 'tutti',
  status: 'tutti',
  onlyVip: false,
  checkinToday: false,
  checkoutToday: false,
  hasCabin: null,
  hasEquipment: null,
  groupOnly: false,
  minAdults: 0,
  query: '',
  rangeFrom: null,
  rangeTo: null,
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
  if (filters.checkinToday && booking.dateFrom !== today) return false;
  if (filters.checkoutToday && booking.dateTo !== today) return false;
  if (filters.rangeFrom && booking.dateTo < filters.rangeFrom) return false;
  if (filters.rangeTo && booking.dateFrom > filters.rangeTo) return false;
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
    filters.checkinToday ||
    filters.checkoutToday ||
    filters.minAdults > 0 ||
    filters.hasEquipment !== null ||
    filters.groupOnly ||
    filters.query.trim().length > 0 ||
    !!filters.rangeFrom ||
    !!filters.rangeTo
  );
}

// Same as needsBooking, minus the range bounds -- used only inside the range-aware Libero
// branch below, where rangeFrom/rangeTo are the very thing being checked (via a real conflict
// scan), not a signal that a pre-existing booking must exist.
function needsBookingBeyondRange(filters: BookingFilters): boolean {
  return (
    filters.onlyVip ||
    filters.checkinToday ||
    filters.checkoutToday ||
    filters.minAdults > 0 ||
    filters.hasEquipment !== null ||
    filters.groupOnly ||
    filters.query.trim().length > 0
  );
}

// A single bound alone means "just that day" -- mirrors how the rest of the filter model
// already treats one-sided ranges as open-ended-but-anchored.
export function effectiveDateRange(filters: BookingFilters): { from: string; to: string } | null {
  if (!filters.rangeFrom && !filters.rangeTo) return null;
  return { from: filters.rangeFrom ?? filters.rangeTo!, to: filters.rangeTo ?? filters.rangeFrom! };
}

// For Piantina/Griglia: umbrellas with no booking (libero) still need to pass side/status/
// cabin checks, but automatically fail any filter that requires a booking to evaluate --
// EXCEPT when a date range is chosen while filtering for 'libero': there, "free" means "no
// booking overlaps the chosen range at all" (checked against every booking for this umbrella,
// not just today's), so a stagionale or otherwise-booked umbrella still matches once the
// picked dates fall outside its existing booking(s).
export function umbrellaMatchesFilters(
  umbrella: Umbrella,
  filters: BookingFilters,
  bookings: Booking[],
  getBooking: (id?: string) => Booking | undefined,
  getCustomer: (id?: string) => Customer | undefined,
  today: string
): boolean {
  if (filters.side !== 'tutti' && umbrella.side !== filters.side) return false;
  if (filters.hasCabin !== null && umbrella.hasCabin !== filters.hasCabin) return false;

  const range = effectiveDateRange(filters);
  if (filters.status === 'libero' && range) {
    const free = !findUmbrellaConflict(bookings, umbrella.id, range.from, range.to);
    if (!free) return false;
    // Every other filter dimension (VIP, check-in/out, equipment, group, query) requires an
    // existing booking, which a libero-for-this-range umbrella by definition has none of.
    return !needsBookingBeyondRange(filters);
  }

  const status = displayStatusFor(umbrella, getBooking);
  if (filters.status !== 'tutti' && status !== filters.status) return false;

  if (!needsBooking(filters)) return true;
  const booking = getBooking(umbrella.currentBookingId);
  if (!booking) return false;
  const customer = getCustomer(booking.customerId);
  return bookingPasses(booking, customer, umbrella, filters, today);
}

// Piantina/Griglia's cell color, for the range-aware view: is this umbrella free for every
// day in the chosen range, regardless of what its status happens to be today?
export function isUmbrellaFreeForRange(umbrella: Umbrella, bookings: Booking[], from: string, to: string): boolean {
  return !findUmbrellaConflict(bookings, umbrella.id, from, to);
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
        : isStagionaleBooking(booking)
        ? 'stagionale'
        : includeSgombera && booking.dateTo === today
        ? 'sgombera'
        : 'occupato';
    if (status !== filters.status) return false;
  }
  return bookingPasses(booking, customer, umbrella, filters, today);
}
