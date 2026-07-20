import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppAlert } from '../../components/AppAlert';
import {
  COLS_PER_SIDE,
  GAP,
  MIN_CELL,
  BeachCanvas,
  WALKWAY_WIDTH,
  useUmbrellaPositions,
} from '../../components/BeachCanvas';
import { Calendar } from '../../components/Calendar';
import { Badge, Button, Card, Checkbox, Chip, Stepper } from '../../components/UI';
import { useAppMode } from '../../store/AppModeContext';
import { useStore } from '../../store/StoreContext';
import { colors, radius, spacing } from '../../theme';
import { Booking, Customer, GuestCount, Umbrella } from '../../types';
import {
  distributeGuests,
  findCustomerConflict,
  findNearestUmbrellas,
  findUmbrellaConflict,
  MAX_GUESTS_PER_UMBRELLA,
  totalGuestCount,
  umbrellasNeededFor,
} from '../../utils/booking';
import { DEPOSIT_RATE, isDepositRefundable, refundCutoffDate } from '../../utils/cancellation';
import { formatCurrency, formatDateLong, formatDateShort, isoDate } from '../../utils/format';

const WIDE_BREAKPOINT = 860;
const SIDEBAR_WIDTH = 380;
const ROWS = 12;
const TOTAL_COLS = COLS_PER_SIDE * 2;

const normalizePhone = (phone: string) => phone.replace(/\s+/g, '');

const PERIOD_PRESETS = [
  { label: '1 giorno', days: 1 },
  { label: '2 giorni', days: 2 },
  { label: '3 giorni', days: 3 },
  { label: '1 settimana', days: 7 },
];

type Step = 'dates' | 'map';

