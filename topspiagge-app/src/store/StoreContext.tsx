import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import {
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

const STORAGE_KEY = 'topspiagge:v1';

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
  return {
    umbrellas,
    bookings,
    customers,
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
  | { type: 'UPSERT_CUSTOMER'; customer: Customer }
  | { type: 'DELETE_CUSTOMER'; customerId: string }
  | { type: 'UPSERT_ARTICLE'; article: Article }
  | { type: 'DELETE_ARTICLE'; articleId: string }
  | { type: 'UPSERT_PRICELIST'; priceList: PriceList }
  | { type: 'PAY_BOOKING'; bookingId: string; amount: number }
  | { type: 'CLOSE_CONTO'; conto: Conto };

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

    case 'PAY_BOOKING': {
      const bookings = state.bookings.map((b) =>
        b.id === action.bookingId ? { ...b, paid: Math.min(b.totalPrice, b.paid + action.amount) } : b
      );
      return { ...state, bookings };
    }

    case 'CLOSE_CONTO': {
      const conto = action.conto;
      const conti = [...state.conti, conto];
      const today = new Date().toISOString().slice(0, 10);
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

    default:
      return state;
  }
}

interface StoreContextValue extends AppState {
  swapUmbrellas: (fromId: string, toId: string) => void;
  createBooking: (booking: Booking) => void;
  freeUmbrella: (umbrellaId: string) => void;
  upsertCustomer: (customer: Customer) => void;
  deleteCustomer: (customerId: string) => void;
  upsertArticle: (article: Article) => void;
  deleteArticle: (articleId: string) => void;
  upsertPriceList: (priceList: PriceList) => void;
  payBooking: (bookingId: string, amount: number) => void;
  closeConto: (conto: Conto) => void;
  getUmbrella: (id: string) => Umbrella | undefined;
  getBooking: (id?: string) => Booking | undefined;
  getCustomer: (id?: string) => Customer | undefined;
  getActivePriceList: () => PriceList;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          dispatch({ type: 'HYDRATE', payload: { ...parsed, hydrated: true } });
        } else {
          dispatch({ type: 'HYDRATE', payload: { ...buildInitialState(), hydrated: true } });
        }
      } catch {
        dispatch({ type: 'HYDRATE', payload: { ...buildInitialState(), hydrated: true } });
      }
    })();
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const swapUmbrellas = useCallback((fromId: string, toId: string) => {
    dispatch({ type: 'SWAP_UMBRELLAS', fromId, toId });
  }, []);
  const createBooking = useCallback((booking: Booking) => {
    dispatch({ type: 'CREATE_BOOKING', booking });
  }, []);
  const freeUmbrella = useCallback((umbrellaId: string) => {
    dispatch({ type: 'FREE_UMBRELLA', umbrellaId });
  }, []);
  const upsertCustomer = useCallback((customer: Customer) => {
    dispatch({ type: 'UPSERT_CUSTOMER', customer });
  }, []);
  const deleteCustomer = useCallback((customerId: string) => {
    dispatch({ type: 'DELETE_CUSTOMER', customerId });
  }, []);
  const upsertArticle = useCallback((article: Article) => {
    dispatch({ type: 'UPSERT_ARTICLE', article });
  }, []);
  const deleteArticle = useCallback((articleId: string) => {
    dispatch({ type: 'DELETE_ARTICLE', articleId });
  }, []);
  const upsertPriceList = useCallback((priceList: PriceList) => {
    dispatch({ type: 'UPSERT_PRICELIST', priceList });
  }, []);
  const closeConto = useCallback((conto: Conto) => {
    dispatch({ type: 'CLOSE_CONTO', conto });
  }, []);
  const payBooking = useCallback((bookingId: string, amount: number) => {
    dispatch({ type: 'PAY_BOOKING', bookingId, amount });
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
    const today = new Date().toISOString().slice(0, 10);
    const active = state.priceLists.find((p) => p.activeFrom <= today && today <= p.activeTo);
    return active ?? state.priceLists[0];
  }, [state.priceLists]);

  const value = useMemo<StoreContextValue>(
    () => ({
      ...state,
      swapUmbrellas,
      createBooking,
      freeUmbrella,
      upsertCustomer,
      deleteCustomer,
      upsertArticle,
      deleteArticle,
      upsertPriceList,
      payBooking,
      closeConto,
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
      upsertCustomer,
      deleteCustomer,
      upsertArticle,
      deleteArticle,
      upsertPriceList,
      payBooking,
      closeConto,
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
