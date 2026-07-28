import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors, radius, spacing } from '../theme';
import { Umbrella } from '../types';

export const CELL = 72;
export const GAP = 8;
export const LABEL_WIDTH = 84;
export const MIN_CELL = 46;
export const COLS_PER_SIDE = 10;
export const WALKWAY_WIDTH = 28;
const GROUP_HEADER_HEIGHT = 22;

export interface WalkwayBreak {
  /** Column index (0-based) where this aisle starts -- every column >= `at` shifts right by `width`. */
  at: number;
  width: number;
}

// The Nord/Sud split (col 10) is always a walkway; callers can add more (e.g. every 5 seats,
// to echo a seat-map's aisle-per-section look) via the `extraWalkways` param threaded through
// from BeachCanvas -- each one just adds its own width to every column at/after its `at`.
export function colOffset(col: number, cellSize: number, gap: number, extraWalkways: WalkwayBreak[] = []): number {
  const base = col * (cellSize + gap);
  const mainWalkway = col >= COLS_PER_SIDE ? WALKWAY_WIDTH : 0;
  const extra = extraWalkways.reduce((sum, w) => sum + (col >= w.at ? w.width : 0), 0);
  return base + mainWalkway + extra;
}

// Cumulative top offset per row, reserving extra vertical space above any row that
// `rowBannerHeight` gives a positive height to -- lets a caller (e.g. a price-tier banner)
// insert a full-width block between groups of rows without the rest of BeachCanvas's position
// math (cells, zone labels, canvas height) needing to know why some rows sit further down
// than a plain `row * (rowHeight + gap)` would put them.
export function computeRowOffsets(
  rows: number[],
  rowHeight: number,
  gap: number,
  rowBannerHeight?: (row: number) => number
): Map<number, number> {
  const sorted = Array.from(new Set(rows)).sort((a, b) => a - b);
  const offsets = new Map<number, number>();
  let y = 0;
  for (const row of sorted) {
    y += rowBannerHeight?.(row) ?? 0;
    offsets.set(row, y);
    y += rowHeight + gap;
  }
  return offsets;
}

