import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card, Chip } from '../../components/UI';
import { useAppMode } from '../../store/AppModeContext';
import { useStore } from '../../store/StoreContext';
import { colors, radius, spacing } from '../../theme';
import { Booking, Customer, Umbrella, UmbrellaStatus } from '../../types';
import { findCustomerConflict, findUmbrellaConflict, buildDayBookingLookup } from '../../utils/booking';
import { formatCurrency, formatDateLong, formatDateShort, isoDate } from '../../utils/format';

const normalizePhone = (phone: string) => phone.replace(/\s+/g, '');

export const CustomerBookingScreen: React.FC = () => {
  const { setMode } = useAppMode();
  const { umbrellas, bookings } = useStore();
  const [dateOffset, setDateOffset] = useState(0);
  const [selectedUmbrellaId, setSelectedUmbrellaId] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [myBookingsVisible, setMyBookingsVisible] = useState(false);

  const dateIso = isoDate(dateOffset);
  const dayLookup = useMemo(() => buildDayBookingLookup(bookings), [bookings]);

  const statusFor = (u: Umbrella): UmbrellaStatus => dayLookup.get(`${u.id}|${dateIso}`)?.status ?? 'libero';

  const freeCount = umbrellas.filter((u) => statusFor(u) === 'libero').length;

  const handleTap = (u: Umbrella) => {
    if (statusFor(u) === 'libero') {
      setSelectedUmbrellaId(u.id);
    } else {
      Alert.alert('Non disponibile', `L'ombrellone N.${u.number} non è disponibile per questa data.`);
    }
  };

  const renderCell = ({ item }: { item: Umbrella }) => {
    const status = statusFor(item);
    return (
      <Pressable
        onPress={() => handleTap(item)}
        style={[styles.cell, { backgroundColor: status === 'libero' ? colors.libero : colors.textMuted }]}
      >
        <Text style={styles.cellNumber}>{item.number}</Text>
        <Text style={styles.cellZone}>{item.zone.replace('Fila ', 'F.')}</Text>
      </Pressable>
    );
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
        <Text style={styles.headerSubtitle}>Bagno Pietrasanta · scegli data e posto</Text>
      </View>

      <View style={styles.dateRow}>
        <Chip label="Oggi" selected={dateOffset === 0} onPress={() => setDateOffset(0)} />
        <Chip label="Domani" selected={dateOffset === 1} onPress={() => setDateOffset(1)} />
        <Chip label="Dopodomani" selected={dateOffset === 2} onPress={() => setDateOffset(2)} />
        <Pressable onPress={() => setDateOffset((v) => v + 1)} style={styles.stepBtn}>
          <Ionicons name="add" size={16} color={colors.primary} />
        </Pressable>
      </View>
      <Text style={styles.dateLabel}>{formatDateLong(dateIso)}</Text>

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

      <View style={styles.beach}>
        <FlatList
          data={umbrellas}
          keyExtractor={(u) => u.id}
          numColumns={5}
          contentContainerStyle={{ padding: spacing.lg }}
          renderItem={renderCell}
        />
        <View style={styles.footerBar}>
          <Text style={styles.footerText}>{freeCount} ombrelloni liberi per il {formatDateShort(dateIso)}</Text>
        </View>
      </View>

      {selectedUmbrellaId && (
        <CustomerBookingSheet
          umbrellaId={selectedUmbrellaId}
          dateOffset={dateOffset}
          onClose={() => setSelectedUmbrellaId(null)}
          onConfirmed={(booking) => {
            setSelectedUmbrellaId(null);
            setConfirmedBooking(booking);
          }}
        />
      )}

      <ConfirmationModal
        booking={confirmedBooking}
        onClose={() => setConfirmedBooking(null)}
        onSeeMyBookings={() => {
          setConfirmedBooking(null);
          setMyBookingsVisible(true);
        }}
      />

      <MyBookingsModal visible={myBookingsVisible} onClose={() => setMyBookingsVisible(false)} />
    </SafeAreaView>
  );
};

const CustomerBookingSheet: React.FC<{
  umbrellaId: string;
  dateOffset: number;
  onClose: () => void;
  onConfirmed: (booking: Booking) => void;
}> = ({ umbrellaId, dateOffset, onClose, onConfirmed }) => {
  const { getUmbrella, customers, bookings, createBooking, upsertCustomer, getActivePriceList } = useStore();
  const [phone, setPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [nights, setNights] = useState(1);

  const umbrella = getUmbrella(umbrellaId);
  const priceList = getActivePriceList();
  const dailyRate = priceList.prices['art-ombrellone'] ?? 18;
  const dateFrom = isoDate(dateOffset);
  const dateTo = isoDate(dateOffset + nights);
  const total = dailyRate * nights;
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
          <Text style={styles.muted}>{formatDateLong(dateFrom)}</Text>

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

            <Text style={[styles.label, { marginTop: spacing.lg }]}>Quante notti?</Text>
            <View style={styles.row}>
              <Button title="−" variant="secondary" onPress={() => setNights((v) => Math.max(1, v - 1))} style={styles.qtyBtn} />
              <Text style={styles.qtyText}>{nights} {nights === 1 ? 'giorno' : 'giorni'}</Text>
              <Button title="+" variant="secondary" onPress={() => setNights((v) => v + 1)} style={styles.qtyBtn} />
            </View>
            <Text style={styles.muted}>
              {formatDateShort(dateFrom)} → {formatDateShort(dateTo)} · {formatCurrency(dailyRate)}/giorno
            </Text>

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
  dateRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, flexWrap: 'wrap' },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    textTransform: 'capitalize',
  },
  legendRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.md },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 11, color: colors.textMuted },
  beach: { flex: 1, backgroundColor: colors.sand },
  cell: {
    flex: 1,
    aspectRatio: 1,
    margin: 4,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellNumber: { fontWeight: '800', fontSize: 14, color: colors.white },
  cellZone: { fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 1, fontWeight: '600' },
  footerBar: {
    backgroundColor: colors.seaDark,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  footerText: { color: colors.white, fontWeight: '700', fontSize: 12 },
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
  label: { fontWeight: '700', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    color: colors.text,
  },
  welcomeText: { color: colors.libero, fontWeight: '700', fontSize: 13, marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  qtyBtn: { width: 36, height: 36, paddingVertical: 0, paddingHorizontal: 0 },
  qtyText: { marginHorizontal: spacing.md, fontWeight: '700', color: colors.text },
  conflictBox: { backgroundColor: colors.occupatoBg, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
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
