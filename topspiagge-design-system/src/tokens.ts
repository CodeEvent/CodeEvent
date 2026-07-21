// Ported verbatim from topspiagge-app/src/theme/index.ts and
// topspiagge-app/src/utils/displayStatus.ts — keep both in sync by hand,
// there is no build-time link between the two packages.
export const colors = {
  bg: '#F4F6F9',
  card: '#FFFFFF',
  primary: '#2B9CDB',
  primaryDark: '#1D7FB8',
  accent: '#F5A623',
  accentDark: '#D98C0F',
  sand: '#F2D9A6',
  sandDark: '#E8C787',
  sea: '#3FBAC2',
  seaDark: '#2E96A0',
  text: '#233044',
  textMuted: '#7C8798',
  border: '#E3E7EE',

  danger: '#E63946',
  success: '#2FB380',
  info: '#29C5E6',
  warning: '#F5A623',

  libero: '#2ECC8F',
  liberoBg: '#E1F9EF',
  occupato: '#F1543F',
  occupatoBg: '#FDE7E4',
  in_arrivo: '#FFB020',
  in_arrivoBg: '#FFF3DC',
  prenotato: '#7C93F0',
  prenotatoBg: '#EAEEFE',
  sgombera: '#F5A623',
  sgomberaBg: '#FDF1DC',

  white: '#FFFFFF',
  black: '#000000',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
} as const;

export type DisplayStatus = 'libero' | 'occupato' | 'da_saldare' | 'sgombera' | 'stagionale';

export const displayStatusColor: Record<DisplayStatus, string> = {
  libero: colors.libero,
  occupato: colors.occupato,
  da_saldare: colors.black,
  sgombera: colors.sgombera,
  stagionale: colors.prenotato,
};

export const displayStatusBg: Record<DisplayStatus, string> = {
  libero: colors.liberoBg,
  occupato: colors.occupatoBg,
  da_saldare: '#E5E6E8',
  sgombera: colors.sgomberaBg,
  stagionale: colors.prenotatoBg,
};

export const displayStatusLabel: Record<DisplayStatus, string> = {
  libero: 'Libero',
  occupato: 'Occupato',
  da_saldare: 'Da saldare',
  sgombera: 'Sgombera',
  stagionale: 'Stagionale',
};