export function useUmbrellaPositions(
  umbrellas: Umbrella[],
  cellSize: number = CELL,
  gap: number = GAP,
  rowHeight: number = cellSize,
  extraWalkways: WalkwayBreak[] = [],
  rowBannerHeight?: (row: number) => number
) {
  return useMemo(() => {
    const rowOffsets = computeRowOffsets(
      umbrellas.map((u) => u.row),
      rowHeight,
      gap,
      rowBannerHeight
    );
    const positions = new Map<string, { x: number; y: number }>();
    umbrellas.forEach((u) => {
      positions.set(u.id, {
        x: colOffset(u.col, cellSize, gap, extraWalkways),
        y: rowOffsets.get(u.row) ?? u.row * (rowHeight + gap),
      });
    });
    return positions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [umbrellas, cellSize, gap, rowHeight, JSON.stringify(extraWalkways), rowBannerHeight]);
}

// `flip` mirrors the wave vertically so it can sit above the first row (sea fill on top,
// curve dipping down into the sand) instead of only working as a footer (sand on top).
export const WaveFooter: React.FC<{ flip?: boolean }> = ({ flip }) => (
  <Svg
    width="100%"
    height={22}
    viewBox="0 0 400 24"
    preserveAspectRatio="none"
    style={flip ? { transform: [{ scaleY: -1 }] } : undefined}
  >
    <Path d="M0,12 C50,24 150,0 200,12 C250,24 350,0 400,12 L400,24 L0,24 Z" fill={colors.sea} />
  </Svg>
);

// Richer, illustrated sea band used only where a caller opts in (the customer booking map's
// `richSeaBand` prop) -- a gradient sea, a foamy wave edge and a scattering of sandy dots, in
// place of the plain single-tone `WaveFooter`. The operator Piantina map never passes this prop,
// so it keeps its existing plain wave with no visual change.
export const SeaBand: React.FC = () => (
  <Svg width="100%" height={64} viewBox="0 0 400 64" preserveAspectRatio="none">
    <Defs>
      <LinearGradient id="seaBandGrad" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={colors.seaDark} />
        <Stop offset="1" stopColor={colors.sea} />
      </LinearGradient>
    </Defs>
    <Path d="M0,0 L400,0 L400,34 C350,48 300,26 250,36 C200,47 150,28 100,38 C60,45 30,36 0,42 Z" fill="url(#seaBandGrad)" />
    <Path
      d="M0,42 C30,36 60,45 100,38 C150,28 200,47 250,36 C300,26 350,48 400,34 L400,50 C350,58 300,44 250,50 C200,57 150,45 100,51 C60,55 30,48 0,53 Z"
      fill={colors.sand}
      opacity={0.9}
    />
    <Circle cx="40" cy="58" r="2" fill={colors.sandDark} opacity={0.6} />
    <Circle cx="120" cy="60" r="1.6" fill={colors.sandDark} opacity={0.5} />
    <Circle cx="210" cy="57" r="2.2" fill={colors.sandDark} opacity={0.6} />
    <Circle cx="290" cy="60" r="1.6" fill={colors.sandDark} opacity={0.5} />
    <Circle cx="360" cy="58" r="2" fill={colors.sandDark} opacity={0.6} />
  </Svg>
);

interface BeachCanvasProps {
  umbrellas: Umbrella[];
  positions: Map<string, { x: number; y: number }>;
  renderCell: (umbrella: Umbrella, position: { x: number; y: number }) => React.ReactNode;
  // Omit to hide the bottom info bar entirely -- the customer map skips it since the same
  // free-count info already lives in its own legend row above the canvas.
  footerText?: string;
  cellSize?: number;
  labelWidth?: number;
  rowHeight?: number;
  // Overrides the default icon+zone-name label -- used by the Disposizione layout editor to put
  // its rename/reorder controls in the same slot instead of plain static text.
  renderZoneLabel?: (row: number, zoneName: string) => React.ReactNode;
  // Extra aisles beyond the standard Nord/Sud split (col 10) -- must match whatever was passed
  // to useUmbrellaPositions so the walkway gaps line up with the cells' own x positions.
  extraWalkways?: WalkwayBreak[];
  // Reserves extra vertical space above a row (e.g. for a price-tier banner) -- must match
  // whatever was passed to useUmbrellaPositions so cells line up with their own row's label
  // and banner. Returning 0 (or omitting both props) reproduces today's plain, even spacing.
  rowBannerHeight?: (row: number) => number;
  // Renders into the reserved space above a row when rowBannerHeight(row) > 0 -- spans the
  // full scrollable seat width (like the NORD/SUD headers), not just the row-label column.
  renderRowBanner?: (row: number) => React.ReactNode;
  // Swaps the plain single-tone WaveFooter for the taller, illustrated gradient SeaBand -- opt-in
  // so the operator Piantina map (which doesn't pass this) keeps its existing look unchanged.
  richSeaBand?: boolean;
  // Lets the guest pan the map by pressing and dragging anywhere on it (both axes at once),
  // like a real map app, instead of only via the scrollbar/two separate straight swipes --
  // opt-in so the operator's Piantina/Disposizione (which have their own per-cell drag-and-drop
  // gestures) are entirely unaffected.
  dragToPan?: boolean;
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
  renderZoneLabel,
  extraWalkways = [],
  rowBannerHeight,
  renderRowBanner,
  richSeaBand = false,
  dragToPan = false,
}) => {
  // Press-and-drag panning (opt-in via `dragToPan`): the canvas is translated directly via a
  // CSS transform instead of living inside a scrollable container, so one continuous diagonal
  // drag moves both axes together -- like a real map app -- rather than needing two separate
  // straight scrollbar swipes. Implemented with raw browser pointer events (not RN's PanResponder
  // gesture system): PanResponder's gesture tracking here turned out to self-terminate after a
  // single move, most likely because programmatically calling a ScrollView's own `scrollTo` from
  // inside its move handler fires a native `scroll` event that the gesture responder reads as
  // "scrolling took over," ending the touch/mouse tracking. Plain window-level pointermove/up
  // listeners have no such conflict since nothing here is an actual scroll container anymore.
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  useEffect(() => {
    if (!dragToPan || typeof window === 'undefined' || !window.addEventListener) return;
    const clamp = (v: number) => Math.min(0, v);
    const handleMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setPan({ x: clamp(d.baseX + (e.clientX - d.startX)), y: clamp(d.baseY + (e.clientY - d.startY)) });
    };
    const handleUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [dragToPan]);

  // Cast to `any`: these are plain DOM pointer-event props (react-native-web forwards unknown
  // "on*" props straight to the underlying host element) that RN's own View typings don't know
  // about -- harmless no-ops on native, where `dragToPan` is never passed anyway.
  const dragHandlers: any = dragToPan
    ? {
        onPointerDown: (e: PointerEvent) => {
          dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pan.x, baseY: pan.y };
        },
      }
    : {};

  const zones = useMemo(() => {
    const seen = new Map<number, string>();
    umbrellas.forEach((u) => seen.set(u.row, u.zone));
    return Array.from(seen.entries()).sort((a, b) => a[0] - b[0]);
  }, [umbrellas]);

  const rowOffsets = useMemo(
    () => computeRowOffsets(zones.map(([row]) => row), rowHeight, GAP, rowBannerHeight),
    [zones, rowHeight, rowBannerHeight]
  );

  const maxCol = Math.max(0, ...umbrellas.map((u) => u.col));
  const hasWalkway = maxCol >= COLS_PER_SIDE;
  const canvasWidth = colOffset(maxCol, cellSize, GAP, extraWalkways) + cellSize;
  const lastRow = zones.length ? zones[zones.length - 1][0] : 0;
  const canvasHeight = zones.length ? (rowOffsets.get(lastRow) ?? 0) + rowHeight + GAP : 0;
  const labelIconSize = Math.min(16, Math.max(12, cellSize / 4));
  const labelFontSize = Math.min(13, Math.max(11, cellSize / 5));

  const walkwayLeft = colOffset(COLS_PER_SIDE - 1, cellSize, GAP, extraWalkways) + cellSize;
  const walkwayRenderWidth = GAP + WALKWAY_WIDTH;
  const walkwayFootprints = Math.max(2, Math.round(canvasHeight / 90));
  // Extra aisles (e.g. every 5 seats, for a seat-map-style sectioned look) each get their own
  // plain gap -- no NORD/SUD text, that label pair is reserved for the one real side split.
  const extraWalkwayRects = extraWalkways
    .filter((w) => maxCol >= w.at)
    .map((w) => ({
      left: colOffset(w.at - 1, cellSize, GAP, extraWalkways) + cellSize,
      width: GAP + w.width,
    }));

  const zoneLabelsContent = (
    <View style={{ width: labelWidth, height: GROUP_HEADER_HEIGHT + canvasHeight }}>
      {zones.map(([rowIdx, zoneName]) => (
        <View
          key={rowIdx}
          style={[
            styles.zoneLabel,
            {
              top: GROUP_HEADER_HEIGHT + (rowOffsets.get(rowIdx) ?? 0),
              height: rowHeight,
              width: labelWidth - 12,
            },
          ]}
        >
          {renderZoneLabel ? (
            renderZoneLabel(rowIdx, zoneName)
          ) : (
            <>
              <Ionicons name="umbrella" size={labelIconSize} color={colors.seaDark} />
              <Text style={[styles.zoneLabelText, { fontSize: labelFontSize }]} numberOfLines={1}>
                {zoneName}
              </Text>
            </>
          )}
        </View>
      ))}
    </View>
  );

  const canvasContent = (
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
      {extraWalkwayRects.map((rect, i) => (
        <View
          key={`extra-walkway-${i}`}
          style={[styles.walkway, { left: rect.left, top: GROUP_HEADER_HEIGHT, width: rect.width, height: canvasHeight }]}
        >
          {Array.from({ length: walkwayFootprints }).map((_, j) => (
            <Ionicons key={j} name="walk-outline" size={11} color={colors.seaDark} style={{ opacity: 0.24 }} />
          ))}
        </View>
      ))}
      {rowBannerHeight &&
        renderRowBanner &&
        zones.map(([rowIdx]) => {
          const bh = rowBannerHeight(rowIdx);
          if (bh <= 0) return null;
          const top = GROUP_HEADER_HEIGHT + (rowOffsets.get(rowIdx) ?? 0) - bh;
          return (
            <View key={`banner-${rowIdx}`} style={{ position: 'absolute', left: 0, top, width: canvasWidth, height: bh }}>
              {renderRowBanner(rowIdx)}
            </View>
          );
        })}
      <View style={{ marginTop: GROUP_HEADER_HEIGHT }}>{umbrellas.map((u) => renderCell(u, positions.get(u.id)!))}</View>
    </View>
  );

  return (
    <View style={styles.beach}>
      {/* Fila 1 is the front row, closest to the water (hasCabin/VIP-assignment logic
          treats row 0 as the premium sea-front tier) -- the wave sits above it, not
          below the last row, so the map reads shoreline-first the way the real beach does. */}
      {richSeaBand ? <SeaBand /> : <WaveFooter flip />}
      {dragToPan ? (
        <View style={[styles.dragClip, styles.dragCursor]} {...dragHandlers}>
          <View style={[styles.boardRow, styles.boardScroll, { transform: [{ translateY: pan.y }] }]}>
            {zoneLabelsContent}
            <View style={styles.dragClip}>
              <View style={{ transform: [{ translateX: pan.x }] }}>{canvasContent}</View>
            </View>
          </View>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.boardScroll}>
          <View style={styles.boardRow}>
            {zoneLabelsContent}
            <ScrollView horizontal showsHorizontalScrollIndicator>
              {canvasContent}
            </ScrollView>
          </View>
        </ScrollView>
      )}

      {footerText && (
        <View style={styles.footerBar}>
          <Text style={styles.footerText}>{footerText}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  beach: { flex: 1, backgroundColor: colors.sand },
  // web-only affordance (silently ignored by native RN) hinting the map can be grabbed and
  // dragged, matching a real map app rather than looking like a plain scroll area.
  dragCursor: { cursor: 'grab' } as unknown as ViewStyle,
  dragClip: { flex: 1, overflow: 'hidden' },
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
