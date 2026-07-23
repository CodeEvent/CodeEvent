import { useWindowDimensions } from 'react-native';
import { colors, radius, spacing } from '../theme';

// Shared breakpoint + styles for the "docked sidebar on laptop-or-wider, bottom sheet on
// phone" chrome used by every substantial modal/panel in the app (booking forms, detail
// views, CRM editors, filters, notifications, QR scanner...). Kept in one place so every
// screen's modal reads the same way instead of each reinventing its own breakpoint/shadow.
export const SIDEBAR_BREAKPOINT = 900;

export function useSidebarMode(): boolean {
  const { width } = useWindowDimensions();
  return width >= SIDEBAR_BREAKPOINT;
}

export const sidebarBackdrop = {
  flex: 1 as const,
  backgroundColor: 'rgba(0,0,0,0.35)',
  flexDirection: 'row' as const,
  justifyContent: 'flex-end' as const,
};

export function sidebarSheet(width: number = 460) {
  return {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
    padding: spacing.lg,
    width,
    maxWidth: '92%' as const,
    height: '100%' as const,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  };
}
