import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BeachCanvas, GAP, MIN_CELL, useUmbrellaPositions } from '../components/BeachCanvas';
import { UmbrellaDetailModal } from '../components/UmbrellaDetailModal';
import { useStore } from '../store/StoreContext';
import { colors, spacing } from '../theme';
import { Umbrella } from '../types';
import {
  DISPLAY_STATUSES,
  DisplayStatus,
  displayStatusColor,
  displayStatusFor,
  displayStatusLabel,
} from '../utils/displayStatus';

const TAP_THRESHOLD = 10;
const ROWS = 12;

const UmbrellaCell: React.FC<{
  umbrella: Umbrella;
  position: { x: number; y: number };
  positions: Map<string, { x: number; y: number }>;
  allUmbrellas: Umbrella[];
  cellSize: number;
  status: DisplayStatus;
  onDrop: (fromId: string, toId: string) => void;
  onTap: (id: string) => void;
}> = ({ umbrella, position, positions, allUmbrellas, cellSize, status, onDrop, onTap }) => {
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

  const isSgombera = status === 'sgombera';

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.cell,
        {
          left: position.x,
          top: position.y,
          width: cellSize,
          height: cellSize,
          borderRadius: cellSize / 2,
          overflow: 'hidden',
          backgroundColor: isSgombera ? undefined : displayStatusColor[status],
          borderColor: colors.card,
          transform: pan.getTranslateTransform(),
          zIndex: dragging ? 10 : 1,
          elevation: dragging ? 8 : 2,
        },
      ]}
    >
      {isSgombera && (
        <View style={StyleSheet.absoluteFill}>
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: cellSize / 2, backgroundColor: colors.libero }} />
          <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: cellSize / 2, backgroundColor: colors.sgombera }} />
        </View>
      )}
      {status === 'libero' ? (
        <MaterialCommunityIcons name="umbrella-closed" size={Math.min(24, Math.max(16, cellSize / 3))} color={colors.white} />
      ) : (
        <Text style={[styles.cellNumber, { fontSize: Math.min(17, Math.max(12, cellSize / 4)) }]}>
          {umbrella.number}
        </Text>
      )}
      {umbrella.hasCabin && <View style={styles.cabinDot} />}
    </Animated.View>
  );
};

export const PiantinaScreen: React.FC = () => {
  const { umbrellas, swapUmbrellas, getBooking } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const route = useRoute<any>();
  const { height } = useWindowDimensions();

  const labelWidth = 60;
  // 20 seats per row (10 Nord + walkway + 10 Sud) rarely fit a screen width without
  // shrinking cells past legibility, so cell size is driven by height only -- the
  // canvas scrolls horizontally to reveal the rest, same as the customer-facing map.
  const mapAreaHeight = height - 240;
  const cellSize = Math.max(MIN_CELL, Math.min(72, Math.floor(mapAreaHeight / ROWS) - GAP));

  const positions = useUmbrellaPositions(umbrellas, cellSize);

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Piantina Spiaggia</Text>
        <Text style={styles.headerSubtitle}>Trascina un ombrellone per spostare la prenotazione</Text>
        <View style={styles.legendRow}>
          {DISPLAY_STATUSES.map((s) => (
            <View key={s} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: displayStatusColor[s] }]} />
              <Text style={styles.legendText}>{displayStatusLabel[s]}</Text>
            </View>
          ))}
        </View>
      </View>

      <BeachCanvas
        umbrellas={umbrellas}
        positions={positions}
        cellSize={cellSize}
        labelWidth={labelWidth}
        footerText={`Liberi oggi: ${freeCounts.nord + freeCounts.sud} (Nord ${freeCounts.nord} · Sud ${freeCounts.sud})`}
        renderCell={(u, position) => (
          <UmbrellaCell
            key={u.id}
            umbrella={u}
            position={position}
            positions={positions}
            allUmbrellas={umbrellas}
            cellSize={cellSize}
            status={displayStatusFor(u, getBooking)}
            onDrop={swapUmbrellas}
            onTap={setSelectedId}
          />
        )}
      />

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
  cell: {
    position: 'absolute',
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
});
