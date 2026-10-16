import React from 'react';
import { Card, StatusPill, Button, colors, spacing } from 'topspiagge-design-system';

export const BookingSummary = () => (
  <Card style={{ maxWidth: 340 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontWeight: 700, color: colors.text, fontSize: 15 }}>Rossi Marco — Fila 2 #7</span>
      <StatusPill status="occupato" />
    </div>
    <div style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.md }}>
      12/07/2026 → 19/07/2026 · 2 adulti, 1 bambino
    </div>
    <Button title="Vai al Conto" onPress={() => {}} />
  </Card>
);

export const EmptyState = () => (
  <Card style={{ alignItems: 'center', padding: 24, textAlign: 'center', maxWidth: 320 }}>
    <div style={{ color: colors.text, fontWeight: 700, marginBottom: 4 }}>Nessuna fila ancora</div>
    <div style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.md }}>
      Inizia a costruire la disposizione del tuo lido aggiungendo la prima fila di ombrelloni.
    </div>
    <Button title="Aggiungi la prima fila" onPress={() => {}} />
  </Card>
);

export const PlainContent = () => (
  <Card>
    <div style={{ color: colors.text, fontSize: 14 }}>
      Il Conto — cassa veloce: articoli, acconti, saldo e split.
    </div>
  </Card>
);
