import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { GAP, MIN_CELL, BeachCanvas, useUmbrellaPositions } from '../../components/BeachCanvas';
import { Calendar } from '../../components/Calendar';
import { QRCode } from '../../components/QRCode';
import { sidebarBackdrop, sidebarSheet, useSidebarMode } from '../../components/sidebarSheet';
import { Button, Card, Checkbox, Chip, StepProgressBar, Stepper } from '../../components/UI';
import { useStore } from '../../store/StoreContext';
import { colors, radius, spacing } from '../../theme';
import { Booking, Customer, Umbrella } from '../../types';
import { ROWS } from '../../data/seed';
import {
  distributeGuests,
  findCustomerConflict,
  findNearestUmbrellas,
  findUmbrellaConflict,
  MAX_ADULTS_PER_UMBRELLA,
  MAX_EQUIPMENT_PER_UMBRELLA,
  umbrellasNeededFor,
} from '../../utils/booking';
import { PREPAYMENT_RATE, REFUND_CUTOFF_DAYS, refundCutoffDate } from '../../utils/cancellation';
import { formatCurrency, formatDateLong, formatDateShort, isoDate, offsetFromToday } from '../../utils/format';
import {
  bundleForUmbrella,
  baseUmbrellaPricePerDay,
  computeDiscounts,
  isSameDayWalkIn,
  isStudentDiscountEligibleRow,
} from '../../utils/pricing';
import { generateBookingReference } from '../../utils/reference';

const WIDE_BREAKPOINT = 700;
const SIDEBAR_WIDTH = 380;

// details (guests/phone/policy) -> equipment ("Lettini e sdraio") -> confirm ("Conferma e
// paga", read-only review) -> payment (card entry, Stripe-only -- see BookingForm's payment
// stage).
type BookingFormStage = 'details' | 'equipment' | 'confirm' | 'payment';

const normalizePhone = (phone: string) => phone.replace(/\s+/g, '');

const PERIOD_PRESETS = [
  { label: '1 giorno', days: 1 },
  { label: '2 giorni', days: 2 },
  { label: '3 giorni', days: 3 },
  { label: '1 settimana', days: 7 },
];

type Step = 'dates' | 'map';

export interface EditBookingContext {
  bookings: Booking[];
  customer: Customer;
}

interface CustomerBookingScreenProps {
  editContext?: EditBookingContext | null;
  onExitToLanding: () => void;
  onManage: () => void;
  initialStartOffset?: number;
  initialDays?: number;
}

