import React from 'react';
import { colors, spacing } from '../tokens';
import { CheckIcon } from '../icons';

export interface StepProgressBarProps {
  steps: string[];
  currentIndex: number;
}

export const StepProgressBar: React.FC<StepProgressBarProps> = ({ steps, currentIndex }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingLeft: spacing.lg,
      paddingRight: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    }}
  >
    {steps.map((label, i) => {
      const done = i < currentIndex;
      const current = i === currentIndex;
      return (
        <React.Fragment key={label}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 64 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                border: `2px solid ${done || current ? colors.primary : colors.border}`,
                background: done ? colors.primary : colors.card,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {done ? (
                <CheckIcon size={14} color={colors.white} />
              ) : current ? (
                <div style={{ width: 10, height: 10, borderRadius: 5, background: colors.primary }} />
              ) : null}
            </div>
            <span
              style={{
                fontSize: 10,
                marginTop: 4,
                fontWeight: done || current ? 800 : 600,
                color: done || current ? colors.primaryDark : colors.textMuted,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 64,
              }}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, marginTop: 12, background: i < currentIndex ? colors.primary : colors.border }} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);
