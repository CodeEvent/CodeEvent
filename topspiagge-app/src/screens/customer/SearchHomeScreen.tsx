import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppAlert } from '../../components/AppAlert';
import { BeachPhoto } from '../../components/BeachPhoto';
import { Calendar } from '../../components/Calendar';
import { Button, Card, Checkbox, Chip, Stepper } from '../../components/UI';
import { useStore } from '../../store/StoreContext';
import { colors, radius, spacing } from '../../theme';
import { DEMO_OPERATORS, DEMO_TOWNS, DemoOperator } from '../../data/demoOperators';
import { MAX_ADULTS_PER_UMBRELLA, umbrellasNeededFor } from '../../utils/booking';
import { baseUmbrellaPricePerDay } from '../../utils/pricing';
import { formatCurrency, formatDateShort, isoDate } from '../../utils/format';

// Desktop-vs-phone threshold for this screen's Booking.com-style top-nav/hero-search/grid
// layout -- deliberately wider than the app's usual SIDEBAR_BREAKPOINT (700, used for
// docked-sidebar-vs-bottom-sheet chrome elsewhere) since a multi-column results grid needs
// more room to read well than a single docked panel does.
export const DESKTOP_BREAKPOINT = 900;

// Flat top-down umbrella illustration (alternating peach/white wedges) inside a soft teal
// ring, echoing the search hero's reference illustration without depending on any external
// photo asset -- everything here is drawn, matching this app's existing SVG-illustration
// pattern (see BeachCanvas's WaveFooter/SeaBand).
const UmbrellaBadge: React.FC<{ size?: number }> = ({ size = 140 }) => {
  const r = size / 2;
  const wedges = 8;
  const points = Array.from({ length: wedges }, (_, i) => {
    const a0 = (i / wedges) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / wedges) * Math.PI * 2 - Math.PI / 2;
    const x0 = r + r * Math.cos(a0);
    const y0 = r + r * Math.sin(a0);
    const x1 = r + r * Math.cos(a1);
    const y1 = r + r * Math.sin(a1);
    return { d: `M${r},${r} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z`, even: i % 2 === 0 };
  });
  return (
    <View style={{ width: size * 1.35, height: size * 1.35, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size * 1.25} height={size * 1.25} viewBox={`0 0 ${size * 1.25} ${size * 1.25}`} style={{ position: 'absolute' }}>
        <Circle cx={(size * 1.25) / 2} cy={(size * 1.25) / 2} r={(size * 1.25) / 2} fill="rgba(255,255,255,0.14)" />
      </Svg>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {points.map((p, idx) => (
          <Path key={idx} d={p.d} fill={p.even ? colors.peach : colors.white} />
        ))}
      </Svg>
      <View style={styles.umbrellaBadgeCenter}>
        <Ionicons name="person" size={size * 0.22} color={colors.primary} />
      </View>
    </View>
  );
};

// Stylized, illustrated silhouette of Italy (mainland "boot" + Sicily + Sardinia) with a pin
// over the Tuscan coast, roughly where Marina di Pietrasanta sits -- used anywhere the app
// shows a "show on map" location thumbnail, so it reads as this real country rather than a
// generic globe/pin glyph. Not cartographically precise (no external map asset/API involved,
// matching this app's existing drawn-illustration pattern), just recognizable at a glance.
export const ItalyMapThumb: React.FC<{ width?: number; height?: number }> = ({ width = 96, height = 120 }) => (
  <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={width} height={height} viewBox="0 0 100 140">
      <Path
        d="M46,4 C38,4 34,10 36,16 C30,18 28,26 33,30 C28,34 26,42 32,46 C27,50 25,58 31,62 C26,66 24,74 30,78 C25,82 22,88 27,94 C30,100 36,104 40,100 C44,106 50,110 47,116 C53,112 58,104 56,98 C62,94 66,86 60,80 C65,74 68,66 62,60 C67,54 68,46 62,40 C66,34 65,26 58,22 C60,16 57,8 46,4 Z"
        fill={colors.sandDark}
      />
      <Path
        d="M18,58 C14,62 13,70 16,76 C13,82 15,90 20,92 C25,90 27,82 24,76 C28,70 26,62 18,58 Z"
        fill={colors.sandDark}
      />
      <Path
        d="M55,118 C50,122 48,128 52,132 C58,135 66,133 68,128 C70,123 64,119 55,118 Z"
        fill={colors.sandDark}
      />
    </Svg>
    <View style={{ position: 'absolute', left: width * 0.28, top: height * 0.22 }}>
      <Ionicons name="location" size={Math.max(14, width * 0.16)} color={colors.danger} />
    </View>
  </View>
);

const HERE_LABEL = 'Intorno alla posizione attuale';

export interface SearchSelection {
  startOffset: number;
  days: number;
  /** Guest count entered on the home search card -- seeds the real booking form's "Adulti"
   * stepper (see CustomerBookingScreen's initialAdults) so choosing e.g. 6 here already shows
   * the venue's max-4-adults-per-umbrella policy and multi-umbrella suggestions on the next
   * screen, instead of silently resetting to 2 and asking again. */
  guests: number;
}

type SearchStep = 'home' | 'destination' | 'dates' | 'results' | 'detail';

export type GuestTab = 'search' | 'saved' | 'bookings' | 'account';

interface Props {
  onSelectOperator: (operator: DemoOperator, selection: SearchSelection) => void;
  /** Reports whether we're on the plain home card (true) or one of the search sub-steps
   * (false), so the parent tab shell can hide its bottom nav during the focused search
   * flow -- matching how the reference flow takes over the whole screen instead of
   * leaving tab chrome visible mid-search. */
  onHomeStateChange?: (isHome: boolean) => void;
  /** Desktop only: the top nav's Salvati/Prenotazioni/Account links switch CustomerApp's own
   * tab state directly, since desktop width replaces the phone bottom tab bar with this nav
   * instead of hiding tab navigation altogether. */
  onNavigateTab?: (tab: GuestTab) => void;
}

