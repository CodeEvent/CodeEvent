// Static, presentation-only list for the guest-side "search nearby beach clubs" flow --
// this is not real bookable inventory (the local-fallback store only ever models one
// beach's umbrellas/bookings), it just gives the discovery screens something real to
// browse. Only `isBookable` operators route into the real map/wizard; the rest show a
// "coming soon" message when tapped, so nothing here is presented as more real than it is.
// There's deliberately no price field here: the only real pricing engine lives in
// CustomerBookingScreen/utils/pricing.ts, and it can't quote a total before the guest has
// picked dates, an umbrella, and lettini/sdraio -- a static "from X€" label on these cards
// would just be a made-up number disconnected from that engine.
export interface DemoOperator {
  id: string;
  name: string;
  town: string;
  tagline: string;
  isBookable: boolean;
}

export const DEMO_OPERATORS: DemoOperator[] = [
  {
    id: 'bagno-pietrasanta',
    name: 'Bagno Pietrasanta',
    town: 'Marina di Pietrasanta',
    tagline: 'Ombrelloni in prima fila, noleggio lettini e sdraio, bar sulla spiaggia',
    isBookable: true,
  },
  {
    id: 'bagno-argentina',
    name: 'Bagno Argentina',
    town: 'Forte dei Marmi',
    tagline: 'Stabilimento storico con ristorante vista mare',
    isBookable: false,
  },
  {
    id: 'bagno-roma',
    name: 'Bagno Roma',
    town: 'Marina di Pietrasanta',
    tagline: 'Ideale per famiglie, area giochi bambini',
    isBookable: false,
  },
  {
    id: 'bagno-le-dune',
    name: 'Bagno Le Dune',
    town: 'Viareggio',
    tagline: 'Spiaggia libera attrezzata, prezzi economici',
    isBookable: false,
  },
  {
    id: 'bagno-miramare',
    name: 'Bagno Miramare',
    town: 'Forte dei Marmi',
    tagline: 'Servizio di lusso, cabine private e spa',
    isBookable: false,
  },
];

// Used by the destination picker's suggestion list -- unique towns across the demo operators.
export const DEMO_TOWNS: string[] = Array.from(new Set(DEMO_OPERATORS.map((o) => o.town)));