export const CustomerBookingScreen: React.FC = () => {
  const { setMode } = useAppMode();
  const { umbrellas, bookings } = useStore();
  const alert = useAppAlert();
  const { width, height } = useWindowDimensions();

  const [step, setStep] = useState<Step>('dates');
  const [startOffset, setStartOffset] = useState(0);
  const [days, setDays] = useState(1);
  const [awaitingEndDate, setAwaitingEndDate] = useState(false);
  const [selectedUmbrellaId, setSelectedUmbrellaId] = useState<string | null>(null);
  const [confirmedGroup, setConfirmedGroup] = useState<Booking[] | null>(null);
  const [myBookingsVisible, setMyBookingsVisible] = useState(false);

  const isWide = width >= WIDE_BREAKPOINT;

  const dateFrom = isoDate(startOffset);
  const dateTo = isoDate(startOffset + days - 1);

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

  const handleSelectDuration = (presetDays: number) => {
    setDays(presetDays);
    setAwaitingEndDate(false);
  };

  const isFreeForPeriod = (u: Umbrella) => !findUmbrellaConflict(bookings, u.id, dateFrom, dateTo);

  const labelWidth = isWide ? 84 : 44;
  const mapAreaWidth = isWide ? width - SIDEBAR_WIDTH : width;
  const mapAreaHeight = height - 320;
  const cellSize = Math.max(
    MIN_CELL,
    Math.min(
      72,
      Math.floor((mapAreaWidth - spacing.lg * 2 - labelWidth - WALKWAY_WIDTH) / TOTAL_COLS) - GAP,
      Math.floor(mapAreaHeight / ROWS) - GAP
    )
  );

  const positions = useUmbrellaPositions(umbrellas, cellSize);
  const freeCount = umbrellas.filter(isFreeForPeriod).length;
  const freeCounts = {
    nord: umbrellas.filter((u) => u.side === 'nord' && isFreeForPeriod(u)).length,
    sud: umbrellas.filter((u) => u.side === 'sud' && isFreeForPeriod(u)).length,
  };

  const handleTap = (u: Umbrella) => {
    if (isFreeForPeriod(u)) {
      setSelectedUmbrellaId(u.id);
    } else {
      alert('Non disponibile', `L'ombrellone N.${u.number} non è disponibile per il periodo scelto.`);
    }
  };

  const handleConfirmed = (createdBookings: Booking[]) => {
    setSelectedUmbrellaId(null);
    setConfirmedGroup(createdBookings);
  };

  const mapStepEl = (
    <MapStep
      umbrellas={umbrellas}
      positions={positions}
      cellSize={cellSize}
      labelWidth={labelWidth}
      dateFrom={dateFrom}
      dateTo={dateTo}
      freeCount={freeCount}
      freeCounts={freeCounts}
      isFreeForPeriod={isFreeForPeriod}
      onTap={handleTap}
      onChangeDates={() => setStep('dates')}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Pressable onPress={() => setMode('select')} style={styles.backLink}>
            <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
            <Text style={styles.backLinkText}>Cambia modalità</Text>
          </Pressable>
          <Pressable
            onPress={() => setMyBookingsVisible(true)}
            style={styles.myBookingsBtn}
            accessibilityLabel="Le mie prenotazioni"
          >
            <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
          </Pressable>
        </View>
        <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>
          Prenota il tuo ombrellone
        </Text>
        <Text style={styles.headerSubtitle}>Bagno Pietrasanta</Text>
      </View>

      {step === 'dates' ? (
        <DateStep
          startOffset={startOffset}
          days={days}
          awaitingEndDate={awaitingEndDate}
          onSelectDate={handleSelectDate}
          onSelectDuration={handleSelectDuration}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onContinue={() => setStep('map')}
        />
      ) : isWide ? (
        <View style={styles.wideRow}>
          <View style={styles.wideMapCol}>{mapStepEl}</View>
          <View style={styles.sidebarCol}>
            {selectedUmbrellaId ? (
              <BookingForm
                key={selectedUmbrellaId}
                umbrellaId={selectedUmbrellaId}
                dateFrom={dateFrom}
                dateTo={dateTo}
                allUmbrellas={umbrellas}
                isFreeForPeriod={isFreeForPeriod}
                onClose={() => setSelectedUmbrellaId(null)}
                onConfirmed={handleConfirmed}
              />
            ) : (
              <View style={styles.sidebarEmpty}>
                <Ionicons name="umbrella-outline" size={36} color={colors.border} />
                <Text style={styles.sidebarEmptyText}>Tocca un ombrellone libero sulla mappa per iniziare la prenotazione</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        mapStepEl
      )}

      {!isWide && selectedUmbrellaId && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedUmbrellaId(null)}>
          <Pressable style={styles.backdrop} onPress={() => setSelectedUmbrellaId(null)}>
            <Pressable style={styles.formSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.handle} />
              <BookingForm
                key={selectedUmbrellaId}
                umbrellaId={selectedUmbrellaId}
                dateFrom={dateFrom}
                dateTo={dateTo}
                allUmbrellas={umbrellas}
                isFreeForPeriod={isFreeForPeriod}
                onClose={() => setSelectedUmbrellaId(null)}
                onConfirmed={handleConfirmed}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <ConfirmationModal
        bookings={confirmedGroup}
        onClose={() => {
          setConfirmedGroup(null);
          setStep('dates');
        }}
        onSeeMyBookings={() => {
          setConfirmedGroup(null);
          setMyBookingsVisible(true);
        }}
      />

      <MyBookingsModal visible={myBookingsVisible} onClose={() => setMyBookingsVisible(false)} />
    </SafeAreaView>
  );
};

const DateStep: React.FC<{
  startOffset: number;
  days: number;
  awaitingEndDate: boolean;
  onSelectDate: (offset: number) => void;
  onSelectDuration: (days: number) => void;
  dateFrom: string;
  dateTo: string;
  onContinue: () => void;
}> = ({ startOffset, days, awaitingEndDate, onSelectDate, onSelectDuration, dateFrom, dateTo, onContinue }) => (
  <ScrollView contentContainerStyle={styles.dateStepBody}>
    <Text style={styles.stepTitle}>Quando vuoi venire?</Text>
    <Text style={styles.stepSubtitle}>
      {awaitingEndDate ? 'Ora tocca il giorno di partenza' : 'Tocca il giorno di arrivo sul calendario'}
    </Text>

    <Calendar startOffset={startOffset} days={days} onSelectDate={onSelectDate} />

    <Text style={[styles.label, { marginTop: spacing.lg }]}>Oppure scegli una durata rapida</Text>
    <View style={styles.row}>
      {PERIOD_PRESETS.map((p) => (
        <Chip key={p.days} label={p.label} selected={days === p.days} onPress={() => onSelectDuration(p.days)} />
      ))}
    </View>

    <View style={styles.summaryCard}>
      <View style={styles.summaryCol}>
        <View style={styles.summaryIconWrap}>
          <Ionicons name="log-in-outline" size={16} color={colors.primary} />
        </View>
        <Text style={styles.summaryLabel}>Arrivo</Text>
        <Text style={styles.summaryDate}>{formatDateLong(dateFrom)}</Text>
      </View>
      <View style={styles.summaryDivider}>
        <Ionicons name="arrow-forward" size={14} color={colors.border} />
      </View>
      <View style={styles.summaryCol}>
        <View style={styles.summaryIconWrap}>
          <Ionicons name="log-out-outline" size={16} color={colors.primary} />
        </View>
        <Text style={styles.summaryLabel}>Partenza</Text>
        <Text style={styles.summaryDate}>{formatDateLong(dateTo)}</Text>
      </View>
    </View>
    <Text style={styles.muted}>{days} {days === 1 ? 'giorno' : 'giorni'} di soggiorno</Text>

    <Button
      title="Cerca disponibilità"
      icon="search-outline"
      onPress={onContinue}
      style={{ marginTop: spacing.xl }}
    />
  </ScrollView>
);

const MapStep: React.FC<{
  umbrellas: Umbrella[];
  positions: Map<string, { x: number; y: number }>;
  cellSize: number;
  labelWidth: number;
  dateFrom: string;
  dateTo: string;
  freeCount: number;
  freeCounts: { nord: number; sud: number };
  isFreeForPeriod: (u: Umbrella) => boolean;
  onTap: (u: Umbrella) => void;
  onChangeDates: () => void;
}> = ({
  umbrellas,
  positions,
  cellSize,
  labelWidth,
  dateFrom,
  dateTo,
  freeCount,
  freeCounts,
  isFreeForPeriod,
  onTap,
  onChangeDates,
}) => (
  <>
    <View style={styles.mapHeader}>
      <View>
        <Text style={styles.mapPeriodText}>
          {formatDateShort(dateFrom)} → {formatDateShort(dateTo)}
        </Text>
        <Text style={styles.mapSubtitle}>Scegli il tuo posto sulla spiaggia</Text>
      </View>
      <Pressable onPress={onChangeDates} style={styles.changeDatesBtn}>
        <Ionicons name="calendar-outline" size={13} color={colors.primaryDark} />
        <Text style={styles.changeDatesText}>Cambia date</Text>
      </Pressable>
    </View>

    <View style={styles.legendRow}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: colors.libero }]} />
        <Text style={styles.legendText}>Libero</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: colors.textMuted }]} />
        <Text style={styles.legendText}>Non disponibile</Text>
      </View>
      <Text style={styles.legendCounts}>
        Nord {freeCounts.nord} liberi · Sud {freeCounts.sud} liberi
      </Text>
    </View>

    <BeachCanvas
      umbrellas={umbrellas}
      positions={positions}
      cellSize={cellSize}
      labelWidth={labelWidth}
      footerText={`${freeCount} ombrelloni liberi per il periodo scelto`}
      renderCell={(u, position) => {
        const free = isFreeForPeriod(u);
        return (
          <Pressable
            key={u.id}
            onPress={() => onTap(u)}
            style={[
              styles.cell,
              {
                left: position.x,
                top: position.y,
                width: cellSize,
                height: cellSize,
                borderRadius: cellSize / 2,
                backgroundColor: free ? colors.libero : colors.textMuted,
              },
            ]}
          >
            <Text style={[styles.cellNumber, { fontSize: Math.min(16, Math.max(9, cellSize / 4.5)) }]}>
              {u.number}
            </Text>
          </Pressable>
        );
      }}
    />
  </>
);

