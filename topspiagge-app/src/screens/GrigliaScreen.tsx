import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLS_PER_SIDE } from '../components/BeachCanvas';
import { FilterSheetModal } from '../components/BookingFilterBar';
import { UmbrellaDetailModal } from '../components/UmbrellaDetailModal';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { Umbrella } from '../types';
import { DEFAULT_BOOKING_FILTERS, umbrellaMatchesFilters } from '../utils/bookingFilters';
import {
  baseDisplayStatusFor,
  DisplayStatus,
  displayStatusColor,
  displayStatusFor,
  hasOutstandingBalance,
} from '../utils/displayStatus';
import { isoDate } from '../utils/format';

function captionFor(
  status: DisplayStatus,
  umbrella: Umbrella,
  getBooking: (id?: string) => import('../types').Booking | undefined,
  getCustomer: (id?: string) => import('../types').Customer | undefined
): string | undefined {
  if (status === 'libero') return undefined;
  const booking = getBooking(umbrella.currentBookingId);
  if (!booking) return undefined;
  const customer = getCustomer(booking.customerId);
  const surname = customer?.name.trim().split(/\s+/).slice(-1)[0] ?? '';
  const equipment = booking.beds || booking.chairs ? `${booking.beds ?? 0}L ${booking.chairs ?? 0}S` : '';
  return [surname, equipment].filter(Boolean).join(' · ');
}

export const GrigliaScreen: React.FC = () => {
  const { umbrellas, getBooking, getCustomer } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_BOOKING_FILTERS);
  const today = isoDate(0);

  const filtered = useMemo(
    () => umbrellas.filter((u) => umbrellaMatchesFilters(u, filters, getBooking, getCustomer, today)),
    [umbrellas, filters, getBooking, getCustomer, today]
  );

  // Every row is a fixed line of umbrellas (10 per side, 20 when both sides are shown) --
  // grouping by row here is what actually reproduces that layout, instead of letting a
  // flat grid wrap the filtered list at an arbitrary column count.
  const rowGroups = useMemo(() => {
    const map = new Map<number, Umbrella[]>();
    filtered.forEach((u) => {
      const list = map.get(u.row) ?? [];
      list.push(u);
      map.set(u.row, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([row, list]) => [row, list.slice().sort((a, b) => a.col - b.col)] as const);
  }, [filtered]);

  const counts = useMemo(() => {
    const c: Record<DisplayStatus, number> = { libero: 0, occupato: 0, da_saldare: 0, sgombera: 0, stagionale: 0 };
    umbrellas.forEach((u) => (c[displayStatusFor(u, getBooking)] += 1));
    return c;
  }, [umbrellas, getBooking]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Griglia Ombrelloni</Text>
            <Text style={styles.headerSubtitle}>
              {counts.libero} liberi · {counts.occupato} occupati · {counts.da_saldare} da saldare ·{' '}
              {counts.sgombera} da sgomberare · {counts.stagionale} stagionali
            </Text>
          </View>
          <Pressable onPress={() => setFiltersOpen((v) => !v)} style={styles.filterToggle}>
            <MaterialCommunityIcons name="tune-variant" size={14} color={colors.primaryDark} />
            <Text style={styles.filterToggleText}>Filtri</Text>
          </Pressable>
        </View>
      </View>

      <FilterSheetModal
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={setFilters}
      />

      <View style={styles.beach}>
        <ScrollView contentContainerStyle={styles.scrollBody}>
          {rowGroups.map(([row, rowUmbrellas]) => (
            <View key={row} style={styles.rowBlock}>
              <Text style={styles.rowLabel}>{rowUmbrellas[0].zone}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.rowCells}>
                  {rowUmbrellas.map((u) => {
                    const displayStatus = displayStatusFor(u, getBooking);
                    const baseStatus = baseDisplayStatusFor(u, getBooking);
                    const isSgombera = baseStatus === 'sgombera';
                    const isStagionale = baseStatus === 'stagionale';
                    const isSplit = isSgombera || isStagionale;
                    const unpaid = hasOutstandingBalance(u, getBooking);
                    const caption = captionFor(displayStatus, u, getBooking, getCustomer);
                    return (
                      <React.Fragment key={u.id}>
                        {u.col === COLS_PER_SIDE && <View style={styles.walkwayDivider} />}
                        <View style={styles.cellWrap}>
                          <Pressable
                            onPress={() => setSelectedId(u.id)}
                            style={[
                              styles.cell,
                              { backgroundColor: isSplit ? undefined : displayStatusColor[baseStatus], overflow: 'hidden' },
                            ]}
                          >
                            {isSgombera && (
                              <View style={StyleSheet.absoluteFill}>
                                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 28, backgroundColor: colors.occupato }} />
                                <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 28, backgroundColor: colors.sgombera }} />
                              </View>
                            )}
                            {isStagionale && (
                              <View style={StyleSheet.absoluteFill}>
                                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 28, backgroundColor: colors.occupato }} />
                                <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 28, backgroundColor: colors.prenotato }} />
                              </View>
                            )}
                            {baseStatus === 'libero' ? (
                              <>
                                <MaterialCommunityIcons name="umbrella-closed" size={14} color={colors.white} />
                                <Text style={[styles.cellNumber, { fontSize: 12 }]}>{u.number}</Text>
                              </>
                            ) : (
                              <Text style={styles.cellNumber}>{u.number}</Text>
                            )}
                            <Text style={styles.cellSide}>{u.side === 'nord' ? 'N' : 'S'}</Text>
                            {unpaid && <View style={styles.unpaidDot} />}
                          </Pressable>
                          {!!caption && (
                            <Text numberOfLines={1} style={styles.cellCaption}>
                              {caption}
                            </Text>
                          )}
                        </View>
                      </React.Fragment>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ))}
          {rowGroups.length === 0 && <Text style={styles.muted}>Nessun ombrellone corrisponde ai filtri.</Text>}
        </ScrollView>
        <View style={styles.footerBar}>
          <Text style={styles.footerText}>Risorse in vista: {filtered.length}</Text>
        </View>
      </View>

      <UmbrellaDetailModal umbrellaId={selectedId} onClose={() => setSelectedId(null)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.card },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.prenotatoBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  filterToggleText: { color: colors.primaryDark, fontWeight: '700', fontSize: 12 },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
  },
  beach: { flex: 1, backgroundColor: colors.sand, marginTop: spacing.sm },
  scrollBody: { padding: spacing.lg },
  muted: { color: colors.textMuted, fontSize: 13 },
  rowBlock: { marginBottom: spacing.md },
  rowLabel: { fontWeight: '700', color: colors.seaDark, fontSize: 12, marginBottom: 4 },
  rowCells: { flexDirection: 'row', alignItems: 'flex-start' },
  cellWrap: { width: 56, marginRight: spacing.sm },
  cell: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  cellNumber: { fontWeight: '800', fontSize: 15, color: colors.white },
  cellSide: { fontSize: 9, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '600' },
  unpaidDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.black,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  cellCaption: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  walkwayDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.seaDark,
    opacity: 0.4,
    marginRight: spacing.sm,
    alignSelf: 'center',
  },
  footerBar: {
    backgroundColor: colors.seaDark,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  footerText: { color: colors.white, fontWeight: '700', fontSize: 12 },
});
