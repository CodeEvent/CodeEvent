import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../store/StoreContext';
import { colors, radius, spacing } from '../theme';
import { LayoutElement, LayoutElementType } from '../types';
import { useAppAlert } from './AppAlert';
import { CELL as GRID_CELL, COLS_PER_SIDE, GAP, WALKWAY_WIDTH, useUmbrellaPositions } from './BeachCanvas';
import { Button, Stepper } from './UI';

// Room around the umbrella grid where decorations (entry, bar, sea, ...) usually belong --
// generous enough that operators rarely need to place something right on top of a row.
const MARGIN = 220;
const DRAG_THRESHOLD = 6;

interface PaletteEntry {
  type: LayoutElementType;
  label: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultColor?: string;
}

const PALETTE: PaletteEntry[] = [
  { type: 'walkway', label: 'Camminamento', defaultWidth: 160, defaultHeight: 32 },
  { type: 'bar', label: 'Bar', defaultWidth: 90, defaultHeight: 60 },
  { type: 'entry', label: 'Ingresso', defaultWidth: 60, defaultHeight: 60 },
  { type: 'steps', label: 'Scalini', defaultWidth: 70, defaultHeight: 36 },
  { type: 'toilet', label: 'Bagni', defaultWidth: 60, defaultHeight: 60 },
  { type: 'sea', label: 'Mare', defaultWidth: 220, defaultHeight: 40 },
  { type: 'shape-rect', label: 'Rettangolo', defaultWidth: 100, defaultHeight: 60, defaultColor: colors.sandDark },
  { type: 'shape-circle', label: 'Cerchio', defaultWidth: 70, defaultHeight: 70, defaultColor: colors.sandDark },
  { type: 'label', label: 'Etichetta', defaultWidth: 110, defaultHeight: 32 },
];

const SWATCHES = [colors.sandDark, colors.accent, colors.sea, colors.primary, colors.danger, colors.success, colors.textMuted];

function iconFor(type: LayoutElementType, size = 20, color = colors.white) {
  switch (type) {
    case 'bar':
      return <Ionicons name="wine-outline" size={size} color={color} />;
    case 'entry':
      return <Ionicons name="enter-outline" size={size} color={color} />;
    case 'steps':
      return <MaterialCommunityIcons name="stairs" size={size} color={color} />;
    case 'toilet':
      return <MaterialCommunityIcons name="toilet" size={size} color={color} />;
    case 'sea':
      return <MaterialCommunityIcons name="waves" size={size} color={color} />;
    case 'walkway':
      return <Ionicons name="walk-outline" size={size} color={color} />;
    default:
      return null;
  }
}

// Presets get a fixed, recognizable fill; only the two generic shapes take the operator's
// chosen color (defaulting to a neutral sand tone until they pick one).
function fillFor(type: LayoutElementType, color?: string): string {
  switch (type) {
    case 'bar':
      return colors.accent;
    case 'entry':
      return colors.success;
    case 'steps':
      return colors.textMuted;
    case 'toilet':
      return colors.info;
    case 'sea':
      return colors.sea;
    case 'walkway':
      return 'rgba(255,255,255,0.6)';
    case 'label':
      return 'transparent';
    default:
      return color ?? colors.sandDark;
  }
}

const LayoutElementView: React.FC<{
  element: LayoutElement;
  onMove: (id: string, x: number, y: number) => void;
  onTap: (id: string) => void;
}> = ({ element, onMove, onTap }) => {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [dragging, setDragging] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: () => setDragging(true),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        setDragging(false);
        const moved = Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD;
        pan.setValue({ x: 0, y: 0 });
        if (!moved) {
          onTap(element.id);
          return;
        }
        onMove(element.id, Math.max(0, Math.round(element.x + gesture.dx)), Math.max(0, Math.round(element.y + gesture.dy)));
      },
    })
  ).current;

  const isCircle = element.type === 'shape-circle';
  const isLabel = element.type === 'label';
  const fill = fillFor(element.type, element.color);
  const icon = iconFor(element.type, Math.min(22, element.width / 3), isLabel ? colors.text : colors.white);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.element,
        {
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          borderRadius: isCircle ? element.width / 2 : radius.sm,
          backgroundColor: fill,
          borderWidth: isLabel ? 1.5 : 0,
          borderColor: colors.border,
          borderStyle: isLabel ? 'dashed' : 'solid',
          transform: pan.getTranslateTransform(),
          zIndex: dragging ? 20 : 2,
          elevation: dragging ? 8 : 1,
        },
      ]}
    >
      {icon}
      {!!element.label && (
        <Text numberOfLines={1} style={[styles.elementLabel, { color: isLabel ? colors.text : colors.white }]}>
          {element.label}
        </Text>
      )}
    </Animated.View>
  );
};

const LayoutElementEditor: React.FC<{
  element: LayoutElement;
  onUpdate: (patch: Partial<Omit<LayoutElement, 'id' | 'type'>>) => void;
  onDelete: () => void;
  onClose: () => void;
}> = ({ element, onUpdate, onDelete, onClose }) => {
  const [label, setLabel] = useState(element.label ?? '');
  const isShape = element.type === 'shape-rect' || element.type === 'shape-circle';
  const preset = PALETTE.find((p) => p.type === element.type);

  return (
    <View>
      <Text style={styles.editorTitle}>{preset?.label ?? 'Elemento'}</Text>

      <Text style={styles.formLabel}>Etichetta</Text>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        onEndEditing={() => onUpdate({ label: label.trim() })}
        placeholder="Es. Bar Centrale"
        placeholderTextColor={colors.textMuted}
      />

      {isShape && (
        <>
          <Text style={[styles.formLabel, { marginTop: spacing.md }]}>Colore</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {SWATCHES.map((c) => (
              <Pressable
                key={c}
                onPress={() => onUpdate({ color: c })}
                style={[styles.swatch, { backgroundColor: c }, element.color === c && styles.swatchSelected]}
              />
            ))}
          </View>
        </>
      )}

      <Text style={[styles.formLabel, { marginTop: spacing.md }]}>Dimensioni</Text>
      <Stepper label="Larghezza" value={element.width} min={24} max={400} onChange={(v) => onUpdate({ width: v })} />
      <Stepper label="Altezza" value={element.height} min={24} max={400} onChange={(v) => onUpdate({ height: v })} />

      <Button title="Elimina elemento" variant="danger" onPress={onDelete} style={{ marginTop: spacing.lg }} />
      <Button title="Chiudi" variant="ghost" onPress={onClose} style={{ marginTop: spacing.sm }} />
    </View>
  );
};

