import React from 'react';
import { StatusPill } from 'topspiagge-design-system';

export const AllStatuses = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
    <StatusPill status="libero" />
    <StatusPill status="occupato" />
    <StatusPill status="sgombera" />
    <StatusPill status="stagionale" />
    <StatusPill status="da_saldare" />
  </div>
);

export const UnpaidOverlay = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <StatusPill status="occupato" unpaid />
    <StatusPill status="stagionale" unpaid />
  </div>
);
