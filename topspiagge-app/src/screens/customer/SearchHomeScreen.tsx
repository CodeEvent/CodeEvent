import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppAlert } from '../../components/AppAlert';
import { Calendar } from '../../components/Calendar';
import { Button, Card, Stepper } from '../../components/UI';
import { useStore } from '../../store/StoreContext';
import { colors, radius, spacing } from '../../theme';
import { DEMO_OPERATORS, DEMO_TOWNS, DemoOperator } from '../../data/demoOperators';
import { MAX_ADULTS_PER_UMBRELLA } from '../../utils/booking';
import { formatCurrency, formatDateShort, isoDate } from '../../utils/format';

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

interface Props {
  onSelectOperator: (operator: DemoOperator, selection: SearchSelection) => void;
  /** Reports whether we're on the plain home card (true) or one of the search sub-steps
   * (false), so the parent tab shell can hide its bottom nav during the focused search
   * flow -- matching how the reference flow takes over the whole screen instead of
   * leaving tab chrome visible mid-search. */
  onHomeStateChange?: (isHome: boolean) => void;
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
export const SearchHomeScreen: React.FC<Props> = ({ onSelectOperator, onHomeStateChange }) => {
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
});
