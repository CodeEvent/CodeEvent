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
import {
  COLS_PER_SIDE,
  GAP,
  MIN_CELL,
  WALKWAY_WIDTH,
  BeachCanvas,
  colOffset,
  useUmbrellaPositions,
  WalkwayBreak,
} from '../../components/BeachCanvas';
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
  findActiveHoldConflict,
  findCustomerConflict,
  findNearestUmbrellas,
  findUmbrellaConflict,
  MAX_ADULTS_PER_UMBRELLA,
  MAX_EQUIPMENT_PER_UMBRELLA,
  umbrellasNeededFor,
} from '../../utils/booking';
import { PREPAYMENT_RATE, refundCutoffDate } from '../../utils/cancellation';
import { formatCurrency, formatDateLong, formatDateShort, isoDate, offsetFromToday } from '../../utils/format';
import {
  baseUmbrellaPricePerDay,
  computeDiscounts,
  isSameDayWalkIn,
  isStudentDiscountEligibleRow,
  priceBandLabel,
} from '../../utils/pricing';
import { generateBookingReference } from '../../utils/reference';
import { DesktopNav } from './SearchHomeScreen';

const WIDE_BREAKPOINT = 700;
const SIDEBAR_WIDTH = 380;

// Splits each 10-wide side into 2 sections of 5 -- on top of the existing Nord/Sud split at
// col 10 -- so the map reads as sections of 5 umbrellas with an aisle between, matching the
// seat-map reference (only used here in the customer wizard; the operator's Piantina keeps
// its plain single Nord/Sud walkway).
const SECTION_WALKWAYS: WalkwayBreak[] = [
  { at: 5, width: 16 },
  { at: 15, width: 16 },
];

// How tall a price-tier banner reserves above the first row of its band -- see buildPriceBands.
const PRICE_BANNER_HEIGHT = 42;

// Groups rows into price tiers (every row in a tier shares the exact same base price) so the
// map can show one full-width "STANDARD - DA €X" banner per tier instead of repeating the
// price on every row, mirroring a seat map's section banners.
function buildPriceBands(umbrellas: Umbrella[]) {
  const rowPrices = new Map<number, number>();
  umbrellas.forEach((u) => rowPrices.set(u.row, baseUmbrellaPricePerDay(u)));
  const sortedRows = Array.from(rowPrices.keys()).sort((a, b) => a - b);
  const isNewBandRow = (row: number) => {
    const price = rowPrices.get(row);
    if (price === undefined) return false;
    const idx = sortedRows.indexOf(row);
    const prevRow = idx > 0 ? sortedRows[idx - 1] : null;
    return prevRow === null || rowPrices.get(prevRow) !== price;
  };
  return { rowPrices, isNewBandRow };
}

// details (guests, lettini/sdraio, contact info and policy consent, all in one screen) ->
// summary (read-only recap: hold countdown, itemized cost breakdown, refund policy) ->
// payment (card entry, Stripe-only -- see BookingForm's payment stage). 'details' used to be
// followed by a "Conferma e paga" review stage that just repeated the same guest count and
// umbrella cards already visible above it -- that one was merged away. 'summary' is different:
// it's a new, genuinely read-only recap (hold timer + cost card) rather than a re-ask of
// already-entered fields. Editing an existing booking still confirms directly from 'details'
// (see BookingForm's footer), since there's no new charge or hold to review.
type BookingFormStage = 'details' | 'summary' | 'payment';

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
  /** Guest count entered on the search home card -- seeds the booking form's "Adulti"
   * stepper so a group of e.g. 6 already sees the max-4-per-umbrella policy and
   * multi-umbrella suggestions on the details step, instead of resetting to the default 2. */
  initialAdults?: number;
  /** True when the guest already chose dates in the search flow before landing here --
   * skips straight to the map instead of asking for dates a second time. */
  datesPreselected?: boolean;
}

