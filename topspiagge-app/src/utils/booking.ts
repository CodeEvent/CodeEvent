import { Booking } from '../types';

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
      map.set(`${b.umbrellaId}|${cursor.toISOString().slice(0, 10)}`, b);
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  return map;
}