// Guest-facing "search a beach club" flow, styled after Booking.com's own search UX (home
// screen with search box + nearby properties -> a single "book your stay" summary page with
// destination + dates -> results list) but in the app's normal light theme rather than
// Booking.com's dark one, and results are beach clubs, not hotels. The home card's "Persone"
// count is a real value carried into the booking flow (seeds the real form's "Adulti" stepper)
// -- lettini/sdraio equipment is still chosen later, after picking a specific umbrella on the
// map (see CustomerBookingScreen), since that genuinely can't be known before then.
// Everything here is presentation over the static DEMO_OPERATORS list -- each `isBookable`
// operator gets its own independent local-fallback inventory (see StoreContext's
// storageKeyFor), so those cards route into the real map/wizard; the rest show a "coming soon"
// message when tapped.
export const SearchHomeScreen: React.FC<Props> = ({ onSelectOperator, onHomeStateChange, onNavigateTab }) => {
  const alert = useAppAlert();
  const [step, setStep] = useState<SearchStep>('home');
  React.useEffect(() => {
    onHomeStateChange?.(step === 'home');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  const [destination, setDestination] = useState(HERE_LABEL);
  const [startOffset, setStartOffset] = useState(0);
  const [days, setDays] = useState(1);
  const [awaitingEndDate, setAwaitingEndDate] = useState(false);
  const [dayMode, setDayMode] = useState<'single' | 'multi'>('single');
  const [persone, setPersone] = useState(0);
  const [detailOperator, setDetailOperator] = useState<DemoOperator | null>(null);
  const [detailReturnStep, setDetailReturnStep] = useState<SearchStep>('home');

  const openDetail = (op: DemoOperator, returnStep: SearchStep) => {
    setDetailOperator(op);
    setDetailReturnStep(returnStep);
    setStep('detail');
  };

  const dateFrom = useMemo(() => isoDate(startOffset), [startOffset]);
  const dateTo = useMemo(() => isoDate(startOffset + days - 1), [startOffset, days]);

  const selection: SearchSelection = { startOffset, days, guests: persone };

  // Warns the guest the moment their count crosses above the venue's per-umbrella cap --
  // only on that one crossing (4 -> 5), not on every further increment, so it informs without
  // nagging on each subsequent tap of "+".
  const handleChangePersone = (value: number) => {
    if (value > MAX_ADULTS_PER_UMBRELLA && persone <= MAX_ADULTS_PER_UMBRELLA) {
      alert(
        'Più di un ombrellone necessario',
        `Ogni ombrellone ospita al massimo ${MAX_ADULTS_PER_UMBRELLA} persone. Con ${value} persone ti serviranno più ombrelloni vicini tra loro: potrai aggiungerli quando scegli il posto sulla mappa.`
      );
    }
    setPersone(value);
  };

  const handleSelectDate = (offset: number) => {
    if (awaitingEndDate && offset > startOffset) {
      setDays(offset - startOffset + 1);
      setAwaitingEndDate(false);
    } else {
      setStartOffset(offset);
      setDays(1);
      setAwaitingEndDate(true);
    }
  };

  const filteredOperators = useMemo(() => {
    if (destination === HERE_LABEL) return DEMO_OPERATORS;
    return DEMO_OPERATORS.filter((o) => o.town === destination);
  }, [destination]);

  const handlePickOperator = (op: DemoOperator, sel: SearchSelection) => {
    if (op.isBookable) {
      onSelectOperator(op, sel);
    } else {
      alert(
        'Prossimamente disponibile',
        `${op.name} sarà prenotabile presto in questa demo. Prova con Bagno Pietrasanta, Bagno Argentina o Bagno Roma.`
      );
    }
  };

  const { width } = useWindowDimensions();
  const isWide = width >= DESKTOP_BREAKPOINT;

  // Desktop gets its own top-nav/hero-search/grid shell end to end (home, results, detail);
  // the narrow phone flow below (full-screen destination/dates sub-steps, stacked list,
  // hero+tabs detail) is untouched. Both ultimately call the same onSelectOperator/alert
  // logic, so a booking made from either layout behaves identically from here on.
  if (isWide) {
    if (step === 'detail' && detailOperator) {
      return (
        <DesktopDetail
          operator={detailOperator}
          startOffset={startOffset}
          days={days}
          fallbackGuests={persone}
          onBack={() => setStep(detailReturnStep)}
          onBook={(sel) => handlePickOperator(detailOperator, sel)}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (step === 'results') {
      return (
        <DesktopResults
          operators={filteredOperators}
          destination={destination}
          onChangeDestination={setDestination}
          startOffset={startOffset}
          days={days}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onSelectDate={handleSelectDate}
          persone={persone}
          onChangePersone={handleChangePersone}
          onSearch={() => setStep('results')}
          onSelectOperator={(op) => openDetail(op, 'results')}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    return (
      <DesktopShell
        operators={DEMO_OPERATORS}
        destination={destination}
        onChangeDestination={setDestination}
        startOffset={startOffset}
        days={days}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onSelectDate={handleSelectDate}
        persone={persone}
        onChangePersone={handleChangePersone}
        onSearch={() => setStep('results')}
        onSelectOperator={(op) => openDetail(op, 'home')}
        onNavigateTab={onNavigateTab}
      />
    );
  }

  if (step === 'destination') {
    return (
      <DestinationPicker
        onBack={() => setStep('home')}
        onSelect={(d) => {
          setDestination(d);
          setStep('home');
        }}
      />
    );
  }

  if (step === 'dates') {
    return (
      <DatesPicker
        startOffset={startOffset}
        days={days}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onSelectDate={(offset) => {
          handleSelectDate(offset);
          setDayMode('multi');
        }}
        onBack={() => setStep('home')}
        onDone={() => setStep('home')}
      />
    );
  }

  if (step === 'results') {
    return (
      <ResultsList
        destination={destination}
        dateFrom={dateFrom}
        dateTo={dateTo}
        operators={filteredOperators}
        onBack={() => setStep('home')}
        onSelect={(op) => openDetail(op, 'results')}
      />
    );
  }

  if (step === 'detail' && detailOperator) {
    return (
      <BeachDetailScreen
        operator={detailOperator}
        dateFrom={dateFrom}
        dateTo={dateTo}
        days={days}
        guests={persone}
        onBack={() => setStep(detailReturnStep)}
        onBook={() => handlePickOperator(detailOperator, selection)}
      />
    );
  }

  return (
    <HomeCard
      operators={DEMO_OPERATORS}
      destination={destination}
      dateFrom={dateFrom}
      dateTo={dateTo}
      days={days}
      dayMode={dayMode}
      persone={persone}
      onChangeDayMode={(mode) => {
        setDayMode(mode);
        if (mode === 'single') setDays(1);
      }}
      onChangePersone={handleChangePersone}
      onOpenDestination={() => setStep('destination')}
      onOpenDates={() => setStep('dates')}
      onSearch={() => setStep('results')}
      onSelectOperator={(op) => openDetail(op, 'home')}
    />
  );
};

const HomeCard: React.FC<{
  operators: DemoOperator[];
  destination: string;
  dateFrom: string;
  dateTo: string;
  days: number;
  dayMode: 'single' | 'multi';
  persone: number;
  onChangeDayMode: (mode: 'single' | 'multi') => void;
  onChangePersone: (value: number) => void;
  onOpenDestination: () => void;
  onOpenDates: () => void;
  onSearch: () => void;
  onSelectOperator: (operator: DemoOperator) => void;
}> = ({
  operators,
  destination,
  dateFrom,
  dateTo,
  days,
  dayMode,
  persone,
  onChangeDayMode,
  onChangePersone,
  onOpenDestination,
  onOpenDates,
  onSearch,
  onSelectOperator,
}) => (
  <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView contentContainerStyle={styles.homeScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.heroBand}>
        <Text style={styles.heroTitle}>Prenota il tuo{'\n'}ombrellone e{'\n'}comincia a{'\n'}rilassarti.</Text>
        <View style={styles.heroBadgeSlot}>
          <UmbrellaBadge size={110} />
        </View>
      </View>

      <View style={styles.searchCard}>
        <Pressable style={styles.searchField} onPress={onOpenDestination}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <Text style={styles.searchFieldText} numberOfLines={1}>
            {destination}
          </Text>
        </Pressable>

        <View style={styles.dayModeRow}>
          <Pressable style={styles.dayModeOption} onPress={() => onChangeDayMode('single')}>
            <View style={[styles.radioOuter, dayMode === 'single' && styles.radioOuterActive]}>
              {dayMode === 'single' && <Ionicons name="checkmark" size={12} color={colors.white} />}
            </View>
            <Text style={styles.dayModeLabel}>Un giorno</Text>
          </Pressable>
          <Pressable style={styles.dayModeOption} onPress={() => onChangeDayMode('multi')}>
            <View style={[styles.radioOuter, dayMode === 'multi' && styles.radioOuterActive]} />
            <Text style={styles.dayModeLabel}>Più giorni</Text>
          </Pressable>
        </View>

        <Pressable style={styles.searchField} onPress={onOpenDates}>
          <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
          <Text style={styles.searchFieldText} numberOfLines={1}>
            {formatDateShort(dateFrom)}
            {dayMode === 'multi' ? ` → ${formatDateShort(dateTo)}` : ''} · {days} {days === 1 ? 'giorno' : 'giorni'}
          </Text>
        </Pressable>

        <View style={styles.personeRow}>
          <Stepper label="Persone" icon="people-outline" value={persone} onChange={onChangePersone} />
        </View>

        <Button title="Cerca" icon="search" onPress={onSearch} style={{ marginTop: spacing.sm }} />
      </View>

      <View style={styles.popularHeader}>
        <Text style={styles.sectionTitle}>Posti popolari</Text>
        <Pressable onPress={onSearch} hitSlop={8}>
          <Text style={styles.popularSeeAll}>Vedi tutti</Text>
        </Pressable>
      </View>
      {operators.map((op) => (
        <OperatorCard key={op.id} operator={op} onPress={() => onSelectOperator(op)} />
      ))}
    </ScrollView>
  </SafeAreaView>
);

// Reference booking-site listings lift their shadow on hover to signal interactivity; RN has
// no hover, so the same depth cue triggers on press instead.
const OperatorCard: React.FC<{ operator: DemoOperator; onPress: () => void }> = ({ operator, onPress }) => (
  <Pressable onPress={onPress}>
    {({ pressed }) => (
      <Card style={[styles.operatorCard, pressed && styles.operatorCardPressed]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.operatorName}>{operator.name}</Text>
          <Text style={styles.operatorTown}>{operator.town}</Text>
          <Text style={styles.operatorTagline} numberOfLines={2}>
            {operator.tagline}
          </Text>
        </View>
        <View style={styles.operatorThumb}>
          <Ionicons name="umbrella" size={22} color={colors.peachDark} />
          <View style={styles.operatorThumbChevron}>
            <Ionicons name="chevron-forward" size={14} color={colors.primaryDark} />
          </View>
        </View>
      </Card>
    )}
  </Pressable>
);

const DestinationPicker: React.FC<{
  onBack: () => void;
  onSelect: (destination: string) => void;
}> = ({ onBack, onSelect }) => {
  const [query, setQuery] = useState('');
  const suggestions = useMemo(
    () => DEMO_TOWNS.filter((t) => t.toLowerCase().includes(query.trim().toLowerCase())),
    [query]
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.body}>
        <View style={styles.inputRow}>
          <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
          <TextInput
            style={styles.input}
            placeholder="Cerca una localita"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <Pressable style={styles.suggestionRow} onPress={() => onSelect(HERE_LABEL)}>
          <View style={styles.suggestionIcon}>
            <Ionicons name="locate" size={16} color={colors.primary} />
          </View>
          <Text style={styles.suggestionText}>{HERE_LABEL}</Text>
        </Pressable>
        <View style={styles.divider} />
        <ScrollView>
          {suggestions.map((town) => (
            <Pressable key={town} style={styles.suggestionRow} onPress={() => onSelect(town)}>
              <View style={styles.suggestionIcon}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
              </View>
              <Text style={styles.suggestionText}>{town}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const DatesPicker: React.FC<{
  startOffset: number;
  days: number;
  dateFrom: string;
  dateTo: string;
  onSelectDate: (offset: number) => void;
  onBack: () => void;
  onDone: () => void;
}> = ({ startOffset, days, dateFrom, dateTo, onSelectDate, onBack, onDone }) => (
  <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.pageTitle}>Seleziona le date</Text>
      <Text style={styles.pageHint}>Tocca il giorno di arrivo, poi il giorno di partenza</Text>
      <Calendar startOffset={startOffset} days={days} onSelectDate={onSelectDate} />
    </ScrollView>
    <View style={styles.footer}>
      <Text style={styles.footerSummary}>
        {formatDateShort(dateFrom)} → {formatDateShort(dateTo)} ({days} {days === 1 ? 'giorno' : 'giorni'})
      </Text>
      <Button title="Seleziona le date" onPress={onDone} />
    </View>
  </SafeAreaView>
);

const ResultsList: React.FC<{
  destination: string;
  dateFrom: string;
  dateTo: string;
  operators: DemoOperator[];
  onBack: () => void;
  onSelect: (operator: DemoOperator) => void;
}> = ({ destination, dateFrom, dateTo, operators, onBack, onSelect }) => (
  <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.pageTitle}>{operators.length} stabilimenti trovati</Text>
      <Text style={styles.pageHint}>
        {destination} · {formatDateShort(dateFrom)} → {formatDateShort(dateTo)}
      </Text>
      {operators.map((op) => (
        <OperatorCard key={op.id} operator={op} onPress={() => onSelect(op)} />
      ))}
    </ScrollView>
  </SafeAreaView>
);

// Property highlights pill row -- a fixed, generic set (not per-operator) since every demo
// beach club offers roughly the same core amenities; keeps demoOperators.ts from needing a
// whole new per-operator content field for what's ultimately decorative.
const PROPERTY_HIGHLIGHTS: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }> = [
  { icon: 'umbrella-outline', title: 'Ombrelloni', subtitle: 'Prima fila disponibile' },
  { icon: 'car-outline', title: 'Parcheggio', subtitle: 'Gratuito, in loco' },
  { icon: 'cafe-outline', title: 'Bar sulla spiaggia', subtitle: 'Aperto tutto il giorno' },
  { icon: 'accessibility-outline', title: 'Accessibile', subtitle: 'Adatto a persone con disabilita' },
];

// Guest review quotes shown on the property page -- fixed, generic set (not per-operator, same
// reasoning as PROPERTY_HIGHLIGHTS above). Mirrors Booking.com's "Guests who stayed here loved"
// card format: name + traveller type, country flag, short quote.
const GUEST_REVIEWS: Array<{ name: string; type: string; country: string; flag: string; quote: string }> = [
  {
    name: 'Marco',
    type: 'Viaggiatore in coppia',
    country: 'Italia',
    flag: '🇮🇹',
    quote: 'Ombrelloni comodi, personale gentilissimo, spiaggia pulita ogni giorno.',
  },
  {
    name: 'Anna',
    type: 'Famiglia con bambini',
    country: 'Germania',
    flag: '🇩🇪',
    quote: 'Perfetto per i bambini, area giochi curata e staff sempre disponibile.',
  },
  {
    name: 'Luca',
    type: 'Viaggiatore singolo',
    country: 'Svizzera',
    flag: '🇨🇭',
    quote: "Bar ottimo, prenotazione facilissima dall'app, tornero sicuramente.",
  },
];

// Booking.com-style tiering for the big rating badge's label.
function ratingSummaryLabel(rating: number): string {
  if (rating >= 4.8) return 'Eccezionale';
  if (rating >= 4.5) return 'Favoloso';
  if (rating >= 4.0) return 'Ottimo';
  return 'Buono';
}

// Only `isBookable` operators are real, bookable inventory (see demoOperators.ts) -- their Costi
// section pulls the actual base prices from the store's active price list rather than
// inventing numbers; the other demo operators show a plain "coming soon" notice instead of
// a fabricated price, matching this file's existing rule against disconnected made-up costs.
// One continuous scroll page (no tabs) structured to match the reference Booking.com property
// page exactly: title+rating badge, address, photo gallery, highlights pills, check-in/checkout
// + "you searched for" + price summary, cancellation checks, rating breakdown, guest reviews,
// sticky footer. Replaces the old Panoramica/Recensioni/Foto tab layout.
const BeachDetailScreen: React.FC<{
  operator: DemoOperator;
  dateFrom: string;
  dateTo: string;
  days: number;
  guests: number;
  onBack: () => void;
  onBook: () => void;
}> = ({ operator, dateFrom, dateTo, days, guests, onBack, onBook }) => {
  const { getActivePriceList, umbrellas } = useStore();
  const priceList = operator.isBookable ? getActivePriceList() : null;
  const cheapestBandPrice = useMemo(() => {
    const prices = umbrellas.map(baseUmbrellaPricePerDay);
    return prices.length ? Math.min(...prices) : operator.priceFrom;
  }, [umbrellas, operator.priceFrom]);
  const umbrellasNeeded = umbrellasNeededFor(Math.max(1, guests));
  const totalFrom = cheapestBandPrice * umbrellasNeeded * days;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.detailTopBar}>
        <Pressable onPress={onBack} style={styles.detailBackBtn} hitSlop={8} accessibilityLabel="Torna indietro">
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.detailTopBarTitle} numberOfLines={1}>
          {operator.name}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Ionicons name="heart-outline" size={20} color={colors.text} />
          <Ionicons name="share-outline" size={20} color={colors.text} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.detailBody}>
        <View style={styles.detailTitleRow}>
          <Text style={styles.detailTitleBig} numberOfLines={2}>
            {operator.name}
          </Text>
          <View style={styles.detailTitleRatingBadge}>
            <Text style={styles.detailTitleRatingBadgeText}>{operator.rating.toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.detailAddressLine}>{operator.town}, Toscana, Italia</Text>

        <GalleryGrid photo={operator.photo} mainHeight={140} smallHeight={80} />

        <Text style={styles.detailSectionTitle}>Punti di forza della struttura</Text>
        <PropertyHighlightsRow />

        <View style={styles.detailDivider} />

        <View style={styles.checkRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkLabel}>Check-in</Text>
            <Text style={styles.checkValue}>{formatDateShort(dateFrom)}</Text>
          </View>
          <View style={styles.checkDivider} />
          <View style={{ flex: 1 }}>
            <Text style={styles.checkLabel}>Check-out</Text>
            <Text style={styles.checkValue}>{formatDateShort(dateTo)}</Text>
          </View>
        </View>

        <Text style={[styles.detailSectionTitle, { marginTop: spacing.lg }]}>Hai cercato</Text>
        <Text style={styles.searchedForLink}>
          {umbrellasNeeded} {umbrellasNeeded === 1 ? 'ombrellone' : 'ombrelloni'} · {Math.max(1, guests)}{' '}
          {guests === 1 ? 'persona' : 'persone'}
        </Text>

        {priceList ? (
          <>
            <Text style={[styles.detailSectionTitle, { marginTop: spacing.lg }]}>
              Prezzo per {days} {days === 1 ? 'giorno' : 'giorni'} ({formatDateShort(dateFrom)} - {formatDateShort(dateTo)})
            </Text>
            <Text style={styles.priceSummaryAmount}>{formatCurrency(totalFrom)}</Text>
            <Text style={styles.priceSummaryHint}>a partire da, tasse incluse</Text>
            <View style={{ marginTop: spacing.sm, gap: 4 }}>
              <View style={styles.checkmarkRow}>
                <Ionicons name="checkmark" size={14} color={colors.success} />
                <Text style={styles.checkmarkRowTextGreen}>Cancellazione gratuita</Text>
              </View>
              <View style={styles.checkmarkRow}>
                <Ionicons name="checkmark" size={14} color={colors.success} />
                <Text style={styles.checkmarkRowTextGreen}>Nessun anticipo richiesto</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={[styles.detailComingSoonBox, { marginTop: spacing.md }]}>
            <Ionicons name="time-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.detailComingSoonText}>
              Prenotabile prossimamente in questa demo. Prova con Bagno Pietrasanta, Bagno Argentina o Bagno Roma.
            </Text>
          </View>
        )}

        <View style={styles.detailDivider} />

        <View style={styles.ratingCardRow}>
          <View style={styles.desktopRatingBadgeLarge}>
            <Text style={styles.desktopRatingBadgeLargeText}>{operator.rating.toFixed(1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.desktopRatingSummary}>{ratingSummaryLabel(operator.rating)}</Text>
            <Text style={styles.detailRatingCount}>Vedi {operator.reviewCount} recensioni</Text>
          </View>
        </View>
        <RatingBreakdown />

        <View style={styles.detailDivider} />

        <Text style={styles.detailSectionTitle}>Gli ospiti hanno apprezzato</Text>
        <GuestReviewsSection />
      </ScrollView>

      <View style={styles.detailFooter}>
        <View style={{ flex: 1 }}>
          <View style={styles.checkmarkRow}>
            <Ionicons name="checkmark" size={14} color={colors.success} />
            <Text style={styles.checkmarkRowTextGreen}>Cancellazione gratuita</Text>
          </View>
          <Text style={styles.detailFooterPriceHint}>Non ti addebitiamo nulla ora</Text>
        </View>
        <Button title="Vedi disponibilita" onPress={onBook} style={{ paddingHorizontal: spacing.lg }} />
      </View>
    </SafeAreaView>
  );
};

type DesktopField = 'destination' | 'dates' | 'guests' | null;

const DESKTOP_NAV_LINKS: Array<{ tab: GuestTab; label: string }> = [
  { tab: 'saved', label: 'Salvati' },
  { tab: 'bookings', label: 'Le mie prenotazioni' },
  { tab: 'account', label: 'Account' },
];

// Replaces the phone bottom tab bar entirely on desktop widths (see CustomerApp.tsx, which
// hides its own GuestTabBar when wide) -- these links are the only way to reach
// Salvati/Prenotazioni/Account without it, so they call straight back into CustomerApp's tab
// state via onNavigateTab rather than being purely decorative.
export const DesktopNav: React.FC<{ onLogoPress?: () => void; onNavigateTab?: (tab: GuestTab) => void }> = ({
  onLogoPress,
  onNavigateTab,
}) => (
  <View style={styles.desktopNav}>
    <Pressable style={styles.desktopNavLeft} onPress={onLogoPress} disabled={!onLogoPress}>
      <Ionicons name="umbrella" size={20} color={colors.white} />
      <Text style={styles.desktopLogo}>Top Spiagge</Text>
    </Pressable>
    <View style={styles.desktopNavLinksRow}>
      {DESKTOP_NAV_LINKS.map((l) => (
        <Pressable key={l.tab} onPress={() => onNavigateTab?.(l.tab)} disabled={!onNavigateTab}>
          <Text style={styles.desktopNavLink}>{l.label}</Text>
        </Pressable>
      ))}
    </View>
  </View>
);

// The destination/dates/guests search bar with its three functional popovers -- shared between
// the home hero and the results page's compact top bar (see DesktopResults) so both stay in
// sync instead of maintaining two copies of this popover logic.
const DesktopSearchBar: React.FC<{
  destination: string;
  onChangeDestination: (d: string) => void;
  startOffset: number;
  days: number;
  dateFrom: string;
  dateTo: string;
  onSelectDate: (offset: number) => void;
  persone: number;
  onChangePersone: (v: number) => void;
  onSearch: () => void;
  compact?: boolean;
}> = ({ destination, onChangeDestination, startOffset, days, dateFrom, dateTo, onSelectDate, persone, onChangePersone, onSearch, compact }) => {
  const [openField, setOpenField] = useState<DesktopField>(null);
  const [destQuery, setDestQuery] = useState('');
  const destSuggestions = useMemo(
    () => DEMO_TOWNS.filter((t) => t.toLowerCase().includes(destQuery.trim().toLowerCase())),
    [destQuery]
  );
  const toggleField = (f: DesktopField) => setOpenField((cur) => (cur === f ? null : f));

  return (
    <View style={[styles.desktopSearchBarWrap, compact && styles.desktopSearchBarWrapResults]}>
      <View style={styles.desktopSearchBar}>
        <View style={[styles.desktopSearchField, { position: 'relative' }]}>
          <Pressable style={styles.desktopSearchFieldBtn} onPress={() => toggleField('destination')}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.desktopFieldLabel}>Destinazione</Text>
              <Text style={styles.desktopFieldValue} numberOfLines={1}>
                {destination}
              </Text>
            </View>
          </Pressable>
          {openField === 'destination' && (
            <View style={styles.desktopPopover}>
              <View style={styles.desktopPopoverSearchRow}>
                <Ionicons name="search" size={14} color={colors.textMuted} />
                <TextInput
                  style={styles.desktopPopoverInput}
                  placeholder="Cerca una localita"
                  placeholderTextColor={colors.textMuted}
                  value={destQuery}
                  onChangeText={setDestQuery}
                  autoFocus
                />
              </View>
              <Pressable
                style={styles.suggestionRow}
                onPress={() => {
                  onChangeDestination(HERE_LABEL);
                  setOpenField(null);
                }}
              >
                <View style={styles.suggestionIcon}>
                  <Ionicons name="locate" size={16} color={colors.primary} />
                </View>
                <Text style={styles.suggestionText}>{HERE_LABEL}</Text>
              </Pressable>
              {destSuggestions.map((town) => (
                <Pressable
                  key={town}
                  style={styles.suggestionRow}
                  onPress={() => {
                    onChangeDestination(town);
                    setOpenField(null);
                  }}
                >
                  <View style={styles.suggestionIcon}>
                    <Ionicons name="location-outline" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.suggestionText}>{town}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.desktopSearchDivider} />

        <View style={[styles.desktopSearchField, { position: 'relative' }]}>
          <Pressable style={styles.desktopSearchFieldBtn} onPress={() => toggleField('dates')}>
            <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.desktopFieldLabel}>Date</Text>
              <Text style={styles.desktopFieldValue} numberOfLines={1}>
                {formatDateShort(dateFrom)} → {formatDateShort(dateTo)}
              </Text>
            </View>
          </Pressable>
          {openField === 'dates' && (
            <View style={[styles.desktopPopover, { width: 320 }]}>
              <Text style={styles.desktopPopoverTitle}>Seleziona le date</Text>
              <Calendar startOffset={startOffset} days={days} onSelectDate={onSelectDate} />
            </View>
          )}
        </View>

        <View style={styles.desktopSearchDivider} />

        <View style={[styles.desktopSearchField, { position: 'relative' }]}>
          <Pressable style={styles.desktopSearchFieldBtn} onPress={() => toggleField('guests')}>
            <Ionicons name="people-outline" size={16} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.desktopFieldLabel}>Persone</Text>
              <Text style={styles.desktopFieldValue}>
                {persone} {persone === 1 ? 'persona' : 'persone'}
              </Text>
            </View>
          </Pressable>
          {openField === 'guests' && (
            <View style={[styles.desktopPopover, { width: 260 }]}>
              <Text style={styles.desktopPopoverTitle}>Ospiti</Text>
              <Stepper label="Persone" icon="people-outline" value={persone} onChange={onChangePersone} />
              <Button title="Fatto" onPress={() => setOpenField(null)} style={{ marginTop: spacing.md }} />
            </View>
          )}
        </View>

        <Button
          title="Cerca"
          icon="search"
          onPress={() => {
            setOpenField(null);
            onSearch();
          }}
          style={styles.desktopSearchBtn}
        />
      </View>

      {openField && <Pressable style={styles.desktopPopoverBackdrop} onPress={() => setOpenField(null)} />}
    </View>
  );
};

// Booking.com-style top nav + hero + the shared search bar + a photo-card grid -- this is the
// plain "home" state only (hero + "Posti popolari"); the post-search state has its own very
// different layout (filters sidebar + list view) handled by DesktopResults instead.
const DesktopShell: React.FC<{
  operators: DemoOperator[];
  destination: string;
  onChangeDestination: (d: string) => void;
  startOffset: number;
  days: number;
  dateFrom: string;
  dateTo: string;
  onSelectDate: (offset: number) => void;
  persone: number;
  onChangePersone: (v: number) => void;
  onSearch: () => void;
  onSelectOperator: (operator: DemoOperator) => void;
  onNavigateTab?: (tab: GuestTab) => void;
}> = ({
  operators,
  destination,
  onChangeDestination,
  startOffset,
  days,
  dateFrom,
  dateTo,
  onSelectDate,
  persone,
  onChangePersone,
  onSearch,
  onSelectOperator,
  onNavigateTab,
}) => {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DesktopNav onNavigateTab={onNavigateTab} />

      <View style={styles.desktopHero}>
        <View style={styles.desktopHeroInner}>
          <Text style={styles.desktopHeroTitle}>Dove vuoi rilassarti?</Text>
          <Text style={styles.desktopHeroSubtitle}>Prenota il tuo ombrellone in pochi click.</Text>
        </View>
      </View>

      <DesktopSearchBar
        destination={destination}
        onChangeDestination={onChangeDestination}
        startOffset={startOffset}
        days={days}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onSelectDate={onSelectDate}
        persone={persone}
        onChangePersone={onChangePersone}
        onSearch={onSearch}
      />

      <ScrollView contentContainerStyle={styles.desktopBody}>
        <View style={styles.desktopBodyInner}>
          <Text style={styles.desktopSectionTitle}>Posti popolari</Text>
          <View style={styles.desktopGrid}>
            {operators.map((op) => (
              <DesktopOperatorCard key={op.id} operator={op} onPress={() => onSelectOperator(op)} />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const DesktopOperatorCard: React.FC<{ operator: DemoOperator; onPress: () => void }> = ({ operator, onPress }) => (
  <Pressable onPress={onPress} style={styles.desktopCardWrap}>
    {({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => (
      <View style={[styles.desktopCard, (pressed || hovered) && styles.desktopCardHovered]}>
        <View style={styles.desktopCardPhotoWrap}>
          <BeachPhoto photo={operator.photo} height={160} variant={0} borderRadius={0} />
          {!operator.isBookable && (
            <View style={styles.desktopCardSoonBadge}>
              <Text style={styles.desktopCardSoonBadgeText}>Prossimamente</Text>
            </View>
          )}
        </View>
        <View style={styles.desktopCardBody}>
          <View style={styles.desktopCardHeaderRow}>
            <Text style={styles.desktopCardName} numberOfLines={1}>
              {operator.name}
            </Text>
            <View style={styles.desktopRatingPill}>
              <Text style={styles.desktopRatingPillText}>{operator.rating.toFixed(1)}</Text>
            </View>
          </View>
          <Text style={styles.desktopCardTown}>{operator.town}</Text>
          <Text style={styles.desktopCardTagline} numberOfLines={2}>
            {operator.tagline}
          </Text>
          <Text style={styles.desktopCardReviews}>{operator.reviewCount} recensioni</Text>
          <View style={styles.desktopCardPriceRow}>
            <Text style={styles.desktopCardPriceHint}>A partire da</Text>
            <Text style={styles.desktopCardPrice}>
              {formatCurrency(operator.priceFrom)}
              <Text style={styles.desktopCardPriceUnit}> /ombrellone al giorno</Text>
            </Text>
          </View>
        </View>
      </View>
    )}
  </Pressable>
);

const RESULT_SORTS = [
  { key: 'consigliati', label: 'Consigliati' },
  { key: 'prezzo', label: 'Prezzo piu basso' },
  { key: 'valutazione', label: 'Valutazione' },
] as const;
type ResultSort = (typeof RESULT_SORTS)[number]['key'];

const BUDGET_MIN = 10;
const BUDGET_MAX = 40;
const BUDGET_STEP = 5;

// Booking.com-style results page: left filters sidebar (map placeholder, budget cap, popular
// filters, location) + right column (breadcrumb, count/sort/list-grid toggle, one honest notice
// banner, list-view rows) -- structurally distinct from the home page's plain photo-card grid,
// per the reference screenshot. Filters here are real (they narrow DEMO_OPERATORS, no fabricated
// data or dark-pattern urgency copy), unlike the reference's own scarcity banners.
const DesktopResults: React.FC<{
  operators: DemoOperator[];
  destination: string;
  onChangeDestination: (d: string) => void;
  startOffset: number;
  days: number;
  dateFrom: string;
  dateTo: string;
  onSelectDate: (offset: number) => void;
  persone: number;
  onChangePersone: (v: number) => void;
  onSearch: () => void;
  onSelectOperator: (operator: DemoOperator) => void;
  onNavigateTab?: (tab: GuestTab) => void;
}> = ({
  operators,
  destination,
  onChangeDestination,
  startOffset,
  days,
  dateFrom,
  dateTo,
  onSelectDate,
  persone,
  onChangePersone,
  onSearch,
  onSelectOperator,
  onNavigateTab,
}) => {
  const [budgetMax, setBudgetMax] = useState(BUDGET_MAX);
  const [onlyBookable, setOnlyBookable] = useState(false);
  const [onlyTopRated, setOnlyTopRated] = useState(false);
  const [selectedTowns, setSelectedTowns] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<ResultSort>('consigliati');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const toggleTown = (town: string) =>
    setSelectedTowns((cur) => {
      const next = new Set(cur);
      if (next.has(town)) next.delete(town);
      else next.add(town);
      return next;
    });

  const bookableCount = operators.filter((o) => o.isBookable).length;
  const topRatedCount = operators.filter((o) => o.rating >= 4.5).length;
  const townCounts = useMemo(() => {
    const counts = new Map<string, number>();
    operators.forEach((o) => counts.set(o.town, (counts.get(o.town) ?? 0) + 1));
    return Array.from(counts.entries());
  }, [operators]);

  const filtered = useMemo(() => {
    let list = operators.filter((o) => o.priceFrom <= budgetMax);
    if (onlyBookable) list = list.filter((o) => o.isBookable);
    if (onlyTopRated) list = list.filter((o) => o.rating >= 4.5);
    if (selectedTowns.size > 0) list = list.filter((o) => selectedTowns.has(o.town));
    const sorted = [...list];
    if (sortBy === 'prezzo') sorted.sort((a, b) => a.priceFrom - b.priceFrom);
    else if (sortBy === 'valutazione') sorted.sort((a, b) => b.rating - a.rating);
    return sorted;
  }, [operators, budgetMax, onlyBookable, onlyTopRated, selectedTowns, sortBy]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DesktopNav onNavigateTab={onNavigateTab} />
      <DesktopSearchBar
        destination={destination}
        onChangeDestination={onChangeDestination}
        startOffset={startOffset}
        days={days}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onSelectDate={onSelectDate}
        persone={persone}
        onChangePersone={onChangePersone}
        onSearch={onSearch}
        compact
      />

      <ScrollView contentContainerStyle={styles.desktopResultsScroll}>
        <View style={styles.desktopResultsInner}>
          <Text style={styles.desktopBreadcrumb}>
            Home <Ionicons name="chevron-forward" size={11} color={colors.textMuted} />{' '}
            {destination === HERE_LABEL ? 'Tutte le destinazioni' : destination}
          </Text>

          <View style={styles.desktopResultsRow}>
            <View style={styles.desktopFiltersSidebar}>
              <View style={styles.desktopMapThumb}>
                <ItalyMapThumb width={64} height={80} />
                <Text style={styles.desktopMapThumbText}>Visualizza sulla mappa</Text>
              </View>

              <Text style={styles.desktopFilterSectionTitle}>Il tuo budget (al giorno)</Text>
              <Text style={styles.desktopBudgetValue}>Fino a {formatCurrency(budgetMax)}</Text>
              <View style={styles.desktopBudgetRow}>
                <Pressable
                  style={styles.desktopBudgetBtn}
                  onPress={() => setBudgetMax((m) => Math.max(BUDGET_MIN, m - BUDGET_STEP))}
                  accessibilityLabel="Diminuisci budget massimo"
                >
                  <Ionicons name="remove" size={16} color={colors.text} />
                </Pressable>
                <View style={styles.desktopBudgetTrack}>
                  <View
                    style={[
                      styles.desktopBudgetFill,
                      { width: `${((budgetMax - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100}%` },
                    ]}
                  />
                </View>
                <Pressable
                  style={styles.desktopBudgetBtn}
                  onPress={() => setBudgetMax((m) => Math.min(BUDGET_MAX, m + BUDGET_STEP))}
                  accessibilityLabel="Aumenta budget massimo"
                >
                  <Ionicons name="add" size={16} color={colors.text} />
                </Pressable>
              </View>

              <View style={styles.desktopFilterDivider} />
              <Text style={styles.desktopFilterSectionTitle}>Filtri popolari</Text>
              <Checkbox
                checked={onlyBookable}
                onToggle={() => setOnlyBookable((v) => !v)}
                label={`Prenotabile subito (${bookableCount})`}
              />
              <Checkbox
                checked={onlyTopRated}
                onToggle={() => setOnlyTopRated((v) => !v)}
                label={`Valutazione 4,5+ (${topRatedCount})`}
              />

              {townCounts.length > 1 && (
                <>
                  <View style={styles.desktopFilterDivider} />
                  <Text style={styles.desktopFilterSectionTitle}>Localita</Text>
                  {townCounts.map(([town, count]) => (
                    <Checkbox
                      key={town}
                      checked={selectedTowns.has(town)}
                      onToggle={() => toggleTown(town)}
                      label={`${town} (${count})`}
                    />
                  ))}
                </>
              )}
            </View>

            <View style={styles.desktopResultsMain}>
              {!bannerDismissed && (
                <View style={styles.desktopNoticeBanner}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.desktopNoticeBannerText}>
                    In questa demo Bagno Pietrasanta, Bagno Argentina e Bagno Roma hanno disponibilita reale: gli
                    altri stabilimenti saranno prenotabili a breve.
                  </Text>
                  <Pressable onPress={() => setBannerDismissed(true)} hitSlop={8} accessibilityLabel="Chiudi avviso">
                    <Ionicons name="close" size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              )}

              <View style={styles.desktopResultsHeaderRow}>
                <Text style={styles.desktopResultsCount}>
                  {filtered.length} {filtered.length === 1 ? 'stabilimento trovato' : 'stabilimenti trovati'}
                </Text>
                <View style={styles.desktopViewToggle}>
                  <Pressable
                    onPress={() => setViewMode('list')}
                    style={[styles.desktopViewToggleBtn, viewMode === 'list' && styles.desktopViewToggleBtnActive]}
                    accessibilityLabel="Vista elenco"
                  >
                    <Ionicons name="list" size={16} color={viewMode === 'list' ? colors.white : colors.text} />
                  </Pressable>
                  <Pressable
                    onPress={() => setViewMode('grid')}
                    style={[styles.desktopViewToggleBtn, viewMode === 'grid' && styles.desktopViewToggleBtnActive]}
                    accessibilityLabel="Vista griglia"
                  >
                    <Ionicons name="grid-outline" size={16} color={viewMode === 'grid' ? colors.white : colors.text} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.desktopSortRow}>
                {RESULT_SORTS.map((s) => (
                  <Chip key={s.key} label={s.label} selected={sortBy === s.key} onPress={() => setSortBy(s.key)} />
                ))}
              </View>

              {filtered.length === 0 ? (
                <View style={styles.desktopResultsEmpty}>
                  <Text style={styles.desktopResultsEmptyText}>Nessuno stabilimento corrisponde ai filtri scelti.</Text>
                </View>
              ) : viewMode === 'list' ? (
                <View style={styles.desktopResultsList}>
                  {filtered.map((op) => (
                    <DesktopResultRow key={op.id} operator={op} onPress={() => onSelectOperator(op)} />
                  ))}
                </View>
              ) : (
                <View style={styles.desktopGrid}>
                  {filtered.map((op) => (
                    <DesktopOperatorCard key={op.id} operator={op} onPress={() => onSelectOperator(op)} />
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const DesktopResultRow: React.FC<{ operator: DemoOperator; onPress: () => void }> = ({ operator, onPress }) => (
  <Pressable onPress={onPress} style={styles.desktopRowWrap}>
    {({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => (
      <View style={[styles.desktopRow, (pressed || hovered) && styles.desktopCardHovered]}>
        <View style={styles.desktopRowPhotoWrap}>
          <BeachPhoto photo={operator.photo} height={140} variant={0} borderRadius={radius.md} />
          {!operator.isBookable && (
            <View style={styles.desktopCardSoonBadge}>
              <Text style={styles.desktopCardSoonBadgeText}>Prossimamente</Text>
            </View>
          )}
        </View>
        <View style={styles.desktopRowBody}>
          <Text style={styles.desktopCardName} numberOfLines={1}>
            {operator.name}
          </Text>
          <Text style={styles.desktopCardTown}>{operator.town}</Text>
          <Text style={styles.desktopCardTagline} numberOfLines={2}>
            {operator.tagline}
          </Text>
          <View style={styles.desktopRowRatingRow}>
            <View style={styles.desktopRatingPill}>
              <Text style={styles.desktopRatingPillText}>{operator.rating.toFixed(1)}</Text>
            </View>
            <Text style={styles.desktopCardReviews}>{operator.reviewCount} recensioni</Text>
          </View>
        </View>
        <View style={styles.desktopRowPriceCol}>
          <Text style={styles.desktopCardPriceHint}>A partire da</Text>
          <Text style={styles.desktopRowPrice}>{formatCurrency(operator.priceFrom)}</Text>
          <Text style={styles.desktopCardPriceUnit}>/ombrellone al giorno</Text>
          <View style={styles.desktopRowCta}>
            <Text style={styles.desktopRowCtaText}>Vedi disponibilita</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.white} />
          </View>
        </View>
      </View>
    )}
  </Pressable>
);

// Ordered so the first 3 (Pulizia/Comfort/Servizi) are the "always visible" bars, matching the
// reference screenshots' Cleanliness/Comfort/Facilities trio -- the rest sit behind "Show more".
const REVIEW_CATEGORIES: Array<{ label: string; score: number }> = [
  { label: 'Pulizia', score: 9.5 },
  { label: 'Comfort', score: 9.4 },
  { label: 'Servizi', score: 9.2 },
  { label: 'Personale', score: 9.1 },
  { label: 'Rapporto qualita/prezzo', score: 8.9 },
  { label: 'Posizione', score: 9.0 },
];
const REVIEW_CATEGORIES_VISIBLE_COUNT = 3;

// Shared "Cleanliness/Comfort/Facilities... Show more" rating breakdown block, used by both the
// mobile and desktop property pages so their score bars/thresholds never drift apart.
const RatingBreakdown: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? REVIEW_CATEGORIES : REVIEW_CATEGORIES.slice(0, REVIEW_CATEGORIES_VISIBLE_COUNT);
  return (
    <View style={{ marginTop: spacing.md }}>
      {visible.map((c) => (
        <View key={c.label} style={styles.desktopCategoryItem}>
          <View style={styles.desktopCategoryLabelRow}>
            <Text style={styles.desktopCategoryLabel}>{c.label}</Text>
            <Text style={styles.desktopCategoryScore}>{c.score.toFixed(1)}</Text>
          </View>
          <View style={styles.desktopCategoryBarTrack}>
            <View style={[styles.desktopCategoryBarFill, { width: `${(c.score / 10) * 100}%` }]} />
          </View>
        </View>
      ))}
      {!expanded && (
        <Pressable onPress={() => setExpanded(true)} hitSlop={8} style={{ marginTop: spacing.xs }}>
          <Text style={styles.detailShowMoreLink}>Mostra altro</Text>
        </Pressable>
      )}
    </View>
  );
};

// Shared "Guests who stayed here loved" review-card list, used by both mobile and desktop.
const GuestReviewsSection: React.FC = () => (
  <View style={{ marginTop: spacing.md, gap: spacing.md }}>
    {GUEST_REVIEWS.map((r) => (
      <View key={r.name} style={styles.reviewCard2}>
        <View style={styles.reviewCard2Header}>
          <View style={styles.reviewCard2Avatar}>
            <Text style={styles.reviewCard2AvatarText}>{r.name[0]}</Text>
          </View>
          <View>
            <Text style={styles.reviewCard2Name}>
              {r.name} - {r.type}
            </Text>
            <Text style={styles.reviewCard2Country}>
              {r.flag} {r.country}
            </Text>
          </View>
        </View>
        <Text style={styles.reviewCard2Quote}>&ldquo;{r.quote}&rdquo;</Text>
      </View>
    ))}
  </View>
);

// Shared "Property highlights" pill row, used by both mobile and desktop property pages.
const PropertyHighlightsRow: React.FC = () => (
  <View style={styles.highlightsRow}>
    {PROPERTY_HIGHLIGHTS.map((h) => (
      <View key={h.title} style={styles.highlightPill}>
        <View style={styles.highlightIconCircle}>
          <Ionicons name={h.icon} size={18} color={colors.primaryDark} />
        </View>
        <Text style={styles.highlightTitle}>{h.title}</Text>
        <Text style={styles.highlightSubtitle}>{h.subtitle}</Text>
      </View>
    ))}
  </View>
);

// Shared 2-large-top + 3-small-bottom (last tile carrying a "+N" overlay) photo gallery grid,
// matching the reference screenshots' structure exactly -- used by both mobile and desktop.
const GalleryGrid: React.FC<{ photo: DemoOperator['photo']; mainHeight: number; smallHeight: number; extraCount?: number }> = ({
  photo,
  mainHeight,
  smallHeight,
  extraCount = 33,
}) => (
  <View style={{ gap: spacing.xs }}>
    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
      <BeachPhoto photo={photo} height={mainHeight} variant={0} style={{ flex: 1 }} borderRadius={radius.lg} />
      <BeachPhoto photo={photo} height={mainHeight} variant={1} style={{ flex: 1 }} borderRadius={radius.lg} />
    </View>
    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
      <BeachPhoto photo={photo} height={smallHeight} variant={2} style={{ flex: 1 }} borderRadius={radius.lg} />
      <BeachPhoto photo={photo} height={smallHeight} variant={3} style={{ flex: 1 }} borderRadius={radius.lg} />
      <View style={{ flex: 1 }}>
        <BeachPhoto photo={photo} height={smallHeight} variant={4} style={{ width: '100%' }} borderRadius={radius.lg} />
        <View style={styles.galleryMoreOverlay} pointerEvents="none">
          <Text style={styles.galleryMoreOverlayText}>+{extraCount}</Text>
        </View>
      </View>
    </View>
  </View>
);

// Two-column desktop detail page: photo gallery + description/costs/services/reviews on the
// left, a price+Reserve card on the right. "Prenota" carries the dates/guest count from the
// home search card straight into the real booking wizard, same as the mobile flow -- choosing
// a specific price band/package/lettini count only makes sense once a specific umbrella (and
// therefore a specific band) is picked, so that now lives in the booking form itself, right
// after the guest has picked their spot on the real map (see BookingForm's package table).
const DesktopDetail: React.FC<{
  operator: DemoOperator;
  startOffset: number;
  days: number;
  fallbackGuests: number;
  onBack: () => void;
  onBook: (selection: SearchSelection) => void;
  onNavigateTab?: (tab: GuestTab) => void;
}> = ({ operator, startOffset, days, fallbackGuests, onBack, onBook, onNavigateTab }) => {
  const { getActivePriceList, umbrellas } = useStore();
  const priceList = operator.isBookable ? getActivePriceList() : null;
  // The cheapest real price band (Fila interna) -- an honest "starting from" figure that
  // matches what the guest will actually see once they reach the real map, rather than the
  // unrelated flat 'art-ombrellone' article price (which disagreed with it). Choosing a
  // specific package/lettini count only makes sense once a specific umbrella (and therefore a
  // specific band) is picked, so that choice now lives in the real booking form after the
  // guest has picked their spot on the map -- this page just gets them there.
  const cheapestBandPrice = useMemo(() => {
    const prices = umbrellas.map(baseUmbrellaPricePerDay);
    return prices.length ? Math.min(...prices) : operator.priceFrom;
  }, [umbrellas, operator.priceFrom]);
  const dateFrom = useMemo(() => isoDate(startOffset), [startOffset]);
  const dateTo = useMemo(() => isoDate(startOffset + days - 1), [startOffset, days]);
  const umbrellasNeeded = umbrellasNeededFor(Math.max(1, fallbackGuests));
  const totalFrom = cheapestBandPrice * umbrellasNeeded * days;

  const handleReserve = () => onBook({ startOffset, days, guests: fallbackGuests });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DesktopNav onNavigateTab={onNavigateTab} />
      <ScrollView contentContainerStyle={styles.desktopDetailBody}>
        <Pressable onPress={onBack} style={styles.desktopBackLink} hitSlop={8}>
          <Ionicons name="chevron-back" size={16} color={colors.primary} />
          <Text style={styles.desktopBackLinkText}>Torna ai risultati</Text>
        </Pressable>

        <Text style={styles.desktopDetailTitle}>{operator.name}</Text>
        <View style={styles.desktopDetailMetaRow}>
          <View style={styles.desktopRatingPill}>
            <Text style={styles.desktopRatingPillText}>{operator.rating.toFixed(1)}</Text>
          </View>
          <Text style={styles.desktopDetailMetaText}>
            {operator.reviewCount} recensioni · {operator.town}
          </Text>
        </View>

        <GalleryGrid photo={operator.photo} mainHeight={260} smallHeight={140} />

        <Text style={styles.detailSectionTitle}>Punti di forza della struttura</Text>
        <PropertyHighlightsRow />

        <View style={styles.desktopDetailColumns}>
          <View style={styles.desktopDetailMain}>
            <Text style={styles.detailSectionTitle}>Descrizione</Text>
            <Text style={styles.detailParagraph}>{operator.tagline}.</Text>

            <Text style={styles.detailSectionTitle}>Servizi presenti</Text>
            <View style={styles.detailServiceRow}>
              <Ionicons name="accessibility-outline" size={16} color={colors.peachDark} />
              <Text style={styles.detailServiceText}>Adatto ai disabili</Text>
            </View>
            <View style={styles.detailServiceRow}>
              <Ionicons name="cafe-outline" size={16} color={colors.peachDark} />
              <Text style={styles.detailServiceText}>Bar sulla spiaggia</Text>
            </View>

            <Text style={styles.detailSectionTitle}>Recensioni</Text>
            <View style={styles.desktopRatingRow}>
              <View style={styles.desktopRatingBadgeLarge}>
                <Text style={styles.desktopRatingBadgeLargeText}>{operator.rating.toFixed(1)}</Text>
              </View>
              <View>
                <Text style={styles.desktopRatingSummary}>{ratingSummaryLabel(operator.rating)}</Text>
                <Text style={styles.detailRatingCount}>Vedi {operator.reviewCount} recensioni</Text>
              </View>
            </View>
            <RatingBreakdown />

            <Text style={[styles.detailSectionTitle, { marginTop: spacing.lg }]}>Gli ospiti hanno apprezzato</Text>
            <GuestReviewsSection />
          </View>

          <View style={styles.desktopDetailSidebar}>
            <View style={styles.desktopPriceCard}>
              {priceList ? (
                <>
                  <View style={styles.checkRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.checkLabel}>Check-in</Text>
                      <Text style={styles.checkValue}>{formatDateShort(dateFrom)}</Text>
                    </View>
                    <View style={styles.checkDivider} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.checkLabel}>Check-out</Text>
                      <Text style={styles.checkValue}>{formatDateShort(dateTo)}</Text>
                    </View>
                  </View>
                  <Text style={[styles.detailSectionTitle, { marginTop: spacing.md }]}>Hai cercato</Text>
                  <Text style={styles.searchedForLink}>
                    {umbrellasNeeded} {umbrellasNeeded === 1 ? 'ombrellone' : 'ombrelloni'} ·{' '}
                    {Math.max(1, fallbackGuests)} {fallbackGuests === 1 ? 'persona' : 'persone'}
                  </Text>
                  <Text style={[styles.detailSectionTitle, { marginTop: spacing.md }]}>
                    Prezzo per {days} {days === 1 ? 'giorno' : 'giorni'}
                  </Text>
                  <Text style={styles.desktopPriceCardAmount}>{formatCurrency(totalFrom)}</Text>
                  <Text style={styles.desktopPriceCardHint}>a partire da, tasse incluse</Text>
                  <View style={{ marginTop: spacing.sm, gap: 4 }}>
                    <View style={styles.checkmarkRow}>
                      <Ionicons name="checkmark" size={14} color={colors.success} />
                      <Text style={styles.checkmarkRowTextGreen}>Cancellazione gratuita</Text>
                    </View>
                    <View style={styles.checkmarkRow}>
                      <Ionicons name="checkmark" size={14} color={colors.success} />
                      <Text style={styles.checkmarkRowTextGreen}>Nessun anticipo richiesto</Text>
                    </View>
                  </View>
                  <Button title="Vedi disponibilita" onPress={handleReserve} style={{ marginTop: spacing.md }} />
                </>
              ) : (
                <>
                  <View style={styles.detailComingSoonBox}>
                    <Ionicons name="time-outline" size={18} color={colors.primaryDark} />
                    <Text style={styles.detailComingSoonText}>
                      Prenotabile prossimamente in questa demo. Prova con Bagno Pietrasanta, Bagno Argentina o Bagno
                      Roma.
                    </Text>
                  </View>
                  <Button title="Prossimamente" onPress={handleReserve} disabled style={{ marginTop: spacing.md }} />
                </>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  homeScroll: { paddingBottom: spacing.xl },
  heroBand: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl + spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroTitle: { flex: 1, fontSize: 26, lineHeight: 32, fontWeight: '800', color: colors.white },
  heroBadgeSlot: { marginLeft: spacing.md, marginTop: -spacing.xs },
  umbrellaBadgeCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  searchCard: {
    backgroundColor: colors.peach,
    borderRadius: radius.xl,
    marginHorizontal: spacing.lg,
    marginTop: -spacing.xxl,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  searchFieldText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  dayModeRow: { flexDirection: 'row', gap: spacing.lg },
  dayModeOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayModeLabel: { fontSize: 13, fontWeight: '700', color: colors.white },
  personeRow: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  popularHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xxl,
  },
  popularSeeAll: { fontSize: 13, fontWeight: '700', color: colors.primary },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  body: { padding: spacing.lg, paddingTop: spacing.xs, flexGrow: 1 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  pageHint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  input: { flex: 1, fontSize: 14, color: colors.text },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.prenotatoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: { fontSize: 14, fontWeight: '600', color: colors.text },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  footerSummary: { textAlign: 'center', fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.xs },
  operatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
  },
  operatorCardPressed: {
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  operatorThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.peachBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorThumbChevron: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorName: { fontSize: 15, fontWeight: '800', color: colors.text },
  operatorTown: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  operatorTagline: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 16 },

  detailTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailTopBarTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.text, marginHorizontal: spacing.sm },
  detailBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBody: { padding: spacing.lg, gap: spacing.sm },
  detailTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  detailTitleBig: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.text, lineHeight: 26 },
  detailTitleRatingBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detailTitleRatingBadgeText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  detailAddressLine: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  detailParagraph: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  detailSectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: spacing.md },
  detailServiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  detailServiceText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  detailComingSoonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.prenotatoBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  detailComingSoonText: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.primaryDark },
  detailRatingCount: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  detailShowMoreLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
  detailDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  galleryMoreOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryMoreOverlayText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  highlightsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  highlightPill: {
    width: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  highlightIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.prenotatoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  highlightTitle: { fontSize: 12, fontWeight: '800', color: colors.text },
  highlightSubtitle: { fontSize: 11, color: colors.textMuted },
  checkRow: { flexDirection: 'row', alignItems: 'center' },
  checkLabel: { fontSize: 13, fontWeight: '800', color: colors.text },
  checkValue: { fontSize: 13, color: colors.primary, fontWeight: '700', marginTop: 2 },
  checkDivider: { width: 1, height: 30, backgroundColor: colors.border, marginHorizontal: spacing.md },
  searchedForLink: { fontSize: 13, color: colors.primary, fontWeight: '700', marginTop: 2 },
  priceSummaryAmount: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 2 },
  priceSummaryHint: { fontSize: 11, color: colors.textMuted },
  checkmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkmarkRowTextGreen: { fontSize: 12, fontWeight: '700', color: colors.success },
  ratingCardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  reviewCard2: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  reviewCard2Header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewCard2Avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCard2AvatarText: { fontSize: 14, fontWeight: '800', color: colors.peachDark },
  reviewCard2Name: { fontSize: 13, fontWeight: '800', color: colors.text },
  reviewCard2Country: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  reviewCard2Quote: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  detailFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailFooterPrice: { fontSize: 16, fontWeight: '800', color: colors.text },
  detailFooterPriceHint: { fontSize: 11, color: colors.textMuted },

  // --- Desktop-only (>= DESKTOP_BREAKPOINT) top-nav/hero-search/grid shell ---
  desktopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  desktopNavLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  desktopLogo: { fontSize: 18, fontWeight: '800', color: colors.white },
  desktopNavLinksRow: { flexDirection: 'row', gap: spacing.xl },
  desktopNavLink: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  // Booking.com's own page content sits in a centered ~1400px column with the colored nav/hero
  // bands running full-bleed behind it -- without this cap, the hero text/search bar/results
  // grid below just hug the left edge with a growing dead zone on the right as the window
  // widens past that column, which is what "the whole thing is on the left" was about.
  desktopHero: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + spacing.xl,
    alignItems: 'center',
  },
  desktopHeroInner: { width: '100%', maxWidth: 1400 },
  desktopHeroTitle: { fontSize: 32, fontWeight: '800', color: colors.white },
  desktopHeroSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: spacing.xs },
  desktopSearchBarWrap: {
    paddingHorizontal: spacing.xxl,
    marginTop: -spacing.xxl - spacing.md,
    marginBottom: spacing.xl,
    zIndex: 30,
    alignItems: 'center',
  },
  desktopSearchBarWrapResults: { marginTop: spacing.lg },
  desktopSearchBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    maxWidth: 900,
    // Must outrank desktopPopoverBackdrop's zIndex -- both are siblings under
    // desktopSearchBarWrap, and without this the backdrop (added later in JSX, so painted on
    // top by default) sits above this whole bar and swallows every click meant for the
    // destination/dates/guests popovers nested inside it.
    zIndex: 30,
  },
  desktopSearchField: { flex: 1 },
  desktopSearchFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  desktopFieldLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  desktopFieldValue: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 1 },
  desktopSearchDivider: { width: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  desktopSearchBtn: { paddingHorizontal: spacing.xl, marginLeft: spacing.xs, alignSelf: 'center' },
  desktopPopoverBackdrop: {
    position: 'absolute',
    top: -2000,
    left: -2000,
    right: -2000,
    bottom: -2000,
    zIndex: 25,
  },
  desktopPopover: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: spacing.sm,
    width: 280,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    zIndex: 30,
  },
  desktopPopoverTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  desktopPopoverSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  desktopPopoverInput: { flex: 1, fontSize: 13, color: colors.text, paddingVertical: spacing.sm },
  // ScrollView's contentContainerStyle doesn't reliably center via maxWidth+alignSelf on web
  // (its content wrapper defaults to stretch-filling the scrollable viewport) -- centering the
  // outer container's children instead, with the actual maxWidth cap on a plain inner View,
  // works the same way the hero/search-bar centering above does.
  desktopBody: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl, alignItems: 'center' },
  desktopBodyInner: { width: '100%', maxWidth: 1400 },
  desktopSectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  desktopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  desktopCardWrap: { width: 300 },
  desktopCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  desktopCardHovered: {
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  desktopCardPhotoWrap: { position: 'relative' },
  desktopCardSoonBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(35,48,68,0.85)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  desktopCardSoonBadgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  desktopCardBody: { padding: spacing.md },
  desktopCardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  desktopCardName: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
  desktopRatingPill: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  desktopRatingPillText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  desktopCardTown: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  desktopCardTagline: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  desktopCardReviews: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm },
  desktopCardPriceRow: { marginTop: spacing.sm, alignItems: 'flex-end' },
  desktopCardPriceHint: { fontSize: 11, color: colors.textMuted },
  desktopCardPrice: { fontSize: 17, fontWeight: '800', color: colors.text },
  desktopCardPriceUnit: { fontSize: 11, fontWeight: '600', color: colors.textMuted },

  // --- Desktop detail page ---
  desktopDetailBody: { paddingHorizontal: spacing.xxl, paddingVertical: spacing.xl, maxWidth: 1100, alignSelf: 'center', width: '100%' },
  desktopBackLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.md },
  desktopBackLinkText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  desktopDetailTitle: { fontSize: 26, fontWeight: '800', color: colors.text },
  desktopDetailMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.lg },
  desktopDetailMetaText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  desktopDetailColumns: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start', marginTop: spacing.xl },
  desktopDetailMain: { flex: 2 },
  desktopDetailSidebar: { flex: 1, minWidth: 260 },
  desktopPriceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'sticky' as any,
    top: spacing.lg,
  },
  desktopPriceCardHint: { fontSize: 12, color: colors.textMuted },
  desktopPriceCardAmount: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 2 },
  desktopPriceCardFootnote: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },

  desktopRatingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs, marginBottom: spacing.lg },
  desktopRatingBadgeLarge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopRatingBadgeLargeText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  desktopRatingSummary: { fontSize: 14, fontWeight: '800', color: colors.text },
  desktopCategoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginBottom: spacing.lg },
  desktopCategoryItem: { width: 240 },
  desktopCategoryLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  desktopCategoryLabel: { fontSize: 12, color: colors.text, fontWeight: '600' },
  desktopCategoryScore: { fontSize: 12, color: colors.text, fontWeight: '800' },
  desktopCategoryBarTrack: { height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  desktopCategoryBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },

  // --- Desktop results page ---
  desktopResultsScroll: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl, alignItems: 'center' },
  desktopResultsInner: { width: '100%', maxWidth: 1400 },
  desktopBreadcrumb: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.md },
  desktopResultsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },

  desktopFiltersSidebar: {
    width: 260,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    position: 'sticky' as any,
    top: spacing.lg,
  },
  desktopMapThumb: {
    height: 110,
    borderRadius: radius.md,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    gap: 4,
  },
  desktopMapThumbText: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  desktopFilterSectionTitle: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  desktopBudgetValue: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
  desktopBudgetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  desktopBudgetBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopBudgetTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  desktopBudgetFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  desktopFilterDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },

  desktopResultsMain: { flex: 1, minWidth: 0 },
  desktopNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  desktopNoticeBannerText: { flex: 1, fontSize: 12.5, color: colors.text, lineHeight: 17 },
  desktopResultsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  desktopResultsCount: { fontSize: 18, fontWeight: '800', color: colors.text },
  desktopViewToggle: { flexDirection: 'row', gap: 4, backgroundColor: colors.sand, borderRadius: radius.sm, padding: 3 },
  desktopViewToggleBtn: { width: 30, height: 30, borderRadius: radius.sm - 2, alignItems: 'center', justifyContent: 'center' },
  desktopViewToggleBtnActive: { backgroundColor: colors.primary },
  desktopSortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.lg },

  desktopResultsEmpty: { padding: spacing.xl, alignItems: 'center' },
  desktopResultsEmptyText: { fontSize: 14, color: colors.textMuted },
  desktopResultsList: { gap: spacing.md },
  desktopRowWrap: {},
  desktopRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  desktopRowPhotoWrap: { width: 220, position: 'relative' },
  desktopRowBody: { flex: 1, padding: spacing.lg },
  desktopRowRatingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  desktopRowPriceCol: {
    width: 180,
    padding: spacing.lg,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  desktopRowPrice: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 2 },
  desktopRowCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  desktopRowCtaText: { color: colors.white, fontSize: 12, fontWeight: '700' },
});