export const CustomerBookingScreen: React.FC<CustomerBookingScreenProps> = ({
  editContext,
  onExitToLanding,
  onManage,
  initialStartOffset,
  initialDays,
}) => {
  const { umbrellas, bookings, joinWaitlist } = useStore();
  const alert = useAppAlert();
  const { width, height } = useWindowDimensions();

  const primaryEditBooking = editContext?.bookings[0];

  // Editing an existing booking must not treat that same booking as a conflict against
  // itself -- otherwise the customer's own umbrella would show as unavailable to them.
  const editingBookingIds = useMemo(
    () => new Set((editContext?.bookings ?? []).map((b) => b.id)),
    [editContext]
  );
  const availabilityBookings = useMemo(
    () => (editContext ? bookings.filter((b) => !editingBookingIds.has(b.id)) : bookings),
    [bookings, editContext, editingBookingIds]
  );

  const [step, setStep] = useState<Step>(editContext ? 'map' : 'dates');
  const [startOffset, setStartOffset] = useState(() =>
    primaryEditBooking ? offsetFromToday(primaryEditBooking.dateFrom) : initialStartOffset ?? 0
  );
  const [days, setDays] = useState(() =>
    primaryEditBooking
      ? offsetFromToday(primaryEditBooking.dateTo) - offsetFromToday(primaryEditBooking.dateFrom) + 1
      : initialDays ?? 1
  );
  const [awaitingEndDate, setAwaitingEndDate] = useState(false);
  const [selectedUmbrellaId, setSelectedUmbrellaId] = useState<string | null>(
    () => primaryEditBooking?.umbrellaId ?? null
  );
  // A new booking never touches the store until "Conferma e prenota" -- this local set
  // just highlights the umbrella(s) currently being composed in red/blue, and clears
  // itself the moment selectedUmbrellaId does (cancel, backdrop, Annulla, navigate away).
  const [pendingExtraIds, setPendingExtraIds] = useState<string[]>([]);
  const pendingIds = useMemo(
    () => (selectedUmbrellaId ? [selectedUmbrellaId, ...pendingExtraIds] : []),
    [selectedUmbrellaId, pendingExtraIds]
  );
  const [formStage, setFormStage] = useState<BookingFormStage>('details');
  const [confirmedGroup, setConfirmedGroup] = useState<Booking[] | null>(null);
  const [confirmedIsEdit, setConfirmedIsEdit] = useState(false);
  const [dateEditVisible, setDateEditVisible] = useState(false);
  const [waitlistUmbrella, setWaitlistUmbrella] = useState<Umbrella | null>(null);

  // Mirrors the booking-flow progress bar: Map (pick dates + spot) -> Dettagli
  // (guests/phone/policy) -> Lettini e sdraio (equipment) -> Conferma e paga (review) ->
  // Pagamento (card entry).
  const stepIndexForStage: Record<BookingFormStage, number> = {
    details: 1,
    equipment: 2,
    confirm: 3,
    payment: 4,
  };
  const currentStepIndex = !selectedUmbrellaId ? 0 : stepIndexForStage[formStage];

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

  const isFreeForPeriod = (u: Umbrella) => !findUmbrellaConflict(availabilityBookings, u.id, dateFrom, dateTo);

  const labelWidth = isWide ? 84 : 60;
  // The map is 20 seats wide (10 Nord + walkway + 10 Sud) and rarely fits a phone or a
  // sidebar-narrowed column without shrinking cells past legibility, so the cell size is
  // driven by available height only -- the canvas scrolls horizontally to reveal the rest.
  const mapAreaHeight = height - 320;
  const cellSize = Math.max(MIN_CELL, Math.min(72, Math.floor(mapAreaHeight / ROWS) - GAP));

  const positions = useUmbrellaPositions(umbrellas, cellSize);
  const freeCount = umbrellas.filter(isFreeForPeriod).length;
  const freeCounts = {
    nord: umbrellas.filter((u) => u.side === 'nord' && isFreeForPeriod(u)).length,
    sud: umbrellas.filter((u) => u.side === 'sud' && isFreeForPeriod(u)).length,
  };

  const handleTap = (u: Umbrella) => {
    if (isFreeForPeriod(u)) {
      setPendingExtraIds([]);
      setSelectedUmbrellaId(u.id);
      setFormStage('details');
    } else {
      alert(
        'Non disponibile',
        `L'ombrellone N.${u.number} (${u.zone}) non è disponibile per il periodo scelto.`,
        [
          { text: 'Chiudi', style: 'cancel' },
          { text: "Iscriviti alla lista d'attesa", onPress: () => setWaitlistUmbrella(u) },
        ]
      );
    }
  };

  const handleConfirmed = (createdBookings: Booking[], isEdit: boolean) => {
    setSelectedUmbrellaId(null);
    setConfirmedGroup(createdBookings);
    setConfirmedIsEdit(isEdit);
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
      pendingIds={pendingIds}
      onTap={handleTap}
      onChangeDates={() => setDateEditVisible(true)}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Pressable onPress={onExitToLanding} style={styles.backLink}>
            <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
            <Text style={styles.backLinkText}>Torna alla home</Text>
          </Pressable>
          <Pressable
            onPress={onManage}
            style={styles.myBookingsBtn}
            accessibilityLabel="Gestisci la tua prenotazione"
          >
            <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
          </Pressable>
        </View>
        <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>
          {editContext ? 'Modifica la tua prenotazione' : 'Prenota il tuo ombrellone'}
        </Text>
        <Text style={styles.headerSubtitle}>Bagno Pietrasanta</Text>
      </View>

      <StepProgressBar
        steps={['Mappa', 'Dettagli', 'Lettini e sdraio', 'Conferma e paga', 'Pagamento']}
        currentIndex={currentStepIndex}
      />

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
                bookingsForAvailability={availabilityBookings}
                editContext={editContext}
                onClose={() => (editContext ? onExitToLanding() : setSelectedUmbrellaId(null))}
                onConfirmed={handleConfirmed}
                onEditDates={() => setDateEditVisible(true)}
                stage={formStage}
                onStageChange={setFormStage}
                onExtrasChange={setPendingExtraIds}
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
                bookingsForAvailability={availabilityBookings}
                editContext={editContext}
                onClose={() => (editContext ? onExitToLanding() : setSelectedUmbrellaId(null))}
                onConfirmed={handleConfirmed}
                onEditDates={() => setDateEditVisible(true)}
                stage={formStage}
                onStageChange={setFormStage}
                onExtrasChange={setPendingExtraIds}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {dateEditVisible && (
        <Modal
          visible
          transparent
          animationType={isWide ? 'fade' : 'slide'}
          onRequestClose={() => setDateEditVisible(false)}
        >
          <Pressable style={isWide ? sidebarBackdrop : styles.backdrop} onPress={() => setDateEditVisible(false)}>
            <Pressable style={isWide ? sidebarSheet() : styles.formSheet} onPress={(e) => e.stopPropagation()}>
              {!isWide && <View style={styles.handle} />}
              <DateStep
                startOffset={startOffset}
                days={days}
                awaitingEndDate={awaitingEndDate}
                onSelectDate={handleSelectDate}
                onSelectDuration={handleSelectDuration}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onContinue={() => setDateEditVisible(false)}
                continueLabel="Conferma date"
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <ConfirmationModal
        bookings={confirmedGroup}
        isEdit={confirmedIsEdit}
        onClose={() => {
          setConfirmedGroup(null);
          if (editContext) {
            onExitToLanding();
          } else {
            setStep('dates');
          }
        }}
        onSeeMyBookings={() => {
          setConfirmedGroup(null);
          onManage();
        }}
      />

      <WaitlistJoinModal
        umbrella={waitlistUmbrella}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onClose={() => setWaitlistUmbrella(null)}
        onJoin={(name, phone) => {
          if (!waitlistUmbrella) return;
          joinWaitlist({
            umbrellaId: waitlistUmbrella.id,
            customerName: name,
            customerPhone: phone,
            dateFrom,
            dateTo,
          });
          setWaitlistUmbrella(null);
          alert(
            'Iscrizione confermata',
            `Ti avviseremo se l'ombrellone N.${waitlistUmbrella.number} si libera per il periodo scelto.`
          );
        }}
      />
    </SafeAreaView>
  );
};

const WaitlistJoinModal: React.FC<{
  umbrella: Umbrella | null;
  dateFrom: string;
  dateTo: string;
  onClose: () => void;
  onJoin: (name: string, phone: string) => void;
}> = ({ umbrella, dateFrom, dateTo, onClose, onJoin }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (umbrella) {
      setName('');
      setPhone('');
    }
  }, [umbrella]);

  return (
    <Modal visible={!!umbrella} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Lista d'attesa</Text>
          <Text style={[styles.confirmSubtitle, { textAlign: 'center' }]}>
            {umbrella && `Ombrellone N.${umbrella.number} (${umbrella.zone})`}
            {'\n'}
            {formatDateShort(dateFrom)} → {formatDateShort(dateTo)}
          </Text>
          <TextInput
            style={[styles.input, { marginTop: spacing.lg, width: '100%' }]}
            placeholder="Nome e cognome"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={[styles.input, { marginTop: spacing.sm, width: '100%' }]}
            placeholder="+39 ..."
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <Button
            title="Iscrivimi"
            onPress={() => onJoin(name.trim(), phone.trim())}
            disabled={!name.trim() || !phone.trim()}
            style={{ marginTop: spacing.lg, width: '100%' }}
          />
          <Button title="Annulla" variant="ghost" onPress={onClose} style={{ marginTop: spacing.sm, width: '100%' }} />
        </View>
      </View>
    </Modal>
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
  continueLabel?: string;
}> = ({
  startOffset,
  days,
  awaitingEndDate,
  onSelectDate,
  onSelectDuration,
  dateFrom,
  dateTo,
  onContinue,
  continueLabel = 'Cerca disponibilità',
}) => (
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
      title={continueLabel}
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
  pendingIds: string[];
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
  pendingIds,
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
        const pending = pendingIds.includes(u.id);
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
                overflow: 'hidden',
                backgroundColor: pending ? undefined : free ? colors.libero : colors.textMuted,
              },
            ]}
          >
            {pending && (
              <View style={StyleSheet.absoluteFill}>
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: cellSize / 2, backgroundColor: colors.occupato }} />
                <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: cellSize / 2, backgroundColor: colors.prenotato }} />
              </View>
            )}
            <Text style={[styles.cellNumber, { fontSize: Math.min(17, Math.max(12, cellSize / 4)) }]}>
              {u.number}
            </Text>
          </Pressable>
        );
      }}
    />
  </>
);

