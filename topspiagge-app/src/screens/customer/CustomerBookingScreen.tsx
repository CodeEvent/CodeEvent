import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BeachCanvas, CELL, useUmbrellaPositions } from '../../components/BeachCanvas';
import { Badge, Button, Card, Chip } from '../../components/UI';
import { useAppMode } from '../../store/AppModeContext';
import { useStore } from '../../store/StoreContext';
import { colors, radius, spacing } from '../../theme';
import { Booking, Customer, Umbrella } from '../../types';
import { findCustomerConflict, findUmbrellaConflict } from '../../utils/booking';
import { formatCurrency, formatDateLong, formatDateShort, isoDate } from '../../utils/format';

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
  const positions = useUmbrellaPositions(umbrellas);

  const [step, setStep] = useState<Step>('dates');
  const [startOffset, setStartOffset] = useState(0);
  const [days, setDays] = useState(1);
  const [selectedUmbrellaId, setSelectedUmbrellaId] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [myBookingsVisible, setMyBookingsVisible] = useState(false);

  const dateFrom = isoDate(startOffset);
  const dateTo = isoDate(startOffset + days - 1);

  const isFreeForPeriod = (u: Umbrella) => !findUmbrellaConflict(bookings, u.id, dateFrom, dateTo);
  const freeCount = umbrellas.filter(isFreeForPeriod).length;

  const handleTap = (u: Umbrella) => {
    if (isFreeForPeriod(u)) {
      setSelectedUmbrellaId(u.id);
    } else {
      Alert.alert('Non disponibile', `L'ombrellone N.${u.number} non è disponibile per il periodo scelto.`);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => setMode('select')} style={styles.backLink}>
          <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
          <Text style={styles.backLinkText}>Cambia modalità</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Prenota il tuo ombrellone</Text>
          <Pressable onPress={() => setMyBookingsVisible(true)} style={styles.myBookingsBtn}>
            <Ionicons name="person-circle-outline" size={16} color={colors.white} />
            <Text style={styles.myBookingsText}>Le mie prenotazioni</Text>
          </Pressable>
        </View>
        <Text style={styles.headerSubtitle}>Bagno Pietrasanta</Text>
      </View>

      {step === 'dates' ? (
        <DateStep
          startOffset={startOffset}
          setStartOffset={setStartOffset}
          days={days}
          setDays={setDays}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onContinue={() => setStep('map')}
        />
      ) : (
        <MapStep
          umbrellas={umbrellas}
          positions={positions}
          dateFrom={dateFrom}
          dateTo={dateTo}
          freeCount={freeCount}
          isFreeForPeriod={isFreeForPeriod}
          onTap={handleTap}
          onChangeDates={() => setStep('dates')}
        />
      )}

      {selectedUmbrellaId && (
        <CustomerBookingSheet
          umbrellaId={selectedUmbrellaId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onClose={() => setSelectedUmbrellaId(null)}
          onConfirmed={(booking) => {
            setSelectedUmbrellaId(null);
            setConfirmedBooking(booking);
          }}
        />
      )}

      <ConfirmationModal
        booking={confirmedBooking}
        onClose={() => {
          setConfirmedBooking(null);
          setStep('dates');
        }}
        onSeeMyBookings={() => {
          setConfirmedBooking(null);
          setMyBookingsVisible(true);
        }}
      />

      <MyBookingsModal visible={myBookingsVisible} onClose={() => setMyBookingsVisible(false)} />
    </SafeAreaView>
  );
};

