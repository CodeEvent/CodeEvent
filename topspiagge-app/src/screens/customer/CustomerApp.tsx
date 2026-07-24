import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Booking, Customer } from '../../types';
import { colors, spacing } from '../../theme';
import { DemoOperator } from '../../data/demoOperators';
import { CustomerBookingScreen, EditBookingContext } from './CustomerBookingScreen';
import { ManageBookingScreen } from './ManageBookingScreen';
import { SearchHomeScreen, SearchSelection } from './SearchHomeScreen';

type Tab = 'search' | 'saved' | 'bookings' | 'account';

interface Props {
  onStaffLogin: () => void;
}

// Guest-facing shell: a Booking.com-style bottom tab bar (Cerca/Salvati/Prenotazioni/Account)
// wraps the tab content, and the actual umbrella map/booking wizard is pushed as a full-screen
// overlay on top of it -- consistent with how the wizard already manages its own internal
// steps, no nested navigator needed here either (the only route that genuinely needs a
// distinct URL is /operator).
export const CustomerApp: React.FC<Props> = ({ onStaffLogin }) => {
  const [tab, setTab] = useState<Tab>('search');
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [editContext, setEditContext] = useState<EditBookingContext | null>(null);
  const [initialSelection, setInitialSelection] = useState<SearchSelection | null>(null);
  // The search flow's destination/dates/guests/results sub-steps take over the whole screen
  // (matching the reference flow), so the bottom tab bar only shows on the plain home card.
  const [searchIsHome, setSearchIsHome] = useState(true);

  const closeOverlay = () => {
    setOverlayOpen(false);
    setEditContext(null);
    setInitialSelection(null);
  };

  if (overlayOpen) {
    return (
      <CustomerBookingScreen
        editContext={editContext}
        onExitToLanding={closeOverlay}
        onManage={() => {
          closeOverlay();
          setTab('bookings');
        }}
        initialStartOffset={initialSelection?.startOffset}
        initialDays={initialSelection?.days}
        datesPreselected={!!initialSelection}
        initialAdults={initialSelection?.adults}
        initialChildren5to15={initialSelection?.children5to15}
        initialChildrenUnder5={initialSelection?.childrenUnder5}
        initialBeds={initialSelection?.beds}
        initialChairs={initialSelection?.chairs}
      />
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.flex}>
        {tab === 'search' && (
          <SearchHomeScreen
            onHomeStateChange={setSearchIsHome}
            onSelectOperator={(_operator: DemoOperator, selection: SearchSelection) => {
              setInitialSelection(selection);
              setEditContext(null);
              setOverlayOpen(true);
            }}
          />
        )}
        {tab === 'saved' && <SavedTab />}
        {tab === 'bookings' && (
          <ManageBookingScreen
            showBackLink={false}
            onBack={() => {}}
            onEdit={(bookings: Booking[], customer: Customer) => {
              setEditContext({ bookings, customer });
              setInitialSelection(null);
              setOverlayOpen(true);
            }}
          />
        )}
        {tab === 'account' && <AccountTab onStaffLogin={onStaffLogin} />}
      </View>
      {(tab !== 'search' || searchIsHome) && <GuestTabBar tab={tab} onChange={setTab} />}
    </View>
  );
};

const SavedTab: React.FC = () => (
  <View style={styles.placeholder}>
    <Ionicons name="heart-outline" size={40} color={colors.border} />
    <Text style={styles.placeholderTitle}>Nessuna spiaggia salvata</Text>
    <Text style={styles.placeholderText}>Gli stabilimenti che salvi durante la ricerca appariranno qui</Text>
  </View>
);

const AccountTab: React.FC<{ onStaffLogin: () => void }> = ({ onStaffLogin }) => (
  <View style={styles.placeholder}>
    <Ionicons name="person-circle-outline" size={48} color={colors.border} />
    <Text style={styles.placeholderTitle}>Il tuo account</Text>
    <Text style={styles.placeholderText}>Accedi alle tue prenotazioni dalla scheda "Prenotazioni"</Text>
    <Pressable onPress={onStaffLogin} style={styles.staffLink} hitSlop={8}>
      <Ionicons name="lock-closed-outline" size={12} color={colors.textMuted} />
      <Text style={styles.staffLinkText}>Sei un operatore? Accedi all'area riservata</Text>
    </Pressable>
  </View>
);

const TAB_CONFIG: Array<{ key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'search', label: 'Cerca', icon: 'search-outline' },
  { key: 'saved', label: 'Salvati', icon: 'heart-outline' },
  { key: 'bookings', label: 'Prenotazioni', icon: 'document-text-outline' },
  { key: 'account', label: 'Account', icon: 'person-outline' },
];

const GuestTabBar: React.FC<{ tab: Tab; onChange: (t: Tab) => void }> = ({ tab, onChange }) => (
  <View style={styles.tabBar}>
    {TAB_CONFIG.map((t) => {
      const focused = t.key === tab;
      return (
        <Pressable key={t.key} onPress={() => onChange(t.key)} style={styles.tabItem}>
          <Ionicons name={t.icon} size={20} color={focused ? colors.primary : colors.textMuted} />
          <Text style={[styles.tabLabel, { color: focused ? colors.primary : colors.textMuted }]}>{t.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 11, fontWeight: '700' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  placeholderTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  placeholderText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', maxWidth: 280 },
  staffLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xl,
  },
  staffLinkText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
});
