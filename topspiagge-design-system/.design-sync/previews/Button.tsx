import React from 'react';
import { Button } from 'topspiagge-design-system';

export const Primary = () => <Button title="Registra" variant="success" icon={<span>✓</span>} onPress={() => {}} />;

export const Secondary = () => <Button title="+ Aggiungi" variant="secondary" onPress={() => {}} />;

export const Danger = () => <Button title="Elimina ombrellone" variant="danger" onPress={() => {}} />;

export const Ghost = () => <Button title="Chiudi" variant="ghost" onPress={() => {}} />;

export const InfoMuted = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <Button title="Stampa" variant="info" icon={<span>🖶</span>} onPress={() => {}} />
    <Button title="Annulla" variant="muted" onPress={() => {}} />
  </div>
);

export const LoadingAndDisabled = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <Button title="Salvataggio…" variant="primary" loading onPress={() => {}} />
    <Button title="Non disponibile" variant="primary" disabled onPress={() => {}} />
  </div>
);
