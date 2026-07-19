import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ArchiviScreen } from './src/screens/ArchiviScreen';
import { ContoScreen } from './src/screens/ContoScreen';
import { GrigliaScreen } from './src/screens/GrigliaScreen';
import { PiantinaScreen } from './src/screens/PiantinaScreen';
import { QuadroScreen } from './src/screens/QuadroScreen';
import { StatisticheScreen } from './src/screens/StatisticheScreen';
import { StoreProvider } from './src/store/StoreContext';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Piantina: 'map-outline',
  Griglia: 'grid-outline',
  Quadro: 'calendar-outline',
  Conto: 'card-outline',
  Statistiche: 'stats-chart-outline',
  Archivi: 'folder-outline',
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarActiveTintColor: colors.primary,
              tabBarInactiveTintColor: colors.textMuted,
              tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
              tabBarIcon: ({ color, size }) => (
                <Ionicons name={ICONS[route.name] ?? 'ellipse-outline'} color={color} size={size} />
              ),
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