export const CustomerBookingScreen: React.FC<CustomerBookingScreenProps> = ({
  editContext,
  onExitToLanding,
  onManage,
  initialStartOffset,
  initialDays,
  initialAdults,
  datesPreselected,
}) => {
  const { umbrellas, bookings, holds, joinWaitlist, createHold, releaseHold } = useStore();
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

  const [step, setStep] = useState<Step>(editContext || datesPreselected ? 'map' : 'dates');
  const [startOffset, setStartOffset] = useState(() =>
    primaryEditBooking ? offsetFromToday(primaryEditBooking.dateFrom) : initialStartOffset ?? 0
  );
  const [days, setDays] = useState(() =>
    primaryEditBooking
      ? offsetFromToday(primaryEditBooking.dateTo) - offsetFromToday(primaryEditBooking.dateFrom) + 1
      : initialDays ?? 1
  );
  const [awaitingEndDate, setAwaitingEndDate] = useState(false);
  // "Vista completa" shrinks cells enough that the whole Nord+Sud grid fits on screen with
  // no scrolling in either direction, purely to get oriented -- tapping still works, just
  // less precisely, so the normal (legible, scrollable) sizing stays the default.
  const [fullMapView, setFullMapView] = useState(false);
  const [selectedUmbrellaId, setSelectedUmbrellaId] = useState<string | null>(
    () => primaryEditBooking?.umbrellaId ?? null
  );
  // Tapping a seat only highlights it -- the booking form itself only opens once the guest taps
  // "Conferma" on the map's own footer, matching a tap-to-select-then-advance flow instead of
  // jumping straight into the form. Editing an existing booking skips this (there's nothing to
  // "select", they're already picking up where their booking left off).
  const [formOpen, setFormOpen] = useState(() => Boolean(editContext));
  // A new booking never touches the store until "Conferma e prenota" -- this local set
  // just highlights the umbrella(s) currently being composed in red/blue, and clears
  // itself the moment selectedUmbrellaId does (cancel, backdrop, Annulla, navigate away).
  const [pendingExtraIds, setPendingExtraIds] = useState<string[]>([]);
  // Tracks which umbrella the "you'll need more umbrellas" reminder was already shown for, so
  // re-tapping "Conferma" for the same selection doesn't nag again (picking a different
  // umbrella resets it, since that's a fresh choice worth re-confirming).
  const [multiUmbrellaNoticeShownFor, setMultiUmbrellaNoticeShownFor] = useState<string | null>(null);
  const pendingIds = useMemo(
    () => (selectedUmbrellaId ? [selectedUmbrellaId, ...pendingExtraIds] : []),
    [selectedUmbrellaId, pendingExtraIds]
  );
  const [formStage, setFormStage] = useState<BookingFormStage>('details');
  const [confirmedGroup, setConfirmedGroup] = useState<Booking[] | null>(null);
  const [confirmedIsEdit, setConfirmedIsEdit] = useState(false);
  const [dateEditVisible, setDateEditVisible] = useState(false);
  const [waitlistUmbrella, setWaitlistUmbrella] = useState<Umbrella | null>(null);
  // This guest's own in-flight checkout hold(s) -- kept out of `isFreeForPeriod`'s conflict
  // check (below) so the umbrella(s) they're actively booking still look selectable/theirs,
  // while every other tab/session still sees them as unavailable for the same window.
  const [ownHoldIds, setOwnHoldIds] = useState<string[]>([]);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);

  // Only three steps, per the reference flow: (1) Mappa+Dettagli -- pick the spot and fill in
  // guests/contact info on one dot, since picking a spot and confirming its details are really
  // one "reservation" step; (2) Riepilogo (read-only recap + hold countdown + cost breakdown);
  // (3) Pagamento (card entry). Editing an existing booking skips 'summary' entirely and
  // confirms straight from Dettagli (see BookingForm's footer) since there's no new charge or
  // hold to review.
  const stepIndexForStage: Record<BookingFormStage, number> = { details: 0, summary: 1, payment: 2 };
  const isFormOpen = Boolean(selectedUmbrellaId && formOpen);
  const currentStepIndex = !isFormOpen ? 0 : stepIndexForStage[formStage];
  const TOTAL_STEPS = 3;
  const currentStepTitle =
    step === 'dates'
      ? 'Scegli le date'
      : !isFormOpen
      ? 'Scegli il tuo posto'
      : formStage === 'details'
      ? editContext
        ? 'Modifica prenotazione'
        : 'Completa la prenotazione'
      : formStage === 'summary'
      ? 'Riepilogo'
      : 'Pagamento';

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

  const ownHoldIdSet = useMemo(() => new Set(ownHoldIds), [ownHoldIds]);
  const isFreeForPeriod = (u: Umbrella) =>
    !findUmbrellaConflict(availabilityBookings, u.id, dateFrom, dateTo) &&
    !findActiveHoldConflict(holds, u.id, dateFrom, dateTo, ownHoldIdSet);

  // Creates a real, short-lived checkout hold the moment a NEW (non-edit) booking form opens,
  // so nobody else can grab the same umbrella(s) while this guest is mid-checkout -- and
  // releases it the instant the form closes, the selection changes, or the guest confirms
  // (all of which change `isFormOpen`/`pendingIds` and re-run this effect's cleanup).
  useEffect(() => {
    if (editContext || !isFormOpen || pendingIds.length === 0) {
      setOwnHoldIds([]);
      setHoldExpiresAt(null);
      return;
    }
    const created = createHold(pendingIds, dateFrom, dateTo);
    setOwnHoldIds(created.map((h) => h.id));
    setHoldExpiresAt(created[0]?.expiresAt ?? null);
    return () => {
      created.forEach((h) => releaseHold(h.id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editContext, isFormOpen, pendingIds.join(','), dateFrom, dateTo]);

  // Auto-expiry: when the hold above actually runs out (guest never finished checkout in
  // time), kick them back to the map so the umbrella visibly frees up again rather than
  // silently letting them keep filling in a form for a spot that's no longer reserved.
  useEffect(() => {
    if (editContext || !isFormOpen || !holdExpiresAt) return;
    const msLeft = holdExpiresAt - Date.now();
    if (msLeft <= 0) return;
    const timeout = setTimeout(() => {
      setSelectedUmbrellaId(null);
      setPendingExtraIds([]);
      setFormOpen(false);
      alert(
        'Tempo scaduto',
        "Il tempo per completare la prenotazione è scaduto e l'ombrellone è tornato disponibile. Seleziona di nuovo il tuo posto."
      );
    }, msLeft);
    return () => clearTimeout(timeout);
  }, [editContext, isFormOpen, holdExpiresAt]);

  const labelWidth = isWide ? 84 : 60;
  // The map is 20 seats wide (10 Nord + walkway + 10 Sud) and rarely fits a phone or a
  // sidebar-narrowed column without shrinking cells past legibility, so the cell size is
  // normally driven by available height only -- the canvas scrolls horizontally to reveal
  // the rest. "Vista completa" (below) is the deliberate exception: it also factors in
  // width so the guest can see the entire beach at a glance on demand.
  const mapAreaHeight = height - 320;
  const normalCellSize = Math.max(MIN_CELL, Math.min(72, Math.floor(mapAreaHeight / ROWS) - GAP));
  const totalCols = COLS_PER_SIDE * 2;
  const mapAreaWidth = width - labelWidth - spacing.lg * 2;
  const totalWalkwayWidth = WALKWAY_WIDTH + SECTION_WALKWAYS.reduce((sum, w) => sum + w.width, 0);
  const widthBasedCellSize = Math.floor((mapAreaWidth - totalWalkwayWidth - (totalCols - 1) * GAP) / totalCols);
  const heightBasedCellSize = Math.floor(mapAreaHeight / ROWS) - GAP;
  const fullCellSize = Math.max(14, Math.min(widthBasedCellSize, heightBasedCellSize));
  const cellSize = fullMapView ? fullCellSize : normalCellSize;

  const priceBands = useMemo(() => buildPriceBands(umbrellas), [umbrellas]);
  const rowBannerHeight = (row: number) => (priceBands.isNewBandRow(row) ? PRICE_BANNER_HEIGHT : 0);
  const positions = useUmbrellaPositions(umbrellas, cellSize, GAP, cellSize, SECTION_WALKWAYS, rowBannerHeight);

  // Known ahead of the map -- carried from the home search card's "Persone" stepper (falls
  // back to 2 if the guest arrived without going through search first). Used both to label
  // the "Selected spot" row and to warn the guest, right when they select a spot, that their
  // group needs more than one umbrella.
  const guestsHint = initialAdults && initialAdults > 0 ? initialAdults : 2;

  // Takes the umbrella id explicitly (rather than reading selectedUmbrellaId from closure)
  // because this always runs in the same tap that just set it -- that state update hasn't
  // committed yet when this executes.
  const maybeWarnMultiUmbrella = (umbrellaId: string) => {
    if (editContext || multiUmbrellaNoticeShownFor === umbrellaId) return;
    const needed = umbrellasNeededFor(guestsHint);
    if (needed > 1) {
      setMultiUmbrellaNoticeShownFor(umbrellaId);
      const extraCount = needed - 1;
      const extraText = extraCount === 1 ? 'un altro ombrellone' : `altri ${extraCount} ombrelloni`;
      alert(
        'Serviranno più ombrelloni',
        `Per ${guestsHint} persone servono almeno ${needed} ombrelloni (max ${MAX_ADULTS_PER_UMBRELLA} persone ciascuno). Ti abbiamo già suggerito ${extraText} vicino al tuo: potrai controllarli nel prossimo passo.`
      );
    }
  };

  const handleTap = (u: Umbrella) => {
    if (!isFreeForPeriod(u)) {
      alert(
        'Non disponibile',
        `L'ombrellone N.${u.number} (${u.zone}) non è disponibile per il periodo scelto.`,
        [
          { text: 'Chiudi', style: 'cancel' },
          { text: "Iscriviti alla lista d'attesa", onPress: () => setWaitlistUmbrella(u) },
        ]
      );
      return;
    }
    // Tapping the already-selected umbrella again deselects it, like a seat picker.
    if (selectedUmbrellaId === u.id) {
      setSelectedUmbrellaId(null);
      setPendingExtraIds([]);
      setFormOpen(false);
      return;
    }
    setPendingExtraIds([]);
    setSelectedUmbrellaId(u.id);
    setFormStage('details');
    // Selecting a spot goes straight into the booking form -- no separate "Conferma" tap.
    maybeWarnMultiUmbrella(u.id);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (editContext) {
      onExitToLanding();
    } else {
      setSelectedUmbrellaId(null);
      setFormOpen(false);
    }
  };

  const handleConfirmed = (createdBookings: Booking[], isEdit: boolean) => {
    setSelectedUmbrellaId(null);
    setFormOpen(false);
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
      isFreeForPeriod={isFreeForPeriod}
      pendingIds={pendingIds}
      onTap={handleTap}
      onChangeDates={() => setDateEditVisible(true)}
      fullMapView={fullMapView}
      onToggleFullMapView={() => setFullMapView((v) => !v)}
      rowBannerHeight={rowBannerHeight}
      rowPrices={priceBands.rowPrices}
      selectedUmbrella={umbrellas.find((u) => u.id === selectedUmbrellaId) ?? null}
      guestsHint={guestsHint}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Desktop widths get the same top nav as SearchHomeScreen's results/detail pages
          (isWide here, 700, is always true whenever that screen's own 900px desktop shell is
          active) -- without this the wizard was the one screen still showing the old plain
          light header, breaking the otherwise-uniform nav/color/font treatment. Phone widths
          keep the original back-chevron + venue-name header unchanged. */}
      {isWide ? (
        <DesktopNav
          onLogoPress={onExitToLanding}
          onNavigateTab={(tab) => (tab === 'bookings' ? onManage() : onExitToLanding())}
        />
      ) : (
        <View style={styles.plainHeader}>
          <Pressable onPress={onExitToLanding} style={styles.plainHeaderBackBtn} accessibilityLabel="Torna alla home">
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.plainHeaderTitle} numberOfLines={1} adjustsFontSizeToFit>
            Prenotazione per Bagno Pietrasanta
          </Text>
          <Pressable onPress={onManage} style={styles.plainHeaderBackBtn} accessibilityLabel="Gestisci la tua prenotazione">
            <Ionicons name="person-circle-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      {isWide && (
        <View style={styles.desktopWizardTitleRow}>
          <Text style={styles.desktopWizardTitle} numberOfLines={1}>
            Prenotazione per Bagno Pietrasanta
          </Text>
        </View>
      )}

      <View style={[styles.stepTitleRow, isWide && styles.stepTitleRowWide]}>
        <Text style={styles.headerStepTitle}>{currentStepTitle}</Text>
        <Text style={styles.headerDateText}>
          {formatDateShort(dateFrom)} → {formatDateShort(dateTo)}
        </Text>
      </View>

      <StepProgressBar totalSteps={TOTAL_STEPS} currentIndex={currentStepIndex} />

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
            {isFormOpen ? (
              <BookingForm
                key={selectedUmbrellaId}
                umbrellaId={selectedUmbrellaId as string}
                dateFrom={dateFrom}
                dateTo={dateTo}
                allUmbrellas={umbrellas}
                isFreeForPeriod={isFreeForPeriod}
                bookingsForAvailability={availabilityBookings}
                editContext={editContext}
                holdExpiresAt={holdExpiresAt}
                initialAdults={initialAdults}
                onClose={closeForm}
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

      {!isWide && isFormOpen && (
        <Modal visible transparent animationType="slide" onRequestClose={closeForm}>
          <Pressable style={styles.backdrop} onPress={closeForm}>
            <Pressable style={styles.formSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.handle} />
              <BookingForm
                key={selectedUmbrellaId}
                umbrellaId={selectedUmbrellaId as string}
                dateFrom={dateFrom}
                dateTo={dateTo}
                allUmbrellas={umbrellas}
                isFreeForPeriod={isFreeForPeriod}
                bookingsForAvailability={availabilityBookings}
                editContext={editContext}
                holdExpiresAt={holdExpiresAt}
                initialAdults={initialAdults}
                onClose={closeForm}
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
  isFreeForPeriod: (u: Umbrella) => boolean;
  pendingIds: string[];
  onTap: (u: Umbrella) => void;
  onChangeDates: () => void;
  fullMapView: boolean;
  onToggleFullMapView: () => void;
  rowBannerHeight: (row: number) => number;
  rowPrices: Map<number, number>;
  selectedUmbrella: Umbrella | null;
  guestsHint: number;
}> = ({
  umbrellas,
  positions,
  cellSize,
  labelWidth,
  dateFrom,
  dateTo,
  isFreeForPeriod,
  pendingIds,
  onTap,
  onChangeDates,
  fullMapView,
  onToggleFullMapView,
  rowBannerHeight,
  rowPrices,
  selectedUmbrella,
  guestsHint,
}) => {
  // Where the Nord side ends and the Sud side begins, in the same units BeachCanvas positions
  // cells in -- needed so each price banner's label can center within the side that's actually
  // on screen, instead of one label centered across the full Nord+Sud width (which lands in
  // the gap between the two and is invisible until the guest scrolls to exactly that spot).
  const nordWidth = colOffset(COLS_PER_SIDE - 1, cellSize, GAP, SECTION_WALKWAYS) + cellSize;
  const sudStart = nordWidth + WALKWAY_WIDTH + GAP;

  return (
  // A real View (not a Fragment) so `flex: 1` can bound this step's height to whatever's left
  // of the screen below the header/progress-bar -- without it, BeachCanvas's own `flex: 1`
  // has no definite space to fill and instead renders at its full natural content height (all
  // 17 rows), pushing the selected-spot row and everything below it past the bottom of the
  // viewport with no way to scroll there (the app disables native page scroll; BeachCanvas's
  // drag-to-pan only pans *within* its own box, it doesn't reveal siblings after it). Bounding
  // this step properly means the map now scrolls/pans within a fixed-size box and the footer
  // stays put.
  <View style={styles.mapStepOuter}>
    <View style={styles.mapHeader}>
      <Pressable onPress={onChangeDates} style={styles.dateSelectPill}>
        <Ionicons name="calendar-outline" size={14} color={colors.primaryDark} />
        <Text style={styles.dateSelectPillText} numberOfLines={1}>
          {formatDateShort(dateFrom)} → {formatDateShort(dateTo)}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.primaryDark} />
      </Pressable>
    </View>

    <View style={styles.mapCanvasWrap}>
    <Pressable
      onPress={onToggleFullMapView}
      style={styles.expandFab}
      accessibilityLabel={fullMapView ? 'Vista compatta' : 'Vista completa'}
    >
      <Ionicons name={fullMapView ? 'contract-outline' : 'expand-outline'} size={18} color={colors.white} />
    </Pressable>
    <BeachCanvas
      umbrellas={umbrellas}
      positions={positions}
      cellSize={cellSize}
      labelWidth={labelWidth}
      extraWalkways={SECTION_WALKWAYS}
      richSeaBand
      dragToPan
      rowBannerHeight={rowBannerHeight}
      renderRowBanner={(row) => {
        // One bar over the Nord side, one over the Sud side -- each sized and positioned
        // exactly to its own side (not just centered across the combined Nord+Sud width),
        // so the price is visible whichever side the guest has scrolled to.
        const label = `Da ${formatCurrency(rowPrices.get(row) ?? 0)} al giorno`;
        return (
          <>
            <View style={[styles.priceBanner, { left: 0, width: nordWidth }]}>
              <Text style={styles.priceBannerText} numberOfLines={1}>
                {label}
              </Text>
            </View>
            <View style={[styles.priceBanner, { left: sudStart, right: 0 }]}>
              <Text style={styles.priceBannerText} numberOfLines={1}>
                {label}
              </Text>
            </View>
          </>
        );
      }}
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
              },
            ]}
          >
            {pending && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius: cellSize * 0.22,
                    overflow: 'hidden',
                    borderWidth: Math.max(2, Math.round(cellSize * 0.06)),
                    borderColor: colors.white,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.35,
                    shadowRadius: 4,
                    elevation: 6,
                  },
                ]}
              >
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: cellSize / 2, backgroundColor: colors.occupato }} />
                <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: cellSize / 2, backgroundColor: colors.prenotato }} />
              </View>
            )}
            <View
              style={{
                width: cellSize * (pending ? 0.5 : 0.62),
                height: cellSize * (pending ? 0.34 : 0.42),
                borderRadius: cellSize * 0.14,
                backgroundColor: pending ? colors.white : free ? colors.libero : colors.textMuted,
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  top: cellSize * 0.045,
                  left: cellSize * 0.07,
                  right: cellSize * 0.07,
                  height: cellSize * 0.1,
                  borderRadius: cellSize * 0.05,
                  backgroundColor: 'rgba(255,255,255,0.5)',
                }}
              />
            </View>
            <Text
              style={[
                styles.cellNumber,
                { fontSize: Math.min(13, Math.max(9, cellSize / 5)), color: pending ? colors.white : colors.text },
              ]}
            >
              {u.number}
            </Text>
            {pending && cellSize >= 30 && (
              <View
                style={[
                  styles.pendingCheckBadge,
                  {
                    width: Math.round(cellSize * 0.38),
                    height: Math.round(cellSize * 0.38),
                    borderRadius: Math.round(cellSize * 0.19),
                  },
                ]}
              >
                <Ionicons name="checkmark" size={Math.max(9, Math.round(cellSize * 0.22))} color={colors.white} />
              </View>
            )}
          </Pressable>
        );
      }}
    />
    </View>

    <View style={styles.selectedSpotRow}>
      <View style={styles.selectedSpotItem}>
        <Ionicons name="pricetag-outline" size={16} color={colors.textMuted} />
        <Text style={styles.selectedSpotText} numberOfLines={1}>
          {selectedUmbrella ? `N. ${selectedUmbrella.number}` : 'Nessun posto'}
        </Text>
      </View>
      <View style={styles.selectedSpotItem}>
        <Ionicons name="people-outline" size={16} color={colors.textMuted} />
        <Text style={styles.selectedSpotText}>{guestsHint}</Text>
      </View>
      <View style={styles.selectedSpotItem}>
        <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
        <Text style={styles.selectedSpotText} numberOfLines={1}>
          {formatDateShort(dateFrom)} → {formatDateShort(dateTo)}
        </Text>
      </View>
      {selectedUmbrella && (
        <Text style={styles.selectedSpotPrice} numberOfLines={1}>
          {formatCurrency(rowPrices.get(selectedUmbrella.row) ?? 0)}
        </Text>
      )}
    </View>
  </View>
  );
};

