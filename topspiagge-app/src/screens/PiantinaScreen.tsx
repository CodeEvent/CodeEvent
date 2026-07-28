import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BeachCanvas, GAP, MIN_CELL, useUmbrellaPositions } from '../components/BeachCanvas';
import { countActiveFilters, FilterSheetModal } from '../components/BookingFilterBar';
import { UmbrellaDetailModal } from '../components/UmbrellaDetailModal';
import { useStore } from '../store/StoreContext';
import { colors, spacing } from '../theme';
import { Umbrella } from '../types';
import { ROWS } from '../data/seed';
import {
  DEFAULT_BOOKING_FILTERS,
  effectiveDateRange,
  isUmbrellaFreeForRange,
  umbrellaMatchesFilters,
} from '../utils/bookingFilters';
import {
  BaseDisplayStatus,
  baseDisplayStatusFor,
  displayStatusColor,
  hasOutstandingBalance,
} from '../utils/displayStatus';
import { isoDate } from '../utils/format';

const TAP_THRESHOLD = 10;
const CAPTION_HEIGHT = 16;

const PIANTINA_LEGEND: { key: BaseDisplayStatus; label: string }[] = [
  { key: 'libero', label: 'Libero' },
  { key: 'occupato', label: 'Occupato' },
  { key: 'sgombera', label: 'Sgombera' },
  { key: 'stagionale', label: 'Stagionale' },
];

function captionFor(
  status: BaseDisplayStatus,
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

const UmbrellaCell: React.FC<{
  umbrella: Umbrella;
  position: { x: number; y: number };
  positions: Map<string, { x: number; y: number }>;
  allUmbrellas: Umbrella[];
  cellSize: number;
  status: BaseDisplayStatus;
  unpaid?: boolean;
  caption?: string;
  dimmed?: boolean;
  pending?: boolean;
  onDrop: (fromId: string, toId: string) => void;
  onTap: (id: string) => void;
}> = ({ umbrella, position, positions, allUmbrellas, cellSize, status, unpaid, caption, dimmed, pending, onDrop, onTap }) => {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [dragging, setDragging] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: () => setDragging(true),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        setDragging(false);
        const moved = Math.abs(gesture.dx) > TAP_THRESHOLD || Math.abs(gesture.dy) > TAP_THRESHOLD;
        if (!moved) {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
          onTap(umbrella.id);
          return;
        }
        const dropCenter = {
          x: position.x + cellSize / 2 + gesture.dx,
          y: position.y + cellSize / 2 + gesture.dy,
        };
        let target: Umbrella | undefined;
        for (const u of allUmbrellas) {
          if (u.id === umbrella.id) continue;
          const p = positions.get(u.id);
          if (!p) continue;
          if (
            dropCenter.x >= p.x &&
            dropCenter.x <= p.x + cellSize &&
            dropCenter.y >= p.y &&
            dropCenter.y <= p.y + cellSize
          ) {
            target = u;
            break;
          }
        }
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        if (target) onDrop(umbrella.id, target.id);
      },
    })
  ).current;

  const isSgombera = !pending && status === 'sgombera';
  const isStagionale = !pending && status === 'stagionale';
  const isSplit = isSgombera || isStagionale || pending;

  return (
    <View style={{ position: 'absolute', left: position.x, top: position.y, width: cellSize, opacity: dimmed ? 0.25 : 1 }}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.cell,
          {
            width: cellSize,
            height: cellSize,
            borderRadius: cellSize / 2,
            overflow: 'hidden',
            backgroundColor: isSplit ? undefined : displayStatusColor[status],
            borderColor: colors.card,
            transform: pan.getTranslateTransform(),
            zIndex: dragging ? 10 : 1,
            elevation: dragging ? 8 : 2,
          },
        ]}
      >
        {isSgombera && (
          <View style={StyleSheet.absoluteFill}>
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: cellSize / 2, backgroundColor: colors.occupato }} />
            <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: cellSize / 2, backgroundColor: colors.sgombera }} />
          </View>
        )}
        {(isStagionale || pending) && (
          <View style={StyleSheet.absoluteFill}>
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: cellSize / 2, backgroundColor: colors.occupato }} />
            <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: cellSize / 2, backgroundColor: colors.prenotato }} />
          </View>
        )}
        {status === 'libero' && !pending ? (
          <>
            <MaterialCommunityIcons name="umbrella-closed" size={Math.min(18, Math.max(12, cellSize / 4))} color={colors.white} />
            <Text style={[styles.cellNumber, { fontSize: Math.min(13, Math.max(10, cellSize / 5.5)) }]}>{umbrella.number}</Text>
          </>
        ) : (
          <Text style={[styles.cellNumber, { fontSize: Math.min(17, Math.max(12, cellSize / 4)) }]}>
            {umbrella.number}
          </Text>
        )}
        {umbrella.hasCabin && <View style={styles.cabinDot} />}
        {unpaid && <View style={styles.unpaidDot} />}
      </Animated.View>
      {!!caption && (
        <Text numberOfLines={1} style={styles.caption}>
          {caption}
        </Text>
      )}
    </View>
  );
};