const DateStep: React.FC<{
  startOffset: number;
  setStartOffset: (updater: (v: number) => number) => void;
  days: number;
  setDays: (updater: (v: number) => number) => void;
  dateFrom: string;
  dateTo: string;
  onContinue: () => void;
}> = ({ startOffset, setStartOffset, days, setDays, dateFrom, dateTo, onContinue }) => (
  <ScrollView contentContainerStyle={styles.dateStepBody}>
    <Text style={styles.stepTitle}>Quando vuoi venire?</Text>
    <Text style={styles.stepSubtitle}>Scegli l'arrivo e la durata del soggiorno</Text>

    <Text style={styles.label}>Arrivo</Text>
    <View style={styles.row}>
      <Chip label="Oggi" selected={startOffset === 0} onPress={() => setStartOffset(() => 0)} />
      <Chip label="Domani" selected={startOffset === 1} onPress={() => setStartOffset(() => 1)} />
      <Chip label="Dopodomani" selected={startOffset === 2} onPress={() => setStartOffset(() => 2)} />
      <Pressable onPress={() => setStartOffset((v) => v + 1)} style={styles.stepBtn}>
        <Ionicons name="add" size={16} color={colors.primary} />
      </Pressable>
    </View>

    <Text style={[styles.label, { marginTop: spacing.lg }]}>Durata</Text>
    <View style={styles.row}>
      {PERIOD_PRESETS.map((p) => (
        <Chip key={p.days} label={p.label} selected={days === p.days} onPress={() => setDays(() => p.days)} />
      ))}
    </View>

    <View style={styles.periodBox}>
      <View style={styles.periodRow}>
        <Text style={styles.periodLabel}>Dal</Text>
        <Text style={styles.periodDate}>{formatDateLong(dateFrom)}</Text>
      </View>
      <View style={styles.periodRow}>
        <Text style={styles.periodLabel}>Al</Text>
        <View style={styles.periodDateAdjust}>
          <Pressable onPress={() => setDays((v) => Math.max(1, v - 1))} style={styles.periodNudgeBtn}>
            <Ionicons name="remove" size={14} color={colors.primary} />
          </Pressable>
          <Text style={styles.periodDate}>{formatDateLong(dateTo)}</Text>
          <Pressable onPress={() => setDays((v) => v + 1)} style={styles.periodNudgeBtn}>
            <Ionicons name="add" size={14} color={colors.primary} />
          </Pressable>
        </View>
      </View>
    </View>
    <Text style={styles.muted}>{days} {days === 1 ? 'giorno' : 'giorni'}</Text>

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
  dateFrom: string;
  dateTo: string;
  freeCount: number;
  isFreeForPeriod: (u: Umbrella) => boolean;
  onTap: (u: Umbrella) => void;
  onChangeDates: () => void;
}> = ({ umbrellas, positions, dateFrom, dateTo, freeCount, isFreeForPeriod, onTap, onChangeDates }) => (
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
    </View>

    <BeachCanvas
      umbrellas={umbrellas}
      positions={positions}
      footerText={`${freeCount} ombrelloni liberi per il periodo scelto`}
      renderCell={(u, position) => {
        const free = isFreeForPeriod(u);
        return (
          <Pressable
            key={u.id}
            onPress={() => onTap(u)}
            style={[
              styles.cell,
              { left: position.x, top: position.y, backgroundColor: free ? colors.libero : colors.textMuted },
            ]}
          >
            <Text style={styles.cellNumber}>{u.number}</Text>
          </Pressable>
        );
      }}
    />
  </>
);