type Equipment = { beds: number; chairs: number };
const DEFAULT_EQUIPMENT: Equipment = { beds: 2, chairs: 2 };

const PeriodHero: React.FC<{ dateFrom: string; dateTo: string; days: number; onEditDates: () => void }> = ({
  dateFrom,
  dateTo,
  days,
  onEditDates,
}) => (
  <>
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
      <Pressable onPress={onEditDates} style={styles.editDatesBtn}>
        <Ionicons name="pencil-outline" size={12} color={colors.white} />
        <Text style={styles.editDatesBtnText}>Modifica</Text>
      </Pressable>
    </View>
    <Text style={styles.muted}>
      {days} {days === 1 ? 'giorno' : 'giorni'} di soggiorno
    </Text>
  </>
);

const BookingFooter: React.FC<{
  total: number;
  deposit: number;
  voucherApplied?: number;
  umbrellaCount: number;
  primaryLabel: string;
  primaryIcon: keyof typeof Ionicons.glyphMap;
  onPrimary: () => void;
  primaryDisabled: boolean;
  onCancel: () => void;
}> = ({ total, deposit, voucherApplied, umbrellaCount, primaryLabel, primaryIcon, onPrimary, primaryDisabled, onCancel }) => (
  <View style={styles.stickyFooter}>
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>
        Totale soggiorno {umbrellaCount > 1 ? `(${umbrellaCount} ombrelloni)` : ''}
      </Text>
      <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
    </View>
    {!!voucherApplied && (
      <Text style={[styles.muted, { color: colors.libero }]}>
        Credito voucher applicato: -{formatCurrency(voucherApplied)}
      </Text>
    )}
    <Text style={styles.muted}>Da pagare ora (pagamento anticipato): {formatCurrency(deposit)}</Text>
    <Button title={primaryLabel} icon={primaryIcon} onPress={onPrimary} disabled={primaryDisabled} style={{ marginTop: spacing.md }} />
    <Button title="Annulla" variant="ghost" onPress={onCancel} style={{ marginTop: spacing.sm }} />
  </View>
);

