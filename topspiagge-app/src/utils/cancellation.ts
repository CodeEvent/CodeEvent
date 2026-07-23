import { toDateKey } from './format';

// Booking is paid in full at the time of booking (no partial deposit + balance-at-the-beach
// split anymore) -- matches spiagge.it's "Pagamento anticipato" policy.
export const PREPAYMENT_RATE = 1;
// Cancelling at least this many days before arrival earns a voucher refund (see
// StoreContext.tsx's grantVoucher); cancelling later, or not showing up, forfeits it.
export const REFUND_CUTOFF_DAYS = 2;

export function daysUntil(dateFrom: string, today: string): number {
  const a = new Date(today + 'T00:00:00').getTime();
  const b = new Date(dateFrom + 'T00:00:00').getTime();
  return Math.round((b - a) / 86400000);
}

export function isRefundEligible(dateFrom: string, today: string): boolean {
  return daysUntil(dateFrom, today) >= REFUND_CUTOFF_DAYS;
}

export function refundCutoffDate(dateFrom: string): string {
  const d = new Date(dateFrom + 'T00:00:00');
  d.setDate(d.getDate() - REFUND_CUTOFF_DAYS);
  return toDateKey(d);
}
