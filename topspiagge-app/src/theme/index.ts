export const colors = {
  bg: '#F5F1E8',
  card: '#FFFFFF',
  primary: '#0E7C7B',
  primaryDark: '#0A5C5B',
  accent: '#F2A65A',
  sand: '#EAD9B8',
  text: '#1E2A2B',
  textMuted: '#6B7A7B',
  border: '#E1D9C8',

  libero: '#3FB88A',
  liberoBg: '#E4F7EE',
  occupato: '#E4573D',
  occupatoBg: '#FCE7E3',
  in_arrivo: '#F2A65A',
  in_arrivoBg: '#FDF0DE',
  prenotato: '#4A8FE7',
  prenotatoBg: '#E7F0FD',

  white: '#FFFFFF',
  black: '#000000',
};

export const statusColor: Record<string, string> = {
  libero: colors.libero,
  occupato: colors.occupato,
  in_arrivo: colors.in_arrivo,
  prenotato: colors.prenotato,
};

export const statusBg: Record<string, string> = {
  libero: colors.liberoBg,
  occupato: colors.occupatoBg,
  in_arrivo: colors.in_arrivoBg,
  prenotato: colors.prenotatoBg,
};

export const statusLabel: Record<string, string> = {
  libero: 'Libero',
  occupato: 'Occupato',
  in_arrivo: 'In arrivo',
  prenotato: 'Prenotato',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
};
