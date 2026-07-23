import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  applySeasonalAssignments,
  buildArticles,
  buildBookings,
  buildContiStorico,
  buildCustomers,
  buildDailyStats,
  buildPriceLists,
  buildUmbrellas,
  COLS_PER_SIDE,
  TOTAL_COLS,
} from '../data/seed';
import {
  Article,
  Booking,
  Conto,
  Customer,
  DailyStat,
  EquipmentChange,
  LayoutElement,
  PaymentMethod,
  PriceList,
  Umbrella,
} from '../types';
import { daysBetween, isoDate } from '../utils/format';
import { equipmentPriceDelta } from '../utils/pricing';
import { safeGetItem, safeSetItem } from '../utils/safeStorage';
import {
  articleToRow,
  bookingToRow,
  contoToRow,
  customerToRow,
  dailyStatToRow,
  equipmentChangeToRow,
  priceListToRow,
  rowToArticle,
  rowToBooking,
  rowToConto,
  rowToCustomer,
  rowToDailyStat,
  rowToEquipmentChange,
  rowToPriceList,
  rowToUmbrella,
  umbrellaToRow,
} from './supabaseMappers';

const STORAGE_KEY = 'topspiagge:v1';

// Fire-and-forget Supabase write: local state is already updated optimistically by the time
// this runs, so a failure here just means this device's change hasn't reached the shared
// database yet (it'll retry on the next action) rather than blocking the UI.
function runSync(promise: PromiseLike<{ error: unknown }> | Promise<any>, onError?: (error: any) => void) {
  Promise.resolve(promise).then((res: any) => {
    if (res?.error) {
      console.warn('Supabase sync failed:', res.error);
      onError?.(res.error);
    }
  });
}

interface AppState {
  umbrellas: Umbrella[];
  bookings: Booking[];
  customers: Customer[];
  articles: Article[];
  priceLists: PriceList[];
  conti: Conto[];
  dailyStats: DailyStat[];
  layoutElements: LayoutElement[];
  equipmentChanges: EquipmentChange[];
  hydrated: boolean;
}

function buildInitialState(): AppState {
  const umbrellas = buildUmbrellas();
  const customers = buildCustomers();
  const bookings = buildBookings(umbrellas, customers);
  applySeasonalAssignments(umbrellas, customers);
  return {
    umbrellas,
    customers,
    bookings,
    articles: buildArticles(),
    priceLists: buildPriceLists(),
    conti: buildContiStorico(),
    dailyStats: buildDailyStats(),
    layoutElements: [],
    equipmentChanges: [],
    hydrated: false,
  };
}

type Action =
  | { type: 'HYDRATE'; payload: AppState }
  | { type: 'ADD_ROW'; umbrellas: Umbrella[] }
  | { type: 'SWAP_POSITIONS'; aId: string; bId: string }
  | { type: 'SWAP_UMBRELLAS'; fromId: string; toId: string }
  | { type: 'CREATE_BOOKING'; booking: Booking }
  | { type: 'FREE_UMBRELLA'; umbrellaId: string }
  | { type: 'CANCEL_BOOKING'; bookingId: string }
  | { type: 'UPSERT_CUSTOMER'; customer: Customer }
  | { type: 'DELETE_CUSTOMER'; customerId: string }
  | { type: 'UPSERT_ARTICLE'; article: Article }
  | { type: 'DELETE_ARTICLE'; articleId: string }
  | { type: 'UPSERT_PRICELIST'; priceList: PriceList }
  | { type: 'DELETE_PRICELIST'; priceListId: string }
  | { type: 'PAY_BOOKING'; bookingId: string; amount: number }
  | { type: 'UPDATE_BOOKING_EQUIPMENT'; bookingId: string; beds: number; chairs: number; priceDelta: number }
  | { type: 'REQUEST_EQUIPMENT_ADD'; change: EquipmentChange }
  | { type: 'CANCEL_EQUIPMENT_ADD'; changeId: string }
  | {
      type: 'CONFIRM_EQUIPMENT_ADD';
      changeId: string;
      bookingId: string;
      beds: number;
      chairs: number;
      priceDelta: number;
      conto: Conto;
    }
  | {
      type: 'REMOVE_EQUIPMENT_REFUND';
      bookingId: string;
      beds: number;
      chairs: number;
      priceDelta: number;
      refundAmount: number;
      change: EquipmentChange;
      conto: Conto;
    }
  | { type: 'RESOLVE_EQUIPMENT_CHANGE'; changeId: string }
  | { type: 'CONFIRM_CHECK_IN'; bookingId: string; checkedInAt: string }
  | { type: 'CLOSE_CONTO'; conto: Conto }
  | { type: 'RENAME_ZONE'; row: number; name: string }
  | { type: 'REORDER_ZONE'; row: number; direction: 'up' | 'down' }
  | { type: 'REMOVE_UMBRELLA'; umbrellaId: string }
  | { type: 'REORDER_UMBRELLA'; umbrellaId: string; direction: 'left' | 'right' }
  | { type: 'UPDATE_UMBRELLA'; umbrellaId: string; patch: Partial<Pick<Umbrella, 'number' | 'hasCabin'>> }
  | { type: 'ASSIGN_CUSTOMER'; umbrellaId: string; customerId?: string }
  | { type: 'SET_LAYOUT_ELEMENTS'; layoutElements: LayoutElement[] }
  | { type: 'ADD_LAYOUT_ELEMENT'; element: LayoutElement }
  | { type: 'UPDATE_LAYOUT_ELEMENT'; id: string; patch: Partial<Omit<LayoutElement, 'id' | 'type'>> }
  | { type: 'DELETE_LAYOUT_ELEMENT'; id: string }
  // Applied when a change from another client arrives over Supabase Realtime. Kept separate
  // from the actions above (which also drive this client's own Supabase writes) so a remote
  // echo of our own change is just an idempotent row replace, not a re-run of side effects
  // (e.g. re-appending to a customer's bookingHistory).
  | { type: 'SYNC_UMBRELLA'; umbrella: Umbrella }
  | { type: 'SYNC_REMOVE_UMBRELLA'; umbrellaId: string }
  | { type: 'SYNC_BOOKING'; booking: Booking }
  | { type: 'SYNC_REMOVE_BOOKING'; bookingId: string }
  | { type: 'SYNC_CONTO'; conto: Conto }
  | { type: 'SYNC_DAILYSTAT'; dailyStat: DailyStat }
  | { type: 'SYNC_EQUIPMENT_CHANGE'; change: EquipmentChange }
  | { type: 'SYNC_REMOVE_EQUIPMENT_CHANGE'; changeId: string };

