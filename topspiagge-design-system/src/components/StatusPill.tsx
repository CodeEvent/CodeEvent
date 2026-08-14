import React from 'react';
import { DisplayStatus, displayStatusBg, displayStatusColor, displayStatusLabel } from '../tokens';

export interface StatusPillProps {
  status: DisplayStatus;
  /** Overlays a small ring on the dot and appends "· Da saldare" to the label. */
  unpaid?: boolean;
}

// The operator screens (Piantina, Griglia, Quadro, Conto, Archivi) all use this merged
// occupancy language instead of the raw booking status, so a cell's color always matches
// what its detail view shows. `unpaid` layers a payment flag on top of the real occupancy
// color rather than replacing it, except when the status already IS 'da_saldare'.
export const StatusPill: React.FC<StatusPillProps> = ({ status, unpaid }) => {
  const showsUnpaidSuffix = unpaid && status !== 'da_saldare';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderRadius: 24,
        background: displayStatusBg[status],
      }}
    >
      <div style={{ position: 'relative', width: 8, height: 8, marginRight: 6 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: displayStatusColor[status],
          }}
        />
        {showsUnpaidSuffix && (
          <div
            style={{
              position: 'absolute',
              top: -2,
              left: -2,
              width: 12,
              height: 12,
              borderRadius: 6,
              border: '1.5px solid #000000',
              boxSizing: 'border-box',
            }}
          />
        )}
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: displayStatusColor[status] }}>
        {displayStatusLabel[status]}
        {showsUnpaidSuffix ? ' · Da saldare' : ''}
      </span>
    </div>
  );
};
