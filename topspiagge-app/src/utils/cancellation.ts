import { toDateKey } from './format';

export const DEPOSIT_RATE = 0.2;
export const REFUND_CUTOFF_DAYS = 7;

export function daysUntil(dateFrom: string, today: string): number {
  const a = new Date(today + 'T00:00:00').getTime();
  const b = new Date(dateFrom + 'T00:00:00').getTime();
  return Math.round((b - a) / 86400000);
}

export function isDepositRefundable(dateFrom: string, today: string): boolean {
  return daysUntil(dateFrom, today) >= REFUND_CUTOFF_DAYS;
}

export function refundCutoffDate(dateFrom: string): string {
  const d = new Date(dateFrom + 'T00:00:00');
  d.setDate(d.getDate() - REFUND_CUTOFF_DAYS);
  return toDateKey(d);
}
