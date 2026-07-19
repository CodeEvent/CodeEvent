import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QuickBookingForm } from '../components/QuickBookingForm';
import { Button } from '../components/UI';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing, statusBg, statusColor } from '../theme';
import { Booking } from '../types';
import { formatCurrency, formatDateShort, isoDate } from '../utils/format';

const LABEL_WIDTH = 96;
const DAY_WIDTH = 42;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 40;
const WINDOW_SIZE = 21;

export const QuadroScreen: React.FC = () => {
  const { umbrellas, bookings, getUmbrella } = useStore();
  const navigation = useNavigation<any>();
  const [windowStart, setWindowStart] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [newBookingSlot, setNewBookingSlot] = useState<{ umbrellaId: string; offset: number } | null>(
    null
  );

  const days = useMemo(
    () => Array.from({ length: WINDOW_SIZE }, (_, i) => isoDate(windowStart + i)),
    [windowStart]
  );

  const bookingLookup = useMemo(() => {
    const map = new Map<string, Booking>();
    bookings.forEach((b) => {
      const cursor = new Date(b.dateFrom + 'T00:00:00');
      const end = new Date(b.dateTo + 'T00:00:00');
      while (cursor <= end) {
        map.set(`${b.umbrellaId}|${cursor.toISOString().slice(0, 10)}`, b);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [bookings]);

  const closeModals = () => {
    setSelectedBooking(null);
    setNewBookingSlot(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Il Quadro</Text>
        <Text style={styles.headerSubtitle}>Planning stagionale · tocca una cella libera per prenotare</Text>
      </View>

      <View style={styles.navRow}>
        <Button title="← Sett." variant="secondary" onPress={() => setWindowStart((w) => w - 7)} style={styles.navBtn} />
        <Button title="Oggi" variant="ghost" onPress={() => setWindowStart(0)} style={styles.navBtn} />
        <Button title="Sett. →" variant="secondary" onPress={() => setWindowStart((w) => w + 7)} style={styles.navBtn} />
        <Text style={styles.rangeText}>
          {formatDateShort(days[0])} – {formatDateShort(days[days.length - 1])}
        </Text>
      </View>

      <ScrollView>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: LABEL_WIDTH }}>
            <View style={{ height: HEADER_HEIGHT }} />
            {umbrellas.map((u) => (
              <View key={u.id} style={[styles.labelCell, { height: ROW_HEIGHT }]}>
                <Text style={styles.labelText} numberOfLines={1}>
                  {u.number} · {u.zone.replace('Fila ', 'F.')}
                </Text>
              </View>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={{ flexDirection: 'row', height: HEADER_HEIGHT }}>
                {days.map((d) => (
                  <View key={d} style={[styles.dayHeaderCell, { width: DAY_WIDTH }]}>
                    <Text style={styles.dayHeaderText}>{formatDateShort(d)}</Text>
                  </View>
                ))}
              </View>
              {umbrellas.map((u) => (
                <View key={u.id} style={{ flexDirection: 'row', height: ROW_HEIGHT }}>
                  {days.map((d, dIdx) => {
                    const booking = bookingLookup.get(`${u.id}|${d}`);
                    return (
                      <Pressable
                        key={d}
                        style={[
                          styles.dayCell,
                          {
                            width: DAY_WIDTH,
                            backgroundColor: booking ? statusBg[booking.status] : colors.card,
                            borderColor: booking ? statusColor[booking.status] : colors.border,
                          },
                        ]}
                        onPress={() =>
                          booking
                            ? setSelectedBooking(booking)
                            : setNewBookingSlot({ umbrellaId: u.id, offset: windowStart + dIdx })
                        }
                      >
                        {booking && d === booking.dateFrom && (
                          <View style={[styles.bookingDot, { backgroundColor: statusColor[booking.status] }]} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Booking info modal */}
      <Modal visible={!!selectedBooking} transparent animationType="fade" onRequestClose={closeModals}>
        <Pressable style={styles.backdrop} onPress={closeModals}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            {selectedBooking && (
              <BookingInfo
                booking={selectedBooking}
                onClose={closeModals}
                onGoToConto={() => {
                  closeModals();
                  navigation.navigate('Conto', { umbrellaId: selectedBooking.umbrellaId });
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* New booking modal */}
      <Modal visible={!!newBookingSlot} transparent animationType="slide" onRequestClose={closeModals}>
        <Pressable style={styles.backdrop} onPress={closeModals}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              Nuova prenotazione ·{' '}
              {newBookingSlot && `Ombrellone ${getUmbrella(newBookingSlot.umbrellaId)?.number}`}
            </Text>
            {newBookingSlot && (
              <QuickBookingForm
                umbrellaId={newBookingSlot.umbrellaId}
                initialFromOffset={newBookingSlot.offset}
                onDone={closeModals}
              />
            )}
            <Button title="Annulla" variant="ghost" onPress={closeModals} style={{ marginTop: spacing.sm }} />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const BookingInfo: React.FC<{ booking: Booking; onClose: () => void; onGoToConto: () => void }> = ({
  booking,
  onClose,
  onGoToConto,
}) => {
  const { getCustomer, getUmbrella } = useStore();
  const customer = getCustomer(booking.customerId);
  const umbrella = getUmbrella(booking.umbrellaId);
  return (
    <View>
      <Text style={styles.modalTitle}>
        Ombrellone {umbrella?.number} · {customer?.name ?? 'Cliente'}
      </Text>
      <Text style={styles.muted}>
        {formatDateShort(booking.dateFrom)} → {formatDateShort(booking.dateTo)}
      </Text>
      <Text style={styles.muted}>Totale: {formatCurrency(booking.totalPrice)}</Text>
      <Text style={styles.muted}>Acconto/Pagato: {formatCurrency(booking.paid)}</Text>
      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <Button title="Vai al Conto" onPress={onGoToConto} />
        <Button title="Chiudi" variant="ghost" onPress={onClose} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  navBtn: { paddingHorizontal: spacing.md, paddingVertical: 8 },
  rangeText: { marginLeft: spacing.sm, color: colors.textMuted, fontWeight: '600', fontSize: 12 },
  labelCell: { justifyContent: 'center', paddingLeft: spacing.lg },
  labelText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  dayHeaderCell: { alignItems: 'center', justifyContent: 'center' },
  dayHeaderText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  dayCell: {
    margin: 1,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingDot: { width: 5, height: 5, borderRadius: 3 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 13, marginBottom: 2 },
});
