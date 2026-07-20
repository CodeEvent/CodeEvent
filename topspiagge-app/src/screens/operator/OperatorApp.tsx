import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArchiviScreen } from '../ArchiviScreen';
import { ContoScreen } from '../ContoScreen';
import { GrigliaScreen } from '../GrigliaScreen';
import { PiantinaScreen } from '../PiantinaScreen';
import { QuadroScreen } from '../QuadroScreen';
import { StatisticheScreen } from '../StatisticheScreen';
import { useOperatorAuth } from '../../store/OperatorAuthContext';
import { colors, radius, spacing } from '../../theme';
import { OperatorLoginScreen } from './OperatorLoginScreen';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Piantina: 'location-outline',
  Griglia: 'grid-outline',
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

const StaffTabs: React.FC = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarShowLabel: false,
      tabBarStyle: styles.tabBar,
      tabBarIcon: ({ focused }) => <TabIcon routeName={route.name} focused={focused} />,
    })}
  >
    <Tab.Screen name="Piantina" component={PiantinaScreen} />
    <Tab.Screen name="Griglia" component={GrigliaScreen} />
    <Tab.Screen name="Quadro" component={QuadroScreen} />
    <Tab.Screen name="Conto" component={ContoScreen} />
    <Tab.Screen name="Statistiche" component={StatisticheScreen} />
    <Tab.Screen name="Archivi" component={ArchiviScreen} />
  </Tab.Navigator>
);

interface Props {
  onExitToCustomer: () => void;
}

// Everything staff-facing lives at the /operator route, gated by its own admin/admin login
// (persisted until logout) -- a completely separate area from the customer-facing app, not
// just an in-app mode toggle.
export const OperatorApp: React.FC<Props> = ({ onExitToCustomer }) => {
  const { isLoggedIn, isHydrating } = useOperatorAuth();
  if (isHydrating) return null;
  if (!isLoggedIn) return <OperatorLoginScreen onExitToCustomer={onExitToCustomer} />;
  return <StaffTabs />;
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
});
