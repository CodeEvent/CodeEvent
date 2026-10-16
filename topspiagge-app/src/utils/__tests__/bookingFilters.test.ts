import { DEFAULT_BOOKING_FILTERS, bookingMatchesFilters, isUmbrellaFreeForRange } from '../bookingFilters';
import { Booking, Umbrella } from '../../types';

function makeUmbrella(overrides: Partial<Umbrella> = {}): Umbrella {
  return {
    id: 'u-1',
    number: 1,
    side: 'nord',
    row: 0,
    col: 0,
    zone: 'Zona A',
    hasCabin: false,
    status: 'occupato',
    ...overrides,
  };
}

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'bk-1',
    umbrellaId: 'u-1',
    customerId: 'c-1',
    dateFrom: '2024-07-10',
    dateTo: '2024-07-12',
    totalPrice: 100,
    deposit: 20,
    paid: 100,
    status: 'occupato',
    createdAt: '2024-07-01',
    reference: 'TS-AAAAAA',
    ...overrides,
  };
}

describe('isUmbrellaFreeForRange', () => {
  it('is false when a booking overlaps the range', () => {
    const bookings = [makeBooking()];
    expect(isUmbrellaFreeForRange(makeUmbrella(), bookings, '2024-07-11', '2024-07-13')).toBe(false);
  });

  it('is true when no booking overlaps the range', () => {
    const bookings = [makeBooking()];
    expect(isUmbrellaFreeForRange(makeUmbrella(), bookings, '2024-07-13', '2024-07-15')).toBe(true);
  });
});

describe('bookingMatchesFilters', () => {
  const today = '2024-07-11';

  it('classifies an unpaid booking as da_saldare regardless of other status', () => {
    const booking = makeBooking({ paid: 50, totalPrice: 100 });
    const filters = { ...DEFAULT_BOOKING_FILTERS, status: 'da_saldare' as const };
    expect(bookingMatchesFilters(booking, makeUmbrella(), undefined, filters, today)).toBe(true);
  });

  it('classifies a 30+ day booking as stagionale even on its checkout day', () => {
    const booking = makeBooking({ dateFrom: '2024-06-01', dateTo: today, paid: 100, totalPrice: 100 });
    const filters = { ...DEFAULT_BOOKING_FILTERS, status: 'stagionale' as const };
    expect(bookingMatchesFilters(booking, makeUmbrella(), undefined, filters, today)).toBe(true);
  });

  it('classifies a fully-paid booking ending today as sgombera when includeSgombera is true', () => {
    const booking = makeBooking({ dateTo: today, paid: 100, totalPrice: 100 });
    const filters = { ...DEFAULT_BOOKING_FILTERS, status: 'sgombera' as const };
    expect(bookingMatchesFilters(booking, makeUmbrella(), undefined, filters, today, true)).toBe(true);
    expect(bookingMatchesFilters(booking, makeUmbrella(), undefined, filters, today, false)).toBe(false);
  });

  it('filters by VIP customer', () => {
    const booking = makeBooking();
    const filters = { ...DEFAULT_BOOKING_FILTERS, onlyVip: true };
    const vip = { id: 'c-1', name: 'A', phone: '1', vip: true, bookingHistory: [], createdAt: '2024-01-01', tags: [] };
    const notVip = { ...vip, vip: false };
    expect(bookingMatchesFilters(booking, makeUmbrella(), vip, filters, today)).toBe(true);
    expect(bookingMatchesFilters(booking, makeUmbrella(), notVip, filters, today)).toBe(false);
  });

  it('filters by side', () => {
    const booking = makeBooking();
    const filters = { ...DEFAULT_BOOKING_FILTERS, side: 'sud' as const };
    expect(bookingMatchesFilters(booking, makeUmbrella({ side: 'nord' }), undefined, filters, today)).toBe(false);
    expect(bookingMatchesFilters(booking, makeUmbrella({ side: 'sud' }), undefined, filters, today)).toBe(true);
  });
});
