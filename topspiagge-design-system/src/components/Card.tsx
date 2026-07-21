import React from 'react';
import { colors, radius, spacing } from '../tokens';

export interface CardProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, style }) => (
  <div
    style={{
      background: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      ...style,
    }}
  >
    {children}
  </div>
);
