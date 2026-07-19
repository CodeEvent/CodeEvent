import {
  Article,
  Booking,
  Conto,
  Customer,
  DailyStat,
  PriceList,
  Umbrella,
  Zone,
} from '../types';

const ZONES: Zone[] = ['Fila A', 'Fila B', 'Fila C', 'Fila D', 'VIP'];

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function buildUmbrellas(): Umbrella[] {
  const umbrellas: Umbrella[] = [];
  let n = 1;
  ZONES.forEach((zone, rowIdx) => {
    const perRow = zone === 'VIP' ? 8 : 12;
    for (let col = 0; col < perRow; col++) {
      umbrellas.push({
        id: `u-${n}`,
        number: n,
        row: rowIdx,
        col,
        zone,
        hasCabin: zone === 'VIP' || col % 4 === 0,
        status: 'libero',
      });
      n++;
    }
  });
  return umbrellas;
}

export function buildArticles(): Article[] {
  return [
    { id: 'art-ombrellone', name: 'Ombrellone', category: 'ombrellone', basePrice: 18, unit: 'giorno' },
    { id: 'art-lettino', name: 'Lettino', category: 'ombrellone', basePrice: 6, unit: 'giorno' },
    { id: 'art-cabina', name: 'Cabina', category: 'cabina', basePrice: 8, unit: 'giorno' },
    { id: 'art-parcheggio', name: 'Parcheggio auto', category: 'parcheggio', basePrice: 5, unit: 'giorno' },
    { id: 'art-pedalo', name: 'Pedalò (1h)', category: 'pedalo', basePrice: 12, unit: 'ora' },
    { id: 'art-acqua', name: 'Acqua 0.5L', category: 'bar', basePrice: 1.5, unit: 'pz' },
    { id: 'art-caffe', name: 'Caffè', category: 'bar', basePrice: 1.2, unit: 'pz' },
    { id: 'art-spritz', name: 'Spritz', category: 'bar', basePrice: 6, unit: 'pz' },
    { id: 'art-panino', name: 'Panino', category: 'bar', basePrice: 5, unit: 'pz' },
    { id: 'art-pasta', name: 'Primo del giorno', category: 'ristorante', basePrice: 12, unit: 'pz' },
    { id: 'art-grigliata', name: 'Grigliata mista', category: 'ristorante', basePrice: 22, unit: 'pz' },
    { id: 'art-doccia', name: 'Telo mare', category: 'servizio', basePrice: 4, unit: 'pz' },
  ];
}

export function buildPriceLists(): PriceList[] {
  return [
    {
      id: 'pl-bassa',
      name: 'Bassa stagione',
      season: 'bassa',
      activeFrom: isoDate(-60),
      activeTo: isoDate(-1),
      prices: { 'art-ombrellone': 14, 'art-lettino': 4, 'art-cabina': 6 },
    },
    {
      id: 'pl-media',
      name: 'Media stagione',
      season: 'media',
      activeFrom: isoDate(0),
      activeTo: isoDate(30),
      prices: { 'art-ombrellone': 18, 'art-lettino': 6, 'art-cabina': 8 },
    },
    {
      id: 'pl-alta',
      name: 'Alta stagione (Agosto)',
      season: 'alta',
      activeFrom: isoDate(31),
      activeTo: isoDate(75),
      prices: { 'art-ombrellone': 26, 'art-lettino': 8, 'art-cabina': 12 },
    },
    {
      id: 'pl-vip',
      name: 'Convenzione VIP',
      season: 'alta',
      activeFrom: isoDate(-60),
      activeTo: isoDate(90),
      prices: { 'art-ombrellone': 22, 'art-lettino': 7, 'art-cabina': 10 },
    },
  ];
}

const NAMES = [
  'Marco Rossi', 'Giulia Bianchi', 'Luca Ferrari', 'Sara Romano',
  'Andrea Colombo', 'Chiara Ricci', 'Davide Marino', 'Elena Greco',
  'Francesco Conti', 'Valentina De Luca', 'Matteo Bruno', 'Alice Galli',
  'Simone Costa', 'Martina Fontana', 'Paolo Rinaldi', 'Federica Barbieri',
];

