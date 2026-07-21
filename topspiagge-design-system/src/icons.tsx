import React from 'react';

// Tiny internal glyphs for components whose icon has a fixed semantic meaning
// (checked, increment/decrement, edit/delete) -- unlike Button/Chip's free-form
// `icon` slot, these are never swapped out by a consumer, so they ship inline
// instead of requiring an icon font neither this DS nor the design agent has.
interface IconProps {
  size?: number;
  color?: string;
}

export const CheckIcon: React.FC<IconProps> = ({ size = 14, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 12.5L9.5 18L20 6" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 16, color = '#000' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 4V20M4 12H20" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
  </svg>
);

export const MinusIcon: React.FC<IconProps> = ({ size = 16, color = '#000' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 12H20" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
  </svg>
);

export const PencilIcon: React.FC<IconProps> = ({ size = 18, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M4 20l.9-3.6L16.3 5 19 7.7 7.6 19.1 4 20z"
      stroke={color}
      strokeWidth={1.6}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 18, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M5 7h14M9 7V5h6v2M6 7l1 13h10l1-13"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
