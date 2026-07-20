// Core domain types for Top Spiagge

export type UmbrellaStatus = 'libero' | 'occupato' | 'in_arrivo' | 'prenotato';

export type Zone = string;

export type BeachSide = 'nord' | 'sud';

export interface Umbrella {
  id: string;
  number: number;
  side: BeachSide; // which half of the beach ("Lato Nord" / "Lato Sud")
  row: number; // grid row (0-indexed), local to its side -- one row = one "fila"
  col: number; // grid col (0-indexed, position within the row)
  zone: Zone;
  hasCabin: boolean;
  status: UmbrellaStatus;
  currentBookingId?: string;
  assignedCustomerId?: string; // seasonal/permanent subscriber ("abbonato"), independent of dated bookings
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  vip: boolean;
  bookingHistory: string[]; // booking ids
  assignedUmbrellaId?: string; // reverse pointer of Umbrella.assignedCustomerId
  createdAt: string;
}

export type PaymentMethod = 'contanti' | 'carta' | 'misto';

export interface GuestCount {
  adults: number;
  children5to15: number;
  childrenUnder5: number;
}

export interface Booking {
  id: string;
  umbrellaId: string;
  customerId: string;
  dateFrom: string; // ISO date (yyyy-mm-dd)
  dateTo: string; // ISO date (yyyy-mm-dd)
  totalPrice: number;
  deposit: number;
  paid: number;
  status: UmbrellaStatus;
  createdAt: string;
  guests?: GuestCount;
  beds?: number; // lettini booked for this umbrella
  chairs?: number; // sdraio booked for this umbrella
  groupId?: string; // links sibling bookings made together for a party > 4 adults, spread across umbrellas
}

export type ArticleCategory =
  | 'ombrellone'
  | 'cabina'
  | 'parcheggio'
  | 'pedalo'
  | 'bar'
  | 'ristorante'
  | 'servizio';

export interface Article {
  id: string;
  name: string;
  category: ArticleCategory;
  basePrice: number;
  unit: string; // 'giorno' | 'pz' | 'ora'
}

export type Season = 'bassa' | 'media' | 'alta';

export interface PriceList {
  id: string;
  name: string;
  season: Season;
  prices: Record<string, number>; // articleId -> price override
  activeFrom: string;
  activeTo: string;
}

export interface ContoItem {
  articleId: string;
  qty: number;
  unitPrice: number;
}

export type DocType = 'scontrino' | 'fattura' | 'ricevuta';

export interface Conto {
  id: string;
  umbrellaId?: string;
  customerId?: string;
  items: ContoItem[];
  total: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  docType: DocType;
  splitCount: number;
  createdAt: string;
  closed: boolean;
}

export interface DailyStat {
  date: string; // yyyy-mm-dd
  incasso: number;
  presenze: number;
  bar: number;
  ombrelloni: number;
}
