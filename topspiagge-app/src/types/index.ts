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
  tags: string[]; // freeform CRM segments, e.g. "famiglia", "cliente storico"
  voucherBalance?: number; // store credit granted by an eligible cancellation refund (see
  // grantVoucher in StoreContext.tsx), redeemable against the total of this customer's next booking
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
  reference: string; // short code shown to the customer, shared by every booking in the same group
  isStudent?: boolean; // self-declared, honor-system -- only ever matters for the same-day student discount
  checkedInAt?: string; // ISO datetime -- set once the operator confirms the guest at reception; while
  // unset, the customer can still freely remove equipment themselves (see EquipmentChange below)
  released?: boolean; // true once the operator has freed the umbrella (checkout done) -- the record
  // is kept for history (CRM, Archivi, Statistiche) but no longer counts as occupying the
  // calendar, so the same umbrella/date range can be booked again (see findUmbrellaConflict).
}

// A customer's request to be told when a specific umbrella/date range frees up, joined from the
// customer map when they tap an umbrella that's unavailable for their chosen dates. There's no
// "resolved"/"notified" flag: whether it currently matches is derived at render time from live
// bookings (see NotificationCenter.tsx), so a match that gets booked by someone else before the
// operator acts on it simply stops matching on its own, with no stale state to clean up.
export interface WaitlistEntry {
  id: string;
  umbrellaId: string;
  customerName: string;
  customerPhone: string;
  dateFrom: string;
  dateTo: string;
  createdAt: string;
}

// A guest-initiated change to their own booking's beds/chairs, made from "Gestisci la mia
// prenotazione" -- kept as its own append-only log (rather than mutating the booking directly
// for adds) so the operator has something concrete to act on:
//  - 'add': the guest requested more equipment but pays for it in person at reception, so the
//    booking itself is untouched until the operator collects payment and confirms the request.
//  - 'remove': the guest can drop equipment (and get refunded) themselves any time before
//    check-in -- that already updates the booking immediately, this record is purely the
//    operator's heads-up to go physically take the item away.
export type EquipmentChangeType = 'add' | 'remove';

export interface EquipmentChange {
  id: string;
  type: EquipmentChangeType;
  bookingId: string;
  umbrellaId: string;
  beds: number; // magnitude of the change (always >= 0), never both beds and chairs > 0 at once
  chairs: number;
  amount: number; // to collect at reception ('add') or already refunded to the guest ('remove')
  createdAt: string;
  resolved: boolean;
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
  stock?: number | null; // null/undefined = not tracked (unlimited); a number = units left today
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

// Free-form decorations placed by the operator on the beach layout designer (Disposizione ->
// Layout). Positioned in free x/y pixels, independent of the umbrella grid's row/col model --
// umbrellas themselves are never represented here, only the surrounding facilities/signage.
export type LayoutElementType =
  | 'walkway'
  | 'bar'
  | 'entry'
  | 'steps'
  | 'toilet'
  | 'sea'
  | 'shape-rect'
  | 'shape-circle'
  | 'label';

export interface LayoutElement {
  id: string;
  type: LayoutElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string; // used by shape-rect/shape-circle; other types have a fixed look
  label?: string; // optional custom caption shown under the icon (required content for 'label')
}
