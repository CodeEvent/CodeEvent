import { ROWS } from '../data/seed';
import { PriceList, Umbrella } from '../types';
import { isoDate } from './format';

// Flat per-row pricing -- every umbrella in a row costs the same regardless of column, and
// there's no equipment-inclusive package for any row anymore: beds/chairs are always priced
// à la carte on top of this (see perDayRate in CustomerBookingScreen/QuickBookingForm).
export function baseUmbrellaPricePerDay(umbrella: Umbrella): number {
  const fila = umbrella.row + 1;
  if (fila === 1) return 22;
  if (fila <= 4) return 17;
  if (fila <= 10) return 14;
  return 11;
}

// Friendly name for the row band a price belongs to -- mirrors baseUmbrellaPricePerDay's own
// row thresholds exactly, so the two never drift apart. Used anywhere a guest needs to see
// which "section" of the beach an umbrella's price corresponds to (the availability table on
// the booking form, the search-side results/detail pages).
export function priceBandLabel(umbrella: Umbrella): string {
  const fila = umbrella.row + 1;
  if (fila === 1) return 'Prima fila';
  if (fila <= 4) return 'Vicino al mare';
  if (fila <= 10) return 'Zona centrale';
  return 'Fila interna';
}

// Both time-based discounts only ever apply to a same-day walk-in: booked and used
// entirely today. A future-dated or multi-night booking never qualifies, regardless of
// when it's placed or who's booking it.
export function isSameDayWalkIn(dateFrom: string, dateTo: string): boolean {
  const today = isoDate(0);
  return dateFrom === today && dateTo === today;
}

export function lateBookingDiscount(dateFrom: string, dateTo: string, now: Date = new Date()): number {
  if (!isSameDayWalkIn(dateFrom, dateTo)) return 0;
  return now.getHours() >= 14 ? 0.5 : 0;
}

// The student discount is boxed into the two rows furthest from the water (Fila 16 and 17
// for a 17-row beach) and only on Mondays -- everywhere else, and every other day, it's 0
// even for a student booking same-day.
export function isStudentDiscountEligibleRow(umbrella: Umbrella, totalRows: number = ROWS): boolean {
  const fila = umbrella.row + 1;
  return fila === totalRows || fila === totalRows - 1;
}

export function studentDiscount(
  dateFrom: string,
  dateTo: string,
  umbrella: Umbrella,
  isStudent: boolean,
  now: Date = new Date()
): number {
  if (!isStudent) return 0;
  if (!isSameDayWalkIn(dateFrom, dateTo)) return 0;
  if (now.getDay() !== 1) return 0; // Monday
  if (!isStudentDiscountEligibleRow(umbrella)) return 0;
  return 0.2;
}

// Extra beds/chairs added to an *existing* booking (via Conto's POS or the customer's own
// self-service screen) are charged at the season's plain per-day rate for the whole stay --
// the Fila 1/2 bundle and same-day discounts above only ever apply to the original booking
// wizard's up-front price, never to a top-up added after the fact.
export function equipmentPriceDelta(
  priceList: PriceList,
  days: number,
  deltaBeds: number,
  deltaChairs: number
): number {
  const bedRate = priceList.prices['art-lettino'] ?? 6;
  const chairRate = priceList.prices['art-sdraio'] ?? 4;
  return Math.round((deltaBeds * bedRate + deltaChairs * chairRate) * days * 100) / 100;
}

export interface DiscountBreakdown {
  lateBooking: number; // 0 or 0.5
  student: number; // 0 or 0.2
  total: number; // the two stack -- up to 0.7 combined
}

// The two discounts are independent (different eligibility conditions) and stack when both
// apply: a student booking a back-row umbrella after 2pm on a Monday gets 70% off.
export function computeDiscounts(
  dateFrom: string,
  dateTo: string,
  umbrella: Umbrella,
  isStudent: boolean,
  now: Date = new Date()
): DiscountBreakdown {
  const lateBooking = lateBookingDiscount(dateFrom, dateTo, now);
  const student = studentDiscount(dateFrom, dateTo, umbrella, isStudent, now);
  return { lateBooking, student, total: lateBooking + student };
}
