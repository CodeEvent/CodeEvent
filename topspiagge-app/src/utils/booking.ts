import { Booking, GuestCount, Umbrella } from '../types';
import { toDateKey } from './format';

export const MAX_GUESTS_PER_UMBRELLA = 4;

export function totalGuestCount(guests: GuestCount): number {
  return guests.adults + guests.children5to15 + guests.childrenUnder5;
}

export function umbrellasNeededFor(totalGuests: number): number {
  return Math.max(1, Math.ceil(totalGuests / MAX_GUESTS_PER_UMBRELLA));
}

export function findNearestUmbrellas(
  anchor: Umbrella,
  allUmbrellas: Umbrella[],
  isAvailable: (u: Umbrella) => boolean,
  excludeIds: Set<string>,
  limit: number
): Umbrella[] {
  return allUmbrellas
    .filter((u) => u.side === anchor.side && !excludeIds.has(u.id) && isAvailable(u))
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
  let slotIndex = 0;
  let slotFill = 0;
  const distribute = (key: keyof GuestCount, count: number) => {
    for (let i = 0; i < count && slotIndex < umbrellaCount; i++) {
      if (slotFill === MAX_GUESTS_PER_UMBRELLA) {
        slotIndex++;
        slotFill = 0;
      }
      if (slotIndex >= umbrellaCount) break;
      slots[slotIndex][key] += 1;
      slotFill++;
    }
  };
  distribute('adults', guests.adults);
  distribute('children5to15', guests.children5to15);
  distribute('childrenUnder5', guests.childrenUnder5);
  return slots;
}

export function findUmbrellaConflict(
  bookings: Booking[],
  umbrellaId: string,
  dateFrom: string,
  dateTo: string
): Booking | undefined {
  return bookings.find(
    (b) => b.umbrellaId === umbrellaId && dateFrom <= b.dateTo && dateTo >= b.dateFrom
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
