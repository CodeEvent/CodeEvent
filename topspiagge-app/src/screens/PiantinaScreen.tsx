import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UmbrellaDetailModal } from '../components/UmbrellaDetailModal';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing, statusBg, statusColor } from '../theme';
import { Umbrella } from '../types';

const CELL = 72;
const GAP = 8;
const LABEL_WIDTH = 84;
const TAP_THRESHOLD = 10;

function useUmbrellaPositions(umbrellas: Umbrella[]) {
  return useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    umbrellas.forEach((u) => {
      positions.set(u.id, {
        x: u.col * (CELL + GAP),
        y: u.row * (CELL + GAP),
      });
    });
    return positions;
  }, [umbrellas]);
}

const UmbrellaCell: React.FC<{
  umbrella: Umbrella;
  position: { x: number; y: number };
  positions: Map<string, { x: number; y: number }>;
  allUmbrellas: Umbrella[];
  onDrop: (fromId: string, toId: string) => void;
  onTap: (id: string) => void;
}> = ({ umbrella, position, positions, allUmbrellas, onDrop, onTap }) => {
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
          x: position.x + CELL / 2 + gesture.dx,
          y: position.y + CELL / 2 + gesture.dy,
        };
        let target: Umbrella | undefined;
        for (const u of allUmbrellas) {
          if (u.id === umbrella.id) continue;
          const p = positions.get(u.id);
          if (!p) continue;
          if (
            dropCenter.x >= p.x &&
            dropCenter.x <= p.x + CELL &&
            dropCenter.y >= p.y &&
            dropCenter.y <= p.y + CELL
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

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.cell,
        {
          left: position.x,
          top: position.y,
          backgroundColor: statusColor[umbrella.status],
          borderColor: colors.card,
          transform: pan.getTranslateTransform(),
          zIndex: dragging ? 10 : 1,
          elevation: dragging ? 8 : 2,
        },
      ]}
    >
      <Text style={styles.cellNumber}>{umbrella.number}</Text>
      {umbrella.hasCabin && <View style={styles.cabinDot} />}
      {umbrella.assignedCustomerId && <View style={styles.assigneeDot} />}
    </Animated.View>
  );
};

const WaveFooter: React.FC = () => (
  <Svg width="100%" height={22} viewBox="0 0 400 24" preserveAspectRatio="none">
    <Path
      d="M0,12 C50,24 150,0 200,12 C250,24 350,0 400,12 L400,24 L0,24 Z"
      fill={colors.sea}
    />
  </Svg>
);

export const PiantinaScreen: React.FC = () => {
  const { umbrellas, swapUmbrellas } = useStore();
  const positions = useUmbrellaPositions(umbrellas);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const route = useRoute<any>();

  useEffect(() => {
    if (route.params?.umbrellaId) setSelectedId(route.params.umbrellaId);
  }, [route.params?.umbrellaId]);

  const zones = useMemo(() => {
    const seen = new Map<number, string>();
    umbrellas.forEach((u) => seen.set(u.row, u.zone));
    return Array.from(seen.entries()).sort((a, b) => a[0] - b[0]);
  }, [umbrellas]);

  const maxCol = Math.max(...umbrellas.map((u) => u.col));
  const canvasWidth = (maxCol + 1) * (CELL + GAP);
  const canvasHeight = zones.length * (CELL + GAP);
  const freeToday = umbrellas.filter((u) => u.status === 'libero').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Piantina Spiaggia</Text>
        <Text style={styles.headerSubtitle}>Trascina un ombrellone per spostare la prenotazione</Text>
        <View style={styles.legendRow}>
          {(['libero', 'occupato', 'in_arrivo', 'prenotato'] as const).map((s) => (
            <View key={s} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: statusColor[s] }]} />
              <Text style={styles.legendText}>
                {s === 'libero' ? 'Libero' : s === 'occupato' ? 'Occupato' : s === 'in_arrivo' ? 'In arrivo' : 'Prenotato'}
              </Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
            <Text style={styles.legendText}>Cliente stagionale</Text>
          </View>
        </View>
      </View>

      <View style={styles.beach}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.boardScroll}>
          <View style={styles.boardRow}>
            <View style={{ width: LABEL_WIDTH, height: canvasHeight }}>
              {zones.map(([rowIdx, zoneName]) => (
                <View
                  key={rowIdx}
                  style={[styles.zoneLabel, { top: rowIdx * (CELL + GAP), height: CELL }]}
                >
                  <Ionicons name="umbrella" size={16} color={colors.seaDark} />
                  <Text style={styles.zoneLabelText} numberOfLines={1}>
                    {zoneName}
                  </Text>
                </View>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={{ width: canvasWidth, height: canvasHeight }}>
                {umbrellas.map((u) => (
                  <UmbrellaCell
                    key={u.id}
                    umbrella={u}
                    position={positions.get(u.id)!}
                    positions={positions}
                    allUmbrellas={umbrellas}
                    onDrop={swapUmbrellas}
                    onTap={setSelectedId}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>

        <WaveFooter />
        <View style={styles.footerBar}>
          <Text style={styles.footerText}>Ombrelloni liberi oggi: {freeToday}</Text>
        </View>
      </View>

      <UmbrellaDetailModal umbrellaId={selectedId} onClose={() => setSelectedId(null)} />
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
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.md },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 11, color: colors.textMuted },
  beach: { flex: 1, backgroundColor: colors.sand },
  boardScroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  boardRow: { flexDirection: 'row' },
  cell: {
    position: 'absolute',
    width: CELL,
    height: CELL,
    borderRadius: CELL / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  cellNumber: { fontWeight: '800', fontSize: 16, color: colors.white },
  cabinDot: {
    position: 'absolute',
    bottom: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  assigneeDot: {
    position: 'absolute',
    top: 4,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  zoneLabel: {
    position: 'absolute',
    left: 0,
    width: LABEL_WIDTH - 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  zoneLabelText: { fontWeight: '700', color: colors.seaDark, fontSize: 12 },
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
