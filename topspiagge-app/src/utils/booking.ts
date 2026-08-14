import { Booking, BookingHold, GuestCount, Umbrella } from '../types';
import { toDateKey } from './format';

// Only adults count against an umbrella's occupancy limit -- children are unlimited.
export const MAX_ADULTS_PER_UMBRELLA = 4;
export const MAX_EQUIPMENT_PER_UMBRELLA = 4;

export function totalGuestCount(guests: GuestCount): number {
  return guests.adults + guests.children5to15 + guests.childrenUnder5;
}

export function umbrellasNeededFor(adults: number): number {
  return Math.max(1, Math.ceil(adults / MAX_ADULTS_PER_UMBRELLA));
}

export function findNearestUmbrellas(
  anchor: Umbrella,
  allUmbrellas: Umbrella[],
  isAvailable: (u: Umbrella) => boolean,
  excludeIds: Set<string>,
  limit: number
): Umbrella[] {
  return allUmbrellas
    .filter((u) => !excludeIds.has(u.id) && isAvailable(u))
    .map((u) => ({ u, dist: Math.hypot(u.row - anchor.row, u.col - anchor.col) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit)
    .map((entry) => entry.u);
}

export function distributeGuests(guests: GuestCount, umbrellaCount: number): GuestCount[] {
  const slots: GuestCount[] = Array.from({ length: umbrellaCount }, () => ({
    adults: 0,
    children5to15: 0,
    childrenUnder5: 0,
  }));
  // Adults respect the per-umbrella occupancy cap, filling one umbrella before the next.
  let slotIndex = 0;
  let slotFill = 0;
  for (let i = 0; i < guests.adults && slotIndex < umbrellaCount; i++) {
    if (slotFill === MAX_ADULTS_PER_UMBRELLA) {
      slotIndex++;
      slotFill = 0;
    }
    if (slotIndex >= umbrellaCount) break;
    slots[slotIndex].adults += 1;
    slotFill++;
  }
  // Children are unlimited and don't affect capacity, so just spread them evenly.
  const spreadChildren = (key: 'children5to15' | 'childrenUnder5', count: number) => {
    for (let i = 0; i < count; i++) {
      slots[i % umbrellaCount][key] += 1;
    }
  };
  spreadChildren('children5to15', guests.children5to15);
  spreadChildren('childrenUnder5', guests.childrenUnder5);
  return slots;
}

// A released booking (the operator has already freed that umbrella -- checkout done) or a
// cancelled one (see Booking.cancelled) is kept around for history but no longer occupies the
// calendar, so both are excluded from the conflict checks below -- otherwise a freshly-freed,
// visibly "Libero" umbrella would stay permanently unbookable for its old dates.
export function findUmbrellaConflict(
  bookings: Booking[],
  umbrellaId: string,
  dateFrom: string,
  dateTo: string
): Booking | undefined {
  return bookings.find(
    (b) => !b.released && !b.cancelled && b.umbrellaId === umbrellaId && dateFrom <= b.dateTo && dateTo >= b.dateFrom
  );
}

// Separate from findUmbrellaConflict (rather than folding holds into it) so the ~10 existing
// callers of that function are entirely unaffected -- only the two call sites that actually
// need to respect a live checkout hold (the guest-facing map and the operator's quick-booking
// form) opt in by also calling this one. `excludeHoldIds` lets the guest currently holding the
// umbrella keep seeing it as theirs rather than "taken by someone else."
export function findActiveHoldConflict(
  holds: BookingHold[],
  umbrellaId: string,
  dateFrom: string,
  dateTo: string,
  excludeHoldIds: ReadonlySet<string> = new Set()
): BookingHold | undefined {
  const now = Date.now();
  return holds.find(
    (h) =>
      !excludeHoldIds.has(h.id) &&
      h.expiresAt > now &&
      h.umbrellaId === umbrellaId &&
      dateFrom <= h.dateTo &&
      dateTo >= h.dateFrom
  );
}

export function findCustomerConflict(
  bookings: Booking[],
  customerId: string,
  umbrellaId: string,
  dateFrom: string,
  dateTo: string
): Booking | undefined {
  return bookings.find(
    (b) =>
      !b.released &&
      !b.cancelled &&
      b.customerId === customerId &&
      b.umbrellaId !== umbrellaId &&
      dateFrom <= b.dateTo &&
      dateTo >= b.dateFrom
  );
}

export function buildDayBookingLookup(bookings: Booking[]): Map<string, Booking> {
  const map = new Map<string, Booking>();
  bookings.forEach((b) => {
    const cursor = new Date(b.dateFrom + 'T00:00:00');
    const end = new Date(b.dateTo + 'T00:00:00');
    while (cursor <= end) {
      map.set(`${b.umbrellaId}|${toDateKey(cursor)}`, b);
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  return map;
}
