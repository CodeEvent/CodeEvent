import { findCustomerConflict, findUmbrellaConflict, totalGuestCount, umbrellasNeededFor } from '../booking';
import { Booking } from '../../types';

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'bk-1',
    umbrellaId: 'u-1',
    customerId: 'c-1',
    dateFrom: '2024-07-10',
    dateTo: '2024-07-12',
    totalPrice: 100,
    deposit: 20,
    paid: 20,
    status: 'occupato',
    createdAt: '2024-07-01',
    reference: 'TS-AAAAAA',
    ...overrides,
  };
}

describe('findUmbrellaConflict', () => {
  it('detects an overlapping range on the same umbrella', () => {
    const bookings = [makeBooking()];
    const conflict = findUmbrellaConflict(bookings, 'u-1', '2024-07-11', '2024-07-14');
    expect(conflict).toBeDefined();
  });

  it('is inclusive on both edges (touching ranges conflict)', () => {
    const bookings = [makeBooking()];
    expect(findUmbrellaConflict(bookings, 'u-1', '2024-07-12', '2024-07-15')).toBeDefined();
    expect(findUmbrellaConflict(bookings, 'u-1', '2024-07-05', '2024-07-10')).toBeDefined();
  });

  it('finds no conflict for a fully separate range', () => {
    const bookings = [makeBooking()];
    expect(findUmbrellaConflict(bookings, 'u-1', '2024-07-13', '2024-07-15')).toBeUndefined();
  });

  it('ignores bookings on a different umbrella', () => {
    const bookings = [makeBooking({ umbrellaId: 'u-2' })];
    expect(findUmbrellaConflict(bookings, 'u-1', '2024-07-10', '2024-07-12')).toBeUndefined();
  });
});

describe('findCustomerConflict', () => {
  it('flags the same customer double-booking a different umbrella on overlapping dates', () => {
    const bookings = [makeBooking({ customerId: 'c-1', umbrellaId: 'u-1' })];
    const conflict = findCustomerConflict(bookings, 'c-1', 'u-2', '2024-07-11', '2024-07-13');
    expect(conflict).toBeDefined();
  });

  it('does not flag a different customer', () => {
    const bookings = [makeBooking({ customerId: 'c-1', umbrellaId: 'u-1' })];
    expect(findCustomerConflict(bookings, 'c-2', 'u-2', '2024-07-11', '2024-07-13')).toBeUndefined();
  });
});

describe('totalGuestCount / umbrellasNeededFor', () => {
  it('sums all guest categories', () => {
    expect(totalGuestCount({ adults: 2, children5to15: 1, childrenUnder5: 1 })).toBe(4);
  });

  it('needs one umbrella per 4 adults, rounded up', () => {
    expect(umbrellasNeededFor(1)).toBe(1);
    expect(umbrellasNeededFor(4)).toBe(1);
    expect(umbrellasNeededFor(5)).toBe(2);
    expect(umbrellasNeededFor(8)).toBe(2);
  });
});
