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
  // A cancelled booking (see Booking.cancelled) never happened, so it's excluded here even
  // though it's kept in the raw history list the caller passes in for display.
  const own = bookings.filter((b) => b.customerId === customer.id && !b.cancelled);
  if (own.length === 0) {
    return { totalSpend: 0, visitCount: 0, lastVisitDate: null, avgNights: null };
  }
  const totalSpend = own.reduce((sum, b) => sum + b.paid, 0);
  const lastVisitDate = own.reduce((latest, b) => (b.dateTo > latest ? b.dateTo : latest), own[0].dateTo);
  const avgNights = own.reduce((sum, b) => sum + daysBetween(b.dateFrom, b.dateTo), 0) / own.length;
  // A multi-umbrella group booking (see Booking.groupId) is one visit split across several
  // Booking records -- count distinct groups (falling back to the booking's own id when it's
  // not part of a group) so a family booking 2 umbrellas together isn't tallied as 2 visits.
  const visitCount = new Set(own.map((b) => b.groupId ?? b.id)).size;
  return { totalSpend, visitCount, lastVisitDate, avgNights };
}