// Adds a revenue/presence delta to a given day's daily-stat entry (creating it if this is the
// first money-moving event of that day) -- shared by every action that changes real money
// (conto close, in-person equipment top-ups/refunds), so Statistiche reflects what actually
// happened today rather than only what went through a full Conto receipt.
function bumpDailyStat(
  dailyStats: DailyStat[],
  date: string,
  delta: { incasso?: number; presenze?: number; bar?: number; ombrelloni?: number }
): DailyStat[] {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  if (dailyStats.some((d) => d.date === date)) {
    return dailyStats.map((d) =>
      d.date === date
        ? {
            ...d,
            incasso: round2(d.incasso + (delta.incasso ?? 0)),
            presenze: d.presenze + (delta.presenze ?? 0),
            bar: round2(d.bar + (delta.bar ?? 0)),
            ombrelloni: round2(d.ombrelloni + (delta.ombrelloni ?? 0)),
          }
        : d
    );
  }
  return [
    ...dailyStats,
    {
      date,
      incasso: round2(delta.incasso ?? 0),
      presenze: delta.presenze ?? 0,
      bar: round2(delta.bar ?? 0),
      ombrelloni: round2(delta.ombrelloni ?? 0),
    },
  ];
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    // Spreading action.payload alone over nothing would leave any field missing from an older
    // persisted blob (e.g. a browser that cached state from before equipmentChanges/dailyStats
    // existed) as undefined instead of falling back to a sane default -- crashing the first
    // component that does something like equipmentChanges.filter(...). Merging onto a fresh
    // buildInitialState() first guarantees every field is at least present.
    case 'HYDRATE':
      return { ...buildInitialState(), ...action.payload, hydrated: true };

    case 'ADD_ROW':
      return { ...state, umbrellas: [...state.umbrellas, ...action.umbrellas] };

    // Swaps two umbrellas' physical layout slot (row/col/zone) only -- unlike SWAP_UMBRELLAS,
    // this never touches status/currentBookingId/assignedCustomerId, since it's a layout-editor
    // move (drag a physical umbrella to a different spot), not a booking action.
    case 'SWAP_POSITIONS': {
      const a = state.umbrellas.find((u) => u.id === action.aId);
      const b = state.umbrellas.find((u) => u.id === action.bId);
      if (!a || !b || a.id === b.id) return state;
      const umbrellas = state.umbrellas.map((u) => {
        if (u.id === a.id) return { ...u, row: b.row, col: b.col, zone: b.zone };
        if (u.id === b.id) return { ...u, row: a.row, col: a.col, zone: a.zone };
        return u;
      });
      return { ...state, umbrellas };
    }

    case 'SWAP_UMBRELLAS': {
      const { fromId, toId } = action;
      const umbrellas = state.umbrellas.map((u) => ({ ...u }));
      const from = umbrellas.find((u) => u.id === fromId);
      const to = umbrellas.find((u) => u.id === toId);
      if (!from || !to || from.id === to.id) return state;

      const bookings = state.bookings.map((b) => ({ ...b }));
      const fromBooking = bookings.find((b) => b.id === from.currentBookingId);
      const toBooking = bookings.find((b) => b.id === to.currentBookingId);

      if (fromBooking) fromBooking.umbrellaId = to.id;
      if (toBooking) toBooking.umbrellaId = from.id;

      const tmpStatus = from.status;
      const tmpBookingId = from.currentBookingId;
      from.status = to.status;
      from.currentBookingId = to.currentBookingId;
      to.status = tmpStatus;
      to.currentBookingId = tmpBookingId;

      return { ...state, umbrellas, bookings };
    }

    case 'CREATE_BOOKING': {
      const booking = action.booking;
      const umbrellas = state.umbrellas.map((u) =>
        u.id === booking.umbrellaId
          ? { ...u, status: booking.status, currentBookingId: booking.id }
          : u
      );
      const customers = state.customers.map((c) =>
        c.id === booking.customerId
          ? { ...c, bookingHistory: [...c.bookingHistory, booking.id] }
          : c
      );
      return {
        ...state,
        umbrellas,
        customers,
        bookings: [...state.bookings, booking],
      };
    }

    case 'FREE_UMBRELLA': {
      const umbrellas = state.umbrellas.map((u) =>
        u.id === action.umbrellaId
          ? { ...u, status: 'libero' as const, currentBookingId: undefined }
          : u
      );
      return { ...state, umbrellas };
    }

    case 'CANCEL_BOOKING': {
      const booking = state.bookings.find((b) => b.id === action.bookingId);
      if (!booking) return state;
      const idsToRemove = new Set(
        booking.groupId
          ? state.bookings.filter((b) => b.groupId === booking.groupId).map((b) => b.id)
          : [booking.id]
      );
      const bookings = state.bookings.filter((b) => !idsToRemove.has(b.id));
      const umbrellas = state.umbrellas.map((u) =>
        u.currentBookingId && idsToRemove.has(u.currentBookingId)
          ? { ...u, status: 'libero' as const, currentBookingId: undefined }
          : u
      );
      const customers = state.customers.map((c) =>
        c.id === booking.customerId
          ? { ...c, bookingHistory: c.bookingHistory.filter((id) => !idsToRemove.has(id)) }
          : c
      );
      return { ...state, bookings, umbrellas, customers };
    }

    case 'UPSERT_CUSTOMER': {
      const exists = state.customers.some((c) => c.id === action.customer.id);
      const customers = exists
        ? state.customers.map((c) => (c.id === action.customer.id ? action.customer : c))
        : [...state.customers, action.customer];
      return { ...state, customers };
    }

    case 'DELETE_CUSTOMER':
      return {
        ...state,
        customers: state.customers.filter((c) => c.id !== action.customerId),
      };

    case 'UPSERT_ARTICLE': {
      const exists = state.articles.some((a) => a.id === action.article.id);
      const articles = exists
        ? state.articles.map((a) => (a.id === action.article.id ? action.article : a))
        : [...state.articles, action.article];
      return { ...state, articles };
    }

    case 'DELETE_ARTICLE':
      return {
        ...state,
        articles: state.articles.filter((a) => a.id !== action.articleId),
      };

    case 'UPSERT_PRICELIST': {
      const exists = state.priceLists.some((p) => p.id === action.priceList.id);
      const priceLists = exists
        ? state.priceLists.map((p) => (p.id === action.priceList.id ? action.priceList : p))
        : [...state.priceLists, action.priceList];
      return { ...state, priceLists };
    }

    case 'DELETE_PRICELIST':
      return {
        ...state,
        priceLists: state.priceLists.filter((p) => p.id !== action.priceListId),
      };

    case 'PAY_BOOKING': {
      const bookings = state.bookings.map((b) =>
        b.id === action.bookingId ? { ...b, paid: Math.min(b.totalPrice, b.paid + action.amount) } : b
      );
      return { ...state, bookings };
    }

    case 'UPDATE_BOOKING_EQUIPMENT': {
      const bookings = state.bookings.map((b) =>
        b.id === action.bookingId
          ? {
              ...b,
              beds: action.beds,
              chairs: action.chairs,
              totalPrice: Math.round((b.totalPrice + action.priceDelta) * 100) / 100,
            }
          : b
      );
      return { ...state, bookings };
    }

    case 'REQUEST_EQUIPMENT_ADD':
      return { ...state, equipmentChanges: [...state.equipmentChanges, action.change] };

    case 'CANCEL_EQUIPMENT_ADD':
      return {
        ...state,
        equipmentChanges: state.equipmentChanges.filter((c) => c.id !== action.changeId),
      };

    case 'CONFIRM_EQUIPMENT_ADD': {
      // The operator is confirming payment was just collected in person, so `paid` moves in
      // lockstep with `totalPrice` here -- unlike the operator's own direct Conto edits, where
      // the amount only becomes "paid" once they separately register it.
      const bookings = state.bookings.map((b) =>
        b.id === action.bookingId
          ? {
              ...b,
              beds: action.beds,
              chairs: action.chairs,
              totalPrice: Math.round((b.totalPrice + action.priceDelta) * 100) / 100,
              paid: Math.round((b.paid + action.priceDelta) * 100) / 100,
            }
          : b
      );
      const equipmentChanges = state.equipmentChanges.map((c) =>
        c.id === action.changeId ? { ...c, resolved: true } : c
      );
      const conti = [...state.conti, action.conto];
      const dailyStats = bumpDailyStat(state.dailyStats, isoDate(0), {
        incasso: action.conto.total,
        ombrelloni: action.conto.total,
      });
      return { ...state, bookings, equipmentChanges, conti, dailyStats };
    }

    case 'REMOVE_EQUIPMENT_REFUND': {
      const bookings = state.bookings.map((b) =>
        b.id === action.bookingId
          ? {
              ...b,
              beds: action.beds,
              chairs: action.chairs,
              totalPrice: Math.round((b.totalPrice + action.priceDelta) * 100) / 100,
              paid: Math.max(0, Math.round((b.paid - action.refundAmount) * 100) / 100),
            }
          : b
      );
      const conti = [...state.conti, action.conto];
      const dailyStats = bumpDailyStat(state.dailyStats, isoDate(0), {
        incasso: -action.refundAmount,
        ombrelloni: -action.refundAmount,
      });
      return {
        ...state,
        bookings,
        equipmentChanges: [...state.equipmentChanges, action.change],
        conti,
        dailyStats,
      };
    }

    case 'RESOLVE_EQUIPMENT_CHANGE':
      return {
        ...state,
        equipmentChanges: state.equipmentChanges.map((c) =>
          c.id === action.changeId ? { ...c, resolved: true } : c
        ),
      };

    case 'CONFIRM_CHECK_IN': {
      const bookings = state.bookings.map((b) =>
        b.id === action.bookingId ? { ...b, checkedInAt: action.checkedInAt } : b
      );
      return { ...state, bookings };
    }

    case 'CLOSE_CONTO': {
      const conto = action.conto;
      const conti = [...state.conti, conto];
      const today = isoDate(0);
      // Split revenue into "Spiaggia" (ombrellone-category items, plus any outstanding booking
      // balance settled here) vs "Bar" (everything else) so Statistiche's sector chart reflects
      // this specific conto instead of never moving past its seeded historical split.
      const itemsTotal = conto.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
      const balancePortion = conto.total - itemsTotal;
      const ombrelloneItemsTotal = conto.items.reduce((sum, i) => {
        const article = state.articles.find((a) => a.id === i.articleId);
        return article?.category === 'ombrellone' ? sum + i.qty * i.unitPrice : sum;
      }, 0);
      const ombrelloniDelta = balancePortion + ombrelloneItemsTotal;
      const barDelta = itemsTotal - ombrelloneItemsTotal;
      const dailyStats = bumpDailyStat(state.dailyStats, today, {
        incasso: conto.total,
        presenze: 1,
        ombrelloni: ombrelloniDelta,
        bar: barDelta,
      });
      // Only articles with a tracked stock count (a number, not null/undefined) get decremented --
      // untracked articles are treated as unlimited, matching Article.stock's documented meaning.
      const soldQtyByArticle = new Map<string, number>();
      for (const i of conto.items) {
        soldQtyByArticle.set(i.articleId, (soldQtyByArticle.get(i.articleId) ?? 0) + i.qty);
      }
      const articles = soldQtyByArticle.size
        ? state.articles.map((a) => {
            const sold = soldQtyByArticle.get(a.id);
            if (!sold || a.stock == null) return a;
            return { ...a, stock: Math.max(0, a.stock - sold) };
          })
        : state.articles;
      return { ...state, conti, dailyStats, articles };
    }

    case 'RENAME_ZONE': {
      const umbrellas = state.umbrellas.map((u) =>
        u.row === action.row ? { ...u, zone: action.name } : u
      );
      return { ...state, umbrellas };
    }

    case 'REORDER_ZONE': {
      const targetRow = action.direction === 'up' ? action.row - 1 : action.row + 1;
      const rows = new Set(state.umbrellas.map((u) => u.row));
      if (!rows.has(targetRow)) return state;
      const umbrellas = state.umbrellas.map((u) => {
        if (u.row === action.row) return { ...u, row: targetRow };
        if (u.row === targetRow) return { ...u, row: action.row };
        return u;
      });
      return { ...state, umbrellas };
    }

    case 'REMOVE_UMBRELLA': {
      const umbrella = state.umbrellas.find((u) => u.id === action.umbrellaId);
      if (!umbrella) return state;
      const bookings = state.bookings.filter((b) => b.umbrellaId !== action.umbrellaId);
      const customers = state.customers.map((c) =>
        c.assignedUmbrellaId === action.umbrellaId ? { ...c, assignedUmbrellaId: undefined } : c
      );
      const umbrellas = state.umbrellas.filter((u) => u.id !== action.umbrellaId);
      return { ...state, umbrellas, bookings, customers };
    }

    case 'REORDER_UMBRELLA': {
      const umbrella = state.umbrellas.find((u) => u.id === action.umbrellaId);
      if (!umbrella) return state;
      const targetCol = action.direction === 'left' ? umbrella.col - 1 : umbrella.col + 1;
      const neighbor = state.umbrellas.find(
        (u) => u.row === umbrella.row && u.col === targetCol
      );
      if (!neighbor) return state;
      const umbrellas = state.umbrellas.map((u) => {
        if (u.id === umbrella.id) return { ...u, col: targetCol };
        if (u.id === neighbor.id) return { ...u, col: umbrella.col };
        return u;
      });
      return { ...state, umbrellas };
    }

    case 'UPDATE_UMBRELLA': {
      const umbrellas = state.umbrellas.map((u) =>
        u.id === action.umbrellaId ? { ...u, ...action.patch } : u
      );
      return { ...state, umbrellas };
    }

    case 'ASSIGN_CUSTOMER': {
      const { umbrellaId, customerId } = action;
      const umbrella = state.umbrellas.find((u) => u.id === umbrellaId);
      if (!umbrella) return state;
      const previousCustomerId = umbrella.assignedCustomerId;
      const previousUmbrellaId = customerId
        ? state.customers.find((c) => c.id === customerId)?.assignedUmbrellaId
        : undefined;

      const umbrellas = state.umbrellas.map((u) => {
        if (u.id === umbrellaId) return { ...u, assignedCustomerId: customerId };
        if (previousUmbrellaId && u.id === previousUmbrellaId) return { ...u, assignedCustomerId: undefined };
        return u;
      });
      const customers = state.customers.map((c) => {
        if (c.id === customerId) return { ...c, assignedUmbrellaId: umbrellaId };
        if (previousCustomerId && c.id === previousCustomerId) return { ...c, assignedUmbrellaId: undefined };
        return c;
      });
      return { ...state, umbrellas, customers };
    }

    case 'SYNC_UMBRELLA': {
      const exists = state.umbrellas.some((u) => u.id === action.umbrella.id);
      const umbrellas = exists
        ? state.umbrellas.map((u) => (u.id === action.umbrella.id ? action.umbrella : u))
        : [...state.umbrellas, action.umbrella];
      return { ...state, umbrellas };
    }

    case 'SYNC_REMOVE_UMBRELLA':
      return { ...state, umbrellas: state.umbrellas.filter((u) => u.id !== action.umbrellaId) };

    case 'SYNC_BOOKING': {
      const exists = state.bookings.some((b) => b.id === action.booking.id);
      const bookings = exists
        ? state.bookings.map((b) => (b.id === action.booking.id ? action.booking : b))
        : [...state.bookings, action.booking];
      return { ...state, bookings };
    }

    case 'SYNC_REMOVE_BOOKING':
      return { ...state, bookings: state.bookings.filter((b) => b.id !== action.bookingId) };

    case 'SYNC_CONTO': {
      const exists = state.conti.some((c) => c.id === action.conto.id);
      const conti = exists
        ? state.conti.map((c) => (c.id === action.conto.id ? action.conto : c))
        : [...state.conti, action.conto];
      return { ...state, conti };
    }

    case 'SYNC_DAILYSTAT': {
      const exists = state.dailyStats.some((d) => d.date === action.dailyStat.date);
      const dailyStats = exists
        ? state.dailyStats.map((d) => (d.date === action.dailyStat.date ? action.dailyStat : d))
        : [...state.dailyStats, action.dailyStat];
      return { ...state, dailyStats };
    }

    case 'SYNC_EQUIPMENT_CHANGE': {
      const exists = state.equipmentChanges.some((c) => c.id === action.change.id);
      const equipmentChanges = exists
        ? state.equipmentChanges.map((c) => (c.id === action.change.id ? action.change : c))
        : [...state.equipmentChanges, action.change];
      return { ...state, equipmentChanges };
    }

    case 'SYNC_REMOVE_EQUIPMENT_CHANGE':
      return {
        ...state,
        equipmentChanges: state.equipmentChanges.filter((c) => c.id !== action.changeId),
      };

    // Layout decorations are device-local for now (see the dedicated persistence effect below)
    // rather than synced through Supabase like everything else -- see NOTES in that effect.
    case 'SET_LAYOUT_ELEMENTS':
      return { ...state, layoutElements: action.layoutElements };

    case 'ADD_LAYOUT_ELEMENT':
      return { ...state, layoutElements: [...state.layoutElements, action.element] };

    case 'UPDATE_LAYOUT_ELEMENT':
      return {
        ...state,
        layoutElements: state.layoutElements.map((el) =>
          el.id === action.id ? { ...el, ...action.patch } : el
        ),
      };

    case 'DELETE_LAYOUT_ELEMENT':
      return { ...state, layoutElements: state.layoutElements.filter((el) => el.id !== action.id) };

    default:
      return state;
  }
}