const BookingForm: React.FC<{
  umbrellaId: string;
  dateFrom: string;
  dateTo: string;
  allUmbrellas: Umbrella[];
  isFreeForPeriod: (u: Umbrella) => boolean;
  bookingsForAvailability: Booking[];
  editContext?: EditBookingContext | null;
  onClose: () => void;
  onConfirmed: (bookings: Booking[], isEdit: boolean) => void;
  onEditDates: () => void;
  stage: BookingFormStage;
  onStageChange: (stage: BookingFormStage) => void;
  /** Reports the currently-selected extra umbrellas so the map behind this form can
   * highlight them as "pending" (not yet confirmed) instead of showing their real,
   * still-free status. */
  onExtrasChange?: (ids: string[]) => void;
}> = ({
  umbrellaId,
  dateFrom,
  dateTo,
  allUmbrellas,
  isFreeForPeriod,
  bookingsForAvailability,
  editContext,
  onClose,
  onConfirmed,
  onEditDates,
  stage,
  onStageChange,
  onExtrasChange,
}) => {
  const { getUmbrella, customers, createBooking, upsertCustomer, getActivePriceList, cancelBooking } = useStore();
  const alert = useAppAlert();
  // Fila 1/2 default to their bundled equipment (so the discounted package price applies
  // out of the box); every other row falls back to the generic 2 beds + 2 chairs default.
  const defaultEquipmentFor = (id: string): Equipment => {
    const u = getUmbrella(id);
    return (u && bundleForUmbrella(u)) || DEFAULT_EQUIPMENT;
  };
  const editBookings = editContext?.bookings ?? [];
  // Only carry over the rest of the group (extra umbrellas + their equipment) when the
  // customer hasn't changed their primary pick -- if they tap a different umbrella on
  // the map, that's a fresh single-umbrella selection instead of silently stacking on
  // top of their original group.
  const isOriginalPrimary = editBookings.length > 0 && editBookings[0].umbrellaId === umbrellaId;

  const [phone, setPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [adults, setAdults] = useState(() =>
    editBookings.length ? editBookings.reduce((s, b) => s + (b.guests?.adults ?? 0), 0) || 1 : 2
  );
  const [children5to15, setChildren5to15] = useState(() =>
    editBookings.reduce((s, b) => s + (b.guests?.children5to15 ?? 0), 0)
  );
  const [childrenUnder5, setChildrenUnder5] = useState(() =>
    editBookings.reduce((s, b) => s + (b.guests?.childrenUnder5 ?? 0), 0)
  );
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [isStudent, setIsStudent] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [extraUmbrellaIds, setExtraUmbrellaIds] = useState<string[]>(() =>
    isOriginalPrimary ? editBookings.filter((b) => b.umbrellaId !== umbrellaId).map((b) => b.umbrellaId) : []
  );
  const [equipment, setEquipment] = useState<Record<string, Equipment>>(() => {
    if (isOriginalPrimary && editBookings.length) {
      const map: Record<string, Equipment> = {};
      editBookings.forEach((b) => {
        map[b.umbrellaId] = { beds: b.beds ?? 0, chairs: b.chairs ?? 0 };
      });
      return map;
    }
    const matching = editBookings.find((b) => b.umbrellaId === umbrellaId);
    return { [umbrellaId]: matching ? { beds: matching.beds ?? 0, chairs: matching.chairs ?? 0 } : defaultEquipmentFor(umbrellaId) };
  });

  useEffect(() => {
    onExtrasChange?.(extraUmbrellaIds);
    return () => onExtrasChange?.([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraUmbrellaIds]);

  const umbrella = getUmbrella(umbrellaId);
  const priceList = getActivePriceList();
  const dailyRate = priceList.prices['art-ombrellone'] ?? 18;
  const bedRate = priceList.prices['art-lettino'] ?? 6;
  const chairRate = priceList.prices['art-sdraio'] ?? 4;
  const days = Math.round((new Date(dateTo + 'T00:00:00').getTime() - new Date(dateFrom + 'T00:00:00').getTime()) / 86400000) + 1;
  const cutoffDate = refundCutoffDate(dateFrom);

  const umbrellasNeeded = umbrellasNeededFor(adults);
  const extraNeeded = umbrellasNeeded - 1;

  const nearbySuggestions = useMemo(() => {
    if (!umbrella) return [];
    return findNearestUmbrellas(umbrella, allUmbrellas, isFreeForPeriod, new Set([umbrella.id]), 8);
  }, [umbrella, allUmbrellas, isFreeForPeriod]);

  const seedEquipment = (ids: string[]) => {
    setEquipment((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (!next[id]) next[id] = defaultEquipmentFor(id);
      });
      return next;
    });
  };

  // Only adults count against an umbrella's occupancy cap, so extra umbrellas are
  // suggested based on adult headcount alone -- children never force a bigger group.
  const adjustExtras = (newAdults: number) => {
    setExtraUmbrellaIds((prev) => {
      const needed = Math.max(0, umbrellasNeededFor(newAdults) - 1);
      if (prev.length === needed) return prev;
      if (prev.length > needed) {
        const removed = prev.slice(needed);
        setEquipment((eq) => {
          const next = { ...eq };
          removed.forEach((id) => delete next[id]);
          return next;
        });
        return prev.slice(0, needed);
      }
      const excludeIds = new Set([umbrellaId, ...prev]);
      const additions = umbrella
        ? findNearestUmbrellas(umbrella, allUmbrellas, isFreeForPeriod, excludeIds, needed - prev.length)
        : [];
      const addedIds = additions.map((u) => u.id);
      seedEquipment(addedIds);
      return [...prev, ...addedIds];
    });
  };

  const changeAdults = (v: number) => {
    setAdults(v);
    adjustExtras(v);
  };

  const toggleExtra = (id: string) => {
    setExtraUmbrellaIds((prev) => {
      if (prev.includes(id)) {
        setEquipment((eq) => {
          const next = { ...eq };
          delete next[id];
          return next;
        });
        return prev.filter((x) => x !== id);
      }
      seedEquipment([id]);
      return [...prev, id];
    });
  };

  const setBeds = (id: string, value: number) =>
    setEquipment((eq) => ({ ...eq, [id]: { ...(eq[id] ?? defaultEquipmentFor(id)), beds: value } }));
  const setChairs = (id: string, value: number) =>
    setEquipment((eq) => ({ ...eq, [id]: { ...(eq[id] ?? defaultEquipmentFor(id)), chairs: value } }));

  const allUmbrellaIds = [umbrellaId, ...extraUmbrellaIds];
  const capacity = allUmbrellaIds.length * MAX_ADULTS_PER_UMBRELLA;
  const capacityOk = capacity >= adults;

  // Fila 1/2's flat price already includes their bundle -- taking exactly that equipment
  // charges the flat rate. Choosing anything else falls back to à la carte: the bundle's
  // own beds/chairs are backed out of the flat price at standard rates, then whatever
  // equipment the customer actually picked is added back in at those same rates.
  const perDayRate = (id: string) => {
    const u = getUmbrella(id);
    if (!u) return dailyRate;
    const eq = equipment[id] ?? defaultEquipmentFor(id);
    const base = baseUmbrellaPricePerDay(u);
    const bundle = bundleForUmbrella(u);
    if (!bundle) return base + eq.beds * bedRate + eq.chairs * chairRate;
    if (eq.beds === bundle.beds && eq.chairs === bundle.chairs) return base;
    const bareRate = base - (bundle.beds * bedRate + bundle.chairs * chairRate);
    return bareRate + eq.beds * bedRate + eq.chairs * chairRate;
  };

  const umbrellaDiscount = (id: string) => {
    const u = getUmbrella(id);
    return u ? computeDiscounts(dateFrom, dateTo, u, isStudent) : { lateBooking: 0, student: 0, total: 0 };
  };

  const umbrellaTotal = (id: string) => {
    const gross = perDayRate(id) * days;
    const discount = umbrellaDiscount(id).total;
    return Math.round(gross * (1 - discount) * 100) / 100;
  };

  // Whether to surface the same-day discount messaging at all -- both discounts only
  // ever matter for a same-day, single-day stay, so there's no reason to mention them
  // for a future or multi-night booking.
  const isWalkInToday = isSameDayWalkIn(dateFrom, dateTo);
  const anyLateDiscount = allUmbrellaIds.some((id) => umbrellaDiscount(id).lateBooking > 0);
  const anyStudentDiscountApplied = allUmbrellaIds.some((id) => umbrellaDiscount(id).student > 0);
  const anyStudentDiscountEligibleRow = allUmbrellaIds.some((id) => {
    const u = getUmbrella(id);
    return !!u && isStudentDiscountEligibleRow(u);
  });
  const matchedCustomer = useMemo(() => {
    const p = normalizePhone(phone);
    if (!p) return undefined;
    return customers.find((c) => normalizePhone(c.phone) === p);
  }, [customers, phone]);

  const grossTotal = allUmbrellaIds.reduce((sum, id) => sum + umbrellaTotal(id), 0);
  // A voucher earned from an eligible past cancellation (see ManageBookingScreen's grantVoucher)
  // is auto-applied against this new booking's total -- never while editing an existing one,
  // so re-picking dates on a booking already in progress can't silently spend the credit again.
  const voucherApplied = editContext
    ? 0
    : Math.round(Math.min(matchedCustomer?.voucherBalance ?? 0, grossTotal) * 100) / 100;
  const voucherShare = (id: string) =>
    grossTotal ? Math.round(((voucherApplied * umbrellaTotal(id)) / grossTotal) * 100) / 100 : 0;
  const umbrellaNetTotal = (id: string) => Math.round((umbrellaTotal(id) - voucherShare(id)) * 100) / 100;
  // Booking is paid in full at the time of booking (PREPAYMENT_RATE = 1) -- see utils/cancellation.ts.
  const umbrellaDeposit = (id: string) => Math.round(umbrellaNetTotal(id) * PREPAYMENT_RATE * 100) / 100;

  const total = Math.round((grossTotal - voucherApplied) * 100) / 100;
  const deposit = allUmbrellaIds.reduce((sum, id) => sum + umbrellaDeposit(id), 0);

  const isNewCustomer = normalizePhone(phone).length >= 6 && !matchedCustomer;
  const effectiveCustomerId = editContext ? editContext.customer.id : matchedCustomer?.id;

  const conflict = useMemo(
    () => allUmbrellaIds.some((id) => findUmbrellaConflict(bookingsForAvailability, id, dateFrom, dateTo)),
    [bookingsForAvailability, allUmbrellaIds, dateFrom, dateTo]
  );
  const customerConflict = useMemo(() => {
    if (!effectiveCustomerId) return undefined;
    return findCustomerConflict(bookingsForAvailability, effectiveCustomerId, umbrellaId, dateFrom, dateTo);
  }, [bookingsForAvailability, effectiveCustomerId, umbrellaId, dateFrom, dateTo]);
  const customerConflictUmbrella = getUmbrella(customerConflict?.umbrellaId ?? '');

  const canConfirm =
    (editContext ||
      !!matchedCustomer ||
      (isNewCustomer && newName.trim().length > 0 && newEmail.includes('@'))) &&
    !conflict &&
    !customerConflict &&
    capacityOk &&
    policyAccepted;

  const confirm = () => {
    if (!canConfirm) return;
    let customerId = effectiveCustomerId;
    if (!customerId) {
      const customer: Customer = {
        id: `cust-${Date.now()}`,
        name: newName.trim(),
        phone: phone.trim(),
        email: newEmail.trim(),
        notes: '',
        vip: false,
        bookingHistory: [],
        createdAt: isoDate(0),
        tags: [],
      };
      upsertCustomer(customer);
      customerId = customer.id;
    } else if (matchedCustomer && (voucherApplied > 0 || (!matchedCustomer.email && newEmail.includes('@')))) {
      upsertCustomer({
        ...matchedCustomer,
        email: matchedCustomer.email || newEmail.trim(),
        voucherBalance: Math.round(((matchedCustomer.voucherBalance ?? 0) - voucherApplied) * 100) / 100,
      });
    }
    const reference = editContext ? editContext.bookings[0].reference : generateBookingReference();
    const groupId = allUmbrellaIds.length > 1 ? `grp-${Date.now()}` : undefined;
    const guestSlots = distributeGuests({ adults, children5to15, childrenUnder5 }, allUmbrellaIds.length);
    const createdBookings: Booking[] = allUmbrellaIds.map((uId, idx) => {
      const eq = equipment[uId] ?? defaultEquipmentFor(uId);
      return {
        id: `bk-${uId}-${Date.now()}-${idx}`,
        umbrellaId: uId,
        customerId: customerId!,
        dateFrom,
        dateTo,
        totalPrice: umbrellaNetTotal(uId),
        deposit: umbrellaDeposit(uId),
        paid: umbrellaDeposit(uId),
        status: 'prenotato',
        createdAt: isoDate(0),
        guests: guestSlots[idx],
        beds: eq.beds,
        chairs: eq.chairs,
        groupId,
        reference,
        isStudent,
      };
    });
    // Editing replaces the old group in place: the whole original group is removed
    // (cancelBooking already cleans up every sibling sharing the same groupId) and the
    // freshly re-picked set is created under the same reference, so the customer can
    // still find it with the code they were originally given.
    if (editContext) {
      cancelBooking(editContext.bookings[0].id);
    }
    // Rare but real once Supabase is the backend: two guests could both pass the client-side
    // availability check for the same umbrella/date at the same instant. The database's own
    // exclusion constraint (bookings_no_overlap) only lets one insert win; onConflict fires for
    // whichever booking(s) lost that race, so the guest is told to sort it out via support
    // rather than silently believing they hold an umbrella that was never actually reserved.
    createdBookings.forEach((b) =>
      createBooking(b, () => {
        const u = getUmbrella(b.umbrellaId);
        alert(
          'Ombrellone non più disponibile',
          `L'ombrellone N.${u?.number ?? ''} (${u?.zone ?? ''}) è stato prenotato da qualcun altro proprio in questo istante. Controlla "Gestisci la mia prenotazione" o contattaci per sistemare la tua prenotazione.`
        );
      })
    );
    onConfirmed(createdBookings, !!editContext);
  };

  if (!umbrella) return null;

  const conflictBanner = (
    <>
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
            Hai già l'Ombrellone {customerConflictUmbrella?.number} ({customerConflictUmbrella?.zone}) prenotato
            dal {formatDateShort(customerConflict.dateFrom)} al {formatDateShort(customerConflict.dateTo)}.
          </Text>
        </View>
      )}
    </>
  );

  if (stage === 'equipment') {
    return (
      <View style={styles.formOuter}>
        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formScrollContentSticky}>
          <Pressable onPress={() => onStageChange('details')} style={styles.backLink}>
            <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
            <Text style={styles.backLinkText}>Modifica ospiti e telefono</Text>
          </Pressable>

          <Text style={styles.sheetTitle}>Lettini e sdraio</Text>

          <PeriodHero dateFrom={dateFrom} dateTo={dateTo} days={days} onEditDates={onEditDates} />

          <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
            {allUmbrellaIds.length > 1 ? 'I tuoi ombrelloni' : 'Il tuo ombrellone'}
          </Text>
          {allUmbrellaIds.map((id) => {
            const u = getUmbrella(id);
            if (!u) return null;
            const eq = equipment[id] ?? defaultEquipmentFor(id);
            const bundle = bundleForUmbrella(u);
            const isBundlePrice = !!bundle && eq.beds === bundle.beds && eq.chairs === bundle.chairs;
            const discount = umbrellaDiscount(id);
            return (
              <View key={id} style={styles.equipmentCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.equipmentTitle}>
                    Ombrellone N.{u.number} · {u.zone}
                  </Text>
                  <Text style={styles.equipmentPrice}>{formatCurrency(umbrellaTotal(id))}</Text>
                </View>
                <Stepper
                  label="Lettini"
                  icon="bed-outline"
                  value={eq.beds}
                  max={MAX_EQUIPMENT_PER_UMBRELLA}
                  onChange={(v) => setBeds(id, v)}
                />
                <Stepper
                  label="Sdraio"
                  icon="sunny-outline"
                  value={eq.chairs}
                  max={MAX_EQUIPMENT_PER_UMBRELLA}
                  onChange={(v) => setChairs(id, v)}
                />
                {isBundlePrice ? (
                  <Text style={styles.muted}>{formatCurrency(perDayRate(id))} al giorno · lettini e sdraio inclusi</Text>
                ) : (
                  <Text style={styles.muted}>
                    {formatCurrency(perDayRate(id) - eq.beds * bedRate - eq.chairs * chairRate)} ombrellone +{' '}
                    {formatCurrency(eq.beds * bedRate)} lettini + {formatCurrency(eq.chairs * chairRate)} sdraio, al
                    giorno
                  </Text>
                )}
                {discount.total > 0 && (
                  <Text style={[styles.muted, { color: colors.libero, fontWeight: '700' }]}>
                    Sconto applicato: -{Math.round(discount.total * 100)}%
                  </Text>
                )}
              </View>
            );
          })}

          {conflictBanner}
        </ScrollView>
        <BookingFooter
          total={grossTotal}
          deposit={deposit}
          voucherApplied={voucherApplied}
          umbrellaCount={allUmbrellaIds.length}
          primaryLabel={editContext ? 'Conferma modifica' : 'Conferma e paga'}
          primaryIcon="checkmark-circle-outline"
          onPrimary={editContext ? confirm : () => onStageChange('confirm')}
          primaryDisabled={!canConfirm}
          onCancel={onClose}
        />
      </View>
    );
  }

  // Read-only review -- no more editing here, just a final check before moving to payment.
  // Editing a booking that's already paid (editContext) never reaches this stage or the next
  // one; it confirms directly from the equipment stage above, since there's no new charge to
  // review or collect.
  if (stage === 'confirm') {
    return (
      <View style={styles.formOuter}>
        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formScrollContentSticky}>
          <Pressable onPress={() => onStageChange('equipment')} style={styles.backLink}>
            <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
            <Text style={styles.backLinkText}>Modifica lettini e sdraio</Text>
          </Pressable>

          <Text style={styles.sheetTitle}>Conferma e paga</Text>

          <PeriodHero dateFrom={dateFrom} dateTo={dateTo} days={days} onEditDates={onEditDates} />

          <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Ospiti</Text>
          <Text style={styles.muted}>
            {adults} adulti
            {children5to15 > 0 ? ` · ${children5to15} bambini 5-15` : ''}
            {childrenUnder5 > 0 ? ` · ${childrenUnder5} under 5` : ''}
          </Text>

          <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
            {allUmbrellaIds.length > 1 ? 'I tuoi ombrelloni' : 'Il tuo ombrellone'}
          </Text>
          {allUmbrellaIds.map((id) => {
            const u = getUmbrella(id);
            if (!u) return null;
            const eq = equipment[id] ?? defaultEquipmentFor(id);
            return (
              <View key={id} style={styles.equipmentCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.equipmentTitle}>
                    Ombrellone N.{u.number} · {u.zone}
                  </Text>
                  <Text style={styles.equipmentPrice}>{formatCurrency(umbrellaTotal(id))}</Text>
                </View>
                <Text style={styles.muted}>
                  {eq.beds} lettini · {eq.chairs} sdraio
                </Text>
              </View>
            );
          })}

          {conflictBanner}
        </ScrollView>
        <BookingFooter
          total={grossTotal}
          deposit={deposit}
          voucherApplied={voucherApplied}
          umbrellaCount={allUmbrellaIds.length}
          primaryLabel="Procedi al pagamento"
          primaryIcon="card-outline"
          onPrimary={() => onStageChange('payment')}
          primaryDisabled={!canConfirm}
          onCancel={onClose}
        />
      </View>
    );
  }

  if (stage === 'payment') {
    const startPayment = () => {
      setPaymentProcessing(true);
      setTimeout(() => {
        setPaymentProcessing(false);
        confirm();
      }, 1100);
    };
    return (
      <View style={styles.formOuter}>
        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formScrollContentSticky}>
          <Pressable onPress={() => onStageChange('confirm')} style={styles.backLink}>
            <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
            <Text style={styles.backLinkText}>Torna al riepilogo</Text>
          </Pressable>

          <Text style={styles.sheetTitle}>Pagamento</Text>

          <View style={styles.simBadge}>
            <Ionicons name="flask-outline" size={12} color={colors.primaryDark} />
            <Text style={styles.simBadgeText}>Pagamento simulato -- demo, nessun addebito reale</Text>
          </View>

          {paymentProcessing ? (
            <View style={styles.paymentProcessingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.title, { marginTop: spacing.md }]}>Elaborazione pagamento...</Text>
              <Text style={styles.muted}>Un istante, stiamo confermando con la banca.</Text>
            </View>
          ) : (
            <View style={styles.paymentCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.equipmentTitle}>Carta di credito/debito</Text>
                <Text style={styles.stripeBadgeText}>Powered by Stripe</Text>
              </View>
              <Text style={[styles.muted, { marginTop: 2 }]}>Unico metodo di pagamento disponibile online.</Text>
              <TextInput
                style={[styles.input, { marginTop: spacing.md }]}
                placeholder="Numero carta (demo) es. 4242 4242 4242 4242"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={cardNumber}
                onChangeText={setCardNumber}
                maxLength={19}
              />
            </View>
          )}
        </ScrollView>
        <BookingFooter
          total={grossTotal}
          deposit={deposit}
          voucherApplied={voucherApplied}
          umbrellaCount={allUmbrellaIds.length}
          primaryLabel={`Paga ${formatCurrency(deposit)} con carta`}
          primaryIcon="card-outline"
          onPrimary={startPayment}
          primaryDisabled={!canConfirm || paymentProcessing}
          onCancel={onClose}
        />
      </View>
    );
  }

  return (
    <View style={styles.formOuter}>
      <ScrollView style={styles.formScroll} contentContainerStyle={styles.formScrollContentSticky}>
        <Text style={styles.sheetTitle}>
          Ombrellone {umbrella.number} · {umbrella.zone}
        </Text>

        <PeriodHero dateFrom={dateFrom} dateTo={dateTo} days={days} onEditDates={onEditDates} />

        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Chi viaggia con te?</Text>
        <View style={styles.guestsBox}>
          <Stepper label="Adulti" icon="person-outline" value={adults} min={1} onChange={changeAdults} />
          <View style={styles.divider} />
          <Stepper
            label="Bambini 5–15 anni"
            icon="school-outline"
            value={children5to15}
            onChange={setChildren5to15}
          />
          <View style={styles.divider} />
          <Stepper
            label="Bambini sotto i 5 anni"
            icon="happy-outline"
            value={childrenUnder5}
            onChange={setChildrenUnder5}
          />
        </View>
        <Text style={styles.muted}>Max {MAX_ADULTS_PER_UMBRELLA} adulti per ombrellone · bambini illimitati</Text>

        {umbrellasNeeded > 1 && (
          <View style={styles.extraBox}>
            <View style={styles.policyHeaderRow}>
              <Ionicons name="people-outline" size={16} color={colors.primaryDark} />
              <Text style={styles.policyTitle}>Ombrelloni aggiuntivi</Text>
            </View>
            <Text style={styles.policyText}>
              Per {adults} adulti servono {umbrellasNeeded} ombrelloni (i bambini non contano per il limite). Ti
              suggeriamo i più vicini a quello scelto: aggiungine{' '}
              {extraNeeded > extraUmbrellaIds.length ? `almeno ${extraNeeded - extraUmbrellaIds.length} in più` : 'quanti ne servono'}.
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
              Capienza: max {capacity} adulti in {allUmbrellaIds.length} ombrelloni · nel gruppo: {adults} adulti
            </Text>
          </View>
        )}

        {editContext ? (
          <View style={styles.editingAsBox}>
            <Ionicons name="person-circle-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.editingAsText}>Stai modificando la prenotazione di {editContext.customer.name}</Text>
          </View>
        ) : (
          <>
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
            {matchedCustomer && !editContext && !!matchedCustomer.voucherBalance && (
              <Text style={styles.welcomeText}>
                Hai un credito voucher di {formatCurrency(matchedCustomer.voucherBalance)}: verrà applicato a
                questa prenotazione.
              </Text>
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
            {(isNewCustomer || (matchedCustomer && !matchedCustomer.email)) && (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={styles.sectionLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="es. mario.rossi@email.it"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={newEmail}
                  onChangeText={setNewEmail}
                />
                <Text style={styles.muted}>Ti invieremo qui la conferma della prenotazione.</Text>
              </View>
            )}
          </>
        )}

        {conflictBanner}

        {isWalkInToday && (
          <View style={styles.discountBox}>
            <View style={styles.policyHeaderRow}>
              <Ionicons name="pricetag-outline" size={16} color={colors.primaryDark} />
              <Text style={styles.policyTitle}>Sconti prenotazione last minute</Text>
            </View>
            {anyLateDiscount && (
              <Text style={styles.policyText}>
                Prenotando dopo le 14:00 per oggi stesso hai diritto al{' '}
                <Text style={styles.policyBold}>50% di sconto</Text>, già applicato al totale.
              </Text>
            )}
            {anyStudentDiscountEligibleRow ? (
              <>
                <Text style={styles.policyText}>
                  Il lunedì gli studenti hanno il <Text style={styles.policyBold}>20% di sconto</Text> sugli
                  ombrelloni delle ultime due file.
                </Text>
                <View style={{ marginTop: spacing.sm }}>
                  <Checkbox checked={isStudent} onToggle={() => setIsStudent((v) => !v)} label="Sono uno studente" />
                </View>
                {isStudent && !anyStudentDiscountApplied && (
                  <Text style={styles.muted}>Sconto valido solo il lunedì.</Text>
                )}
              </>
            ) : (
              <Text style={styles.policyText}>
                Il lunedì gli studenti hanno il <Text style={styles.policyBold}>20% di sconto</Text> sugli
                ombrelloni delle ultime due file (non disponibile per questo ombrellone).
              </Text>
            )}
          </View>
        )}

        <View style={styles.policyBox}>
          <View style={styles.policyHeaderRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.policyTitle}>Pagamento anticipato</Text>
          </View>
          <Text style={styles.policyText}>
            L'importo totale della prenotazione ({formatCurrency(deposit)}) viene addebitato ora, al momento della
            prenotazione.
          </Text>
          <Text style={[styles.policyText, { marginTop: spacing.sm }]}>
            <Text style={styles.policyBold}>Rimborsabile tramite voucher:</Text> se annulli entro il{' '}
            <Text style={styles.policyBold}>{formatDateShort(cutoffDate)}</Text> ({REFUND_CUTOFF_DAYS} giorni prima
            dell'arrivo), riceverai un voucher da usare per una prossima prenotazione qui. Annullando dopo tale
            data, o non presentandoti, l'importo pagato <Text style={styles.policyBold}>non è rimborsabile</Text>.
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            <Checkbox
              checked={policyAccepted}
              onToggle={() => setPolicyAccepted((v) => !v)}
              label="Ho letto e accetto la politica di pagamento e cancellazione"
            />
          </View>
        </View>
      </ScrollView>
      <BookingFooter
        total={grossTotal}
        deposit={deposit}
        voucherApplied={voucherApplied}
        umbrellaCount={allUmbrellaIds.length}
        primaryLabel="Lettini e sdraio"
        primaryIcon="bed-outline"
        onPrimary={() => onStageChange('equipment')}
        primaryDisabled={!canConfirm}
        onCancel={onClose}
      />
    </View>
  );
};

const ConfirmationModal: React.FC<{
  bookings: Booking[] | null;
  isEdit: boolean;
  onClose: () => void;
  onSeeMyBookings: () => void;
}> = ({ bookings, isEdit, onClose, onSeeMyBookings }) => {
  const { getUmbrella, getCustomer } = useStore();
  const sidebarMode = useSidebarMode();
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
  const equipmentTotals = bookings.reduce(
    (acc, b) => ({ beds: acc.beds + (b.beds ?? 0), chairs: acc.chairs + (b.chairs ?? 0) }),
    { beds: 0, chairs: 0 }
  );

  const body = (
    <View style={sidebarMode ? { width: '100%', alignItems: 'center' } : styles.confirmCard}>
          <View style={styles.confirmIconCircle}>
            <Ionicons name="checkmark" size={32} color={colors.white} />
          </View>
          <Text style={styles.confirmTitle}>{isEdit ? 'Prenotazione aggiornata!' : 'Prenotazione confermata!'}</Text>
          <Text style={styles.confirmSubtitle}>Ti aspettiamo, {customer?.name}</Text>

          <View style={styles.referenceBox}>
            <Text style={styles.referenceLabel}>Codice prenotazione</Text>
            <Text style={styles.referenceValue}>{primary.reference}</Text>
            <View style={{ marginTop: spacing.sm }}>
              <QRCode value={primary.reference} size={120} />
            </View>
            <Text style={styles.referenceHint}>
              Conservalo: ti servirà per modificare o cancellare la prenotazione, oppure mostra il
              codice QR in reception per il check-in
            </Text>
          </View>

          {!!customer?.email && (
            <View style={styles.simBadge}>
              <Ionicons name="mail-outline" size={12} color={colors.primaryDark} />
              <Text style={styles.simBadgeText}>
                Ti abbiamo inviato un'email di conferma a {customer.email} con i dettagli della
                prenotazione (simulata in questa demo).
              </Text>
            </View>
          )}

          <Card style={{ marginTop: spacing.md, width: '100%' }}>
            <View style={styles.confirmRow}>
              <Text style={styles.muted}>{umbrellas.length > 1 ? 'Ombrelloni' : 'Ombrellone'}</Text>
              <Text style={styles.confirmValue}>
                {umbrellas.map((u) => `N.${u?.number} (${u?.zone})`).join(', ')}
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
              <Text style={styles.muted}>Attrezzatura</Text>
              <Text style={styles.confirmValue}>
                {equipmentTotals.beds} lettini · {equipmentTotals.chairs} sdraio
              </Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.muted}>Totale</Text>
              <Text style={styles.confirmValue}>{formatCurrency(total)}</Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.muted}>Pagato</Text>
              <Text style={[styles.confirmValue, { color: colors.libero }]}>{formatCurrency(paid)}</Text>
            </View>
          </Card>

          <Button title="Nuova prenotazione" onPress={onClose} style={{ marginTop: spacing.lg, width: '100%' }} />
          <Button
            title="Gestisci le tue prenotazioni"
            variant="ghost"
            onPress={onSeeMyBookings}
            style={{ marginTop: spacing.sm, width: '100%' }}
          />
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={sidebarMode ? sidebarBackdrop : styles.backdrop}>
        {sidebarMode ? (
          <View style={sidebarSheet()}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center' }}>
              {body}
            </ScrollView>
          </View>
        ) : (
          body
        )}
      </View>
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
  formOuter: { flex: 1 },
  formScroll: { flex: 1 },
  formScrollContentSticky: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  stickyFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },

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
    height: '94%',
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
  editDatesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  editDatesBtnText: { color: colors.white, fontWeight: '700', fontSize: 11 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  equipmentCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  equipmentTitle: { fontWeight: '700', color: colors.text, fontSize: 13 },
  equipmentPrice: { fontWeight: '800', color: colors.primaryDark, fontSize: 13 },
  simBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.prenotatoBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
    width: '100%',
  },
  simBadgeText: { color: colors.primaryDark, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  paymentProcessingBox: { alignItems: 'center', paddingVertical: spacing.xl },
  title: { fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'center' },
  paymentCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  stripeBadgeText: { color: colors.textMuted, fontSize: 11, fontWeight: '700', fontStyle: 'italic' },
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
  discountBox: {
    backgroundColor: colors.liberoBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  policyHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  policyTitle: { fontWeight: '700', color: colors.primaryDark, fontSize: 13 },
  policyText: { color: colors.text, fontSize: 12, lineHeight: 17, marginTop: 4 },
  policyBold: { fontWeight: '800' },
  input: {
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    color: colors.text,
    marginTop: spacing.xs,
  },
  welcomeText: { color: colors.libero, fontWeight: '700', fontSize: 13, marginTop: spacing.xs },
  editingAsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.prenotatoBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  editingAsText: { color: colors.primaryDark, fontWeight: '700', fontSize: 12, flexShrink: 1 },
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
  referenceBox: {
    backgroundColor: colors.prenotatoBg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
    width: '100%',
  },
  referenceLabel: { fontSize: 11, fontWeight: '700', color: colors.primaryDark, textTransform: 'uppercase' },
  referenceValue: { fontSize: 22, fontWeight: '800', color: colors.primaryDark, letterSpacing: 1, marginTop: 2 },
  referenceHint: { fontSize: 11, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  confirmValue: { fontWeight: '700', color: colors.text },
});
