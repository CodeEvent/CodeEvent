import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
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
} from '../data/seed';
import {
  Article,
  Booking,
  Conto,
  Customer,
  DailyStat,
  PriceList,
  Umbrella,
} from '../types';
import { isoDate } from '../utils/format';
import { safeGetItem, safeSetItem } from '../utils/safeStorage';
import {
  articleToRow,
  bookingToRow,
  contoToRow,
  customerToRow,
  dailyStatToRow,
  priceListToRow,
  rowToArticle,
  rowToBooking,
  rowToConto,
  rowToCustomer,
  rowToDailyStat,
  rowToPriceList,
  rowToUmbrella,
  umbrellaToRow,
} from './supabaseMappers';

const STORAGE_KEY = 'topspiagge:v1';

// Fire-and-forget Supabase write: local state is already updated optimistically by the time
// this runs, so a failure here just means this device's change hasn't reached the shared
// database yet (it'll retry on the next action) rather than blocking the UI.
function runSync(promise: PromiseLike<{ error: unknown }> | Promise<any>) {
  Promise.resolve(promise).then((res: any) => {
    if (res?.error) console.warn('Supabase sync failed:', res.error);
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
    hydrated: false,
  };
}

type Action =
  | { type: 'HYDRATE'; payload: AppState }
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
  | { type: 'CLOSE_CONTO'; conto: Conto }
  | { type: 'RENAME_ZONE'; row: number; name: string }
  | { type: 'REORDER_ZONE'; row: number; direction: 'up' | 'down' }
  | { type: 'REMOVE_UMBRELLA'; umbrellaId: string }
  | { type: 'REORDER_UMBRELLA'; umbrellaId: string; direction: 'left' | 'right' }
  | { type: 'UPDATE_UMBRELLA'; umbrellaId: string; patch: Partial<Pick<Umbrella, 'number' | 'hasCabin'>> }
  | { type: 'ASSIGN_CUSTOMER'; umbrellaId: string; customerId?: string }
  // Applied when a change from another client arrives over Supabase Realtime. Kept separate
  // from the actions above (which also drive this client's own Supabase writes) so a remote
  // echo of our own change is just an idempotent row replace, not a re-run of side effects
  // (e.g. re-appending to a customer's bookingHistory).
  | { type: 'SYNC_UMBRELLA'; umbrella: Umbrella }
  | { type: 'SYNC_REMOVE_UMBRELLA'; umbrellaId: string }
  | { type: 'SYNC_BOOKING'; booking: Booking }
  | { type: 'SYNC_REMOVE_BOOKING'; bookingId: string }
  | { type: 'SYNC_CONTO'; conto: Conto }
  | { type: 'SYNC_DAILYSTAT'; dailyStat: DailyStat };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...action.payload, hydrated: true };

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

    case 'CLOSE_CONTO': {
      const conto = action.conto;
      const conti = [...state.conti, conto];
      const today = isoDate(0);
      const dailyStats = state.dailyStats.some((d) => d.date === today)
        ? state.dailyStats.map((d) =>
            d.date === today
              ? {
                  ...d,
                  incasso: d.incasso + conto.total,
                  presenze: d.presenze + 1,
                  bar: d.bar,
                  ombrelloni: d.ombrelloni,
                }
              : d
          )
        : [
            ...state.dailyStats,
            { date: today, incasso: conto.total, presenze: 1, bar: 0, ombrelloni: 0 },
          ];
      let umbrellas = state.umbrellas;
      if (conto.umbrellaId && conto.docType !== 'ricevuta') {
        // keep umbrella occupied for bar/restaurant-only conti; only free on explicit checkout
      }
      return { ...state, conti, dailyStats, umbrellas };
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

    default:
      return state;
  }
}

