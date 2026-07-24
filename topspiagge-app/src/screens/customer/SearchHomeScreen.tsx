import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppAlert } from '../../components/AppAlert';
import { Calendar } from '../../components/Calendar';
import { Button, Card, Stepper } from '../../components/UI';
import { colors, radius, spacing } from '../../theme';
import { DEMO_OPERATORS, DEMO_TOWNS, DemoOperator } from '../../data/demoOperators';
import { formatDateShort, isoDate } from '../../utils/format';

const HERE_LABEL = 'Intorno alla posizione attuale';

export interface SearchSelection {
  startOffset: number;
  days: number;
  adults: number;
  children5to15: number;
  childrenUnder5: number;
  beds: number;
  chairs: number;
}

type SearchStep = 'home' | 'summary' | 'destination' | 'dates' | 'guests' | 'results';

interface Props {
  onSelectOperator: (operator: DemoOperator, selection: SearchSelection) => void;
  /** Reports whether we're on the plain home card (true) or one of the search sub-steps
   * (false), so the parent tab shell can hide its bottom nav during the focused search
   * flow -- matching how the reference flow takes over the whole screen instead of
   * leaving tab chrome visible mid-search. */
  onHomeStateChange?: (isHome: boolean) => void;
}

function guestSummaryText(sel: SearchSelection): string {
  const parts: string[] = [`${sel.adults} adult${sel.adults === 1 ? 'o' : 'i'}`];
  const kids = sel.children5to15 + sel.childrenUnder5;
  parts.push(kids > 0 ? `${kids} bambin${kids === 1 ? 'o' : 'i'}` : 'nessun bambino');
  parts.push(`${sel.beds} lettini`);
  parts.push(`${sel.chairs} sdraio`);
  return parts.join(' · ');
}

// Guest-facing "search a beach club" flow, styled after Booking.com's own search UX (home
// search box -> destination/dates/guests picker -> results list) but in the app's normal
// light theme rather than Booking.com's dark one, and tailored to umbrellas: guest counts
// include Lettini/Sdraio alongside Adulti/Bambini, and results are beach clubs, not hotels.
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
  const [adults, setAdults] = useState(2);
  const [children5to15, setChildren5to15] = useState(0);
  const [childrenUnder5, setChildrenUnder5] = useState(0);
  const [beds, setBeds] = useState(0);
  const [chairs, setChairs] = useState(0);

  const dateFrom = useMemo(() => isoDate(startOffset), [startOffset]);
  const dateTo = useMemo(() => isoDate(startOffset + days - 1), [startOffset, days]);

  const selection: SearchSelection = { startOffset, days, adults, children5to15, childrenUnder5, beds, chairs };

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

  if (step === 'destination') {
    return (
      <DestinationPicker
        onBack={() => setStep('summary')}
        onSelect={(d) => {
          setDestination(d);
          setStep('summary');
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
        onSelectDate={handleSelectDate}
        onBack={() => setStep('summary')}
        onDone={() => setStep('summary')}
      />
    );
  }

  if (step === 'guests') {
    return (
      <GuestsPicker
        adults={adults}
        children5to15={children5to15}
        childrenUnder5={childrenUnder5}
        beds={beds}
        chairs={chairs}
        onChangeAdults={setAdults}
        onChangeChildren5to15={setChildren5to15}
        onChangeChildrenUnder5={setChildrenUnder5}
        onChangeBeds={setBeds}
        onChangeChairs={setChairs}
        onBack={() => setStep('summary')}
        onApply={() => setStep('summary')}
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
        onBack={() => setStep('summary')}
        onSelect={(op) => {
          if (op.isBookable) {
            onSelectOperator(op, selection);
          } else {
            alert(
              'Prossimamente disponibile',
              `${op.name} sarà prenotabile presto in questa demo. Prova intanto con Bagno Pietrasanta.`
            );
          }
        }}
      />
    );
  }

  if (step === 'summary') {
    return (
      <SearchSummary
        destination={destination}
        dateFrom={dateFrom}
        dateTo={dateTo}
        guestSummary={guestSummaryText(selection)}
        onBack={() => setStep('home')}
        onOpenDestination={() => setStep('destination')}
        onOpenDates={() => setStep('dates')}
        onOpenGuests={() => setStep('guests')}
        onSearch={() => setStep('results')}
      />
    );
  }

  return <HomeCard onOpenSearch={() => setStep('summary')} />;
};

const HomeCard: React.FC<{ onOpenSearch: () => void }> = ({ onOpenSearch }) => (
  <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView contentContainerStyle={styles.homeBody}>
      <Text style={styles.homeTitle}>Prenota la tua spiaggia</Text>
      <Text style={styles.homeSubtitle}>Trova e prenota ombrelloni negli stabilimenti vicino a te</Text>
      <Pressable style={styles.searchBox} onPress={onOpenSearch}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <Text style={styles.searchBoxText}>{HERE_LABEL}</Text>
      </Pressable>
    </ScrollView>
  </SafeAreaView>
);

const SummaryRow: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  onPress: () => void;
}> = ({ icon, text, onPress }) => (
  <Pressable style={styles.summaryRow} onPress={onPress}>
    <Ionicons name={icon} size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
    <Text style={styles.summaryRowText} numberOfLines={1}>
      {text}
    </Text>
    <Ionicons name="chevron-forward" size={16} color={colors.border} />
  </Pressable>
);

