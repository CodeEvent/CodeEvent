import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, statusBg, statusColor, statusLabel } from '../theme';
import { UmbrellaStatus } from '../types';

// react-native-web's Pressable adds a `hovered` field to the style-callback state that
// upstream RN's own PressableStateCallbackType doesn't declare (there's no such thing as
// hover on native) -- this local type covers both without an `any`.
type PressState = { pressed: boolean; hovered?: boolean };
import {
  DisplayStatus,
  displayStatusBg,
  displayStatusColor,
  displayStatusLabel,
  displayStatusTextColor,
} from '../utils/displayStatus';

export const Card: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({
  children,
  style,
}) => <View style={[styles.card, style]}>{children}</View>;

export const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle,
}) => (
  <View style={{ marginBottom: spacing.md }}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
  </View>
);

export const Badge: React.FC<{ status: UmbrellaStatus }> = ({ status }) => (
  <View style={[styles.badge, { backgroundColor: statusBg[status] }]}>
    <View style={[styles.dot, { backgroundColor: statusColor[status] }]} />
    <Text style={[styles.badgeText, { color: statusColor[status] }]}>{statusLabel[status]}</Text>
  </View>
);

// The operator screens (Piantina, Griglia, Quadro, Conto, Archivi) all use the same
// merged 3-color language -- libero/occupato/da saldare -- instead of the raw 4-value
// booking status, so a cell's color always matches what its detail view shows.
// `unpaid` overlays a small black ring on the dot and appends "· Da saldare" to the label,
// instead of the badge itself turning solid black -- so it always shows the real occupancy
// color (Occupato/Sgombera) with the payment flag layered on top, matching the map cells.
export const StatusPill: React.FC<{ status: DisplayStatus; unpaid?: boolean }> = ({ status, unpaid }) => {
  const showsUnpaidSuffix = unpaid && status !== 'da_saldare';
  return (
    <View style={[styles.badge, { backgroundColor: displayStatusBg[status] }]}>
      <View style={styles.dotWrap}>
        <View style={[styles.dot, { backgroundColor: displayStatusColor[status] }]} />
        {showsUnpaidSuffix && <View style={styles.unpaidRing} />}
      </View>
      <Text style={[styles.badgeText, { color: displayStatusTextColor[status] }]}>
        {displayStatusLabel[status]}
        {showsUnpaidSuffix ? ' · Da saldare' : ''}
      </Text>
    </View>
  );
};

export const Button: React.FC<{
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'info' | 'muted';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ title, onPress, variant = 'primary', icon, disabled, loading, style }) => {
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
      ? colors.danger
      : variant === 'success'
      ? colors.success
      : variant === 'info'
      ? colors.info
      : variant === 'muted'
      ? colors.textMuted
      : variant === 'ghost'
      ? 'transparent'
      : colors.sand;
  const textColor = variant === 'ghost' ? colors.primary : variant === 'secondary' ? colors.text : colors.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed, hovered }: PressState) => [
        styles.button,
        styles.transition,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : hovered ? 0.92 : 1 },
        !disabled && hovered && !pressed && styles.hoverLift,
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.primary },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.buttonContent}>
          {icon && <Ionicons name={icon} size={16} color={textColor} style={{ marginRight: spacing.xs }} />}
          <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
};

export const Chip: React.FC<{
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Small colored dot before the label -- lets a status chip echo its map color. */
  dotColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}> = ({ label, selected, onPress, dotColor, icon }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: !!selected }}
    style={({ hovered, pressed }: PressState) => [
      styles.chip,
      styles.transition,
      { backgroundColor: selected ? colors.primary : colors.sand },
      hovered && !pressed && !selected && styles.chipHover,
    ]}
  >
    {!!dotColor && <View style={[styles.chipDot, { backgroundColor: dotColor }]} />}
    {!!icon && (
      <Ionicons name={icon} size={13} color={selected ? colors.white : colors.textMuted} style={{ marginRight: 4 }} />
    )}
    <Text style={{ color: selected ? colors.white : colors.text, fontWeight: '600', fontSize: 13 }}>
      {label}
    </Text>
  </Pressable>
);

export const IconButton: React.FC<{
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: 'edit' | 'delete' | 'neutral';
  size?: number;
  /** Announced by screen readers -- this button never shows a visible text label, so without
   * this it reads as an unlabeled "button" (or just the glyph name on some readers). */
  accessibilityLabel?: string;
}> = ({ name, onPress, variant = 'neutral', size = 18, accessibilityLabel }) => {
  const bg = variant === 'edit' ? colors.accent : variant === 'delete' ? colors.danger : colors.sand;
  const iconColor = variant === 'neutral' ? colors.text : colors.white;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (variant === 'edit' ? 'Modifica' : variant === 'delete' ? 'Elimina' : undefined)}
      style={({ pressed, hovered }: PressState) => [
        styles.iconButton,
        styles.transition,
        { backgroundColor: bg, opacity: pressed ? 0.8 : 1 },
        hovered && !pressed && styles.hoverLift,
      ]}
    >
      <Ionicons name={name} size={size} color={iconColor} />
    </Pressable>
  );
};