type Equipment = { beds: number; chairs: number };
// A brand-new booking starts with no beds/chairs at all, so "Totale soggiorno" reflects
// just the bare umbrella price -- the guest then watches it climb as they pick lettini/sdraio
// on the "Lettini e sdraio" step. Editing an existing booking is unaffected: it seeds from
// the booking's actual saved equipment instead (see editBookings below).
const DEFAULT_EQUIPMENT: Equipment = { beds: 0, chairs: 0 };

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
  /** Shown only while primaryDisabled, so the guest isn't left staring at a greyed-out
   * button with no idea what's missing. */
  disabledHint?: string | null;
  onCancel: () => void;
  cancelLabel?: string;
}> = ({
  total,
  deposit,
  voucherApplied,
  umbrellaCount,
  primaryLabel,
  primaryIcon,
  onPrimary,
  primaryDisabled,
  disabledHint,
  onCancel,
  cancelLabel,
}) => (
  <View style={styles.stickyFooter}>
    <View style={styles.footerContent}>
      <View style={styles.footerSummaryRow}>
        <View>
          <Text style={styles.footerSummaryLabel}>
            Totale {umbrellaCount > 1 ? `(${umbrellaCount} ombrelloni)` : ''}
          </Text>
          <Text style={styles.footerSummaryValue}>{formatCurrency(total)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.footerSummaryLabel}>Da pagare ora</Text>
          <Text style={styles.footerSummaryValue}>{formatCurrency(deposit)}</Text>
        </View>
      </View>
      {!!voucherApplied && (
        <Text style={[styles.muted, { color: colors.libero }]}>
          Credito voucher applicato: -{formatCurrency(voucherApplied)}
        </Text>
      )}
      {primaryDisabled && !!disabledHint && (
        <Text style={styles.disabledHintText}>{disabledHint}</Text>
      )}
    </View>
    {/* Same edge-to-edge, square-cornered two-tone bar as the map step's own footer
        (mapFooterRow/mapFooterLabel/mapFooterCta) -- one consistent button shape and size
        across every step, matching the reference design's AVANTI footer. */}
    <View style={styles.footerActionRow}>
      <Pressable onPress={onCancel} style={styles.footerBackBtn}>
        <Text style={styles.footerBackText} numberOfLines={1}>
          {cancelLabel ?? 'Annulla'}
        </Text>
      </Pressable>
      <Pressable
        onPress={onPrimary}
        disabled={primaryDisabled}
        style={[styles.footerCta, primaryDisabled && styles.footerCtaDisabled]}
      >
        <Text style={styles.footerCtaText} numberOfLines={1}>
          {primaryLabel}
        </Text>
        <Ionicons name={primaryIcon} size={18} color={colors.white} />
      </Pressable>
    </View>
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
  /** Epoch ms when this guest's checkout hold on the selected umbrella(s) expires -- null
   * while editing (no hold) or before a hold has been created yet. Drives the countdown shown
   * on the 'summary' stage. */
  holdExpiresAt: number | null;
  /** Guest count entered on the search home card, for a NEW (non-edit) booking only --
   * seeds "Adulti" so a group over MAX_ADULTS_PER_UMBRELLA already sees the multi-umbrella
   * suggestions on first render instead of the default 2. */
  initialAdults?: number;
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
  holdExpiresAt,
  initialAdults,
  onClose,
  onConfirmed,
  onEditDates,
  stage,
  onStageChange,
  onExtrasChange,
}) => {
  const { getUmbrella, customers, createBooking, upsertCustomer, getActivePriceList, cancelBooking } = useStore();
  const alert = useAppAlert();
  // Every umbrella (bundle rows included) starts bare -- see DEFAULT_EQUIPMENT above. If the
  // guest later picks exactly Fila 1/2's bundle quantity, perDayRate below still snaps to that
  // package's discounted rate; there's just no equipment assumed before they've chosen any.
  const defaultEquipmentFor = (_id: string): Equipment => DEFAULT_EQUIPMENT;
  const editBookings = editContext?.bookings ?? [];
  // Editing an existing booking's "cancel" exits the whole edit session, so it keeps saying
  // "Annulla" -- but for a fresh booking it just returns to the map (see onClose above), so a
  // more concrete label makes it clear the guest can freely change their umbrella pick.
  const cancelLabel = editContext ? 'Annulla' : 'Cambia ombrellone';
  // Only carry over the rest of the group (extra umbrellas + their equipment) when the
  // customer hasn't changed their primary pick -- if they tap a different umbrella on
  // the map, that's a fresh single-umbrella selection instead of silently stacking on
  // top of their original group.
  const isOriginalPrimary = editBookings.length > 0 && editBookings[0].umbrellaId === umbrellaId;

  // Computed once up front (not just inside the `adults` initializer) so the extra-umbrella
  // seeding below can use the exact same starting headcount -- otherwise a group of e.g. 8
  // arriving with initialAdults already set would render with "Adulti: 8" but zero extra
  // umbrellas pre-selected, leaving capacity at 4 and silently blocking "Continua" until the
  // guest happened to notice the small red hint and manually add one from the suggestions.
  const startingAdults = editBookings.length
    ? editBookings.reduce((s, b) => s + (b.guests?.adults ?? 0), 0) || 1
    : initialAdults && initialAdults > 0
    ? initialAdults
    : 2;
  // Same reasoning as above, computed once for the extra-umbrella + equipment initializers
  // below: a brand-new booking whose starting headcount already needs more than one umbrella
  // gets the rest of the group nearby pre-selected immediately, instead of only ever gaining
  // extras once the guest manually nudges the "Adulti" stepper (see changeAdults/adjustExtras).
  const startingExtraIds =
    !isOriginalPrimary && !editContext
      ? (() => {
          const needed = Math.max(0, umbrellasNeededFor(startingAdults) - 1);
          if (needed === 0) return [];
          const anchor = getUmbrella(umbrellaId);
          if (!anchor) return [];
          return findNearestUmbrellas(anchor, allUmbrellas, isFreeForPeriod, new Set([umbrellaId]), needed).map(
            (u) => u.id
          );
        })()
      : [];

  const [phone, setPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [adults, setAdults] = useState(() => startingAdults);
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
  // Ticks once a second purely to redraw the hold countdown on the 'summary' stage below --
  // the hold's actual expiry/release is handled by the parent (CustomerBookingScreen), this
  // is display-only.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!holdExpiresAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [holdExpiresAt]);
  const holdSecondsLeft = holdExpiresAt ? Math.max(0, Math.ceil((holdExpiresAt - now) / 1000)) : null;
  const holdCountdownLabel =
    holdSecondsLeft !== null
      ? `${Math.floor(holdSecondsLeft / 60)}:${String(holdSecondsLeft % 60).padStart(2, '0')}`
      : null;
  const [extraUmbrellaIds, setExtraUmbrellaIds] = useState<string[]>(() =>
    isOriginalPrimary
      ? editBookings.filter((b) => b.umbrellaId !== umbrellaId).map((b) => b.umbrellaId)
      : startingExtraIds
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
    const map: Record<string, Equipment> = {
      [umbrellaId]: matching ? { beds: matching.beds ?? 0, chairs: matching.chairs ?? 0 } : defaultEquipmentFor(umbrellaId),
    };
    startingExtraIds.forEach((id) => {
      map[id] = defaultEquipmentFor(id);
    });
    return map;
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

  const perDayRate = (id: string) => {
    const u = getUmbrella(id);
    if (!u) return dailyRate;
    const eq = equipment[id] ?? defaultEquipmentFor(id);
    return baseUmbrellaPricePerDay(u) + eq.beds * bedRate + eq.chairs * chairRate;
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

  // Availability/capacity alone (no identity, no policy).
  const capacityAndAvailabilityOk = !conflict && !customerConflict && capacityOk;

  // Guests, contact info and policy consent are all collected together on the one 'details'
  // screen now, so a single gate covers everything the primary button needs -- for both a new
  // booking and an edit (which skips the identity checks since a matched customer is already
  // known, but still needs the policy re-accepted).
  const canConfirm =
    (editContext ||
      !!matchedCustomer ||
      (isNewCustomer && newName.trim().length > 0 && newEmail.includes('@'))) &&
    capacityAndAvailabilityOk &&
    policyAccepted;

  // Pinpoints the single next thing missing so a disabled "continue" button never leaves the
  // guest guessing -- conflict/customerConflict aren't listed here since those already get
  // their own visible red banner (conflictBanner) right in the form.
  const missingRequirement =
    !editContext && !matchedCustomer && normalizePhone(phone).length < 6
      ? 'Inserisci il tuo numero di telefono per continuare'
      : !editContext && isNewCustomer && newName.trim().length === 0
      ? 'Inserisci il tuo nome e cognome per continuare'
      : !editContext && isNewCustomer && !newEmail.includes('@')
      ? 'Inserisci un indirizzo email valido per continuare'
      : !capacityOk
      ? `Per ${adults} adulti servono più ombrelloni: aggiungine tra quelli suggeriti qui sopra`
      : !policyAccepted
      ? 'Accetta la politica di pagamento e cancellazione per continuare'
      : null;

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

  if (stage === 'summary') {
    return (
      <View style={styles.formOuter}>
        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formScrollContentSticky}>
          <Pressable onPress={() => onStageChange('details')} style={styles.backLink}>
            <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
            <Text style={styles.backLinkText}>Torna alla prenotazione</Text>
          </Pressable>

          <Text style={styles.sheetTitle}>Riepilogo</Text>

          {holdCountdownLabel && (
            <View style={styles.holdBanner}>
              <Ionicons name="time-outline" size={22} color={colors.in_arrivo} />
              <View style={styles.holdBannerTextBox}>
                <Text style={styles.holdBannerTitle}>Ombrellone bloccato per te</Text>
                <Text style={styles.holdBannerSubtitle}>Completa il pagamento prima che scada il tempo</Text>
              </View>
              <Text style={styles.holdBannerTime}>{holdCountdownLabel}</Text>
            </View>
          )}

          {conflictBanner}

          <View style={styles.costCard}>
            {allUmbrellaIds.map((id) => {
              const u = getUmbrella(id);
              if (!u) return null;
              return (
                <View key={id} style={styles.costRow}>
                  <Text style={styles.costRowLabel}>
                    Ombrellone N.{u.number} · {u.zone}
                  </Text>
                  <Text style={styles.costRowValue}>{formatCurrency(umbrellaTotal(id))}</Text>
                </View>
              );
            })}
            {voucherApplied > 0 && (
              <View style={styles.costRow}>
                <Text style={styles.costRowLabel}>Credito voucher</Text>
                <Text style={[styles.costRowValue, { color: colors.libero }]}>
                  -{formatCurrency(voucherApplied)}
                </Text>
              </View>
            )}
            <View style={styles.costRowDivider} />
            <View style={styles.costRow}>
              <Text style={styles.costRowTotalLabel}>Totale</Text>
              <Text style={styles.costRowTotalValue}>{formatCurrency(total)}</Text>
            </View>
          </View>

          <View style={styles.policyBox}>
            <View style={styles.policyHeaderRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.primaryDark} />
              <Text style={styles.policyTitle}>Pagamento anticipato</Text>
            </View>
            <Text style={styles.policyText}>
              Rimborsabile con voucher fino al <Text style={styles.policyBold}>{formatDateShort(cutoffDate)}</Text>.
            </Text>
          </View>
        </ScrollView>
        <BookingFooter
          total={grossTotal}
          deposit={deposit}
          voucherApplied={voucherApplied}
          umbrellaCount={allUmbrellaIds.length}
          primaryLabel="Paga"
          primaryIcon="card-outline"
          onPrimary={() => onStageChange('payment')}
          primaryDisabled={!canConfirm}
          onCancel={onClose}
          cancelLabel={cancelLabel}
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
          <Pressable onPress={() => onStageChange('summary')} style={styles.backLink}>
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
          primaryLabel="Paga"
          primaryIcon="card-outline"
          onPrimary={startPayment}
          primaryDisabled={!canConfirm || paymentProcessing}
          onCancel={onClose}
          cancelLabel={cancelLabel}
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
              Per {adults} adulti servono {umbrellasNeeded} ombrelloni:{' '}
              {extraNeeded > extraUmbrellaIds.length ? `aggiungine almeno ${extraNeeded - extraUmbrellaIds.length}` : 'ne hai aggiunti abbastanza'}.
            </Text>
            {nearbySuggestions.map((u) => {
              const selected = extraUmbrellaIds.includes(u.id);
              return (
                <Pressable
                  key={u.id}
                  onPress={() => toggleExtra(u.id)}
                  style={[styles.extraRow, selected && styles.extraRowSelected]}
                >
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'add-circle-outline'}
                    size={18}
                    color={selected ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.extraRowText, selected && styles.extraRowTextSelected]}>
                    {selected ? 'Aggiunto' : 'Aggiungi'} · Ombrellone N.{u.number} · {u.zone}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Booking.com-style package table, but only ever meaningful once a specific umbrella
            (and therefore a specific price band) is already chosen -- shown here, right after
            that pick, rather than on the pre-booking marketing/detail page where selecting a
            band/quantity would look like a reservation without a real spot behind it. The
            "+N lettini" package's N always matches the adults just entered above (capped at
            MAX_EQUIPMENT_PER_UMBRELLA, since a big group needing multiple umbrellas can't all
            fit their lettini on this one) -- tapping a package just sets this umbrella's own
            Lettini stepper below, which the guest can still fine-tune afterward. */}
        {umbrella && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Disponibilità</Text>
            <View style={styles.packageTable}>
              <View style={styles.packageHeaderRow}>
                <Text style={[styles.packageHeaderCell, { flex: 2 }]}>Tipo di ombrellone</Text>
                <Text style={[styles.packageHeaderCell, { flex: 1 }]}>
                  Prezzo per {days} {days === 1 ? 'giorno' : 'giorni'}
                </Text>
                <Text style={[styles.packageHeaderCell, { flex: 1 }]}>La tua scelta</Text>
                <Text style={[styles.packageHeaderCell, { width: 60, textAlign: 'center' }]}>Seleziona</Text>
              </View>
              {[
                { key: 'bare', label: 'Solo ombrellone', beds: 0 },
                { key: 'beds', label: `Ombrellone + ${Math.min(adults, MAX_EQUIPMENT_PER_UMBRELLA)} lettini`, beds: Math.min(adults, MAX_EQUIPMENT_PER_UMBRELLA) },
              ].map((pkg, i) => {
                const eq = equipment[umbrellaId] ?? defaultEquipmentFor(umbrellaId);
                const price = (baseUmbrellaPricePerDay(umbrella) + pkg.beds * bedRate) * days;
                const selected = eq.beds === pkg.beds;
                return (
                  <View key={pkg.key} style={[styles.packageRow, i === 0 && styles.packageRowFirst]}>
                    <View style={{ flex: 2 }}>
                      {i === 0 && (
                        <>
                          <Text style={styles.packageBandLabel}>{priceBandLabel(umbrella)}</Text>
                          <Text style={styles.packageBandSub}>
                            Fila {umbrella.row + 1} · max {MAX_ADULTS_PER_UMBRELLA} adulti
                          </Text>
                        </>
                      )}
                      <Text style={styles.packagePackageLabel}>{pkg.label}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.packagePrice}>{formatCurrency(price)}</Text>
                      <Text style={styles.packagePriceHint}>tasse incluse</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.packageChoiceRow}>
                        <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                        <Text style={styles.packageChoiceText}>Rimborsabile con voucher fino al {formatDateShort(cutoffDate)}</Text>
                      </View>
                      {pkg.beds > 0 && (
                        <View style={styles.packageChoiceRow}>
                          <Ionicons name="bed-outline" size={13} color={colors.textMuted} />
                          <Text style={styles.packageChoiceText}>{pkg.beds} lettini inclusi</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ width: 60, alignItems: 'center' }}>
                      <Pressable
                        onPress={() => setBeds(umbrellaId, pkg.beds)}
                        style={styles.packageSelectBtn}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={pkg.label}
                      >
                        <Ionicons
                          name={selected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={selected ? colors.primary : colors.border}
                        />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
          {allUmbrellaIds.length > 1 ? 'I tuoi ombrelloni' : 'Il tuo ombrellone'}
        </Text>
        {allUmbrellaIds.map((id) => {
          const u = getUmbrella(id);
          if (!u) return null;
          const eq = equipment[id] ?? defaultEquipmentFor(id);
          const discount = umbrellaDiscount(id);
          return (
            <View key={id} style={styles.equipmentCard}>
              <View style={styles.equipmentCardHeader}>
                <View style={styles.equipmentThumb}>
                  <Ionicons name="sunny-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.equipmentTitle}>Ombrellone N.{u.number}</Text>
                  <Text style={styles.equipmentSubtitle}>{u.zone}</Text>
                </View>
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
              <Text style={styles.muted}>
                {[
                  `${formatCurrency(perDayRate(id) - eq.beds * bedRate - eq.chairs * chairRate)} ombrellone`,
                  eq.beds > 0 ? `${formatCurrency(eq.beds * bedRate)} lettini` : null,
                  eq.chairs > 0 ? `${formatCurrency(eq.chairs * chairRate)} sdraio` : null,
                ]
                  .filter(Boolean)
                  .join(' + ')}
                , al giorno
              </Text>
              {discount.total > 0 && (
                <Text style={[styles.muted, { color: colors.libero, fontWeight: '700' }]}>
                  Sconto applicato: -{Math.round(discount.total * 100)}%
                </Text>
              )}
            </View>
          );
        })}

        {editContext && (
          <View style={styles.editingAsBox}>
            <Ionicons name="person-circle-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.editingAsText}>Stai modificando la prenotazione di {editContext.customer.name}</Text>
          </View>
        )}

        {conflictBanner}

        {/* Only shown when a discount actually applies to this booking -- a walk-in-today
            stay where neither discount is relevant used to still render this whole box just
            to say "not available for this umbrella," which read as an error rather than a
            perk and added a block of text nobody needed to see. */}
        {isWalkInToday && (anyLateDiscount || anyStudentDiscountEligibleRow) && (
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
            {anyStudentDiscountEligibleRow && (
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
            )}
          </View>
        )}

        {/* Editing an existing booking already knows who the customer is -- only a brand-new
            booking needs to ask. */}
        {!editContext && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>I tuoi contatti</Text>
            <TextInput
              style={styles.input}
              placeholder="Il tuo numero di telefono"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            {matchedCustomer && (
              <Text style={styles.welcomeText}>Bentornato/a, {matchedCustomer.name}! 👋</Text>
            )}
            {matchedCustomer && !!matchedCustomer.voucherBalance && (
              <Text style={styles.welcomeText}>
                Hai un credito voucher di {formatCurrency(matchedCustomer.voucherBalance)}: verrà applicato a questa
                prenotazione.
              </Text>
            )}
            {isNewCustomer && (
              <View style={{ marginTop: spacing.sm }}>
                <TextInput
                  style={styles.input}
                  placeholder="Nome e cognome"
                  placeholderTextColor={colors.textMuted}
                  value={newName}
                  onChangeText={setNewName}
                />
              </View>
            )}
            {(isNewCustomer || (matchedCustomer && !matchedCustomer.email)) && (
              <View style={{ marginTop: spacing.sm }}>
                <TextInput
                  style={styles.input}
                  placeholder="Email (per la conferma della prenotazione)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={newEmail}
                  onChangeText={setNewEmail}
                />
              </View>
            )}
          </>
        )}

        <View style={styles.policyBox}>
          <View style={styles.policyHeaderRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.policyTitle}>Pagamento anticipato</Text>
          </View>
          <Text style={styles.policyText}>
            {formatCurrency(deposit)} vengono addebitati ora. Rimborsabile con voucher se annulli entro il{' '}
            <Text style={styles.policyBold}>{formatDateShort(cutoffDate)}</Text>; dopo tale data, o in caso di
            no-show, l'importo <Text style={styles.policyBold}>non è rimborsabile</Text>.
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
        primaryLabel={editContext ? 'Conferma' : 'Continua'}
        primaryIcon="checkmark-circle-outline"
        onPrimary={() => (editContext ? confirm() : onStageChange('summary'))}
        primaryDisabled={!canConfirm}
        disabledHint={missingRequirement}
        onCancel={onClose}
        cancelLabel={cancelLabel}
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
          // Capped height + its own ScrollView -- without this, a booking with several
          // umbrellas (taller card) could overflow past the top of the screen with no way
          // to reach the rest short of resizing the browser window.
          <View style={styles.confirmSheetOuter}>
            <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: spacing.lg }}>{body}</ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.card },
  // Plain cream header (back chevron + venue name inline) for the booking wizard specifically,
  // matching the "Reservation for [venue]" reference screens -- kept distinct from the teal
  // hero band used by the search-home/beach-detail/manage-booking screens, per the reference.
  plainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  plainHeaderBackBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  plainHeaderTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  // Matches the padding used by DesktopNav/SearchHomeScreen's hero+search bar (spacing.xxl)
  // instead of the phone header's tighter spacing.lg, so this row lines up with that same
  // nav's edges rather than sitting noticeably narrower underneath it.
  stepTitleRowWide: { paddingHorizontal: spacing.xxl },
  desktopWizardTitleRow: { paddingHorizontal: spacing.xxl, paddingTop: spacing.lg },
  desktopWizardTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  backLink: { flexDirection: 'row', alignItems: 'center' },
  backLinkText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  headerStepTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  headerDateText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },

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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  // Bordered "Seleziona date" pill matching the reference's own date-select control -- an
  // outlined chip rather than a filled button, since this screen's only other action (the
  // floating expand button, see expandFab) is the filled one.
  dateSelectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginTop: spacing.sm,
  },
  dateSelectPillText: { color: colors.primaryDark, fontWeight: '700', fontSize: 13 },

  // One bar per side (Nord/Sud), shown once above the first row of each price tier -- mirrors
  // a seat map's "STANDARD - FROM X" section banner, sized to actually be legible (the old
  // version squeezed this into the narrow row-label column and truncated). `left`/`right` (or
  // `width`) are set per-instance by the caller to match that side's own on-screen bounds.
  priceBanner: {
    position: 'absolute',
    top: 4,
    bottom: 8,
    marginHorizontal: spacing.sm,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    justifyContent: 'center',
    // Left-aligned (alignItems is the horizontal axis here, since this View's default
    // flexDirection is 'column'), not centered: a side is ~500px of umbrellas but only a
    // ~330px slice of it is ever on screen at once on a phone, so a label centered in the
    // *whole* side often landed just past whatever slice the guest had scrolled to. Anchoring
    // at the very start of each side's bar means it's visible the instant that side scrolls
    // into view at all.
    alignItems: 'flex-start',
  },
  priceBannerText: { color: colors.white, fontWeight: '800', fontSize: 12, letterSpacing: 0.3, paddingHorizontal: spacing.sm },
  // flex: 1 bounds the whole map step to the space left below the header/progress-bar (see the
  // comment on MapStep's root View), so its own flex:1 child below (mapCanvasWrap) has a real,
  // definite height to fill instead of expanding to its full natural content size.
  mapStepOuter: { flex: 1 },
  // Wraps BeachCanvas so the expand/fullscreen toggle can float over its top-right corner,
  // matching the reference's floating map-expand icon (instead of a "Vista completa" pill
  // competing for space in the header row above). flex: 1 fills whatever's left between the
  // date pill above and the footer below, so BeachCanvas's own flex:1 (and its dragToPan
  // panning) resolves against a real bounded box instead of rendering at full content height.
  mapCanvasWrap: { position: 'relative', flex: 1 },
  expandFab: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 5,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,20,0.55)',
  },
  // "Selected spot" summary row (ticket/people/calendar icons + price), matching the
  // reference's pre-confirm recap -- shown above the Confirm button rather than a single
  // label, since it's the guest's last check before locking the spot for 5 minutes.
  selectedSpotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.md,
  },
  selectedSpotItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectedSpotText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  selectedSpotPrice: { color: colors.text, fontWeight: '800', fontSize: 14, marginLeft: 'auto' },
  cell: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellNumber: { fontWeight: '800', fontSize: 16, color: colors.white },
  pendingCheckBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  },
  footerContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
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
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  equipmentCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  equipmentThumb: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.liberoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipmentTitle: { fontWeight: '700', color: colors.text, fontSize: 13 },
  equipmentSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  equipmentPrice: { fontWeight: '800', color: colors.primary, fontSize: 14 },
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
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  extraRowSelected: { borderColor: colors.primary, backgroundColor: colors.liberoBg },
  extraRowText: { color: colors.textMuted, fontWeight: '600', fontSize: 13, flexShrink: 1 },
  extraRowTextSelected: { color: colors.primaryDark },
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
  holdBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.in_arrivoBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  holdBannerTextBox: { flex: 1 },
  holdBannerTitle: { fontWeight: '700', color: colors.text, fontSize: 13 },
  holdBannerSubtitle: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  holdBannerTime: { fontWeight: '800', color: colors.in_arrivo, fontSize: 20, fontVariant: ['tabular-nums'] },
  costCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  costRowLabel: { color: colors.text, fontSize: 13 },
  costRowValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  costRowDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  costRowTotalLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  costRowTotalValue: { color: colors.primaryDark, fontSize: 15, fontWeight: '800' },
  disabledHintText: { color: colors.occupato, fontSize: 12, fontWeight: '600', marginTop: spacing.xs },
  footerSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerSummaryLabel: { color: colors.textMuted, fontWeight: '600', fontSize: 12 },
  footerSummaryValue: { color: colors.text, fontWeight: '800', fontSize: 18, marginTop: 2 },
  // Same edge-to-edge, square-cornered shape/size as the map step's mapFooterRow/mapFooterLabel/
  // mapFooterCta -- one consistent footer button across every step of the wizard.
  footerActionRow: { flexDirection: 'row' },
  footerBackBtn: {
    flex: 1,
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  footerBackText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  footerCta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
  },
  footerCtaDisabled: { backgroundColor: colors.border },
  footerCtaText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  confirmSheetOuter: {
    maxHeight: '88%',
    width: '100%',
  },
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

  // Booking.com-style package table (see BookingForm's "Disponibilità" section) -- a compact,
  // single-band version of the same table style used pre-booking on SearchHomeScreen's detail
  // page, since here there's only ever one relevant band (the umbrella already chosen).
  packageTable: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  packageHeaderRow: { flexDirection: 'row', backgroundColor: colors.primaryDark, padding: spacing.sm },
  packageHeaderCell: { color: colors.white, fontSize: 11, fontWeight: '700' },
  packageRow: {
    flexDirection: 'row',
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  packageRowFirst: { borderTopWidth: 0 },
  packageBandLabel: { fontSize: 13, fontWeight: '800', color: colors.text },
  packageBandSub: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  packagePackageLabel: { fontSize: 12, color: colors.text, fontWeight: '600', marginTop: 2 },
  packagePrice: { fontSize: 14, fontWeight: '800', color: colors.text },
  packagePriceHint: { fontSize: 10, color: colors.textMuted },
  packageChoiceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  packageChoiceText: { fontSize: 11, color: colors.textMuted, flexShrink: 1 },
  packageSelectBtn: { alignItems: 'center', justifyContent: 'center' },
});