interface StoreContextValue extends AppState {
  swapUmbrellas: (fromId: string, toId: string) => void;
  createBooking: (booking: Booking) => void;
  freeUmbrella: (umbrellaId: string) => void;
  cancelBooking: (bookingId: string) => void;
  upsertCustomer: (customer: Customer) => void;
  deleteCustomer: (customerId: string) => void;
  upsertArticle: (article: Article) => void;
  deleteArticle: (articleId: string) => void;
  upsertPriceList: (priceList: PriceList) => void;
  deletePriceList: (priceListId: string) => void;
  payBooking: (bookingId: string, amount: number) => void;
  closeConto: (conto: Conto) => void;
  renameZone: (row: number, name: string) => void;
  reorderZone: (row: number, direction: 'up' | 'down') => void;
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

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Initial load: pull live data from Supabase when configured (real shared backend), otherwise
  // fall back to the original AsyncStorage-then-seed path so local dev and the Claude Artifact
  // preview (whose CSP blocks all outbound network calls, so it can never reach Supabase) keep
  // working exactly as before.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const [u, c, b, a, pl, co, ds] = await Promise.all([
            supabase.from('umbrellas').select('*'),
            supabase.from('customers').select('*'),
            supabase.from('bookings').select('*'),
            supabase.from('articles').select('*'),
            supabase.from('price_lists').select('*'),
            supabase.from('conti').select('*'),
            supabase.from('daily_stats').select('*'),
          ]);
          const failed = [u, c, b, a, pl, co, ds].find((r) => r.error);
          if (failed?.error) throw failed.error;
          if (cancelled) return;
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
  }, []);

  // Local-only persistence: skipped once Supabase is the source of truth, since re-caching the
  // whole store into AsyncStorage on every change would just be a second, redundant copy.
  useEffect(() => {
    if (!state.hydrated || isSupabaseConfigured) return;
    safeSetItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Realtime: mirror every change made by any other connected client into local state so all
  // operators (and all screens within this client) stay in sync without a manual refresh.
  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) return;
    const channel = client
      .channel('topspiagge-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'umbrellas' }, (payload: any) => {
        if (payload.eventType === 'DELETE') dispatch({ type: 'SYNC_REMOVE_UMBRELLA', umbrellaId: payload.old.id });
        else dispatch({ type: 'SYNC_UMBRELLA', umbrella: rowToUmbrella(payload.new) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload: any) => {
        if (payload.eventType === 'DELETE') dispatch({ type: 'DELETE_CUSTOMER', customerId: payload.old.id });
        else dispatch({ type: 'UPSERT_CUSTOMER', customer: rowToCustomer(payload.new) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload: any) => {
        if (payload.eventType === 'DELETE') dispatch({ type: 'SYNC_REMOVE_BOOKING', bookingId: payload.old.id });
        else dispatch({ type: 'SYNC_BOOKING', booking: rowToBooking(payload.new) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'articles' }, (payload: any) => {
        if (payload.eventType === 'DELETE') dispatch({ type: 'DELETE_ARTICLE', articleId: payload.old.id });
        else dispatch({ type: 'UPSERT_ARTICLE', article: rowToArticle(payload.new) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_lists' }, (payload: any) => {
        if (payload.eventType === 'DELETE') dispatch({ type: 'DELETE_PRICELIST', priceListId: payload.old.id });
        else dispatch({ type: 'UPSERT_PRICELIST', priceList: rowToPriceList(payload.new) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conti' }, (payload: any) => {
        if (payload.eventType !== 'DELETE') dispatch({ type: 'SYNC_CONTO', conto: rowToConto(payload.new) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_stats' }, (payload: any) => {
        if (payload.eventType !== 'DELETE') dispatch({ type: 'SYNC_DAILYSTAT', dailyStat: rowToDailyStat(payload.new) });
      })
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, []);

  const swapUmbrellas = useCallback((fromId: string, toId: string) => {
    const action: Action = { type: 'SWAP_UMBRELLAS', fromId, toId };
    const prev = stateRef.current;
    const next = reducer(prev, action);
    dispatch(action);
    if (supabase && next !== prev) {
      const from = next.umbrellas.find((u) => u.id === fromId);
      const to = next.umbrellas.find((u) => u.id === toId);
      const prevFrom = prev.umbrellas.find((u) => u.id === fromId);
      const prevTo = prev.umbrellas.find((u) => u.id === toId);
      if (from) runSync(supabase.from('umbrellas').update(umbrellaToRow(from)).eq('id', from.id));
      if (to) runSync(supabase.from('umbrellas').update(umbrellaToRow(to)).eq('id', to.id));
      const fromBooking = prevFrom?.currentBookingId && next.bookings.find((b) => b.id === prevFrom.currentBookingId);
      const toBooking = prevTo?.currentBookingId && next.bookings.find((b) => b.id === prevTo.currentBookingId);
      if (fromBooking) runSync(supabase.from('bookings').update(bookingToRow(fromBooking)).eq('id', fromBooking.id));
      if (toBooking) runSync(supabase.from('bookings').update(bookingToRow(toBooking)).eq('id', toBooking.id));
    }
  }, []);

  const createBooking = useCallback((booking: Booking) => {
    const action: Action = { type: 'CREATE_BOOKING', booking };
    const next = reducer(stateRef.current, action);
    dispatch(action);
    if (supabase) {
      runSync(supabase.from('bookings').insert(bookingToRow(booking)));
      const umbrella = next.umbrellas.find((u) => u.id === booking.umbrellaId);
      if (umbrella) runSync(supabase.from('umbrellas').update(umbrellaToRow(umbrella)).eq('id', umbrella.id));
      const customer = next.customers.find((c) => c.id === booking.customerId);
      if (customer) runSync(supabase.from('customers').update(customerToRow(customer)).eq('id', customer.id));
    }
  }, []);

  const freeUmbrella = useCallback((umbrellaId: string) => {
    dispatch({ type: 'FREE_UMBRELLA', umbrellaId });
    if (supabase) {
      runSync(
        supabase.from('umbrellas').update({ status: 'libero', current_booking_id: null }).eq('id', umbrellaId)
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
    if (client && booking) {
      const idsToRemove = booking.groupId
        ? prev.bookings.filter((b) => b.groupId === booking.groupId).map((b) => b.id)
        : [booking.id];
      runSync(client.from('bookings').delete().in('id', idsToRemove));
      const affectedUmbrellaIds = prev.umbrellas
        .filter((u) => u.currentBookingId && idsToRemove.includes(u.currentBookingId))
        .map((u) => u.id);
      affectedUmbrellaIds.forEach((id) => {
        const u = next.umbrellas.find((x) => x.id === id);
        if (u) runSync(client.from('umbrellas').update(umbrellaToRow(u)).eq('id', id));
      });
      const customer = next.customers.find((c) => c.id === booking.customerId);
      if (customer) runSync(client.from('customers').update(customerToRow(customer)).eq('id', customer.id));
    }
  }, []);

  const upsertCustomer = useCallback((customer: Customer) => {
    dispatch({ type: 'UPSERT_CUSTOMER', customer });
    if (supabase) runSync(supabase.from('customers').upsert(customerToRow(customer)));
  }, []);

  const deleteCustomer = useCallback((customerId: string) => {
    dispatch({ type: 'DELETE_CUSTOMER', customerId });
    if (supabase) runSync(supabase.from('customers').delete().eq('id', customerId));
  }, []);

  const upsertArticle = useCallback((article: Article) => {
    dispatch({ type: 'UPSERT_ARTICLE', article });
    if (supabase) runSync(supabase.from('articles').upsert(articleToRow(article)));
  }, []);

  const deleteArticle = useCallback((articleId: string) => {
    dispatch({ type: 'DELETE_ARTICLE', articleId });
    if (supabase) runSync(supabase.from('articles').delete().eq('id', articleId));
  }, []);

  const upsertPriceList = useCallback((priceList: PriceList) => {
    dispatch({ type: 'UPSERT_PRICELIST', priceList });
    if (supabase) runSync(supabase.from('price_lists').upsert(priceListToRow(priceList)));
  }, []);

  const deletePriceList = useCallback((priceListId: string) => {
    dispatch({ type: 'DELETE_PRICELIST', priceListId });
    if (supabase) runSync(supabase.from('price_lists').delete().eq('id', priceListId));
  }, []);

  const closeConto = useCallback((conto: Conto) => {
    const action: Action = { type: 'CLOSE_CONTO', conto };
    const next = reducer(stateRef.current, action);
    dispatch(action);
    if (supabase) {
      runSync(supabase.from('conti').insert(contoToRow(conto)));
      const today = isoDate(0);
      const stat = next.dailyStats.find((d) => d.date === today);
      if (stat) runSync(supabase.from('daily_stats').upsert(dailyStatToRow(stat)));
    }
  }, []);

  const payBooking = useCallback((bookingId: string, amount: number) => {
    const next = reducer(stateRef.current, { type: 'PAY_BOOKING', bookingId, amount });
    dispatch({ type: 'PAY_BOOKING', bookingId, amount });
    if (supabase) {
      const booking = next.bookings.find((b) => b.id === bookingId);
      if (booking) runSync(supabase.from('bookings').update({ paid: booking.paid }).eq('id', bookingId));
    }
  }, []);

  const renameZone = useCallback((row: number, name: string) => {
    dispatch({ type: 'RENAME_ZONE', row, name });
    if (supabase) runSync(supabase.from('umbrellas').update({ zone: name }).eq('row', row));
  }, []);

  const reorderZone = useCallback((row: number, direction: 'up' | 'down') => {
    const action: Action = { type: 'REORDER_ZONE', row, direction };
    const prev = stateRef.current;
    const next = reducer(prev, action);
    dispatch(action);
    const client = supabase;
    if (client && next !== prev) {
      const targetRow = direction === 'up' ? row - 1 : row + 1;
      const affected = prev.umbrellas.filter((u) => u.row === row || u.row === targetRow);
      affected.forEach((u) => {
        const updated = next.umbrellas.find((x) => x.id === u.id);
        if (updated) runSync(client.from('umbrellas').update({ row: updated.row }).eq('id', u.id));
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
    if (client && umbrella) {
      runSync(client.from('umbrellas').delete().eq('id', umbrellaId));
      const affectedCustomers = prev.customers.filter((c) => c.assignedUmbrellaId === umbrellaId);
      affectedCustomers.forEach((c) => {
        const updated = next.customers.find((x) => x.id === c.id);
        if (updated) runSync(client.from('customers').update(customerToRow(updated)).eq('id', c.id));
      });
    }
  }, []);

  const reorderUmbrella = useCallback((umbrellaId: string, direction: 'left' | 'right') => {
    const action: Action = { type: 'REORDER_UMBRELLA', umbrellaId, direction };
    const prev = stateRef.current;
    const next = reducer(prev, action);
    dispatch(action);
    const client = supabase;
    if (client && next !== prev) {
      const umbrella = prev.umbrellas.find((u) => u.id === umbrellaId);
      const targetCol = umbrella ? (direction === 'left' ? umbrella.col - 1 : umbrella.col + 1) : undefined;
      const neighbor =
        umbrella && targetCol !== undefined
          ? prev.umbrellas.find((u) => u.row === umbrella.row && u.col === targetCol)
          : undefined;
      [umbrellaId, neighbor?.id].filter(Boolean).forEach((id) => {
        const updated = next.umbrellas.find((x) => x.id === id);
        if (updated) runSync(client.from('umbrellas').update({ col: updated.col }).eq('id', id as string));
      });
    }
  }, []);

  const updateUmbrella = useCallback(
    (umbrellaId: string, patch: Partial<Pick<Umbrella, 'number' | 'hasCabin'>>) => {
      dispatch({ type: 'UPDATE_UMBRELLA', umbrellaId, patch });
      if (supabase) {
        const row: Record<string, unknown> = {};
        if (patch.number !== undefined) row.number = patch.number;
        if (patch.hasCabin !== undefined) row.has_cabin = patch.hasCabin;
        runSync(supabase.from('umbrellas').update(row).eq('id', umbrellaId));
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
    if (client && next !== prev) {
      const previousCustomerId = prev.umbrellas.find((u) => u.id === umbrellaId)?.assignedCustomerId;
      const previousUmbrellaId = customerId
        ? prev.customers.find((c) => c.id === customerId)?.assignedUmbrellaId
        : undefined;
      [umbrellaId, previousUmbrellaId].filter(Boolean).forEach((id) => {
        const u = next.umbrellas.find((x) => x.id === id);
        if (u) runSync(client.from('umbrellas').update(umbrellaToRow(u)).eq('id', id as string));
      });
      [customerId, previousCustomerId].filter(Boolean).forEach((id) => {
        const c = next.customers.find((x) => x.id === id);
        if (c) runSync(client.from('customers').update(customerToRow(c)).eq('id', id as string));
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
      closeConto,
      renameZone,
      reorderZone,
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
      closeConto,
      renameZone,
      reorderZone,
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
