import React from 'react';
import { colors, radius, spacing } from '../tokens';
import { CheckIcon } from '../icons';

export interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onToggle, label }) => (
  <button
    onClick={onToggle}
    style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      border: 'none',
      background: 'transparent',
      padding: 0,
      cursor: 'pointer',
      textAlign: 'left',
    }}
  >
    <span
      style={{
        width: 22,
        height: 22,
        flexShrink: 0,
        borderRadius: radius.sm,
        border: `2px solid ${checked ? colors.primary : colors.textMuted}`,
        background: checked ? colors.primary : 'transparent',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked && <CheckIcon size={14} color={colors.white} />}
    </span>
    <span style={{ color: colors.text, fontSize: 13, lineHeight: '18px' }}>{label}</span>
  </button>
);
