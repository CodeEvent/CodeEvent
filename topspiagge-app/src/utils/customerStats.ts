import { Booking, Customer } from '../types';
import { daysBetween } from './format';

export interface CustomerStats {
  totalSpend: number;
  visitCount: number;
  lastVisitDate: string | null;
  avgNights: number | null;
}

// Pure derived stats computed from the bookings already in the store -- nothing here is
// persisted, so there's no new schema/column to keep in sync as bookings change.
export function computeCustomerStats(customer: Customer, bookings: Booking[]): CustomerStats {
  const own = bookings.filter((b) => b.customerId === customer.id);
  if (own.length === 0) {
    return { totalSpend: 0, visitCount: 0, lastVisitDate: null, avgNights: null };
  }
  const totalSpend = own.reduce((sum, b) => sum + b.paid, 0);
  const lastVisitDate = own.reduce((latest, b) => (b.dateTo > latest ? b.dateTo : latest), own[0].dateTo);
  const avgNights = own.reduce((sum, b) => sum + daysBetween(b.dateFrom, b.dateTo), 0) / own.length;
  return { totalSpend, visitCount: own.length, lastVisitDate, avgNights };
}
