import React from 'react';
import { IconButton } from 'topspiagge-design-system';

export const Variants = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <IconButton variant="edit" onPress={() => {}} />
    <IconButton variant="delete" onPress={() => {}} />
    <IconButton variant="neutral" onPress={() => {}} />
  </div>
);

export const CustomIcon = () => (
  <IconButton
    variant="neutral"
    onPress={() => {}}
    icon={
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#233044" strokeWidth={1.6} />
        <path d="M12 8v4l3 2" stroke="#233044" strokeWidth={1.6} strokeLinecap="round" />
      </svg>
    }
  />
);