const BookingForm: React.FC<{
  umbrellaId: string;
  dateFrom: string;
  dateTo: string;
  allUmbrellas: Umbrella[];
  isFreeForPeriod: (u: Umbrella) => boolean;
  onClose: () => void;
  onConfirmed: (bookings: Booking[]) => void;
}> = ({ umbrellaId, dateFrom, dateTo, allUmbrellas, isFreeForPeriod, onClose, onConfirmed }) => {
  const { getUmbrella, customers, bookings, createBooking, upsertCustomer, getActivePriceList } = useStore();
  const [phone, setPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [adults, setAdults] = useState(2);
  const [children5to15, setChildren5to15] = useState(0);
  const [childrenUnder5, setChildrenUnder5] = useState(0);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [extraUmbrellaIds, setExtraUmbrellaIds] = useState<string[]>([]);

  const umbrella = getUmbrella(umbrellaId);
  const priceList = getActivePriceList();
  const dailyRate = priceList.prices['art-ombrellone'] ?? 18;
  const days = Math.round((new Date(dateTo + 'T00:00:00').getTime() - new Date(dateFrom + 'T00:00:00').getTime()) / 86400000) + 1;
  const perUmbrellaTotal = dailyRate * days;
  const perUmbrellaDeposit = Math.round(perUmbrellaTotal * DEPOSIT_RATE);
  const cutoffDate = refundCutoffDate(dateFrom);

  const totalGuests = totalGuestCount({ adults, children5to15, childrenUnder5 });
  const umbrellasNeeded = umbrellasNeededFor(totalGuests);
  const extraNeeded = umbrellasNeeded - 1;

  const nearbySuggestions = useMemo(() => {
    if (!umbrella) return [];
    return findNearestUmbrellas(umbrella, allUmbrellas, isFreeForPeriod, new Set([umbrella.id]), 8);
  }, [umbrella, allUmbrellas, isFreeForPeriod]);

  const adjustExtras = (newTotalGuests: number) => {
    setExtraUmbrellaIds((prev) => {
      const needed = Math.max(0, umbrellasNeededFor(newTotalGuests) - 1);
      if (prev.length === needed) return prev;
      if (prev.length > needed) return prev.slice(0, needed);
      const excludeIds = new Set([umbrellaId, ...prev]);
      const additions = umbrella
        ? findNearestUmbrellas(umbrella, allUmbrellas, isFreeForPeriod, excludeIds, needed - prev.length)
        : [];
      return [...prev, ...additions.map((u) => u.id)];
    });
  };

  const changeAdults = (v: number) => {
    setAdults(v);
    adjustExtras(v + children5to15 + childrenUnder5);
  };
  const changeChildren5to15 = (v: number) => {
    setChildren5to15(v);
    adjustExtras(adults + v + childrenUnder5);
  };
  const changeChildrenUnder5 = (v: number) => {
    setChildrenUnder5(v);
    adjustExtras(adults + children5to15 + v);
  };

  const toggleExtra = (id: string) => {
    setExtraUmbrellaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allUmbrellaIds = [umbrellaId, ...extraUmbrellaIds];
  const capacity = allUmbrellaIds.length * MAX_GUESTS_PER_UMBRELLA;
  const capacityOk = capacity >= totalGuests;
  const total = perUmbrellaTotal * allUmbrellaIds.length;
  const deposit = perUmbrellaDeposit * allUmbrellaIds.length;

  const matchedCustomer = useMemo(() => {
    const p = normalizePhone(phone);
    if (!p) return undefined;
    return customers.find((c) => normalizePhone(c.phone) === p);
  }, [customers, phone]);

  const isNewCustomer = normalizePhone(phone).length >= 6 && !matchedCustomer;

  const conflict = useMemo(
    () => allUmbrellaIds.some((id) => findUmbrellaConflict(bookings, id, dateFrom, dateTo)),
    [bookings, allUmbrellaIds, dateFrom, dateTo]
  );
  const customerConflict = useMemo(() => {
    if (!matchedCustomer) return undefined;
    return findCustomerConflict(bookings, matchedCustomer.id, umbrellaId, dateFrom, dateTo);
  }, [bookings, matchedCustomer, umbrellaId, dateFrom, dateTo]);
  const customerConflictUmbrella = getUmbrella(customerConflict?.umbrellaId ?? '');

  const canConfirm =
    (!!matchedCustomer || (isNewCustomer && newName.trim().length > 0)) &&
    !conflict &&
    !customerConflict &&
    capacityOk &&
    policyAccepted;

  const confirm = () => {
    if (!canConfirm) return;
    let customerId = matchedCustomer?.id;
    if (!customerId) {
      const customer: Customer = {
        id: `cust-${Date.now()}`,
        name: newName.trim(),
        phone: phone.trim(),
        email: '',
        notes: '',
        vip: false,
        bookingHistory: [],
        createdAt: isoDate(0),
      };
      upsertCustomer(customer);
      customerId = customer.id;
    }
    const groupId = allUmbrellaIds.length > 1 ? `grp-${Date.now()}` : undefined;
    const guestSlots = distributeGuests({ adults, children5to15, childrenUnder5 }, allUmbrellaIds.length);
    const createdBookings: Booking[] = allUmbrellaIds.map((uId, idx) => ({
      id: `bk-${uId}-${Date.now()}-${idx}`,
      umbrellaId: uId,
      customerId: customerId!,
      dateFrom,
      dateTo,
      totalPrice: perUmbrellaTotal,
      deposit: perUmbrellaDeposit,
      paid: perUmbrellaDeposit,
      status: 'prenotato',
      createdAt: isoDate(0),
      guests: guestSlots[idx],
      groupId,
    }));
    createdBookings.forEach(createBooking);
    onConfirmed(createdBookings);
  };

  if (!umbrella) return null;

  return (
    <ScrollView style={styles.formScroll} contentContainerStyle={styles.formScrollContent}>
      <Text style={styles.sheetTitle}>
        Ombrellone {umbrella.number} · {umbrella.zone}
      </Text>

      <View style={styles.periodHero}>
        <View style={styles.periodHeroCol}>
          <Text style={styles.periodHeroLabel}>Dal</Text>
          <Text style={styles.periodHeroDate}>{formatDateLong(dateFrom)}</Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color={colors.white} />
        <View style={styles.periodHeroCol}>
          <Text style={styles.periodHeroLabel}>Al</Text>
          <Text style={styles.periodHeroDate}>{formatDateLong(dateTo)}</Text>
        </View>
        <Text style={styles.periodHeroDays}>
          {days} {days === 1 ? 'giorno' : 'giorni'}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Chi viaggia con te?</Text>
      <View style={styles.guestsBox}>
        <Stepper label="Adulti" value={adults} min={1} onChange={changeAdults} />
        <View style={styles.divider} />
        <Stepper label="Bambini 5–15 anni" value={children5to15} onChange={changeChildren5to15} />
        <View style={styles.divider} />
        <Stepper label="Bambini sotto i 5 anni" value={childrenUnder5} onChange={changeChildrenUnder5} />
      </View>
      <Text style={styles.muted}>Max {MAX_GUESTS_PER_UMBRELLA} persone per ombrellone</Text>

      {umbrellasNeeded > 1 && (
        <View style={styles.extraBox}>
          <View style={styles.policyHeaderRow}>
            <Ionicons name="people-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.policyTitle}>Ombrelloni aggiuntivi</Text>
          </View>
          <Text style={styles.policyText}>
            Per {totalGuests} persone servono {umbrellasNeeded} ombrelloni. Ti suggeriamo i più vicini a
            quello scelto: aggiungine {extraNeeded > extraUmbrellaIds.length ? `almeno ${extraNeeded - extraUmbrellaIds.length} in più` : 'quanti ne servono'}.
          </Text>
          {nearbySuggestions.map((u) => {
            const selected = extraUmbrellaIds.includes(u.id);
            return (
              <Pressable key={u.id} onPress={() => toggleExtra(u.id)} style={styles.extraRow}>
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={selected ? colors.libero : colors.border}
                />
                <Text style={styles.extraRowText}>
                  Ombrellone N.{u.number} · {u.zone}
                </Text>
              </Pressable>
            );
          })}
          <Text style={[styles.muted, { marginTop: spacing.xs }]}>
            Capienza selezionata: {capacity} / {totalGuests} persone in {allUmbrellaIds.length} ombrelloni
          </Text>
        </View>
      )}

      <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Il tuo numero di telefono</Text>
      <TextInput
        style={styles.input}
        placeholder="+39 ..."
        placeholderTextColor={colors.textMuted}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      {matchedCustomer && (
        <Text style={styles.welcomeText}>Bentornato/a, {matchedCustomer.name}! 👋</Text>
      )}
      {isNewCustomer && (
        <View style={{ marginTop: spacing.sm }}>
          <Text style={styles.sectionLabel}>Nome e cognome</Text>
          <TextInput
            style={styles.input}
            placeholder="Es. Marco Bianchi"
            placeholderTextColor={colors.textMuted}
            value={newName}
            onChangeText={setNewName}
          />
        </View>
      )}

      {conflict && (
        <View style={styles.conflictBox}>
          <Text style={styles.conflictText}>
            Uno degli ombrelloni selezionati non è più disponibile per queste date.
          </Text>
        </View>
      )}
      {!conflict && customerConflict && (
        <View style={styles.conflictBox}>
          <Text style={styles.conflictText}>
            Hai già l'Ombrellone {customerConflictUmbrella?.number} prenotato dal{' '}
            {formatDateShort(customerConflict.dateFrom)} al {formatDateShort(customerConflict.dateTo)}.
          </Text>
        </View>
      )}

      <View style={styles.policyBox}>
        <View style={styles.policyHeaderRow}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.primaryDark} />
          <Text style={styles.policyTitle}>Acconto e politica di cancellazione</Text>
        </View>
        <Text style={styles.policyText}>
          Per confermare versi ora un acconto del 20% ({formatCurrency(deposit)}). Il saldo di{' '}
          {formatCurrency(total - deposit)} si paga in spiaggia.
        </Text>
        <Text style={styles.policyText}>
          Puoi cancellare gratuitamente entro il <Text style={styles.policyBold}>{formatDateShort(cutoffDate)}</Text>{' '}
          (7 giorni prima dell'arrivo): l'acconto ti verrà restituito. Cancellando dopo tale data, o non
          presentandoti, l'acconto <Text style={styles.policyBold}>non è rimborsabile</Text>.
        </Text>
        <View style={{ marginTop: spacing.sm }}>
          <Checkbox
            checked={policyAccepted}
            onToggle={() => setPolicyAccepted((v) => !v)}
            label="Ho letto e accetto la politica di acconto e cancellazione"
          />
        </View>
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>
          Totale soggiorno {allUmbrellaIds.length > 1 ? `(${allUmbrellaIds.length} ombrelloni)` : ''}
        </Text>
        <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
      </View>
      <Text style={styles.muted}>Acconto da versare ora: {formatCurrency(deposit)}</Text>

      <Button
        title="Conferma e prenota"
        icon="checkmark-circle-outline"
        onPress={confirm}
        disabled={!canConfirm}
        style={{ marginTop: spacing.lg }}
      />
      <Button title="Annulla" variant="ghost" onPress={onClose} style={{ marginTop: spacing.sm }} />
    </ScrollView>
  );
};

const ConfirmationModal: React.FC<{
  bookings: Booking[] | null;
  onClose: () => void;
  onSeeMyBookings: () => void;
}> = ({ bookings, onClose, onSeeMyBookings }) => {
  const { getUmbrella, getCustomer } = useStore();
  if (!bookings || bookings.length === 0) return null;
  const primary = bookings[0];
  const umbrellas = bookings.map((b) => getUmbrella(b.umbrellaId));
  const customer = getCustomer(primary.customerId);
  const total = bookings.reduce((sum, b) => sum + b.totalPrice, 0);
  const paid = bookings.reduce((sum, b) => sum + b.paid, 0);
  const guests = bookings.reduce(
    (acc, b) => ({
      adults: acc.adults + (b.guests?.adults ?? 0),
      children5to15: acc.children5to15 + (b.guests?.children5to15 ?? 0),
      childrenUnder5: acc.childrenUnder5 + (b.guests?.childrenUnder5 ?? 0),
    }),
    { adults: 0, children5to15: 0, childrenUnder5: 0 }
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.confirmCard}>
          <View style={styles.confirmIconCircle}>
            <Ionicons name="checkmark" size={32} color={colors.white} />
          </View>
          <Text style={styles.confirmTitle}>Prenotazione confermata!</Text>
          <Text style={styles.confirmSubtitle}>Ti aspettiamo, {customer?.name}</Text>

          <Card style={{ marginTop: spacing.lg, width: '100%' }}>
            <View style={styles.confirmRow}>
              <Text style={styles.muted}>{umbrellas.length > 1 ? 'Ombrelloni' : 'Ombrellone'}</Text>
              <Text style={styles.confirmValue}>
                {umbrellas.map((u) => `N.${u?.number}`).join(', ')}
              </Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.muted}>Periodo</Text>
              <Text style={styles.confirmValue}>
                {formatDateShort(primary.dateFrom)} → {formatDateShort(primary.dateTo)}
              </Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.muted}>Ospiti</Text>
              <Text style={styles.confirmValue}>
                {guests.adults} adulti
                {guests.children5to15 > 0 ? ` · ${guests.children5to15} bambini 5-15` : ''}
                {guests.childrenUnder5 > 0 ? ` · ${guests.childrenUnder5} under 5` : ''}
              </Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.muted}>Totale</Text>
              <Text style={styles.confirmValue}>{formatCurrency(total)}</Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.muted}>Acconto pagato</Text>
              <Text style={[styles.confirmValue, { color: colors.libero }]}>{formatCurrency(paid)}</Text>
            </View>
          </Card>

          <Button title="Nuova prenotazione" onPress={onClose} style={{ marginTop: spacing.lg, width: '100%' }} />
          <Button title="Le mie prenotazioni" variant="ghost" onPress={onSeeMyBookings} style={{ marginTop: spacing.sm, width: '100%' }} />
        </View>
      </View>
    </Modal>
  );
};

