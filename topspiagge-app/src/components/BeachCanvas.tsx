import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius, spacing } from '../theme';
import { Umbrella } from '../types';

export const CELL = 72;
export const GAP = 8;
export const LABEL_WIDTH = 84;

export function useUmbrellaPositions(umbrellas: Umbrella[]) {
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

export const WaveFooter: React.FC = () => (
  <Svg width="100%" height={22} viewBox="0 0 400 24" preserveAspectRatio="none">
    <Path d="M0,12 C50,24 150,0 200,12 C250,24 350,0 400,12 L400,24 L0,24 Z" fill={colors.sea} />
  </Svg>
);

interface BeachCanvasProps {
  umbrellas: Umbrella[];
  positions: Map<string, { x: number; y: number }>;
  renderCell: (umbrella: Umbrella, position: { x: number; y: number }) => React.ReactNode;
  footerText: string;
}

export const BeachCanvas: React.FC<BeachCanvasProps> = ({ umbrellas, positions, renderCell, footerText }) => {
  const zones = useMemo(() => {
    const seen = new Map<number, string>();
    umbrellas.forEach((u) => seen.set(u.row, u.zone));
    return Array.from(seen.entries()).sort((a, b) => a[0] - b[0]);
  }, [umbrellas]);

  const maxCol = Math.max(0, ...umbrellas.map((u) => u.col));
  const canvasWidth = (maxCol + 1) * (CELL + GAP);
  const canvasHeight = zones.length * (CELL + GAP);

  return (
    <View style={styles.beach}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.boardScroll}>
        <View style={styles.boardRow}>
          <View style={{ width: LABEL_WIDTH, height: canvasHeight }}>
            {zones.map(([rowIdx, zoneName]) => (
              <View key={rowIdx} style={[styles.zoneLabel, { top: rowIdx * (CELL + GAP), height: CELL }]}>
                <Ionicons name="umbrella" size={16} color={colors.seaDark} />
                <Text style={styles.zoneLabelText} numberOfLines={1}>
                  {zoneName}
                </Text>
              </View>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ width: canvasWidth, height: canvasHeight }}>
              {umbrellas.map((u) => renderCell(u, positions.get(u.id)!))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      <WaveFooter />
      <View style={styles.footerBar}>
        <Text style={styles.footerText}>{footerText}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  beach: { flex: 1, backgroundColor: colors.sand },
  boardScroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  boardRow: { flexDirection: 'row' },
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
