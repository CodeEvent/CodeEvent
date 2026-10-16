import React from 'react';
import { colors, radius } from '../tokens';
import { PencilIcon, TrashIcon } from '../icons';

export type IconButtonVariant = 'edit' | 'delete' | 'neutral';

export interface IconButtonProps {
  icon?: React.ReactNode;
  onPress: () => void;
  variant?: IconButtonVariant;
  size?: number;
}

// `icon` defaults to a variant-appropriate glyph (pencil for edit, trash for delete) so the
// two most common call sites need no icon prop at all -- pass your own for anything else.
export const IconButton: React.FC<IconButtonProps> = ({ icon, onPress, variant = 'neutral', size = 18 }) => {
  const bg = variant === 'edit' ? colors.accent : variant === 'delete' ? colors.danger : colors.sand;
  const iconColor = variant === 'neutral' ? colors.text : colors.white;
  const resolvedIcon =
    icon ??
    (variant === 'edit' ? (
      <PencilIcon size={size} color={iconColor} />
    ) : variant === 'delete' ? (
      <TrashIcon size={size} color={iconColor} />
    ) : null);
  return (
    <button
      onClick={onPress}
      style={{
        width: 36,
        height: 36,
        borderRadius: radius.sm,
        border: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        cursor: 'pointer',
      }}
    >
      {resolvedIcon}
    </button>
  );
};
