import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QuickBookingForm } from '../components/QuickBookingForm';
import { Chip, Button } from '../components/UI';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { BeachSide, Booking } from '../types';
import { displayStatusColor, displayStatusForBooking } from '../utils/displayStatus';
import { formatCurrency, formatDateShort, isoDate } from '../utils/format';

const LABEL_WIDTH = 96;
const DAY_WIDTH = 42;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 22;
const MONTH_HEADER_HEIGHT = 20;
const WINDOW_SIZE = 21;

const MONTH_NAMES = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

function dayIndexInWindow(dateIso: string, windowStartIso: string): number {
  const a = new Date(windowStartIso + 'T00:00:00').getTime();
  const b = new Date(dateIso + 'T00:00:00').getTime();
  return Math.round((b - a) / 86400000);
}

export const QuadroScreen: React.FC = () => {
  const { umbrellas, bookings, getUmbrella, getCustomer } = useStore();
  const navigation = useNavigation<any>();
  const [windowStart, setWindowStart] = useState(0);
  const [sideFilter, setSideFilter] = useState<BeachSide | 'tutti'>('nord');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [newBookingSlot, setNewBookingSlot] = useState<{ umbrellaId: string; offset: number } | null>(
    null
  );

  const visibleUmbrellas = useMemo(
    () => (sideFilter === 'tutti' ? umbrellas : umbrellas.filter((u) => u.side === sideFilter)),
    [umbrellas, sideFilter]
  );

  const days = useMemo(
    () => Array.from({ length: WINDOW_SIZE }, (_, i) => isoDate(windowStart + i)),
    [windowStart]
  );
  const windowStartIso = days[0];
  const windowEndIso = days[days.length - 1];

  const monthGroups = useMemo(() => {
    const groups: { label: string; startCol: number; span: number }[] = [];
    days.forEach((d, i) => {
      const monthIdx = parseInt(d.slice(5, 7), 10) - 1;
      const label = MONTH_NAMES[monthIdx];
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.span += 1;
      } else {
        groups.push({ label, startCol: i, span: 1 });
      }
    });
    return groups;
  }, [days]);

  const bookingsByUmbrella = useMemo(() => {
    const map = new Map<string, Booking[]>();
    bookings.forEach((b) => {
      if (b.dateTo < windowStartIso || b.dateFrom > windowEndIso) return;
      const list = map.get(b.umbrellaId) ?? [];
      list.push(b);
      map.set(b.umbrellaId, list);
    });
    return map;
  }, [bookings, windowStartIso, windowEndIso]);

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
          {formatDateShort(windowStartIso)} – {formatDateShort(windowEndIso)}
        </Text>
      </View>

      <View style={[styles.filterRow]}>
        {(['nord', 'sud', 'tutti'] as const).map((s) => (
          <Chip
            key={s}
            label={s === 'tutti' ? 'Tutti i lati' : s === 'nord' ? 'Lato Nord' : 'Lato Sud'}
            selected={sideFilter === s}
            onPress={() => setSideFilter(s)}
          />
        ))}
      </View>

      <ScrollView>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: LABEL_WIDTH }}>
            <View style={{ height: MONTH_HEADER_HEIGHT + HEADER_HEIGHT }} />
            {visibleUmbrellas.map((u) => (
              <View key={u.id} style={[styles.labelCell, { height: ROW_HEIGHT }]}>
                <Text style={styles.labelText} numberOfLines={1}>
                  {u.number} · {u.side === 'nord' ? 'N' : 'S'}{u.row + 1}
                </Text>
              </View>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={{ flexDirection: 'row', height: MONTH_HEADER_HEIGHT }}>
                {monthGroups.map((g) => (
                  <View key={g.startCol} style={[styles.monthCell, { width: g.span * DAY_WIDTH }]}>
                    <Text style={styles.monthText}>{g.label}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', height: HEADER_HEIGHT }}>
                {days.map((d) => (
                  <View key={d} style={[styles.dayHeaderCell, { width: DAY_WIDTH }]}>
                    <Text style={styles.dayHeaderText}>{d.slice(8, 10)}</Text>
                  </View>
                ))}
              </View>
              {visibleUmbrellas.map((u) => {
                const rowBookings = bookingsByUmbrella.get(u.id) ?? [];
                return (
                  <View key={u.id} style={{ height: ROW_HEIGHT, width: WINDOW_SIZE * DAY_WIDTH }}>
                    <View style={styles.dayGridRow}>
                      {days.map((d, dIdx) => (
                        <Pressable
                          key={d}
                          style={[styles.dayCell, { width: DAY_WIDTH }]}
                          onPress={() => setNewBookingSlot({ umbrellaId: u.id, offset: windowStart + dIdx })}
                        />
                      ))}
                    </View>
                    {rowBookings.map((b) => {
                      const startIdx = Math.max(0, dayIndexInWindow(b.dateFrom, windowStartIso));
                      const endIdx = Math.min(WINDOW_SIZE - 1, dayIndexInWindow(b.dateTo, windowStartIso));
                      if (endIdx < startIdx) return null;
                      const left = startIdx * DAY_WIDTH + 1;
                      const width = (endIdx - startIdx + 1) * DAY_WIDTH - 2;
                      return (
                        <Pressable
                          key={b.id}
                          style={[
                            styles.bar,
                            { left, width, backgroundColor: displayStatusColor[displayStatusForBooking(b, true)] },
                          ]}
                          onPress={() => setSelectedBooking(b)}
                        >
                          <Text style={styles.barText} numberOfLines={1}>
                            {getCustomer(b.customerId)?.name.split(' ')[0] ?? 'Cliente'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
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
              {newBookingSlot &&
                `Ombrellone ${getUmbrella(newBookingSlot.umbrellaId)?.number} · ${getUmbrella(newBookingSlot.umbrellaId)?.zone}`}
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
        Ombrellone {umbrella?.number} ({umbrella?.zone}) · {customer?.name ?? 'Cliente'}
      </Text>
      {!!customer?.phone && <Text style={styles.muted}>{customer.phone}</Text>}
      <Text style={styles.muted}>
        {formatDateShort(booking.dateFrom)} → {formatDateShort(booking.dateTo)}
      </Text>
      {booking.guests && (
        <Text style={styles.muted}>
          {booking.guests.adults} adulti
          {booking.guests.children5to15 > 0 ? ` · ${booking.guests.children5to15} bambini 5-15` : ''}
          {booking.guests.childrenUnder5 > 0 ? ` · ${booking.guests.childrenUnder5} under 5` : ''}
        </Text>
      )}
      {(booking.beds || booking.chairs) && (
        <Text style={styles.muted}>
          {booking.beds ?? 0} lettini · {booking.chairs ?? 0} sdraio
        </Text>
      )}
      {!!booking.reference && <Text style={styles.muted}>Codice: {booking.reference}</Text>}
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
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
  monthCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthText: { fontSize: 10, fontWeight: '800', color: colors.primaryDark, textTransform: 'uppercase' },
  dayHeaderCell: { alignItems: 'center', justifyContent: 'center' },
  dayHeaderText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  dayGridRow: { flexDirection: 'row', position: 'absolute', top: 0, left: 0, height: ROW_HEIGHT },
  dayCell: {
    height: ROW_HEIGHT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  bar: {
    position: 'absolute',
    top: 3,
    height: ROW_HEIGHT - 6,
    borderRadius: radius.sm,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  barText: { color: colors.white, fontWeight: '700', fontSize: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 13, marginBottom: 2 },
});
