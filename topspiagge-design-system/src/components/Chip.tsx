import React from 'react';
import { colors, radius, spacing } from '../tokens';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Small colored dot before the label — lets a status chip echo its map color. */
  dotColor?: string;
  icon?: React.ReactNode;
}

export const Chip: React.FC<ChipProps> = ({ label, selected, onPress, dotColor, icon }) => (
  <button
    onClick={onPress}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      paddingLeft: spacing.md,
      paddingRight: spacing.md,
      paddingTop: 6,
      paddingBottom: 6,
      borderRadius: radius.xl,
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
      border: 'none',
      cursor: onPress ? 'pointer' : 'default',
      background: selected ? colors.primary : colors.sand,
      fontFamily: 'inherit',
    }}
  >
    {!!dotColor && (
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          marginRight: 5,
          background: dotColor,
          display: 'inline-block',
        }}
      />
    )}
    {!!icon && <span style={{ marginRight: 4, display: 'inline-flex' }}>{icon}</span>}
    <span style={{ color: selected ? colors.white : colors.text, fontWeight: 600, fontSize: 13 }}>{label}</span>
  </button>
);