interface StoreContextValue extends AppState {
  // The beach this store instance is scoped to -- null in local-only mode (no Supabase
  // configured) or while a Supabase-backed instance is still resolving it on mount.
  beachId: string | null;
  addRow: () => void;
  swapUmbrellaPositions: (aId: string, bId: string) => void;
  swapUmbrellas: (fromId: string, toId: string) => void;
  createBooking: (booking: Booking, onConflict?: () => void) => void;
  freeUmbrella: (umbrellaId: string) => void;
  cancelBooking: (bookingId: string) => void;
  upsertCustomer: (customer: Customer) => void;
  deleteCustomer: (customerId: string) => void;
  upsertArticle: (article: Article) => void;
  deleteArticle: (articleId: string) => void;
  upsertPriceList: (priceList: PriceList) => void;
  deletePriceList: (priceListId: string) => void;
  payBooking: (bookingId: string, amount: number) => void;
  updateBookingEquipment: (bookingId: string, beds: number, chairs: number) => void;
  requestEquipmentAdd: (bookingId: string, umbrellaId: string, deltaBeds: number, deltaChairs: number) => void;
  cancelEquipmentAdd: (changeId: string) => void;
  confirmEquipmentAdd: (changeId: string, paymentMethod: PaymentMethod) => void;
  removeEquipmentAndRefund: (bookingId: string, deltaBeds: number, deltaChairs: number) => void;
  resolveEquipmentChange: (changeId: string) => void;
  confirmCheckIn: (bookingId: string) => void;
  closeConto: (conto: Conto) => void;
  renameZone: (row: number, name: string) => void;
  reorderZone: (row: number, direction: 'up' | 'down') => void;
  addLayoutElement: (element: LayoutElement) => void;
  updateLayoutElement: (id: string, patch: Partial<Omit<LayoutElement, 'id' | 'type'>>) => void;
  deleteLayoutElement: (id: string) => void;
  removeUmbrella: (umbrellaId: string) => void;
  reorderUmbrella: (umbrellaId: string, direction: 'left' | 'right') => void;
  updateUmbrella: (umbrellaId: string, patch: Partial<Pick<Umbrella, 'number' | 'hasCabin'>>) => void;
  assignCustomer: (umbrellaId: string, customerId?: string) => void;
  getUmbrella: (id: string) => Umbrella | undefined;
  getBooking: (id?: string) => Booking | undefined;
  getCustomer: (id?: string) => Customer | undefined;
  getActivePriceList: () => PriceList;
}

