import { ROWS } from '../data/seed';
import { Umbrella } from '../types';
import { isoDate } from './format';

export interface EquipmentBundle {
  beds: number;
  chairs: number;
}

// Umbrella numbers 1-7 and 14-20 in any row are the "special" columns -- cheaper than the
// 8-13 band straddling the Nord/Sud walkway. Fila 1 states this split outright (€30 vs €35);
// every row after that inherits the same column split, just at a lower starting price.
function isSpecialColumn(umbrellaNumber: number): boolean {
  return umbrellaNumber <= 7 || umbrellaNumber >= 14;
}

// Fila 1 and Fila 2 are the only rows sold as an equipment-inclusive package -- everywhere
// else is bare umbrella + à la carte beds/chairs at the season's standard rates.
export function bundleForUmbrella(umbrella: Umbrella): EquipmentBundle | null {
  const fila = umbrella.row + 1;
  if (fila === 1) return { beds: 2, chairs: 2 };
  if (fila === 2) return { beds: 1, chairs: 1 };
  return null;
}

// Fila 1 is a hardcoded base (€35 / €30). Every row after that follows one continuous
// -€2/row degression starting from Fila 2's values (€18 / €13), floored at €10 -- which
// lands exactly on Fila 13-17's flat €10, so the same formula covers both without a
// separate special case.
export function baseUmbrellaPricePerDay(umbrella: Umbrella): number {
  const fila = umbrella.row + 1;
  const special = isSpecialColumn(umbrella.number);
  if (fila === 1) return special ? 30 : 35;
  const filaTwoBase = special ? 13 : 18;
  return Math.max(10, filaTwoBase - 2 * (fila - 2));
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
