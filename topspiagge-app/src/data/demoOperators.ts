// Static, presentation-only list for the guest-side "search nearby beach clubs" flow. Each
// `isBookable` operator gets its own independent local-fallback umbrella grid/bookings/price
// list (see StoreContext's storageKeyFor, keyed by this `id` as the beachSlug) so it's a real,
// separately-bookable beach rather than shared/aliased state; the rest still show a "coming
// soon" message when tapped, so nothing here is presented as more real than it is.
// `priceFrom` is a display-only "starting from" figure kept in sync by hand with the real base
// rate in utils/pricing.ts (Fila 1 = 22/day) -- every actual quoted cost the guest sees past
// this point (results card, detail page, availability table) still comes straight from the
// real pricing engine / active price list, never this field.
export interface DemoOperator {
  id: string;
  name: string;
  town: string;
  tagline: string;
  isBookable: boolean;
  priceFrom: number;
  rating: number;
  reviewCount: number;
  /** Purely-illustrated "photo" palette (no external image assets, drawn by BeachPhoto) --
   * gives each card/gallery tile a distinct sky/sea/sand scene per beach. */
  photo: { sky: string; sea: string; sand: string };
}

export const DEMO_OPERATORS: DemoOperator[] = [
  {
    id: 'bagno-pietrasanta',
    name: 'Bagno Pietrasanta',
    town: 'Marina di Pietrasanta',
    tagline: 'Ombrelloni in prima fila, noleggio lettini e sdraio, bar sulla spiaggia',
    isBookable: true,
    priceFrom: 22,
    rating: 4.8,
    reviewCount: 312,
    photo: { sky: '#8FE3E8', sea: '#17A2AA', sand: '#F2D9A6' },
  },
  {
    id: 'bagno-argentina',
    name: 'Bagno Argentina',
    town: 'Forte dei Marmi',
    tagline: 'Stabilimento storico con ristorante vista mare',
    isBookable: true,
    priceFrom: 28,
    rating: 4.6,
    reviewCount: 187,
    photo: { sky: '#A9C6E8', sea: '#3D6FA8', sand: '#EAD6B0' },
  },
  {
    id: 'bagno-roma',
    name: 'Bagno Roma',
    town: 'Marina di Pietrasanta',
    tagline: 'Ideale per famiglie, area giochi bambini',
    isBookable: true,
    priceFrom: 18,
    rating: 4.5,
    reviewCount: 96,
    photo: { sky: '#FFE0B2', sea: '#4FB3BF', sand: '#F6E2B8' },
  },
  {
    id: 'bagno-le-dune',
    name: 'Bagno Le Dune',
    town: 'Viareggio',
    tagline: 'Spiaggia libera attrezzata, prezzi economici',
    isBookable: false,
    priceFrom: 14,
    rating: 4.2,
    reviewCount: 54,
    photo: { sky: '#CDEEDB', sea: '#3FA37E', sand: '#EDE0C8' },
  },
  {
    id: 'bagno-miramare',
    name: 'Bagno Miramare',
    town: 'Forte dei Marmi',
    tagline: 'Servizio di lusso, cabine private e spa',
    isBookable: false,
    priceFrom: 35,
    rating: 4.9,
    reviewCount: 241,
    photo: { sky: '#D9CFF2', sea: '#5C4A9E', sand: '#F0E6D2' },
  },
];

// Used by the destination picker's suggestion list -- unique towns across the demo operators.
export const DEMO_TOWNS: string[] = Array.from(new Set(DEMO_OPERATORS.map((o) => o.town)));