const StoreContext = createContext<StoreContextValue | null>(null);

interface StoreProviderProps {
  children: React.ReactNode;
  // Set only by the customer-facing route (resolved from the /:beachSlug URL segment) so its
  // store instance knows which beach to read/write without any login. The operator route omits
  // this and instead resolves its beach from the logged-in user's beach_operators membership --
  // see the initial-load effect below. Ignored entirely in local-only (no Supabase) mode.
  beachSlug?: string;
}

export const StoreProvider: React.FC<StoreProviderProps> = ({ children, beachSlug }) => {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Resolved once per mount (see beachIdRef note below on why write actions need a ref, not
  // just this state) and reused for every read/write filter and the realtime subscription.
  const [beachId, setBeachId] = useState<string | null>(null);
  const beachIdRef = useRef<string | null>(null);
  useEffect(() => {
    beachIdRef.current = beachId;
  }, [beachId]);

  // Initial load: pull live data from Supabase when configured (real shared backend), otherwise
  // fall back to the original AsyncStorage-then-seed path so local dev and the Claude Artifact
  // preview (whose CSP blocks all outbound network calls, so it can never reach Supabase) keep
  // working exactly as before.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          let resolvedBeachId: string | null = null;
          if (beachSlug) {
            const { data, error } = await supabase.from('beaches').select('id').eq('slug', beachSlug).maybeSingle();
            if (error) throw error;
            resolvedBeachId = data?.id ?? null;
          } else {
            const { data: sessionData } = await supabase.auth.getSession();
            const uid = sessionData.session?.user.id;
            if (uid) {
              const { data, error } = await supabase
                .from('beach_operators')
                .select('beach_id')
                .eq('user_id', uid)
                .limit(1)
                .maybeSingle();
              if (error) throw error;
              resolvedBeachId = data?.beach_id ?? null;
            }
          }
          if (!resolvedBeachId) {
            throw new Error(
              beachSlug
                ? `No beach found for slug "${beachSlug}"`
                : 'Logged-in user has no beach_operators membership'
            );
          }
          const [u, c, b, a, pl, co, ds, ec] = await Promise.all([
            supabase.from('umbrellas').select('*').eq('beach_id', resolvedBeachId),
            supabase.from('customers').select('*').eq('beach_id', resolvedBeachId),
            supabase.from('bookings').select('*').eq('beach_id', resolvedBeachId),
            supabase.from('articles').select('*').eq('beach_id', resolvedBeachId),
            supabase.from('price_lists').select('*').eq('beach_id', resolvedBeachId),
            supabase.from('conti').select('*').eq('beach_id', resolvedBeachId),
            supabase.from('daily_stats').select('*').eq('beach_id', resolvedBeachId),
            supabase.from('equipment_changes').select('*').eq('beach_id', resolvedBeachId),
          ]);
          const failed = [u, c, b, a, pl, co, ds, ec].find((r) => r.error);
          if (failed?.error) throw failed.error;
          if (cancelled) return;
          setBeachId(resolvedBeachId);
          dispatch({
            type: 'HYDRATE',
            payload: {
              umbrellas: (u.data ?? []).map(rowToUmbrella),
              customers: (c.data ?? []).map(rowToCustomer),
              bookings: (b.data ?? []).map(rowToBooking),
              articles: (a.data ?? []).map(rowToArticle),
              priceLists: (pl.data ?? []).map(rowToPriceList),
              conti: (co.data ?? []).map(rowToConto),
              dailyStats: (ds.data ?? []).map(rowToDailyStat),
              // No Supabase table yet -- restored right after by the dedicated local-storage
              // effect below (layout decorations are device-local for now even in Supabase mode).
              layoutElements: [],
              equipmentChanges: (ec.data ?? []).map(rowToEquipmentChange),
              hydrated: true,
            },
          });
          return;
        } catch (err) {
          console.warn('Supabase initial load failed, falling back to local seed data:', err);
        }
      }
      const raw = await safeGetItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (!cancelled) dispatch({ type: 'HYDRATE', payload: { ...parsed, hydrated: true } });
          return;
        } catch {
          // corrupted storage payload -- fall through to a fresh seed below
        }
      }
      if (!cancelled) dispatch({ type: 'HYDRATE', payload: { ...buildInitialState(), hydrated: true } });
    })();
    return () => {
      cancelled = true;
    };
  }, [beachSlug]);

  // Local-only persistence: skipped once Supabase is the source of truth, since re-caching the
  // whole store into AsyncStorage on every change would just be a second, redundant copy.
  useEffect(() => {
    if (!state.hydrated || isSupabaseConfigured) return;
    safeSetItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Layout decorations (walkways, bar, entry, shapes, ...) have no Supabase table yet, so they're
  // kept in their own small device-local cache -- independent of the big STORAGE_KEY blob above,
  // which is skipped entirely once Supabase is configured. Keyed by beach so switching beaches in
  // the same browser session (via beachSlug) doesn't leak one beach's layout into another's.
  const layoutStorageKey = `topspiagge:layout:${beachId ?? 'local'}`;
  useEffect(() => {
    (async () => {
      const raw = await safeGetItem(layoutStorageKey);
      if (!raw) return;
      try {
        dispatch({ type: 'SET_LAYOUT_ELEMENTS', layoutElements: JSON.parse(raw) });
      } catch {
        // corrupted cache -- ignore, starts from an empty layout
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutStorageKey]);
  useEffect(() => {
    if (!state.hydrated) return;
    safeSetItem(layoutStorageKey, JSON.stringify(state.layoutElements));
  }, [state.layoutElements, state.hydrated, layoutStorageKey]);

  // Realtime: mirror every change made by any other connected client into local state so all
  // operators (and all screens within this client) stay in sync without a manual refresh. Each
  // subscription is filtered to this store's own beach_id -- without that filter every beach's
  // changes would be delivered to every other beach's clients once more than one tenant exists.
  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client || !beachId) return;
    const beachFilter = `beach_id=eq.${beachId}`;
    const channel = client
      .channel(`topspiagge-sync-${beachId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'umbrellas', filter: beachFilter },
        (payload: any) => {
          if (payload.eventType === 'DELETE') dispatch({ type: 'SYNC_REMOVE_UMBRELLA', umbrellaId: payload.old.id });
          else dispatch({ type: 'SYNC_UMBRELLA', umbrella: rowToUmbrella(payload.new) });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers', filter: beachFilter },
        (payload: any) => {
          if (payload.eventType === 'DELETE') dispatch({ type: 'DELETE_CUSTOMER', customerId: payload.old.id });
          else dispatch({ type: 'UPSERT_CUSTOMER', customer: rowToCustomer(payload.new) });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: beachFilter },
        (payload: any) => {
          if (payload.eventType === 'DELETE') dispatch({ type: 'SYNC_REMOVE_BOOKING', bookingId: payload.old.id });
          else dispatch({ type: 'SYNC_BOOKING', booking: rowToBooking(payload.new) });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'articles', filter: beachFilter },
        (payload: any) => {
          if (payload.eventType === 'DELETE') dispatch({ type: 'DELETE_ARTICLE', articleId: payload.old.id });
          else dispatch({ type: 'UPSERT_ARTICLE', article: rowToArticle(payload.new) });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'price_lists', filter: beachFilter },
        (payload: any) => {
          if (payload.eventType === 'DELETE') dispatch({ type: 'DELETE_PRICELIST', priceListId: payload.old.id });
          else dispatch({ type: 'UPSERT_PRICELIST', priceList: rowToPriceList(payload.new) });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conti', filter: beachFilter },
        (payload: any) => {
          if (payload.eventType !== 'DELETE') dispatch({ type: 'SYNC_CONTO', conto: rowToConto(payload.new) });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_stats', filter: beachFilter },
        (payload: any) => {
          if (payload.eventType !== 'DELETE') dispatch({ type: 'SYNC_DAILYSTAT', dailyStat: rowToDailyStat(payload.new) });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'equipment_changes', filter: beachFilter },
        (payload: any) => {
          if (payload.eventType === 'DELETE')
            dispatch({ type: 'SYNC_REMOVE_EQUIPMENT_CHANGE', changeId: payload.old.id });
          else dispatch({ type: 'SYNC_EQUIPMENT_CHANGE', change: rowToEquipmentChange(payload.new) });
        }
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [beachId]);

  // Appends one fresh row of 20 umbrellas (10 nord + 10 sud, no cabins, all libero) -- the only
  // way to grow a layout beyond what the seed script created, needed so a brand-new beach
  // (which starts with zero umbrellas) has something to build from in Disposizione.
  const addRow = useCallback(() => {
    const prev = stateRef.current;
    const maxRow = prev.umbrellas.length ? Math.max(...prev.umbrellas.map((u) => u.row)) : -1;
    const newRow = maxRow + 1;
    const maxIdNum = prev.umbrellas.length
      ? Math.max(...prev.umbrellas.map((u) => parseInt(u.id.replace(/^u-/, ''), 10) || 0))
      : 0;
    const newUmbrellas: Umbrella[] = [];
    for (let col = 0; col < TOTAL_COLS; col++) {
      newUmbrellas.push({
        id: `u-${maxIdNum + col + 1}`,
        number: col + 1,
        side: col < COLS_PER_SIDE ? 'nord' : 'sud',
        row: newRow,
        col,
        zone: `Fila ${newRow + 1}`,
        hasCabin: false,
        status: 'libero',
      });
    }
    dispatch({ type: 'ADD_ROW', umbrellas: newUmbrellas });
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId) {
      runSync(client.from('umbrellas').insert(newUmbrellas.map((u) => umbrellaToRow(u, beachId))));
    }
  }, []);

  // Drag-and-drop layout editing (Disposizione): swaps two umbrellas' row/col/zone only, never
  // their booking state -- see the SWAP_POSITIONS reducer case.
  const swapUmbrellaPositions = useCallback((aId: string, bId: string) => {
    const action: Action = { type: 'SWAP_POSITIONS', aId, bId };
    const prev = stateRef.current;
    const next = reducer(prev, action);
    dispatch(action);
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId && next !== prev) {
      const a = next.umbrellas.find((u) => u.id === aId);
      const b = next.umbrellas.find((u) => u.id === bId);
      if (a) runSync(client.from('umbrellas').update(umbrellaToRow(a, beachId)).eq('beach_id', beachId).eq('id', a.id));
      if (b) runSync(client.from('umbrellas').update(umbrellaToRow(b, beachId)).eq('beach_id', beachId).eq('id', b.id));
    }
  }, []);

  const swapUmbrellas = useCallback((fromId: string, toId: string) => {
    const action: Action = { type: 'SWAP_UMBRELLAS', fromId, toId };
    const prev = stateRef.current;
    const next = reducer(prev, action);
    dispatch(action);
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId && next !== prev) {
      const from = next.umbrellas.find((u) => u.id === fromId);
      const to = next.umbrellas.find((u) => u.id === toId);
      const prevFrom = prev.umbrellas.find((u) => u.id === fromId);
      const prevTo = prev.umbrellas.find((u) => u.id === toId);
      if (from) runSync(client.from('umbrellas').update(umbrellaToRow(from, beachId)).eq('beach_id', beachId).eq('id', from.id));
      if (to) runSync(client.from('umbrellas').update(umbrellaToRow(to, beachId)).eq('beach_id', beachId).eq('id', to.id));
      const fromBooking = prevFrom?.currentBookingId && next.bookings.find((b) => b.id === prevFrom.currentBookingId);
      const toBooking = prevTo?.currentBookingId && next.bookings.find((b) => b.id === prevTo.currentBookingId);
      if (fromBooking)
        runSync(client.from('bookings').update(bookingToRow(fromBooking, beachId)).eq('beach_id', beachId).eq('id', fromBooking.id));
      if (toBooking)
        runSync(client.from('bookings').update(bookingToRow(toBooking, beachId)).eq('beach_id', beachId).eq('id', toBooking.id));
    }
  }, []);

  // onConflict fires if the database's own exclusion constraint (bookings_no_overlap in
  // schema.sql) rejects this insert -- meaning another client booked the same umbrella for an
  // overlapping date range in the instant between this client's own optimistic availability
  // check and this insert landing. The optimistic local booking is rolled back so the map goes
  // back to showing the umbrella as taken, and the caller should tell the guest to pick again.
  const createBooking = useCallback((booking: Booking, onConflict?: () => void) => {
    const action: Action = { type: 'CREATE_BOOKING', booking };
    const next = reducer(stateRef.current, action);
    dispatch(action);
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId) {
      runSync(client.from('bookings').insert(bookingToRow(booking, beachId)), (error) => {
        if (error?.code === '23P01') {
          dispatch({ type: 'CANCEL_BOOKING', bookingId: booking.id });
          onConflict?.();
        }
      });
      const umbrella = next.umbrellas.find((u) => u.id === booking.umbrellaId);
      if (umbrella)
        runSync(client.from('umbrellas').update(umbrellaToRow(umbrella, beachId)).eq('beach_id', beachId).eq('id', umbrella.id));
      const customer = next.customers.find((c) => c.id === booking.customerId);
      if (customer)
        runSync(client.from('customers').update(customerToRow(customer, beachId)).eq('beach_id', beachId).eq('id', customer.id));
    }
  }, []);

  const freeUmbrella = useCallback((umbrellaId: string) => {
    dispatch({ type: 'FREE_UMBRELLA', umbrellaId });
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId) {
      runSync(
        client
          .from('umbrellas')
          .update({ status: 'libero', current_booking_id: null })
          .eq('beach_id', beachId)
          .eq('id', umbrellaId)
      );
    }
  }, []);

  const cancelBooking = useCallback((bookingId: string) => {
    const prev = stateRef.current;
    const booking = prev.bookings.find((b) => b.id === bookingId);
    const action: Action = { type: 'CANCEL_BOOKING', bookingId };
    const next = reducer(prev, action);
    dispatch(action);
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId && booking) {
      const idsToRemove = booking.groupId
        ? prev.bookings.filter((b) => b.groupId === booking.groupId).map((b) => b.id)
        : [booking.id];
      runSync(client.from('bookings').delete().eq('beach_id', beachId).in('id', idsToRemove));
      const affectedUmbrellaIds = prev.umbrellas
        .filter((u) => u.currentBookingId && idsToRemove.includes(u.currentBookingId))
        .map((u) => u.id);
      affectedUmbrellaIds.forEach((id) => {
        const u = next.umbrellas.find((x) => x.id === id);
        if (u) runSync(client.from('umbrellas').update(umbrellaToRow(u, beachId)).eq('beach_id', beachId).eq('id', id));
      });
      const customer = next.customers.find((c) => c.id === booking.customerId);
      if (customer)
        runSync(client.from('customers').update(customerToRow(customer, beachId)).eq('beach_id', beachId).eq('id', customer.id));
    }
  }, []);

  const upsertCustomer = useCallback((customer: Customer) => {
    dispatch({ type: 'UPSERT_CUSTOMER', customer });
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId) runSync(client.from('customers').upsert(customerToRow(customer, beachId)));
  }, []);

  const deleteCustomer = useCallback((customerId: string) => {
    dispatch({ type: 'DELETE_CUSTOMER', customerId });
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId) runSync(client.from('customers').delete().eq('beach_id', beachId).eq('id', customerId));
  }, []);

  const upsertArticle = useCallback((article: Article) => {
    dispatch({ type: 'UPSERT_ARTICLE', article });
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId) runSync(client.from('articles').upsert(articleToRow(article, beachId)));
  }, []);

  const deleteArticle = useCallback((articleId: string) => {
    dispatch({ type: 'DELETE_ARTICLE', articleId });
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId) runSync(client.from('articles').delete().eq('beach_id', beachId).eq('id', articleId));
  }, []);

  const upsertPriceList = useCallback((priceList: PriceList) => {
    dispatch({ type: 'UPSERT_PRICELIST', priceList });
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId) runSync(client.from('price_lists').upsert(priceListToRow(priceList, beachId)));
  }, []);

  const deletePriceList = useCallback((priceListId: string) => {
    dispatch({ type: 'DELETE_PRICELIST', priceListId });
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId) runSync(client.from('price_lists').delete().eq('beach_id', beachId).eq('id', priceListId));
  }, []);

  const closeConto = useCallback((conto: Conto) => {
    const action: Action = { type: 'CLOSE_CONTO', conto };
    const next = reducer(stateRef.current, action);
    dispatch(action);
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId) {
      runSync(client.from('conti').insert(contoToRow(conto, beachId)));
      const today = isoDate(0);
      const stat = next.dailyStats.find((d) => d.date === today);
      if (stat) runSync(client.from('daily_stats').upsert(dailyStatToRow(stat, beachId)));
      const changedArticles = next.articles.filter((a, idx) => a.stock !== stateRef.current.articles[idx]?.stock);
      for (const article of changedArticles) {
        runSync(client.from('articles').upsert(articleToRow(article, beachId)));
      }
    }
  }, []);

  const payBooking = useCallback((bookingId: string, amount: number) => {
    const next = reducer(stateRef.current, { type: 'PAY_BOOKING', bookingId, amount });
    dispatch({ type: 'PAY_BOOKING', bookingId, amount });
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId) {
      const booking = next.bookings.find((b) => b.id === bookingId);
      if (booking)
        runSync(client.from('bookings').update({ paid: booking.paid }).eq('beach_id', beachId).eq('id', bookingId));
    }
  }, []);

  // Adding beds/chairs to an already-existing booking -- from Conto's POS catalog or the
  // customer's own self-service screen. Priced at the plain per-day rate for the whole stay
  // (see equipmentPriceDelta) and folded straight into totalPrice, so the extra cost simply
  // becomes part of the same balance the operator already settles in Conto.
  const updateBookingEquipment = useCallback((bookingId: string, beds: number, chairs: number) => {
    const prev = stateRef.current;
    const booking = prev.bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    const today = isoDate(0);
    const priceList =
      prev.priceLists.find((p) => p.activeFrom <= today && today <= p.activeTo) ?? prev.priceLists[0];
    const days = daysBetween(booking.dateFrom, booking.dateTo);
    const priceDelta = equipmentPriceDelta(priceList, days, beds - (booking.beds ?? 0), chairs - (booking.chairs ?? 0));
    const action: Action = { type: 'UPDATE_BOOKING_EQUIPMENT', bookingId, beds, chairs, priceDelta };
    const next = reducer(prev, action);
    dispatch(action);
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId) {
      const updated = next.bookings.find((b) => b.id === bookingId);
      if (updated)
        runSync(
          client
            .from('bookings')
            .update({ beds: updated.beds ?? null, chairs: updated.chairs ?? null, total_price: updated.totalPrice })
            .eq('beach_id', beachId)
            .eq('id', bookingId)
        );
    }
  }, []);

  // Guest-initiated equipment change requests (from "Gestisci la mia prenotazione") -- see
  // EquipmentChange in types/index.ts for why 'add' and 'remove' behave so differently.
  const requestEquipmentAdd = useCallback(
    (bookingId: string, umbrellaId: string, deltaBeds: number, deltaChairs: number) => {
      const prev = stateRef.current;
      const booking = prev.bookings.find((b) => b.id === bookingId);
      if (!booking) return;
      const today = isoDate(0);
      const priceList =
        prev.priceLists.find((p) => p.activeFrom <= today && today <= p.activeTo) ?? prev.priceLists[0];
      const days = daysBetween(booking.dateFrom, booking.dateTo);
      const amount = equipmentPriceDelta(priceList, days, deltaBeds, deltaChairs);
      const change: EquipmentChange = {
        id: `eq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'add',
        bookingId,
        umbrellaId,
        beds: deltaBeds,
        chairs: deltaChairs,
        amount,
        createdAt: new Date().toISOString(),
        resolved: false,
      };
      dispatch({ type: 'REQUEST_EQUIPMENT_ADD', change });
      const client = supabase;
      const beachId = beachIdRef.current;
      if (client && beachId) runSync(client.from('equipment_changes').insert(equipmentChangeToRow(change, beachId)));
    },
    []
  );

  // The guest changed their mind before paying at reception -- the booking was never touched,
  // so undoing this is just dropping the request.
  const cancelEquipmentAdd = useCallback((changeId: string) => {
    dispatch({ type: 'CANCEL_EQUIPMENT_ADD', changeId });
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId)
      runSync(client.from('equipment_changes').delete().eq('beach_id', beachId).eq('id', changeId));
  }, []);

  // Operator collected the payment in person and applies it -- same booking mutation as
  // updateBookingEquipment, plus marking the request resolved so it drops off the pending list.
  const confirmEquipmentAdd = useCallback((changeId: string, paymentMethod: PaymentMethod) => {
    const prev = stateRef.current;
    const change = prev.equipmentChanges.find((c) => c.id === changeId);
    if (!change) return;
    const booking = prev.bookings.find((b) => b.id === change.bookingId);
    if (!booking) return;
    const beds = (booking.beds ?? 0) + change.beds;
    const chairs = (booking.chairs ?? 0) + change.chairs;
    // A real Conto record, not just a silent balance bump -- gives this in-person cash/card
    // collection the same receipt/audit trail as anything rung up through Conto directly, and
    // is what lets it show up correctly in Statistiche (see CONFIRM_EQUIPMENT_ADD's reducer case).
    const conto: Conto = {
      id: `conto-${Date.now()}`,
      umbrellaId: booking.umbrellaId,
      customerId: booking.customerId,
      items: [],
      total: change.amount,
      paidAmount: change.amount,
      paymentMethod,
      docType: 'ricevuta',
      splitCount: 1,
      createdAt: new Date().toISOString(),
      closed: true,
    };
    const action: Action = {
      type: 'CONFIRM_EQUIPMENT_ADD',
      changeId,
      bookingId: change.bookingId,
      beds,
      chairs,
      priceDelta: change.amount,
      conto,
    };
    const next = reducer(prev, action);
    dispatch(action);
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId) {
      const updated = next.bookings.find((b) => b.id === change.bookingId);
      if (updated)
        runSync(
          client
            .from('bookings')
            .update({
              beds: updated.beds ?? null,
              chairs: updated.chairs ?? null,
              total_price: updated.totalPrice,
              paid: updated.paid,
            })
            .eq('beach_id', beachId)
            .eq('id', change.bookingId)
        );
      runSync(client.from('equipment_changes').update({ resolved: true }).eq('beach_id', beachId).eq('id', changeId));
      runSync(client.from('conti').insert(contoToRow(conto, beachId)));
      const stat = next.dailyStats.find((d) => d.date === isoDate(0));
      if (stat) runSync(client.from('daily_stats').upsert(dailyStatToRow(stat, beachId)));
    }
  }, []);

  // The guest drops equipment themselves (only ever offered before check-in) -- unlike an add,
  // this takes effect immediately: the booking's total shrinks and whatever they'd already paid
  // toward it is refunded on the spot, so there's no "pending payment" step to gate it on.
  const removeEquipmentAndRefund = useCallback((bookingId: string, deltaBeds: number, deltaChairs: number) => {
    const prev = stateRef.current;
    const booking = prev.bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    const today = isoDate(0);
    const priceList =
      prev.priceLists.find((p) => p.activeFrom <= today && today <= p.activeTo) ?? prev.priceLists[0];
    const days = daysBetween(booking.dateFrom, booking.dateTo);
    const priceDelta = equipmentPriceDelta(priceList, days, -deltaBeds, -deltaChairs);
    const refundAmount = Math.min(booking.paid, -priceDelta);
    const beds = Math.max(0, (booking.beds ?? 0) - deltaBeds);
    const chairs = Math.max(0, (booking.chairs ?? 0) - deltaChairs);
    const change: EquipmentChange = {
      id: `eq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'remove',
      bookingId,
      umbrellaId: booking.umbrellaId,
      beds: deltaBeds,
      chairs: deltaChairs,
      amount: refundAmount,
      createdAt: new Date().toISOString(),
      resolved: false,
    };
    // A negative-total Conto record, so this self-service refund leaves the same kind of audit
    // trail a manual refund at the register would -- and Statistiche picks it up automatically.
    const conto: Conto = {
      id: `conto-${Date.now()}`,
      umbrellaId: booking.umbrellaId,
      customerId: booking.customerId,
      items: [],
      total: -refundAmount,
      paidAmount: -refundAmount,
      paymentMethod: 'misto',
      docType: 'ricevuta',
      splitCount: 1,
      createdAt: new Date().toISOString(),
      closed: true,
    };
    const action: Action = {
      type: 'REMOVE_EQUIPMENT_REFUND',
      bookingId,
      beds,
      chairs,
      priceDelta,
      refundAmount,
      change,
      conto,
    };
    const next = reducer(prev, action);
    dispatch(action);
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId) {
      const updated = next.bookings.find((b) => b.id === bookingId);
      if (updated)
        runSync(
          client
            .from('bookings')
            .update({
              beds: updated.beds ?? null,
              chairs: updated.chairs ?? null,
              total_price: updated.totalPrice,
              paid: updated.paid,
            })
            .eq('beach_id', beachId)
            .eq('id', bookingId)
        );
      runSync(client.from('equipment_changes').insert(equipmentChangeToRow(change, beachId)));
      runSync(client.from('conti').insert(contoToRow(conto, beachId)));
      const stat = next.dailyStats.find((d) => d.date === isoDate(0));
      if (stat) runSync(client.from('daily_stats').upsert(dailyStatToRow(stat, beachId)));
    }
  }, []);

  // Operator has physically taken the item away (and already handed back the refund at request
  // time) -- dismissing here just clears it off the pending-notifications list.
  const resolveEquipmentChange = useCallback((changeId: string) => {
    dispatch({ type: 'RESOLVE_EQUIPMENT_CHANGE', changeId });
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId)
      runSync(
        client.from('equipment_changes').update({ resolved: true }).eq('beach_id', beachId).eq('id', changeId)
      );
  }, []);

  const confirmCheckIn = useCallback((bookingId: string) => {
    const checkedInAt = new Date().toISOString();
    const action: Action = { type: 'CONFIRM_CHECK_IN', bookingId, checkedInAt };
    dispatch(action);
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId) {
      runSync(client.from('bookings').update({ checked_in_at: checkedInAt }).eq('beach_id', beachId).eq('id', bookingId));
    }
  }, []);

  const renameZone = useCallback((row: number, name: string) => {
    dispatch({ type: 'RENAME_ZONE', row, name });
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId) runSync(client.from('umbrellas').update({ zone: name }).eq('beach_id', beachId).eq('row', row));
  }, []);

  const addLayoutElement = useCallback((element: LayoutElement) => {
    dispatch({ type: 'ADD_LAYOUT_ELEMENT', element });
  }, []);

  const updateLayoutElement = useCallback(
    (id: string, patch: Partial<Omit<LayoutElement, 'id' | 'type'>>) => {
      dispatch({ type: 'UPDATE_LAYOUT_ELEMENT', id, patch });
    },
    []
  );

  const deleteLayoutElement = useCallback((id: string) => {
    dispatch({ type: 'DELETE_LAYOUT_ELEMENT', id });
  }, []);

  const reorderZone = useCallback((row: number, direction: 'up' | 'down') => {
    const action: Action = { type: 'REORDER_ZONE', row, direction };
    const prev = stateRef.current;
    const next = reducer(prev, action);
    dispatch(action);
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId && next !== prev) {
      const targetRow = direction === 'up' ? row - 1 : row + 1;
      const affected = prev.umbrellas.filter((u) => u.row === row || u.row === targetRow);
      affected.forEach((u) => {
        const updated = next.umbrellas.find((x) => x.id === u.id);
        if (updated) runSync(client.from('umbrellas').update({ row: updated.row }).eq('beach_id', beachId).eq('id', u.id));
      });
    }
  }, []);

  const removeUmbrella = useCallback((umbrellaId: string) => {
    const prev = stateRef.current;
    const umbrella = prev.umbrellas.find((u) => u.id === umbrellaId);
    const action: Action = { type: 'REMOVE_UMBRELLA', umbrellaId };
    const next = reducer(prev, action);
    dispatch(action);
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId && umbrella) {
      runSync(client.from('umbrellas').delete().eq('beach_id', beachId).eq('id', umbrellaId));
      const affectedCustomers = prev.customers.filter((c) => c.assignedUmbrellaId === umbrellaId);
      affectedCustomers.forEach((c) => {
        const updated = next.customers.find((x) => x.id === c.id);
        if (updated)
          runSync(client.from('customers').update(customerToRow(updated, beachId)).eq('beach_id', beachId).eq('id', c.id));
      });
    }
  }, []);

  const reorderUmbrella = useCallback((umbrellaId: string, direction: 'left' | 'right') => {
    const action: Action = { type: 'REORDER_UMBRELLA', umbrellaId, direction };
    const prev = stateRef.current;
    const next = reducer(prev, action);
    dispatch(action);
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId && next !== prev) {
      const umbrella = prev.umbrellas.find((u) => u.id === umbrellaId);
      const targetCol = umbrella ? (direction === 'left' ? umbrella.col - 1 : umbrella.col + 1) : undefined;
      const neighbor =
        umbrella && targetCol !== undefined
          ? prev.umbrellas.find((u) => u.row === umbrella.row && u.col === targetCol)
          : undefined;
      [umbrellaId, neighbor?.id].filter(Boolean).forEach((id) => {
        const updated = next.umbrellas.find((x) => x.id === id);
        if (updated)
          runSync(client.from('umbrellas').update({ col: updated.col }).eq('beach_id', beachId).eq('id', id as string));
      });
    }
  }, []);

  const updateUmbrella = useCallback(
    (umbrellaId: string, patch: Partial<Pick<Umbrella, 'number' | 'hasCabin'>>) => {
      dispatch({ type: 'UPDATE_UMBRELLA', umbrellaId, patch });
      const client = supabase;
      const beachId = beachIdRef.current;
      if (client && beachId) {
        const row: Record<string, unknown> = {};
        if (patch.number !== undefined) row.number = patch.number;
        if (patch.hasCabin !== undefined) row.has_cabin = patch.hasCabin;
        runSync(client.from('umbrellas').update(row).eq('beach_id', beachId).eq('id', umbrellaId));
      }
    },
    []
  );

  const assignCustomer = useCallback((umbrellaId: string, customerId?: string) => {
    const action: Action = { type: 'ASSIGN_CUSTOMER', umbrellaId, customerId };
    const prev = stateRef.current;
    const next = reducer(prev, action);
    dispatch(action);
    const client = supabase;
    const beachId = beachIdRef.current;
    if (client && beachId && next !== prev) {
      const previousCustomerId = prev.umbrellas.find((u) => u.id === umbrellaId)?.assignedCustomerId;
      const previousUmbrellaId = customerId
        ? prev.customers.find((c) => c.id === customerId)?.assignedUmbrellaId
        : undefined;
      [umbrellaId, previousUmbrellaId].filter(Boolean).forEach((id) => {
        const u = next.umbrellas.find((x) => x.id === id);
        if (u) runSync(client.from('umbrellas').update(umbrellaToRow(u, beachId)).eq('beach_id', beachId).eq('id', id as string));
      });
      [customerId, previousCustomerId].filter(Boolean).forEach((id) => {
        const c = next.customers.find((x) => x.id === id);
        if (c) runSync(client.from('customers').update(customerToRow(c, beachId)).eq('beach_id', beachId).eq('id', id as string));
      });
    }
  }, []);

  const getUmbrella = useCallback(
    (id: string) => state.umbrellas.find((u) => u.id === id),
    [state.umbrellas]
  );
  const getBooking = useCallback(
    (id?: string) => (id ? state.bookings.find((b) => b.id === id) : undefined),
    [state.bookings]
  );
  const getCustomer = useCallback(
    (id?: string) => (id ? state.customers.find((c) => c.id === id) : undefined),
    [state.customers]
  );
  const getActivePriceList = useCallback((): PriceList => {
    const today = isoDate(0);
    const active = state.priceLists.find((p) => p.activeFrom <= today && today <= p.activeTo);
    return active ?? state.priceLists[0];
  }, [state.priceLists]);

  const value = useMemo<StoreContextValue>(
    () => ({
      ...state,
      beachId,
      addRow,
      swapUmbrellaPositions,
      swapUmbrellas,
      createBooking,
      freeUmbrella,
      cancelBooking,
      upsertCustomer,
      deleteCustomer,
      upsertArticle,
      deleteArticle,
      upsertPriceList,
      deletePriceList,
      payBooking,
      updateBookingEquipment,
      requestEquipmentAdd,
      cancelEquipmentAdd,
      confirmEquipmentAdd,
      removeEquipmentAndRefund,
      resolveEquipmentChange,
      confirmCheckIn,
      closeConto,
      renameZone,
      reorderZone,
      addLayoutElement,
      updateLayoutElement,
      deleteLayoutElement,
      removeUmbrella,
      reorderUmbrella,
      updateUmbrella,
      assignCustomer,
      getUmbrella,
      getBooking,
      getCustomer,
      getActivePriceList,
    }),
    [
      state,
      beachId,
      addRow,
      swapUmbrellaPositions,
      swapUmbrellas,
      createBooking,
      freeUmbrella,
      cancelBooking,
      upsertCustomer,
      deleteCustomer,
      upsertArticle,
      deleteArticle,
      upsertPriceList,
      deletePriceList,
      payBooking,
      updateBookingEquipment,
      requestEquipmentAdd,
      cancelEquipmentAdd,
      confirmEquipmentAdd,
      removeEquipmentAndRefund,
      resolveEquipmentChange,
      confirmCheckIn,
      closeConto,
      renameZone,
      reorderZone,
      addLayoutElement,
      updateLayoutElement,
      deleteLayoutElement,
      removeUmbrella,
      reorderUmbrella,
      updateUmbrella,
      assignCustomer,
      getUmbrella,
      getBooking,
      getCustomer,
      getActivePriceList,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
