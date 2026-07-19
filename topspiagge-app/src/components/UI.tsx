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
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
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
}> = ({ label, selected, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.chip,
      { backgroundColor: selected ? colors.primary : colors.sand },
    ]}
  >
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
}> = ({ name, onPress, variant = 'neutral', size = 18 }) => {
  const bg = variant === 'edit' ? colors.accent : variant === 'delete' ? colors.danger : colors.sand;
  const iconColor = variant === 'neutral' ? colors.text : colors.white;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: bg, opacity: pressed ? 0.8 : 1 }]}
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

const styles = StyleSheet.create({
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
    marginRight: 6,
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
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.xl,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
