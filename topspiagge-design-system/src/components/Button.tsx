import React from 'react';
import { colors, spacing, radius } from '../tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'info' | 'muted';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Leading icon element — the DS ships no icon font, bring your own (SVG, emoji, etc). */
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: React.CSSProperties;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
}) => {
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
    <button
      onClick={onPress}
      disabled={disabled || loading}
      style={{
        paddingTop: 12,
        paddingBottom: 12,
        paddingLeft: spacing.lg,
        paddingRight: spacing.lg,
        borderRadius: radius.md,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: variant === 'ghost' ? `1px solid ${colors.primary}` : 'none',
        background: bg,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled || loading ? 'default' : 'pointer',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {loading ? (
        <span className="tsds-spinner" style={{ borderTopColor: textColor, borderColor: `${textColor}33` }} />
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          {icon && <span style={{ marginRight: spacing.xs, display: 'inline-flex' }}>{icon}</span>}
          <span style={{ fontWeight: 700, fontSize: 15, color: textColor }}>{title}</span>
        </span>
      )}
    </button>
  );
};