export const EditDeleteRow: React.FC<{ onEdit: () => void; onDelete: () => void }> = ({
  onEdit,
  onDelete,
}) => (
  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
    <IconButton name="pencil" variant="edit" onPress={onEdit} />
    <IconButton name="trash-outline" variant="delete" onPress={onDelete} />
  </View>
);

export const Checkbox: React.FC<{
  checked: boolean;
  onToggle: () => void;
  label: string;
}> = ({ checked, onToggle, label }) => (
  <Pressable
    onPress={onToggle}
    style={styles.checkboxRow}
    accessibilityRole="checkbox"
    accessibilityState={{ checked }}
  >
    <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
      {checked && <Ionicons name="checkmark" size={14} color={colors.white} />}
    </View>
    <Text style={styles.checkboxLabel}>{label}</Text>
  </Pressable>
);

export const Stepper: React.FC<{
  label: string;
  value: number;
  min?: number;
  max?: number;
  icon?: keyof typeof Ionicons.glyphMap;
  onChange: (value: number) => void;
}> = ({ label, value, min = 0, max = Infinity, icon, onChange }) => (
  <View style={styles.stepperRow}>
    <View style={styles.stepperLabelRow}>
      {icon && <Ionicons name={icon} size={16} color={colors.textMuted} style={{ marginRight: spacing.xs }} />}
      <Text style={styles.stepperLabel}>{label}</Text>
    </View>
    <View style={styles.stepperControls}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        style={[styles.stepperBtn, styles.transition, value <= min && styles.stepperBtnDisabled]}
        disabled={value <= min}
        accessibilityRole="button"
        accessibilityLabel={`Diminuisci ${label}`}
      >
        <Ionicons name="remove" size={16} color={value <= min ? colors.border : colors.primary} />
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        style={[styles.stepperBtn, styles.transition, value >= max && styles.stepperBtnDisabled]}
        disabled={value >= max}
        accessibilityRole="button"
        accessibilityLabel={`Aumenta ${label}`}
      >
        <Ionicons name="add" size={16} color={value >= max ? colors.border : colors.primary} />
      </Pressable>
    </View>
  </View>
);

// Plain numbered circles connected by a uniform line -- only the current step is filled; a
// step already passed looks the same as one not yet reached, matching the reference design's
// step indicator (which doesn't distinguish "done" from "upcoming", only "current").
export const StepProgressBar: React.FC<{ totalSteps: number; currentIndex: number }> = ({
  totalSteps,
  currentIndex,
}) => (
  <View style={styles.stepBarRow}>
    {Array.from({ length: totalSteps }).map((_, i) => {
      const current = i === currentIndex;
      return (
        <React.Fragment key={i}>
          <View style={[styles.stepBarDot, current && styles.stepBarDotCurrent]}>
            <Text style={[styles.stepBarDotText, current && styles.stepBarDotTextCurrent]}>{i + 1}</Text>
          </View>
          {i < totalSteps - 1 && <View style={styles.stepBarLine} />}
        </React.Fragment>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  // Web-only (RNW passes these straight through as CSS; native silently ignores unknown
  // style keys) -- gives every hover/press state change a smooth snap instead of an instant
  // cut, which is most of what makes a static-feeling web UI read as "alive."
  transition: {
    transitionProperty: 'background-color, opacity, box-shadow, transform',
    transitionDuration: '150ms',
  } as ViewStyle,
  // A hovered-but-not-pressed control lifts very slightly with a softer shadow -- pressed
  // still wins (no lift while actively tapped) and disabled controls never opt in at all.
  hoverLift: {
    transform: [{ translateY: -1 }],
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  } as ViewStyle,
  chipHover: { backgroundColor: colors.sandDark },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.xl,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotWrap: { position: 'relative', width: 8, height: 8, marginRight: 6 },
  unpaidRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.black,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.xl,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18 },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  stepperLabelRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  stepperLabel: { color: colors.text, fontWeight: '600', fontSize: 14 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: { backgroundColor: colors.bg },
  stepperValue: { fontWeight: '700', color: colors.text, fontSize: 15, minWidth: 20, textAlign: 'center' },
  stepBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  stepBarDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBarDotCurrent: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepBarDotText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  stepBarDotTextCurrent: { color: colors.white },
  stepBarLine: { flex: 1, height: 1.5, backgroundColor: colors.border, marginHorizontal: 6 },
});
