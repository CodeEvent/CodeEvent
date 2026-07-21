// Row (snake_case, matching supabase/schema.sql) <-> app type (camelCase) conversions.
// Kept in one place so StoreContext never touches raw Supabase rows directly.
import { Article, Booking, Conto, Customer, DailyStat, PriceList, Umbrella } from '../types';

export function rowToUmbrella(r: any): Umbrella {
  return {
    id: r.id,
    number: r.number,
    side: r.side,
    row: r.row,
    col: r.col,
    zone: r.zone,
    hasCabin: r.has_cabin,
    status: r.status,
    currentBookingId: r.current_booking_id ?? undefined,
    assignedCustomerId: r.assigned_customer_id ?? undefined,
  };
}

export function umbrellaToRow(u: Umbrella) {
  return {
    id: u.id,
    number: u.number,
    side: u.side,
    row: u.row,
    col: u.col,
    zone: u.zone,
    has_cabin: u.hasCabin,
    status: u.status,
    current_booking_id: u.currentBookingId ?? null,
    assigned_customer_id: u.assignedCustomerId ?? null,
  };
}

export function rowToCustomer(r: any): Customer {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email ?? undefined,
    notes: r.notes ?? undefined,
    vip: r.vip,
    bookingHistory: r.booking_history ?? [],
    assignedUmbrellaId: r.assigned_umbrella_id ?? undefined,
    createdAt: r.created_at,
  };
}

export function customerToRow(c: Customer) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email ?? null,
    notes: c.notes ?? null,
    vip: c.vip,
    booking_history: c.bookingHistory,
    assigned_umbrella_id: c.assignedUmbrellaId ?? null,
    created_at: c.createdAt,
  };
}

export function rowToBooking(r: any): Booking {
  return {
    id: r.id,
    umbrellaId: r.umbrella_id,
    customerId: r.customer_id,
    dateFrom: r.date_from,
    dateTo: r.date_to,
    totalPrice: Number(r.total_price),
    deposit: Number(r.deposit),
    paid: Number(r.paid),
    status: r.status,
    createdAt: r.created_at,
    guests: r.guests ?? undefined,
    beds: r.beds ?? undefined,
    chairs: r.chairs ?? undefined,
    groupId: r.group_id ?? undefined,
    reference: r.reference,
    isStudent: r.is_student ?? undefined,
  };
}

export function bookingToRow(b: Booking) {
  return {
    id: b.id,
    umbrella_id: b.umbrellaId,
    customer_id: b.customerId,
    date_from: b.dateFrom,
    date_to: b.dateTo,
    total_price: b.totalPrice,
    deposit: b.deposit,
    paid: b.paid,
    status: b.status,
    created_at: b.createdAt,
    guests: b.guests ?? null,
    beds: b.beds ?? null,
    chairs: b.chairs ?? null,
    group_id: b.groupId ?? null,
    reference: b.reference,
    is_student: b.isStudent ?? null,
  };
}

export function rowToArticle(r: any): Article {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    basePrice: Number(r.base_price),
    unit: r.unit,
  };
}

export function articleToRow(a: Article) {
  return { id: a.id, name: a.name, category: a.category, base_price: a.basePrice, unit: a.unit };
}

export function rowToPriceList(r: any): PriceList {
  return {
    id: r.id,
    name: r.name,
    season: r.season,
    prices: r.prices ?? {},
    activeFrom: r.active_from,
    activeTo: r.active_to,
  };
}

export function priceListToRow(p: PriceList) {
  return {
    id: p.id,
    name: p.name,
    season: p.season,
    prices: p.prices,
    active_from: p.activeFrom,
    active_to: p.activeTo,
  };
}

export function rowToConto(r: any): Conto {
  return {
    id: r.id,
    umbrellaId: r.umbrella_id ?? undefined,
    customerId: r.customer_id ?? undefined,
    items: r.items ?? [],
    total: Number(r.total),
    paidAmount: Number(r.paid_amount),
    paymentMethod: r.payment_method,
    docType: r.doc_type,
    splitCount: r.split_count,
    createdAt: r.created_at,
    closed: r.closed,
  };
}

export function contoToRow(c: Conto) {
  return {
    id: c.id,
    umbrella_id: c.umbrellaId ?? null,
    customer_id: c.customerId ?? null,
    items: c.items,
    total: c.total,
    paid_amount: c.paidAmount,
    payment_method: c.paymentMethod,
    doc_type: c.docType,
    split_count: c.splitCount,
    created_at: c.createdAt,
    closed: c.closed,
  };
}

export function rowToDailyStat(r: any): DailyStat {
  return {
    date: r.date,
    incasso: Number(r.incasso),
    presenze: r.presenze,
    bar: Number(r.bar),
    ombrelloni: Number(r.ombrelloni),
  };
}

export function dailyStatToRow(d: DailyStat) {
  return { date: d.date, incasso: d.incasso, presenze: d.presenze, bar: d.bar, ombrelloni: d.ombrelloni };
}
