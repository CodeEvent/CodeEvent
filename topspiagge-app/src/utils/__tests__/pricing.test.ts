import {
  baseUmbrellaPricePerDay,
  computeDiscounts,
  equipmentPriceDelta,
  isSameDayWalkIn,
  lateBookingDiscount,
  studentDiscount,
} from '../pricing';
import { PriceList, Umbrella } from '../../types';

function makeUmbrella(row: number, number: number): Umbrella {
  return {
    id: `u-${row}-${number}`,
    number,
    side: 'nord',
    row,
    col: number - 1,
    zone: 'Zona A',
    hasCabin: false,
    status: 'libero',
  };
}

describe('baseUmbrellaPricePerDay', () => {
  it('prices Fila 1 at 22, flat across every column', () => {
    expect(baseUmbrellaPricePerDay(makeUmbrella(0, 1))).toBe(22);
    expect(baseUmbrellaPricePerDay(makeUmbrella(0, 20))).toBe(22);
  });

  it('prices Fila 2-4 at 17', () => {
    expect(baseUmbrellaPricePerDay(makeUmbrella(1, 1))).toBe(17); // Fila 2
    expect(baseUmbrellaPricePerDay(makeUmbrella(3, 10))).toBe(17); // Fila 4
  });

  it('prices Fila 5-10 at 14', () => {
    expect(baseUmbrellaPricePerDay(makeUmbrella(4, 1))).toBe(14); // Fila 5
    expect(baseUmbrellaPricePerDay(makeUmbrella(9, 10))).toBe(14); // Fila 10
  });

  it('prices Fila 11-17 at 11', () => {
    expect(baseUmbrellaPricePerDay(makeUmbrella(10, 1))).toBe(11); // Fila 11
    expect(baseUmbrellaPricePerDay(makeUmbrella(16, 1))).toBe(11); // Fila 17
  });
});

describe('isSameDayWalkIn / lateBookingDiscount', () => {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  it('is only true when both dates are today', () => {
    expect(isSameDayWalkIn(today, today)).toBe(true);
    expect(isSameDayWalkIn(today, tomorrow)).toBe(false);
  });

  it('applies 50% off same-day bookings from 2pm onward, 0 before', () => {
    const afternoon = new Date();
    afternoon.setHours(15, 0, 0, 0);
    const morning = new Date();
    morning.setHours(9, 0, 0, 0);
    expect(lateBookingDiscount(today, today, afternoon)).toBe(0.5);
    expect(lateBookingDiscount(today, today, morning)).toBe(0);
  });

  it('never discounts a multi-day or future booking regardless of hour', () => {
    const afternoon = new Date();
    afternoon.setHours(15, 0, 0, 0);
    expect(lateBookingDiscount(today, tomorrow, afternoon)).toBe(0);
  });
});

describe('studentDiscount', () => {
  const today = new Date().toISOString().slice(0, 10);
  const backRow = makeUmbrella(16, 1); // Fila 17 of a 17-row beach
  const frontRow = makeUmbrella(0, 1);

  it('only applies for students, same-day, on Monday, in the back two rows', () => {
    const monday = new Date('2024-01-01T15:00:00'); // a Monday
    expect(studentDiscount(today, today, backRow, true, monday)).toBe(0.2);
    expect(studentDiscount(today, today, backRow, false, monday)).toBe(0);
    expect(studentDiscount(today, today, frontRow, true, monday)).toBe(0);
  });

  it('is 0 on any other day of the week', () => {
    const tuesday = new Date('2024-01-02T15:00:00');
    expect(studentDiscount(today, today, backRow, true, tuesday)).toBe(0);
  });
});

describe('computeDiscounts', () => {
  it('stacks late-booking and student discounts up to 0.7', () => {
    const today = new Date().toISOString().slice(0, 10);
    const monday = new Date('2024-01-01T15:00:00');
    const backRow = makeUmbrella(16, 1);
    const breakdown = computeDiscounts(today, today, backRow, true, monday);
    expect(breakdown.lateBooking).toBe(0.5);
    expect(breakdown.student).toBe(0.2);
    expect(breakdown.total).toBeCloseTo(0.7);
  });
});

describe('equipmentPriceDelta', () => {
  const priceList: PriceList = {
    id: 'pl-1',
    name: 'Test',
    season: 'alta',
    prices: { 'art-lettino': 6, 'art-sdraio': 4 },
    activeFrom: '2024-06-01',
    activeTo: '2024-09-01',
  };

  it('charges the plain per-day rate for the whole stay', () => {
    expect(equipmentPriceDelta(priceList, 3, 1, 1)).toBeCloseTo(30); // (6+4)*3
  });

  it('falls back to default rates when the price list has no override', () => {
    const emptyList: PriceList = { ...priceList, prices: {} };
    expect(equipmentPriceDelta(emptyList, 1, 1, 0)).toBeCloseTo(6);
  });
});
