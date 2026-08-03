import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppAlert } from '../../components/AppAlert';
import { BeachPhoto } from '../../components/BeachPhoto';
import { Calendar } from '../../components/Calendar';
import { Button, Card, Stepper } from '../../components/UI';
import { useStore } from '../../store/StoreContext';
import { colors, radius, spacing } from '../../theme';
import { DEMO_OPERATORS, DEMO_TOWNS, DemoOperator } from '../../data/demoOperators';
import { refundCutoffDate } from '../../utils/cancellation';
import { findActiveHoldConflict, findUmbrellaConflict, MAX_ADULTS_PER_UMBRELLA } from '../../utils/booking';
import { baseUmbrellaPricePerDay } from '../../utils/pricing';
import { formatCurrency, formatDateShort, isoDate } from '../../utils/format';
import { Umbrella } from '../../types';

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
// Everything here is presentation over the static DEMO_OPERATORS list -- the local-fallback
// store only ever models one beach's real inventory (Bagno Pietrasanta), so only that card
// routes into the real map/wizard; the others show a "coming soon" message when tapped.
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
        `${op.name} sarà prenotabile presto in questa demo. Prova intanto con Bagno Pietrasanta.`
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
          dateFrom={dateFrom}
          dateTo={dateTo}
          startOffset={startOffset}
          days={days}
          fallbackGuests={persone}
          onBack={() => setStep(detailReturnStep)}
          onBook={(sel) => handlePickOperator(detailOperator, sel)}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    return (
      <DesktopShell
        mode={step === 'results' ? 'results' : 'home'}
        operators={step === 'results' ? filteredOperators : DEMO_OPERATORS}
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
        onSelectOperator={(op) => openDetail(op, step === 'results' ? 'results' : 'home')}
        onBackHome={() => setStep('home')}
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

type DetailTab = 'panoramica' | 'recensioni' | 'foto';

const DETAIL_REVIEWS = [
  { name: 'Fantastico', stars: 5 },
  { name: 'Servizi incredibili', stars: 4 },
];

const DETAIL_PHOTO_TILES = 9;

// Only Bagno Pietrasanta is real, bookable inventory (see demoOperators.ts) -- its Costi
// section pulls the actual base prices from the store's active price list rather than
// inventing numbers; the other demo operators show a plain "coming soon" notice instead of
// a fabricated price, matching this file's existing rule against disconnected made-up costs.
const BeachDetailScreen: React.FC<{
  operator: DemoOperator;
  onBack: () => void;
  onBook: () => void;
}> = ({ operator, onBack, onBook }) => {
  const [tab, setTab] = useState<DetailTab>('panoramica');
  const { getActivePriceList } = useStore();
  const priceList = operator.isBookable ? getActivePriceList() : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.detailHero}>
        <Pressable onPress={onBack} style={styles.detailBackBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.white} />
        </Pressable>
        <View style={styles.detailHeroIconWrap}>
          <Ionicons name="umbrella" size={56} color="rgba(255,255,255,0.5)" />
        </View>
        <Text style={styles.detailHeroTitle} numberOfLines={2}>
          {operator.name}
        </Text>
      </View>

      <View style={styles.detailTabsRow}>
        {(['panoramica', 'recensioni', 'foto'] as DetailTab[]).map((t) => (
          <Pressable key={t} style={styles.detailTab} onPress={() => setTab(t)}>
            <Text style={[styles.detailTabText, tab === t && styles.detailTabTextActive]}>
              {t === 'panoramica' ? 'Panoramica' : t === 'recensioni' ? 'Recensioni' : 'Foto'}
            </Text>
            {tab === t && <View style={styles.detailTabUnderline} />}
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.detailBody}>
        {tab === 'panoramica' && (
          <>
            <Text style={styles.detailParagraph}>{operator.tagline}.</Text>
            {priceList ? (
              <>
                <Text style={styles.detailSectionTitle}>Costi</Text>
                <Text style={styles.detailParagraph}>
                  Ombrellone: {formatCurrency(priceList.prices['art-ombrellone'] ?? 0)}/giorno
                </Text>
                <Text style={styles.detailParagraph}>
                  Sdraio: {formatCurrency(priceList.prices['art-sdraio'] ?? 0)}/giorno
                </Text>
                <Text style={styles.detailSectionTitle}>Servizi presenti</Text>
                <View style={styles.detailServiceRow}>
                  <Ionicons name="accessibility-outline" size={16} color={colors.peachDark} />
                  <Text style={styles.detailServiceText}>Adatto ai disabili</Text>
                </View>
                <View style={styles.detailServiceRow}>
                  <Ionicons name="cafe-outline" size={16} color={colors.peachDark} />
                  <Text style={styles.detailServiceText}>Bar sulla spiaggia</Text>
                </View>
              </>
            ) : (
              <View style={styles.detailComingSoonBox}>
                <Ionicons name="time-outline" size={18} color={colors.primaryDark} />
                <Text style={styles.detailComingSoonText}>
                  Prenotabile prossimamente in questa demo. Prova intanto con Bagno Pietrasanta.
                </Text>
              </View>
            )}
          </>
        )}

        {tab === 'recensioni' && (
          <>
            <View style={styles.detailRatingRow}>
              <Text style={styles.detailRatingScore}>4,9</Text>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ionicons key={i} name="ellipse" size={12} color={colors.primary} />
                ))}
              </View>
              <Text style={styles.detailRatingCount}>100 recensioni</Text>
            </View>
            {DETAIL_REVIEWS.map((r) => (
              <View key={r.name} style={styles.detailReviewCard}>
                <View style={styles.detailReviewHeader}>
                  <View style={styles.detailReviewAvatar}>
                    <Ionicons name="person" size={16} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.detailReviewName}>{r.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Ionicons
                          key={i}
                          name={i < r.stars ? 'ellipse' : 'ellipse-outline'}
                          size={9}
                          color={colors.primary}
                        />
                      ))}
                    </View>
                  </View>
                </View>
                <Text style={styles.detailParagraph}>
                  Ottima esperienza, personale gentile e spiaggia curata nei minimi dettagli.
                </Text>
              </View>
            ))}
          </>
        )}

        {tab === 'foto' && (
          <>
            <Text style={styles.detailPhotoHint}>Foto più recenti</Text>
            <View style={styles.detailPhotoGrid}>
              {Array.from({ length: DETAIL_PHOTO_TILES }).map((_, i) => (
                <View key={i} style={[styles.detailPhotoTile, i % 2 === 0 && styles.detailPhotoTileAlt]}>
                  <Ionicons name="umbrella-outline" size={20} color="rgba(255,255,255,0.7)" />
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.detailFooter}>
        {priceList ? (
          <View>
            <Text style={styles.detailFooterPrice}>{formatCurrency(priceList.prices['art-ombrellone'] ?? 0)}/giorno</Text>
            <Text style={styles.detailFooterPriceHint}>per ombrellone</Text>
          </View>
        ) : (
          <Text style={styles.detailFooterPriceHint}>Non disponibile in questa demo</Text>
        )}
        <Button title="Prenota" onPress={onBook} style={{ paddingHorizontal: spacing.xl }} />
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
const DesktopNav: React.FC<{ onLogoPress?: () => void; onNavigateTab?: (tab: GuestTab) => void }> = ({
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

// Booking.com-style top nav + hero + inline search bar (destination/dates/guests each open a
// small functional popover instead of pushing a full-screen sub-step, since desktop has room
// to show them inline) + a photo-card results grid -- covers both the plain "home" state
// (hero + "popular" grid) and "results" state (post-search grid, no hero) with one component
// so the search bar/nav chrome never has to remount between them.
const DesktopShell: React.FC<{
  mode: 'home' | 'results';
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
  onBackHome: () => void;
  onNavigateTab?: (tab: GuestTab) => void;
}> = ({
  mode,
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
  onBackHome,
  onNavigateTab,
}) => {
  const [openField, setOpenField] = useState<DesktopField>(null);
  const [destQuery, setDestQuery] = useState('');
  const destSuggestions = useMemo(
    () => DEMO_TOWNS.filter((t) => t.toLowerCase().includes(destQuery.trim().toLowerCase())),
    [destQuery]
  );
  const toggleField = (f: DesktopField) => setOpenField((cur) => (cur === f ? null : f));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DesktopNav onLogoPress={mode === 'results' ? onBackHome : undefined} onNavigateTab={onNavigateTab} />

      {mode === 'home' && (
        <View style={styles.desktopHero}>
          <Text style={styles.desktopHeroTitle}>Dove vuoi rilassarti?</Text>
          <Text style={styles.desktopHeroSubtitle}>Prenota il tuo ombrellone in pochi click.</Text>
        </View>
      )}

      <View style={[styles.desktopSearchBarWrap, mode === 'results' && styles.desktopSearchBarWrapResults]}>
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
              <View style={[styles.desktopPopover, { width: 240 }]}>
                <Stepper label="Persone" icon="people-outline" value={persone} onChange={onChangePersone} />
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

      <ScrollView contentContainerStyle={styles.desktopBody}>
        <Text style={styles.desktopSectionTitle}>
          {mode === 'results' ? `${operators.length} stabilimenti trovati` : 'Posti popolari'}
        </Text>
        <View style={styles.desktopGrid}>
          {operators.map((op) => (
            <DesktopOperatorCard key={op.id} operator={op} onPress={() => onSelectOperator(op)} />
          ))}
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

// One row of the Availability table -- a real price band (see baseUmbrellaPricePerDay) crossed
// with an equipment package (bare vs. + lettini), each independently quantity-selectable. Only
// ever built for the one bookable operator: everything here (price, refund-cutoff date, free
// count) comes straight from the real store/pricing engine, never a fabricated number.
interface AvailabilityRow {
  key: string;
  bandLabel: string;
  filaRange: string;
  pricePerDay: number;
  packageLabel: string;
  beds: number;
  freeCount: number;
}

function buildAvailabilityRows(
  umbrellas: Umbrella[],
  bookings: ReturnType<typeof useStore>['bookings'],
  holds: ReturnType<typeof useStore>['holds'],
  dateFrom: string,
  dateTo: string,
  bedRate: number
): AvailabilityRow[] {
  const byPrice = new Map<number, Umbrella[]>();
  umbrellas.forEach((u) => {
    const price = baseUmbrellaPricePerDay(u);
    byPrice.set(price, [...(byPrice.get(price) ?? []), u]);
  });
  const sortedPrices = Array.from(byPrice.keys()).sort((a, b) => b - a);
  const bandNames = ['Prima fila', 'Vicino al mare', 'Zona centrale', 'Fila interna'];
  const rows: AvailabilityRow[] = [];
  sortedPrices.forEach((price, idx) => {
    const group = byPrice.get(price) ?? [];
    const filaMin = Math.min(...group.map((u) => u.row)) + 1;
    const filaMax = Math.max(...group.map((u) => u.row)) + 1;
    const freeCount = group.filter(
      (u) => !findUmbrellaConflict(bookings, u.id, dateFrom, dateTo) && !findActiveHoldConflict(holds, u.id, dateFrom, dateTo)
    ).length;
    const filaRange = filaMin === filaMax ? `Fila ${filaMin}` : `Fila ${filaMin}-${filaMax}`;
    const bandLabel = bandNames[idx] ?? filaRange;
    rows.push({
      key: `${price}-bare`,
      bandLabel,
      filaRange,
      pricePerDay: price,
      packageLabel: 'Solo ombrellone',
      beds: 0,
      freeCount,
    });
    rows.push({
      key: `${price}-beds`,
      bandLabel,
      filaRange,
      pricePerDay: price + 2 * bedRate,
      packageLabel: 'Ombrellone + 2 lettini',
      beds: 2,
      freeCount,
    });
  });
  return rows;
}

const REVIEW_CATEGORIES: Array<{ label: string; score: number }> = [
  { label: 'Personale', score: 9.1 },
  { label: 'Servizi', score: 9.2 },
  { label: 'Pulizia', score: 9.5 },
  { label: 'Comfort', score: 9.4 },
  { label: 'Rapporto qualita/prezzo', score: 8.9 },
  { label: 'Posizione', score: 9.0 },
];

// Two-column desktop detail page (photo gallery + description/costs/services/reviews on the
// left, a sticky price+Reserve card on the right) plus a Booking.com-style Availability table:
// each row crosses a real price band with a real equipment package, its own live free-count
// for the selected dates, and a quantity selector -- selecting quantities and pressing Prenota
// carries the resulting guest count (qty * MAX_ADULTS_PER_UMBRELLA) and the dates chosen here
// straight into the real booking wizard's initial state, same as the plain "Prenota" shortcut
// falls back to the guest count/dates carried from the home search card.
const DesktopDetail: React.FC<{
  operator: DemoOperator;
  dateFrom: string;
  dateTo: string;
  startOffset: number;
  days: number;
  fallbackGuests: number;
  onBack: () => void;
  onBook: (selection: SearchSelection) => void;
  onNavigateTab?: (tab: GuestTab) => void;
}> = ({
  operator,
  dateFrom: initialDateFrom,
  dateTo: initialDateTo,
  startOffset: initialStartOffset,
  days: initialDays,
  fallbackGuests,
  onBack,
  onBook,
  onNavigateTab,
}) => {
  const { getActivePriceList, umbrellas, bookings, holds } = useStore();
  const priceList = operator.isBookable ? getActivePriceList() : null;
  const [startOffset, setStartOffset] = useState(initialStartOffset);
  const [days, setDays] = useState(initialDays);
  const [awaitingEndDate, setAwaitingEndDate] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [qtyByRow, setQtyByRow] = useState<Record<string, number>>({});

  const dateFrom = useMemo(() => isoDate(startOffset), [startOffset]);
  const dateTo = useMemo(() => isoDate(startOffset + days - 1), [startOffset, days]);

  const handleSelectDate = (offset: number) => {
    if (awaitingEndDate && offset > startOffset) {
      setDays(offset - startOffset + 1);
      setAwaitingEndDate(false);
      setDatesOpen(false);
    } else {
      setStartOffset(offset);
      setDays(1);
      setAwaitingEndDate(true);
    }
  };

  const bedRate = priceList?.prices['art-lettino'] ?? 6;
  const rows = useMemo(
    () => (priceList ? buildAvailabilityRows(umbrellas, bookings, holds, dateFrom, dateTo, bedRate) : []),
    [priceList, umbrellas, bookings, holds, dateFrom, dateTo, bedRate]
  );
  const cutoff = useMemo(() => formatDateShort(refundCutoffDate(dateFrom)), [dateFrom]);

  const totalUmbrellas = Object.values(qtyByRow).reduce((sum, q) => sum + q, 0);
  const totalPrice = rows.reduce((sum, r) => sum + (qtyByRow[r.key] ?? 0) * r.pricePerDay * days, 0);

  const handleReserve = () => {
    const guests = totalUmbrellas > 0 ? totalUmbrellas * MAX_ADULTS_PER_UMBRELLA : fallbackGuests;
    onBook({ startOffset, days, guests });
  };

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

        <View style={styles.desktopGalleryRow}>
          <BeachPhoto photo={operator.photo} height={340} variant={0} style={styles.desktopGalleryMain} borderRadius={radius.lg} />
          <View style={styles.desktopGallerySide}>
            <BeachPhoto photo={operator.photo} height={162} variant={1} style={styles.desktopGallerySideTile} borderRadius={radius.lg} />
            <BeachPhoto photo={operator.photo} height={162} variant={2} style={styles.desktopGallerySideTile} borderRadius={radius.lg} />
          </View>
        </View>

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

            <View style={styles.desktopAvailabilitySection}>
              <View style={styles.desktopAvailabilityHeaderRow}>
                <Text style={styles.detailSectionTitle}>Disponibilità</Text>
              </View>

              {priceList ? (
                <>
                  <Pressable style={[styles.desktopSearchField, { position: 'relative', maxWidth: 260 }]} onPress={() => setDatesOpen((v) => !v)}>
                    <View style={styles.desktopSearchFieldBtn}>
                      <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.desktopFieldLabel}>Date</Text>
                        <Text style={styles.desktopFieldValue} numberOfLines={1}>
                          {formatDateShort(dateFrom)} → {formatDateShort(dateTo)}
                        </Text>
                      </View>
                    </View>
                    {datesOpen && (
                      <View style={[styles.desktopPopover, { width: 320 }]}>
                        <Calendar startOffset={startOffset} days={days} onSelectDate={handleSelectDate} />
                      </View>
                    )}
                  </Pressable>
                  {datesOpen && <Pressable style={styles.desktopPopoverBackdrop} onPress={() => setDatesOpen(false)} />}

                  <View style={styles.availabilityTable}>
                    <View style={styles.availabilityHeaderRow}>
                      <Text style={[styles.availabilityHeaderCell, { flex: 2 }]}>Tipo di ombrellone</Text>
                      <Text style={[styles.availabilityHeaderCell, { flex: 1 }]}>Prezzo per {days} {days === 1 ? 'giorno' : 'giorni'}</Text>
                      <Text style={[styles.availabilityHeaderCell, { flex: 1 }]}>La tua scelta</Text>
                      <Text style={[styles.availabilityHeaderCell, { width: 90, textAlign: 'center' }]}>Ombrelloni</Text>
                    </View>
                    {rows.map((row, i) => {
                      const isFirstOfBand = i === 0 || rows[i - 1].bandLabel !== row.bandLabel;
                      const qty = qtyByRow[row.key] ?? 0;
                      return (
                        <View key={row.key} style={[styles.availabilityRow, isFirstOfBand && styles.availabilityRowBandStart]}>
                          <View style={{ flex: 2 }}>
                            {isFirstOfBand && (
                              <>
                                <Text style={styles.availabilityBandLabel}>{row.bandLabel}</Text>
                                <Text style={styles.availabilityBandSub}>{row.filaRange} · max {MAX_ADULTS_PER_UMBRELLA} adulti</Text>
                              </>
                            )}
                            <Text style={styles.availabilityPackageLabel}>{row.packageLabel}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.availabilityPrice}>{formatCurrency(row.pricePerDay * days)}</Text>
                            <Text style={styles.availabilityPriceHint}>tasse incluse</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.availabilityChoiceRow}>
                              <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                              <Text style={styles.availabilityChoiceText}>Rimborsabile con voucher fino al {cutoff}</Text>
                            </View>
                            {row.beds > 0 && (
                              <View style={styles.availabilityChoiceRow}>
                                <Ionicons name="bed-outline" size={13} color={colors.textMuted} />
                                <Text style={styles.availabilityChoiceText}>{row.beds} lettini inclusi</Text>
                              </View>
                            )}
                          </View>
                          <View style={{ width: 90, alignItems: 'center' }}>
                            {row.freeCount > 0 ? (
                              <Stepper label={`${row.bandLabel} ${row.packageLabel}`} hideLabel min={0} max={row.freeCount} value={qty} onChange={(v) => setQtyByRow((cur) => ({ ...cur, [row.key]: v }))} />
                            ) : (
                              <Text style={styles.availabilityNoneLeft}>Esaurito</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </>
              ) : (
                <View style={styles.detailComingSoonBox}>
                  <Ionicons name="time-outline" size={18} color={colors.primaryDark} />
                  <Text style={styles.detailComingSoonText}>
                    Prenotabile prossimamente in questa demo. Prova intanto con Bagno Pietrasanta.
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.detailSectionTitle}>Recensioni</Text>
            <View style={styles.desktopRatingRow}>
              <View style={styles.desktopRatingBadgeLarge}>
                <Text style={styles.desktopRatingBadgeLargeText}>{operator.rating.toFixed(1)}</Text>
              </View>
              <View>
                <Text style={styles.desktopRatingSummary}>Ottimo</Text>
                <Text style={styles.detailRatingCount}>{operator.reviewCount} recensioni</Text>
              </View>
            </View>
            <View style={styles.desktopCategoryGrid}>
              {REVIEW_CATEGORIES.map((c) => (
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
            </View>
            {DETAIL_REVIEWS.map((r) => (
              <View key={r.name} style={styles.detailReviewCard}>
                <View style={styles.detailReviewHeader}>
                  <View style={styles.detailReviewAvatar}>
                    <Ionicons name="person" size={16} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.detailReviewName}>{r.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Ionicons key={i} name={i < r.stars ? 'ellipse' : 'ellipse-outline'} size={9} color={colors.primary} />
                      ))}
                    </View>
                  </View>
                </View>
                <Text style={styles.detailParagraph}>Ottima esperienza, personale gentile e spiaggia curata nei minimi dettagli.</Text>
              </View>
            ))}
          </View>

          <View style={styles.desktopDetailSidebar}>
            <View style={styles.desktopPriceCard}>
              {priceList ? (
                <>
                  {totalUmbrellas > 0 ? (
                    <>
                      <Text style={styles.desktopPriceCardHint}>
                        {totalUmbrellas} {totalUmbrellas === 1 ? 'ombrellone' : 'ombrelloni'} selezionati
                      </Text>
                      <Text style={styles.desktopPriceCardAmount}>{formatCurrency(totalPrice)}</Text>
                      <Text style={styles.desktopPriceCardHint}>tasse e costi inclusi</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.desktopPriceCardHint}>A partire da</Text>
                      <Text style={styles.desktopPriceCardAmount}>
                        {formatCurrency(priceList.prices['art-ombrellone'] ?? operator.priceFrom)}
                      </Text>
                      <Text style={styles.desktopPriceCardHint}>per ombrellone al giorno</Text>
                    </>
                  )}
                  <Button title="Prenota" onPress={handleReserve} style={{ marginTop: spacing.md }} />
                  <Text style={styles.desktopPriceCardFootnote}>Bastano due minuti · nessun addebito qui</Text>
                </>
              ) : (
                <>
                  <Text style={styles.desktopPriceCardHint}>Non disponibile in questa demo</Text>
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

  detailHero: {
    height: 200,
    backgroundColor: colors.seaDark,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  detailBackBtn: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.lg,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeroIconWrap: { position: 'absolute', right: spacing.xl, top: spacing.xl },
  detailHeroTitle: { fontSize: 22, fontWeight: '800', color: colors.white },
  detailTabsRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  detailTab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  detailTabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  detailTabTextActive: { color: colors.text },
  detailTabUnderline: { marginTop: 6, height: 2, width: 28, backgroundColor: colors.peachDark, borderRadius: 1 },
  detailBody: { padding: spacing.lg, gap: spacing.sm },
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
  detailRatingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailRatingScore: { fontSize: 18, fontWeight: '800', color: colors.peachDark },
  detailRatingCount: { fontSize: 12, color: colors.textMuted, marginLeft: spacing.sm },
  detailReviewCard: { marginTop: spacing.md, gap: 6 },
  detailReviewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailReviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.prenotatoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailReviewName: { fontSize: 13, fontWeight: '800', color: colors.text },
  detailPhotoHint: { fontSize: 12, color: colors.textMuted },
  detailPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: spacing.xs },
  detailPhotoTile: {
    width: '32.6%',
    aspectRatio: 1,
    backgroundColor: colors.seaDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailPhotoTileAlt: { backgroundColor: colors.primary },
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
  desktopHero: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + spacing.xl,
  },
  desktopHeroTitle: { fontSize: 32, fontWeight: '800', color: colors.white },
  desktopHeroSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: spacing.xs },
  desktopSearchBarWrap: {
    paddingHorizontal: spacing.xxl,
    marginTop: -spacing.xxl - spacing.md,
    marginBottom: spacing.xl,
    zIndex: 30,
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
  desktopBody: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl },
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
  desktopGalleryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  desktopGalleryMain: { flex: 2 },
  desktopGallerySide: { flex: 1, gap: spacing.sm },
  desktopGallerySideTile: { width: '100%' },
  desktopDetailColumns: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
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

  desktopAvailabilitySection: { marginTop: spacing.sm },
  desktopAvailabilityHeaderRow: { marginBottom: spacing.sm },
  availabilityTable: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  availabilityHeaderRow: { flexDirection: 'row', backgroundColor: colors.primaryDark, padding: spacing.sm },
  availabilityHeaderCell: { color: colors.white, fontSize: 11, fontWeight: '700' },
  availabilityRow: {
    flexDirection: 'row',
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  availabilityRowBandStart: { backgroundColor: colors.bg },
  availabilityBandLabel: { fontSize: 13, fontWeight: '800', color: colors.text },
  availabilityBandSub: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  availabilityPackageLabel: { fontSize: 12, color: colors.text, fontWeight: '600', marginTop: 2 },
  availabilityPrice: { fontSize: 14, fontWeight: '800', color: colors.text },
  availabilityPriceHint: { fontSize: 10, color: colors.textMuted },
  availabilityChoiceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  availabilityChoiceText: { fontSize: 11, color: colors.textMuted, flexShrink: 1 },
  availabilityNoneLeft: { fontSize: 11, color: colors.danger, fontWeight: '700' },

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
});
