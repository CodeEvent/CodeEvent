import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius, spacing } from '../theme';
import { Umbrella } from '../types';

export const CELL = 72;
export const GAP = 8;
export const LABEL_WIDTH = 84;
export const MIN_CELL = 46;
export const COLS_PER_SIDE = 10;
export const WALKWAY_WIDTH = 28;
const GROUP_HEADER_HEIGHT = 22;

function colOffset(col: number, cellSize: number, gap: number): number {
  const base = col * (cellSize + gap);
  return col >= COLS_PER_SIDE ? base + WALKWAY_WIDTH : base;
}

export function useUmbrellaPositions(
  umbrellas: Umbrella[],
  cellSize: number = CELL,
  gap: number = GAP,
  rowHeight: number = cellSize
) {
  return useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    umbrellas.forEach((u) => {
      positions.set(u.id, {
        x: colOffset(u.col, cellSize, gap),
        y: u.row * (rowHeight + gap),
      });
    });
    return positions;
  }, [umbrellas, cellSize, gap, rowHeight]);
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
  cellSize?: number;
  labelWidth?: number;
  rowHeight?: number;
}

// Every row is one continuous line of umbrellas split by a walkway: seats on
// the left (columns 0-9) are "Lato Nord", seats on the right (columns 10+)
// are "Lato Sud" -- the same single map for both staff and customers, so the
// walkway and NORD/SUD headers are drawn once here rather than behind a toggle.
export const BeachCanvas: React.FC<BeachCanvasProps> = ({
  umbrellas,
  positions,
  renderCell,
  footerText,
  cellSize = CELL,
  labelWidth = LABEL_WIDTH,
  rowHeight = cellSize,
}) => {
  const zones = useMemo(() => {
    const seen = new Map<number, string>();
    umbrellas.forEach((u) => seen.set(u.row, u.zone));
    return Array.from(seen.entries()).sort((a, b) => a[0] - b[0]);
  }, [umbrellas]);

  const maxCol = Math.max(0, ...umbrellas.map((u) => u.col));
  const hasWalkway = maxCol >= COLS_PER_SIDE;
  const canvasWidth = colOffset(maxCol, cellSize, GAP) + cellSize;
  const canvasHeight = zones.length * (rowHeight + GAP);
  const labelIconSize = Math.min(16, Math.max(12, cellSize / 4));
  const labelFontSize = Math.min(13, Math.max(11, cellSize / 5));

  const walkwayLeft = colOffset(COLS_PER_SIDE - 1, cellSize, GAP) + cellSize;
  const walkwayRenderWidth = GAP + WALKWAY_WIDTH;
  const walkwayFootprints = Math.max(2, Math.round(canvasHeight / 90));

  return (
    <View style={styles.beach}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.boardScroll}>
        <View style={styles.boardRow}>
          <View style={{ width: labelWidth, height: GROUP_HEADER_HEIGHT + canvasHeight }}>
            {zones.map(([rowIdx, zoneName]) => (
              <View
                key={rowIdx}
                style={[
                  styles.zoneLabel,
                  {
                    top: GROUP_HEADER_HEIGHT + rowIdx * (rowHeight + GAP),
                    height: rowHeight,
                    width: labelWidth - 12,
                  },
                ]}
              >
                <Ionicons name="umbrella" size={labelIconSize} color={colors.seaDark} />
                <Text style={[styles.zoneLabelText, { fontSize: labelFontSize }]} numberOfLines={1}>
                  {zoneName}
                </Text>
              </View>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ width: canvasWidth, height: GROUP_HEADER_HEIGHT + canvasHeight }}>
              {hasWalkway && (
                <>
                  <Text style={[styles.groupHeaderText, { left: 0, width: walkwayLeft }]}>NORD</Text>
                  <Text
                    style={[
                      styles.groupHeaderText,
                      { left: walkwayLeft + walkwayRenderWidth, width: canvasWidth - walkwayLeft - walkwayRenderWidth },
                    ]}
                  >
                    SUD
                  </Text>
                  <View
                    style={[
                      styles.walkway,
                      {
                        left: walkwayLeft,
                        top: GROUP_HEADER_HEIGHT,
                        width: walkwayRenderWidth,
                        height: canvasHeight,
                      },
                    ]}
                  >
                    {Array.from({ length: walkwayFootprints }).map((_, i) => (
                      <Ionicons key={i} name="walk-outline" size={13} color={colors.seaDark} style={{ opacity: 0.32 }} />
                    ))}
                  </View>
                </>
              )}
              <View style={{ marginTop: GROUP_HEADER_HEIGHT }}>
                {umbrellas.map((u) => renderCell(u, positions.get(u.id)!))}
              </View>
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
  groupHeaderText: {
    position: 'absolute',
    top: 0,
    height: GROUP_HEADER_HEIGHT,
    lineHeight: GROUP_HEADER_HEIGHT,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 11,
    color: colors.seaDark,
    letterSpacing: 1,
  },
  walkway: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(46,150,160,0.35)',
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: spacing.sm,
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
