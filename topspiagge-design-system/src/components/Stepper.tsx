import React from 'react';
import { colors, spacing, radius } from '../tokens';
import { MinusIcon, PlusIcon } from '../icons';

export interface StepperProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  icon?: React.ReactNode;
  onChange: (value: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({ label, value, min = 0, max = Infinity, icon, onChange }) => {
  const atMin = value <= min;
  const atMax = value >= max;
  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    border: 'none',
    background: disabled ? colors.bg : colors.sand,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer',
  });
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing.sm,
        paddingBottom: spacing.sm,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {icon && <span style={{ marginRight: spacing.xs, display: 'inline-flex' }}>{icon}</span>}
        <span style={{ color: colors.text, fontWeight: 600, fontSize: 14 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
        <button onClick={() => onChange(Math.max(min, value - 1))} disabled={atMin} style={btnStyle(atMin)}>
          <MinusIcon size={16} color={atMin ? colors.border : colors.primary} />
        </button>
        <span style={{ fontWeight: 700, color: colors.text, fontSize: 15, minWidth: 20, textAlign: 'center' }}>
          {value}
        </span>
        <button onClick={() => onChange(Math.min(max, value + 1))} disabled={atMax} style={btnStyle(atMax)}>
          <PlusIcon size={16} color={atMax ? colors.border : colors.primary} />
        </button>
      </div>
    </div>
  );
};