export function buildCustomers(): Customer[] {
  return NAMES.map((name, i) => ({
    id: `cust-${i + 1}`,
    name,
    phone: `+39 3${(20 + i).toString().padStart(2, '0')} 555${(1000 + i)}`,
    email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
    notes: i % 5 === 0 ? 'Preferisce ombrellone vicino al bagnasciuga' : '',
    vip: i % 4 === 0,
    bookingHistory: [],
    createdAt: isoDate(-200 + i * 3),
  }));
}

export function buildBookings(umbrellas: Umbrella[], customers: Customer[]): Booking[] {
  const bookings: Booking[] = [];
  const statusesForToday: Array<Umbrella['status']> = [
    'occupato', 'occupato', 'occupato', 'in_arrivo', 'prenotato', 'libero',
  ];

  umbrellas.forEach((u, idx) => {
    // Assign a status pattern so the beach looks "alive"
    const status = statusesForToday[idx % statusesForToday.length];
    if (status === 'libero') return;
    const customer = customers[idx % customers.length];
    const from = status === 'prenotato' ? isoDate(2 + (idx % 5)) : isoDate(0);
    const to = status === 'prenotato' ? isoDate(4 + (idx % 5)) : isoDate(0 + (idx % 3));
    const total = 18 + (idx % 5) * 4;
    const booking: Booking = {
      id: `bk-${u.id}`,
      umbrellaId: u.id,
      customerId: customer.id,
      dateFrom: from,
      dateTo: to,
      totalPrice: total,
      deposit: status === 'prenotato' ? Math.round(total * 0.3) : 0,
      paid: status === 'occupato' ? total : 0,
      status,
      createdAt: isoDate(-1),
    };
    bookings.push(booking);
    u.status = status;
    u.currentBookingId = booking.id;
    customer.bookingHistory.push(booking.id);
  });

  // A handful of future season bookings for the Quadro (planning) view
  umbrellas.slice(0, 15).forEach((u, idx) => {
    const startOffset = 5 + idx * 3;
    const length = 2 + (idx % 4);
    const customer = customers[(idx + 3) % customers.length];
    const total = 18 * length;
    const booking: Booking = {
      id: `bk-future-${u.id}-${idx}`,
      umbrellaId: u.id,
      customerId: customer.id,
      dateFrom: isoDate(startOffset),
      dateTo: isoDate(startOffset + length),
      totalPrice: total,
      deposit: Math.round(total * 0.3),
      paid: Math.round(total * 0.3),
      status: 'prenotato',
      createdAt: isoDate(-3),
    };
    bookings.push(booking);
    customer.bookingHistory.push(booking.id);
  });

  return bookings;
}

export function buildDailyStats(): DailyStat[] {
  const stats: DailyStat[] = [];
  for (let i = -29; i <= 0; i++) {
    const weekday = new Date(Date.now() + i * 86400000).getDay();
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.4 : 1;
    const base = 900 + Math.sin(i / 4) * 150;
    const incasso = Math.round(base * weekendBoost + (i + 30) * 6);
    stats.push({
      date: isoDate(i),
      incasso,
      presenze: Math.round(60 * weekendBoost + (i + 30) * 0.8),
      bar: Math.round(incasso * 0.28),
      ombrelloni: Math.round(incasso * 0.62),
    });
  }
  return stats;
}

export function buildContiStorico(): Conto[] {
  return [];
}

export function applySeasonalAssignments(umbrellas: Umbrella[], customers: Customer[]): void {
  const vipUmbrellas = umbrellas.filter((u) => u.zone === 'VIP');
  const vipCustomers = customers.filter((c) => c.vip);
  vipUmbrellas.slice(0, vipCustomers.length).forEach((u, idx) => {
    const customer = vipCustomers[idx];
    u.assignedCustomerId = customer.id;
    customer.assignedUmbrellaId = u.id;
  });
}
