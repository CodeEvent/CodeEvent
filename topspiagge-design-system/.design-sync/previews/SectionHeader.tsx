import React from 'react';
import { SectionHeader } from 'topspiagge-design-system';

export const WithSubtitle = () => (
  <SectionHeader title="Il Conto" subtitle="Cassa veloce: articoli, acconti, saldo e split" />
);

export const Archivi = () => (
  <SectionHeader title="Archivi" subtitle="Prenotazioni, listini, clienti e articoli su misura per il tuo lido" />
);

export const TitleOnly = () => <SectionHeader title="Clienti (CRM)" />;