export const LayoutDesignerScreen: React.FC = () => {
  const { umbrellas, layoutElements, addLayoutElement, updateLayoutElement, deleteLayoutElement } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const alert = useAppAlert();

  const positions = useUmbrellaPositions(umbrellas, GRID_CELL, GAP, GRID_CELL);

  const { canvasWidth, canvasHeight } = useMemo(() => {
    const maxCol = umbrellas.length ? Math.max(...umbrellas.map((u) => u.col)) : 0;
    const maxRow = umbrellas.length ? Math.max(...umbrellas.map((u) => u.row)) : 0;
    const gridWidth =
      maxCol >= COLS_PER_SIDE
        ? maxCol * (GRID_CELL + GAP) + WALKWAY_WIDTH + GRID_CELL
        : maxCol * (GRID_CELL + GAP) + GRID_CELL;
    const gridHeight = (maxRow + 1) * (GRID_CELL + GAP);
    return { canvasWidth: gridWidth + MARGIN * 2, canvasHeight: gridHeight + MARGIN * 2 };
  }, [umbrellas]);

  const editingElement = layoutElements.find((el) => el.id === editingId) ?? null;

  const handleMove = (id: string, x: number, y: number) => updateLayoutElement(id, { x, y });

  const handleAdd = (type: LayoutElementType) => {
    const preset = PALETTE.find((p) => p.type === type)!;
    // Cascade each new element a bit further from center than the last, so adding several in a
    // row never buries one exactly under another -- wraps back after 8 steps rather than
    // drifting off toward a canvas edge.
    const step = layoutElements.length % 8;
    const cascade = step * 28;
    const el: LayoutElement = {
      id: `layout-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      type,
      x: Math.round(canvasWidth / 2 - preset.defaultWidth / 2 + cascade),
      y: Math.round(canvasHeight / 2 - preset.defaultHeight / 2 + cascade),
      width: preset.defaultWidth,
      height: preset.defaultHeight,
      color: preset.defaultColor,
      label: preset.label,
    };
    addLayoutElement(el);
    setEditingId(el.id);
  };

  const confirmDelete = (id: string) => {
    alert('Eliminare questo elemento?', "Potrai ricrearlo in qualsiasi momento dalla palette qui sopra.", [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: () => {
          deleteLayoutElement(id);
          setEditingId(null);
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <Text style={styles.helperText}>
          Tocca un'icona per aggiungerla alla mappa, trascinala per posizionarla, toccala di nuovo per
          rinominarla, cambiarne il colore o eliminarla.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.paletteRow}
      >
        {PALETTE.map((p) => (
          <Pressable key={p.type} style={styles.paletteBtn} onPress={() => handleAdd(p.type)}>
            <View style={[styles.paletteIconWrap, { backgroundColor: fillFor(p.type, p.defaultColor) }]}>
              {iconFor(p.type, 18, p.type === 'label' ? colors.text : colors.white) ?? (
                <Ionicons name="add-outline" size={18} color={colors.text} />
              )}
            </View>
            <Text style={styles.paletteLabel} numberOfLines={1}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.beachBg}>
        <ScrollView contentContainerStyle={{ padding: spacing.md }}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ width: canvasWidth, height: canvasHeight }}>
              {umbrellas.map((u) => {
                const p = positions.get(u.id);
                if (!p) return null;
                return (
                  <View
                    key={u.id}
                    pointerEvents="none"
                    style={[
                      styles.umbrellaRef,
                      { left: p.x + MARGIN, top: p.y + MARGIN, width: GRID_CELL, height: GRID_CELL },
                    ]}
                  >
                    <Text style={styles.umbrellaRefText}>{u.number}</Text>
                  </View>
                );
              })}

              {layoutElements.map((el) => (
                <LayoutElementView key={el.id} element={el} onMove={handleMove} onTap={setEditingId} />
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      </View>

      <Modal visible={!!editingElement} transparent animationType="slide" onRequestClose={() => setEditingId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditingId(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {editingElement && (
              <LayoutElementEditor
                element={editingElement}
                onUpdate={(patch) => updateLayoutElement(editingElement.id, patch)}
                onDelete={() => confirmDelete(editingElement.id)}
                onClose={() => setEditingId(null)}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  helperText: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  paletteRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.md },
  paletteBtn: { alignItems: 'center', width: 64 },
  paletteIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  paletteLabel: { fontSize: 10, color: colors.textMuted, marginTop: 4, fontWeight: '600', textAlign: 'center' },
  beachBg: { flex: 1, backgroundColor: colors.sand },
  umbrellaRef: {
    position: 'absolute',
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(46,150,160,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  umbrellaRefText: { fontSize: 11, fontWeight: '700', color: colors.seaDark },
  element: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  elementLabel: { fontSize: 10, fontWeight: '700', marginTop: 2, paddingHorizontal: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  editorTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  formLabel: { fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    color: colors.text,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: { borderColor: colors.text },
});