const CustomerBookingSheet: React.FC<{
  umbrellaId: string;
  dateFrom: string;
  dateTo: string;
  onClose: () => void;
  onConfirmed: (booking: Booking) => void;
}> = ({ umbrellaId, dateFrom, dateTo, onClose, onConfirmed }) => {
  const { getUmbrella, customers, bookings, createBooking, upsertCustomer, getActivePriceList } = useStore();
  const [phone, setPhone] = useState('');
  const [newName, setNewName] = useState('');

  const umbrella = getUmbrella(umbrellaId);
  const priceList = getActivePriceList();
  const dailyRate = priceList.prices['art-ombrellone'] ?? 18;
  const days = Math.round((new Date(dateTo + 'T00:00:00').getTime() - new Date(dateFrom + 'T00:00:00').getTime()) / 86400000) + 1;
  const total = dailyRate * days;
  const deposit = Math.round(total * 0.3);

  const matchedCustomer = useMemo(() => {
    const p = normalizePhone(phone);
    if (!p) return undefined;
    return customers.find((c) => normalizePhone(c.phone) === p);
  }, [customers, phone]);

  const isNewCustomer = normalizePhone(phone).length >= 6 && !matchedCustomer;

  const conflict = useMemo(
    () => findUmbrellaConflict(bookings, umbrellaId, dateFrom, dateTo),
    [bookings, umbrellaId, dateFrom, dateTo]
  );
  const customerConflict = useMemo(() => {
    if (!matchedCustomer) return undefined;
    return findCustomerConflict(bookings, matchedCustomer.id, umbrellaId, dateFrom, dateTo);
  }, [bookings, matchedCustomer, umbrellaId, dateFrom, dateTo]);
  const customerConflictUmbrella = getUmbrella(customerConflict?.umbrellaId ?? '');

  const canConfirm =
    (!!matchedCustomer || (isNewCustomer && newName.trim().length > 0)) && !conflict && !customerConflict;

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
    const booking: Booking = {
      id: `bk-${umbrellaId}-${Date.now()}`,
      umbrellaId,
      customerId,
      dateFrom,
      dateTo,
      totalPrice: total,
      deposit,
      paid: deposit,
      status: 'prenotato',
      createdAt: isoDate(0),
    };
    createBooking(booking);
    onConfirmed(booking);
  };

  if (!umbrella) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>
            Ombrellone {umbrella.number} · {umbrella.zone}
          </Text>
          <Text style={styles.muted}>
            {formatDateLong(dateFrom)} → {formatDateLong(dateTo)} · {days} {days === 1 ? 'giorno' : 'giorni'}
          </Text>

          <ScrollView style={{ maxHeight: 420 }}>
            <Text style={styles.label}>Il tuo numero di telefono</Text>
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
                <Text style={styles.label}>Nome e cognome</Text>
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
                  Questo ombrellone non è più disponibile per queste date.
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

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Totale</Text>
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
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const ConfirmationModal: React.FC<{
  booking: Booking | null;
  onClose: () => void;
  onSeeMyBookings: () => void;
}> = ({ booking, onClose, onSeeMyBookings }) => {
  const { getUmbrella, getCustomer } = useStore();
  if (!booking) return null;
  const umbrella = getUmbrella(booking.umbrellaId);
  const customer = getCustomer(booking.customerId);

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
              <Text style={styles.muted}>Ombrellone</Text>
              <Text style={styles.confirmValue}>N.{umbrella?.number} · {umbrella?.zone}</Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.muted}>Periodo</Text>
              <Text style={styles.confirmValue}>
                {formatDateShort(booking.dateFrom)} → {formatDateShort(booking.dateTo)}
              </Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.muted}>Totale</Text>
              <Text style={styles.confirmValue}>{formatCurrency(booking.totalPrice)}</Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.muted}>Acconto pagato</Text>
              <Text style={[styles.confirmValue, { color: colors.libero }]}>{formatCurrency(booking.paid)}</Text>
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
  const { customers, bookings, getUmbrella } = useStore();
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
                return (
                  <Card key={b.id} style={{ marginTop: spacing.sm }}>
                    <View style={styles.confirmRow}>
                      <Text style={styles.confirmValue}>Ombrellone N.{u?.number}</Text>
                      <Badge status={b.status} />
                    </View>
                    <Text style={styles.muted}>
                      {formatDateShort(b.dateFrom)} → {formatDateShort(b.dateTo)} · {formatCurrency(b.totalPrice)}
                    </Text>
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
  backLink: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  backLinkText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text, flexShrink: 1 },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  myBookingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: 4,
  },
  myBookingsText: { color: colors.white, fontSize: 11, fontWeight: '700' },

  dateStepBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  stepTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: spacing.md },
  stepSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.lg },

  label: { fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, flexWrap: 'wrap' },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  periodBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  periodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  periodLabel: { color: colors.textMuted, fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
  periodDate: { color: colors.text, fontWeight: '700', fontSize: 14, textTransform: 'capitalize' },
  periodDateAdjust: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  periodNudgeBtn: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },

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

  legendRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.md },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 11, color: colors.textMuted },
  cell: {
    position: 'absolute',
    width: CELL,
    height: CELL,
    borderRadius: CELL / 2,
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

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '88%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
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
