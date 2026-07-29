// Palette adapted from the real SGS Beach / Top Spiagge desktop software:
// sandy beach canvas + teal sea-wave for the spatial views (Piantina/Griglia),
// a Bootstrap-admin teal/orange/red button language for everything else -- the brand color
// itself is teal/turquoise (matching the guest booking flow's reference design) rather than
// the earlier blue, so it now reads as one consistent color with the sea/seaDark tokens.
export const colors = {
  bg: '#F4F6F9',
  card: '#FFFFFF',
  primary: '#17A2AA',
  primaryDark: '#0E7D83',
  accent: '#F5A623',
  accentDark: '#D98C0F',
  sand: '#F2D9A6',
  sandDark: '#E8C787',
  sea: '#3FBAC2',
  seaDark: '#2E96A0',
  text: '#233044',
  textMuted: '#7C8798',
  border: '#E3E7EE',

  // Guest-app-only accent (search hero, umbrella illustration, results cards) -- a soft
  // peach/apricot, kept separate from `accent` above since that token doubles as the
  // operator side's warning/sgombera semantic color and shouldn't shift meaning here.
  peach: '#F6CC9C',
  peachDark: '#E7AD6B',
  peachBg: '#FCEBD4',

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