export const PiantinaScreen: React.FC = () => {
  const { umbrellas, bookings, swapUmbrellas, getBooking, getCustomer } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingExtraIds, setPendingExtraIds] = useState<string[]>([]);
  const [filters, setFilters] = useState(DEFAULT_BOOKING_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const route = useRoute<any>();
  const { height } = useWindowDimensions();
  const today = isoDate(0);

  const labelWidth = 60;
  // 20 seats per row (10 Nord + walkway + 10 Sud) rarely fit a screen width without
  // shrinking cells past legibility, so cell size is driven by height only -- the
  // canvas scrolls horizontally to reveal the rest, same as the customer-facing map.
  const mapAreaHeight = height - 240;
  const cellSize = Math.max(MIN_CELL, Math.min(72, Math.floor(mapAreaHeight / (ROWS * 1.2)) - GAP));
  const rowHeight = cellSize + CAPTION_HEIGHT;

  const positions = useUmbrellaPositions(umbrellas, cellSize, GAP, rowHeight);

  useEffect(() => {
    if (route.params?.umbrellaId) setSelectedId(route.params.umbrellaId);
  }, [route.params?.umbrellaId]);

  const freeCounts = useMemo(
    () => ({
      nord: umbrellas.filter((u) => u.side === 'nord' && u.status === 'libero').length,
      sud: umbrellas.filter((u) => u.side === 'sud' && u.status === 'libero').length,
    }),
    [umbrellas]
  );

  // A chosen "Quando" range switches the whole map from today's rich status (occupato/
  // sgombera/stagionale/da saldare) to a simple free/not-free view computed for that specific
  // range -- so a stagionale umbrella whose booking doesn't overlap the picked dates correctly
  // shows green, and one that does still shows as unavailable. Today-only nuances (checking
  // out today, an outstanding balance today) don't generalize to an arbitrary future range, so
  // they're suppressed while this view is active.
  const range = effectiveDateRange(filters);
  const activeFilterCount = countActiveFilters(filters);
  const periodFreeCounts = useMemo(() => {
    if (!range) return null;
    return {
      nord: umbrellas.filter((u) => u.side === 'nord' && isUmbrellaFreeForRange(u, bookings, range.from, range.to))
        .length,
      sud: umbrellas.filter((u) => u.side === 'sud' && isUmbrellaFreeForRange(u, bookings, range.from, range.to))
        .length,
    };
  }, [range, umbrellas, bookings]);

  // Tapping an umbrella to start a new booking never touches the store until "Conferma" --
  // this local pending set just drives a temporary red/blue highlight so the operator can
  // see what they're about to book, and it clears itself (see below) on every cancel path.
  const pendingIds = useMemo(
    () => (selectedId ? [selectedId, ...pendingExtraIds] : []),
    [selectedId, pendingExtraIds]
  );

  const selectUmbrella = (id: string) => {
    setPendingExtraIds([]);
    setSelectedId(id);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Piantina Spiaggia</Text>
            <Text style={styles.headerSubtitle}>Trascina un ombrellone per spostare la prenotazione</Text>
          </View>
          <Pressable
            onPress={() => setFiltersOpen((v) => !v)}
            style={[styles.filterToggle, activeFilterCount > 0 && styles.filterToggleActive]}
          >
            <Ionicons
              name="options-outline"
              size={14}
              color={activeFilterCount > 0 ? colors.white : colors.primaryDark}
            />
            <Text style={[styles.filterToggleText, activeFilterCount > 0 && styles.filterToggleTextActive]}>
              Filtri
            </Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterCountBadge}>
                <Text style={styles.filterCountBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
        <View style={styles.legendRow}>
          {range ? (
            <>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.libero }]} />
                <Text style={styles.legendText}>Libero per il periodo scelto</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.occupato }]} />
                <Text style={styles.legendText}>Non disponibile</Text>
              </View>
            </>
          ) : (
            <>
              {PIANTINA_LEGEND.map(({ key, label }) => (
                <View key={key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: displayStatusColor[key] }]} />
                  <Text style={styles.legendText}>{label}</Text>
                </View>
              ))}
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.unpaidDotStatic]} />
                <Text style={styles.legendText}>Da saldare</Text>
              </View>
            </>
          )}
        </View>
      </View>

      <FilterSheetModal
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={setFilters}
      />

      <BeachCanvas
        umbrellas={umbrellas}
        positions={positions}
        cellSize={cellSize}
        rowHeight={rowHeight}
        labelWidth={labelWidth}
        footerText={
          range
            ? `Liberi per il periodo scelto: ${periodFreeCounts!.nord + periodFreeCounts!.sud} (Nord ${
                periodFreeCounts!.nord
              } · Sud ${periodFreeCounts!.sud})`
            : `Liberi oggi: ${freeCounts.nord + freeCounts.sud} (Nord ${freeCounts.nord} · Sud ${freeCounts.sud})`
        }
        renderCell={(u, position) => {
          const status: BaseDisplayStatus = range
            ? isUmbrellaFreeForRange(u, bookings, range.from, range.to)
              ? 'libero'
              : 'occupato'
            : baseDisplayStatusFor(u, getBooking);
          return (
            <UmbrellaCell
              key={u.id}
              umbrella={u}
              position={position}
              positions={positions}
              allUmbrellas={umbrellas}
              cellSize={cellSize}
              status={status}
              unpaid={range ? false : hasOutstandingBalance(u, getBooking)}
              caption={range ? undefined : captionFor(status, u, getBooking, getCustomer)}
              dimmed={!umbrellaMatchesFilters(u, filters, bookings, getBooking, getCustomer, today)}
              pending={pendingIds.includes(u.id)}
              onDrop={swapUmbrellas}
              onTap={selectUmbrella}
            />
          );
        }}
      />

      <UmbrellaDetailModal
        umbrellaId={selectedId}
        onClose={() => setSelectedId(null)}
        onExtrasChange={setPendingExtraIds}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.card },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.prenotatoBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  filterToggleActive: { backgroundColor: colors.primary },
  filterToggleText: { color: colors.primaryDark, fontWeight: '700', fontSize: 12 },
  filterToggleTextActive: { color: colors.white },
  filterCountBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    marginLeft: 2,
  },
  filterCountBadgeText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.md },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 11, color: colors.textMuted },
  cell: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  cellNumber: { fontWeight: '800', color: colors.white },
  cabinDot: {
    position: 'absolute',
    bottom: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
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
  unpaidDotStatic: { backgroundColor: colors.black },
  caption: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
});
