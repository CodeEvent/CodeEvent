import React from 'react';
import { Chip, colors } from 'topspiagge-design-system';

export const TabRow = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', maxWidth: 420 }}>
    <Chip label="Oggi" selected onPress={() => {}} />
    <Chip label="Prenotazioni" onPress={() => {}} />
    <Chip label="Filtri" onPress={() => {}} />
    <Chip label="Disposizione" onPress={() => {}} />
    <Chip label="Clienti (CRM)" onPress={() => {}} />
  </div>
);

export const StatusDots = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
    <Chip label="Libero" dotColor={colors.libero} onPress={() => {}} />
    <Chip label="Occupato" dotColor={colors.occupato} onPress={() => {}} />
    <Chip label="Stagionale" dotColor={colors.prenotato} onPress={() => {}} />
  </div>
);

export const SavedPreset = () => <Chip label="Solo VIP non saldati" onPress={() => {}} />;