const SearchSummary: React.FC<{
  destination: string;
  dateFrom: string;
  dateTo: string;
  guestSummary: string;
  onBack: () => void;
  onOpenDestination: () => void;
  onOpenDates: () => void;
  onOpenGuests: () => void;
  onSearch: () => void;
}> = ({ destination, dateFrom, dateTo, guestSummary, onBack, onOpenDestination, onOpenDates, onOpenGuests, onSearch }) => (
  <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.pageTitle}>Prenota il tuo ombrellone</Text>
      <Card style={styles.summaryCard}>
        <SummaryRow icon="location-outline" text={destination} onPress={onOpenDestination} />
        <View style={styles.divider} />
        <SummaryRow icon="calendar-outline" text={`${formatDateShort(dateFrom)} → ${formatDateShort(dateTo)}`} onPress={onOpenDates} />
        <View style={styles.divider} />
        <SummaryRow icon="people-outline" text={guestSummary} onPress={onOpenGuests} />
      </Card>
      <Button title="Cerca" icon="search" onPress={onSearch} style={{ marginTop: spacing.lg }} />
    </ScrollView>
  </SafeAreaView>
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

const GuestsPicker: React.FC<{
  adults: number;
  children5to15: number;
  childrenUnder5: number;
  beds: number;
  chairs: number;
  onChangeAdults: (v: number) => void;
  onChangeChildren5to15: (v: number) => void;
  onChangeChildrenUnder5: (v: number) => void;
  onChangeBeds: (v: number) => void;
  onChangeChairs: (v: number) => void;
  onBack: () => void;
  onApply: () => void;
}> = ({
  adults,
  children5to15,
  childrenUnder5,
  beds,
  chairs,
  onChangeAdults,
  onChangeChildren5to15,
  onChangeChildrenUnder5,
  onChangeBeds,
  onChangeChairs,
  onBack,
  onApply,
}) => (
  <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.pageTitle}>Ombrellone e ospiti</Text>
      <Card>
        <Stepper label="Lettini" icon="bed-outline" value={beds} min={0} max={4} onChange={onChangeBeds} />
        <View style={styles.divider} />
        <Stepper label="Sdraio" icon="sunny-outline" value={chairs} min={0} max={4} onChange={onChangeChairs} />
      </Card>
      <View style={{ height: spacing.lg }} />
      <Card>
        <Stepper label="Adulti" icon="person-outline" value={adults} min={1} onChange={onChangeAdults} />
        <View style={styles.divider} />
        <Stepper label="Bambini 5-15 anni" icon="school-outline" value={children5to15} min={0} onChange={onChangeChildren5to15} />
        <View style={styles.divider} />
        <Stepper label="Bambini sotto i 5 anni" icon="happy-outline" value={childrenUnder5} min={0} onChange={onChangeChildrenUnder5} />
      </Card>
    </ScrollView>
    <View style={styles.footer}>
      <Button title="Applica" onPress={onApply} />
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
        <Pressable key={op.id} onPress={() => onSelect(op)}>
          <Card style={styles.operatorCard}>
            <View style={styles.operatorIcon}>
              <Ionicons name="umbrella-outline" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.operatorName}>{op.name}</Text>
              <Text style={styles.operatorTown}>{op.town}</Text>
              <Text style={styles.operatorTagline} numberOfLines={2}>
                {op.tagline}
              </Text>
              <Text style={styles.operatorPrice}>{op.priceFromLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.border} />
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  homeBody: { padding: spacing.lg, paddingTop: spacing.xxl },
  homeTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  homeSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.xl },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  searchBoxText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  body: { padding: spacing.lg, paddingTop: spacing.xs, flexGrow: 1 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  pageHint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg },
  summaryCard: { padding: 0 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  summaryRowText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
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
  operatorCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  operatorIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.prenotatoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorName: { fontSize: 15, fontWeight: '800', color: colors.text },
  operatorTown: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  operatorTagline: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  operatorPrice: { fontSize: 13, fontWeight: '700', color: colors.primaryDark, marginTop: 6 },
});
