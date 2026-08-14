import React from 'react';
import { colors, spacing } from '../tokens';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle }) => (
  <div style={{ marginBottom: spacing.md }}>
    <div style={{ fontSize: 20, fontWeight: 700, color: colors.text }}>{title}</div>
    {subtitle ? (
      <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{subtitle}</div>
    ) : null}
  </div>
);
