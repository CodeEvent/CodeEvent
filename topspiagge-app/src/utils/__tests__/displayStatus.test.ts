import {
  STAGIONALE_MIN_DAYS,
  baseDisplayStatusFor,
  displayStatusFor,
  hasOutstandingBalance,
  isStagionaleBooking,
} from '../displayStatus';
import { isoDate } from '../format';
import { Booking, Umbrella } from '../../types';

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'bk-1',
    umbrellaId: 'u-1',
    customerId: 'c-1',
    dateFrom: isoDate(0),
    dateTo: isoDate(2),
    totalPrice: 100,
    deposit: 20,
    paid: 100,
    status: 'occupato',
    createdAt: isoDate(-1),
    reference: 'TS-AAAAAA',
    ...overrides,
  };
}

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
    currentBookingId: 'bk-1',
    ...overrides,
  };
}

describe('isStagionaleBooking', () => {
  it('is false just under the threshold', () => {
    const booking = makeBooking({ dateFrom: isoDate(0), dateTo: isoDate(STAGIONALE_MIN_DAYS - 1) });
    expect(isStagionaleBooking(booking)).toBe(false);
  });

  it('is true at exactly the threshold', () => {
    const booking = makeBooking({ dateFrom: isoDate(0), dateTo: isoDate(STAGIONALE_MIN_DAYS) });
    expect(isStagionaleBooking(booking)).toBe(true);
  });
});

describe('displayStatusFor priority', () => {
  const getBooking = (bookings: Record<string, Booking>) => (id?: string) => (id ? bookings[id] : undefined);

  it('libero wins when the umbrella itself is free', () => {
    const umbrella = makeUmbrella({ status: 'libero', currentBookingId: undefined });
    expect(displayStatusFor(umbrella, getBooking({}))).toBe('libero');
  });

  it('da_saldare takes priority over stagionale and sgombera', () => {
    const booking = makeBooking({ paid: 50, totalPrice: 100, dateFrom: isoDate(-40), dateTo: isoDate(0) });
    const umbrella = makeUmbrella();
    expect(displayStatusFor(umbrella, getBooking({ 'bk-1': booking }))).toBe('da_saldare');
  });

  it('stagionale wins over sgombera when fully paid', () => {
    const booking = makeBooking({ paid: 100, totalPrice: 100, dateFrom: isoDate(-40), dateTo: isoDate(0) });
    const umbrella = makeUmbrella();
    expect(displayStatusFor(umbrella, getBooking({ 'bk-1': booking }))).toBe('stagionale');
  });

  it('sgombera applies to a short, fully-paid booking checking out today', () => {
    const booking = makeBooking({ paid: 100, totalPrice: 100, dateFrom: isoDate(-2), dateTo: isoDate(0) });
    const umbrella = makeUmbrella();
    expect(displayStatusFor(umbrella, getBooking({ 'bk-1': booking }))).toBe('sgombera');
  });

  it('falls back to occupato for a short, fully-paid, still-ongoing booking', () => {
    const booking = makeBooking({ paid: 100, totalPrice: 100, dateFrom: isoDate(0), dateTo: isoDate(3) });
    const umbrella = makeUmbrella();
    expect(displayStatusFor(umbrella, getBooking({ 'bk-1': booking }))).toBe('occupato');
  });
});

describe('baseDisplayStatusFor / hasOutstandingBalance', () => {
  it('never returns da_saldare -- that is a separate dot, not a base color', () => {
    const booking = makeBooking({ paid: 50, totalPrice: 100 });
    const umbrella = makeUmbrella();
    const getBooking = (id?: string) => (id === 'bk-1' ? booking : undefined);
    expect(baseDisplayStatusFor(umbrella, getBooking)).not.toBe('da_saldare');
    expect(hasOutstandingBalance(umbrella, getBooking)).toBe(true);
  });
});
