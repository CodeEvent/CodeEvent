import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArchiviScreen } from '../ArchiviScreen';
import { ContoScreen } from '../ContoScreen';
import { PiantinaScreen } from '../PiantinaScreen';
import { QuadroScreen } from '../QuadroScreen';
import { StatisticheScreen } from '../StatisticheScreen';
import { NotificationCenter } from '../../components/NotificationCenter';
import { QRScannerModal } from '../../components/QRScannerModal';
import { useOperatorAuth } from '../../store/OperatorAuthContext';
import { StoreProvider } from '../../store/StoreContext';
import { colors, radius, spacing } from '../../theme';
import { OperatorLoginScreen } from './OperatorLoginScreen';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Piantina: 'location-outline',
  Quadro: 'reorder-four-outline',
  Conto: 'card-outline',
  Statistiche: 'stats-chart-outline',
  Archivi: 'folder-outline',
};

const TabIcon: React.FC<{ routeName: string; focused: boolean }> = ({ routeName, focused }) => (
  <View style={[styles.tabChip, focused && styles.tabChipActive]}>
    <Ionicons
      name={ICONS[routeName] ?? 'ellipse-outline'}
      size={18}
      color={focused ? colors.white : colors.primary}
    />
    <Text style={[styles.tabLabel, { color: focused ? colors.white : colors.textMuted }]} numberOfLines={1}>
      {routeName}
    </Text>
  </View>
);

const StaffTabs: React.FC = () => {
  const [scannerOpen, setScannerOpen] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: styles.tabBar,
          tabBarIcon: ({ focused }) => <TabIcon routeName={route.name} focused={focused} />,
        })}
      >
        <Tab.Screen name="Piantina" component={PiantinaScreen} />
        <Tab.Screen name="Quadro" component={QuadroScreen} />
        <Tab.Screen name="Conto" component={ContoScreen} />
        <Tab.Screen name="Statistiche" component={StatisticheScreen} />
        <Tab.Screen name="Archivi" component={ArchiviScreen} />
      </Tab.Navigator>
      <Pressable style={styles.scanBtn} onPress={() => setScannerOpen(true)}>
        <Ionicons name="qr-code-outline" size={22} color={colors.primaryDark} />
      </Pressable>
      <NotificationCenter />
      <QRScannerModal visible={scannerOpen} onClose={() => setScannerOpen(false)} />
    </View>
  );
};

interface Props {
  onExitToCustomer: () => void;
}

// Everything staff-facing lives at the /operator route, gated by a real login (persisted until
// logout) -- a completely separate area from the customer-facing app, not just an in-app mode
// toggle. StoreProvider is mounted here, not at the app root, so it only exists once an operator
// is actually logged in -- that way it always resolves its beach_id from a session that's
// already established (see StoreContext.tsx's initial-load effect), and remounts fresh with a
// clean resolution on every new login rather than needing its own separate auth-change listener.
export const OperatorApp: React.FC<Props> = ({ onExitToCustomer }) => {
  const { isLoggedIn, isHydrating } = useOperatorAuth();
  if (isHydrating) return null;
  if (!isLoggedIn) return <OperatorLoginScreen onExitToCustomer={onExitToCustomer} />;
  return (
    <StoreProvider>
      <StaffTabs />
    </StoreProvider>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    height: 72,
    paddingTop: 6,
  },
  tabChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    minWidth: 64,
    gap: 2,
  },
  tabChipActive: {
    backgroundColor: colors.accent,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  scanBtn: {
    position: 'absolute',
    // Sits below spacing.xl + a typical per-screen header row (title + a filter/legend
    // pill), not overlapping it -- previously both this and the bell sat at spacing.xl,
    // which visually collided with Piantina/Quadro's own "Filtri" toggle on phone widths.
    top: spacing.xl + 32,
    right: spacing.lg + 52,
    zIndex: 50,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
});