const MyBookingsModal: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const { customers, bookings, getUmbrella, cancelBooking } = useStore();
  const alert = useAppAlert();
  const [phone, setPhone] = useState('');

  const customer = useMemo(() => {
    const p = normalizePhone(phone);
    if (!p) return undefined;
    return customers.find((c) => normalizePhone(c.phone) === p);
  }, [customers, phone]);

  const today = isoDate(0);
  const myBookings = useMemo(() => {
    if (!customer) return [];
    return bookings
      .filter((b) => b.customerId === customer.id && b.dateTo >= today)
      .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
  }, [bookings, customer, today]);

  const handleCancel = (booking: Booking) => {
    const refundable = isDepositRefundable(booking.dateFrom, today);
    const groupSize = booking.groupId
      ? bookings.filter((b) => b.groupId === booking.groupId).length
      : 1;
    const depositTotal = booking.groupId
      ? bookings.filter((b) => b.groupId === booking.groupId).reduce((sum, b) => sum + b.deposit, 0)
      : booking.deposit;
    const groupNote = groupSize > 1 ? ` Verranno cancellati tutti e ${groupSize} gli ombrelloni del gruppo.` : '';
    alert(
      'Cancellare la prenotazione?',
      (refundable
        ? `L'arrivo è tra almeno 7 giorni: l'acconto di ${formatCurrency(depositTotal)} ti verrà restituito.`
        : `L'arrivo è tra meno di 7 giorni (o è già iniziato): l'acconto di ${formatCurrency(depositTotal)} non è rimborsabile.`) + groupNote,
      [
        { text: 'Non cancellare', style: 'cancel' },
        {
          text: 'Cancella prenotazione',
          style: 'destructive',
          onPress: () => cancelBooking(booking.id),
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Le mie prenotazioni</Text>
          <TextInput
            style={styles.input}
            placeholder="Inserisci il tuo numero di telefono"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <ScrollView style={{ maxHeight: 360, marginTop: spacing.sm }}>
            {!customer && normalizePhone(phone).length > 0 && (
              <Text style={styles.muted}>Nessun cliente trovato con questo numero.</Text>
            )}
            {customer && myBookings.length === 0 && (
              <Text style={styles.muted}>Nessuna prenotazione futura per {customer.name}.</Text>
            )}
            {customer &&
              myBookings.map((b) => {
                const u = getUmbrella(b.umbrellaId);
                const refundable = isDepositRefundable(b.dateFrom, today);
                return (
                  <Card key={b.id} style={{ marginTop: spacing.sm }}>
                    <View style={styles.confirmRow}>
                      <Text style={styles.confirmValue}>Ombrellone N.{u?.number}</Text>
                      <Badge status={b.status} />
                    </View>
                    <Text style={styles.muted}>
                      {formatDateShort(b.dateFrom)} → {formatDateShort(b.dateTo)} · {formatCurrency(b.totalPrice)}
                    </Text>
                    {b.groupId && <Text style={styles.groupTag}>Gruppo multi-ombrellone</Text>}
                    <Text style={[styles.muted, { color: refundable ? colors.libero : colors.occupato }]}>
                      {refundable ? 'Acconto rimborsabile se cancelli ora' : 'Acconto non rimborsabile'}
                    </Text>
                    <Button
                      title="Cancella prenotazione"
                      variant="danger"
                      onPress={() => handleCancel(b)}
                      style={{ marginTop: spacing.sm, paddingVertical: 8 }}
                    />
                  </Card>
                );
              })}
          </ScrollView>
          <Button title="Chiudi" variant="ghost" onPress={onClose} style={{ marginTop: spacing.md }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.card },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  backLink: { flexDirection: 'row', alignItems: 'center' },
  backLinkText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  myBookingsBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.prenotatoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dateStepBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  stepTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: spacing.md },
  stepSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.lg },

  label: { fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, flexWrap: 'wrap' },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  summaryCol: { flex: 1, alignItems: 'center' },
  summaryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.prenotatoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  summaryDivider: { paddingHorizontal: spacing.sm },
  summaryLabel: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  summaryDate: { color: colors.text, fontWeight: '700', fontSize: 14, textTransform: 'capitalize', marginTop: 2 },

  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  mapPeriodText: { fontSize: 16, fontWeight: '800', color: colors.primaryDark },
  mapSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  changeDatesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.prenotatoBg,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  changeDatesText: { color: colors.primaryDark, fontWeight: '700', fontSize: 11 },

  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.md },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 11, color: colors.textMuted },
  legendCounts: { fontSize: 11, color: colors.textMuted, fontWeight: '700', marginLeft: 'auto' },
  cell: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  cellNumber: { fontWeight: '800', fontSize: 16, color: colors.white },

  wideRow: { flex: 1, flexDirection: 'row' },
  wideMapCol: { flex: 1 },
  sidebarCol: {
    width: SIDEBAR_WIDTH,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    backgroundColor: colors.card,
  },
  sidebarEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  sidebarEmptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  formScroll: { flex: 1 },
  formScrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '88%',
  },
  formSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
    height: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  periodHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.seaDark,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  periodHeroCol: { alignItems: 'flex-start' },
  periodHeroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  periodHeroDate: { color: colors.white, fontWeight: '800', fontSize: 14, textTransform: 'capitalize' },
  periodHeroDays: { color: colors.white, fontWeight: '700', fontSize: 12, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.xl },
  sectionLabel: { fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  guestsBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  extraBox: {
    backgroundColor: colors.in_arrivoBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  extraRowText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  groupTag: { color: colors.primaryDark, fontWeight: '700', fontSize: 11, marginTop: 2 },
  policyBox: {
    backgroundColor: colors.prenotatoBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  policyHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  policyTitle: { fontWeight: '700', color: colors.primaryDark, fontSize: 13 },
  policyText: { color: colors.text, fontSize: 12, lineHeight: 17, marginTop: 4 },
  policyBold: { fontWeight: '800' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    color: colors.text,
    marginTop: spacing.xs,
  },
  welcomeText: { color: colors.libero, fontWeight: '700', fontSize: 13, marginTop: spacing.xs },
  conflictBox: { backgroundColor: colors.occupatoBg, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  conflictText: { color: colors.occupato, fontWeight: '600', fontSize: 13 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { color: colors.textMuted, fontWeight: '600' },
  totalValue: { color: colors.primaryDark, fontWeight: '800', fontSize: 20 },
  confirmCard: {
    margin: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    width: '90%',
    alignSelf: 'center',
  },
  confirmIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.libero,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: { fontSize: 19, fontWeight: '800', color: colors.text, marginTop: spacing.md },
  confirmSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  confirmValue: { fontWeight: '700', color: colors.text },
});
