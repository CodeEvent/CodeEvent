import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ArchiviScreen } from './src/screens/ArchiviScreen';
import { ContoScreen } from './src/screens/ContoScreen';
import { GrigliaScreen } from './src/screens/GrigliaScreen';
import { PiantinaScreen } from './src/screens/PiantinaScreen';
import { QuadroScreen } from './src/screens/QuadroScreen';
import { StatisticheScreen } from './src/screens/StatisticheScreen';
import { StoreProvider } from './src/store/StoreContext';
import { colors, radius, spacing } from './src/theme';

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

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
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
        </NavigationContainer>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

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
