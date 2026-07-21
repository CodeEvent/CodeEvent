import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppAlertProvider } from './src/components/AppAlert';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { CustomerApp } from './src/screens/customer/CustomerApp';
import { OperatorApp } from './src/screens/operator/OperatorApp';
import { OperatorAuthProvider } from './src/store/OperatorAuthContext';
import { StoreProvider } from './src/store/StoreContext';

type RootStackParamList = {
  Customer: { beachSlug?: string } | undefined;
  Operator: { beachSlug?: string } | undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

// The customer app lives at "/" (or "/:beachSlug" for a specific beach once multi-tenant) and
// the operator app at "/operator" (or "/:beachSlug/operator") -- two genuinely separate routes
// (not just an in-app mode toggle), per the requirement that the operator admin area be
// completely distinct from the customer-facing site. beachSlug is optional so today's plain
// "/" and "/operator" URLs keep working unchanged for local-only/single-beach use -- it's only
// read once Supabase is configured (see StoreContext.tsx), and even then only by the customer
// route; the operator route resolves its beach from the logged-in user's membership instead.
const linking: LinkingOptions<any> = {
  prefixes: [],
  config: {
    screens: {
      Customer: ':beachSlug?',
      Operator: {
        path: ':beachSlug?/operator',
        screens: {
          Piantina: 'Piantina',
          Griglia: 'Griglia',
          Quadro: 'Quadro',
          Conto: 'Conto',
          Statistiche: 'Statistiche',
          Archivi: 'Archivi',
        },
      },
    },
  },
};

const CustomerRoute: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const beachSlug = route.params?.beachSlug;
  return (
    <StoreProvider beachSlug={beachSlug}>
      <CustomerApp onStaffLogin={() => navigation.navigate('Operator', { beachSlug })} />
    </StoreProvider>
  );
};

const OperatorRoute: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => (
  <OperatorApp onExitToCustomer={() => navigation.navigate('Customer', { beachSlug: route.params?.beachSlug })} />
);

const RootNavigator: React.FC = () => (
  <RootStack.Navigator screenOptions={{ headerShown: false }}>
    <RootStack.Screen name="Customer" component={CustomerRoute} />
    <RootStack.Screen name="Operator" component={OperatorRoute} />
  </RootStack.Navigator>
);

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppAlertProvider>
          <OperatorAuthProvider>
            <StatusBar style="dark" />
            <NavigationContainer linking={linking}>
              <RootNavigator />
            </NavigationContainer>
          </OperatorAuthProvider>
        </AppAlertProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
