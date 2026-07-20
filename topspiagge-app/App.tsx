import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppAlertProvider } from './src/components/AppAlert';
import { CustomerApp } from './src/screens/customer/CustomerApp';
import { OperatorApp } from './src/screens/operator/OperatorApp';
import { OperatorAuthProvider } from './src/store/OperatorAuthContext';
import { StoreProvider } from './src/store/StoreContext';

type RootStackParamList = {
  Customer: undefined;
  Operator: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

// The customer app lives at "/" and the operator app at "/operator" -- two genuinely
// separate routes (not just an in-app mode toggle), per the requirement that the operator
// admin area be completely distinct from the customer-facing site.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [],
  config: {
    screens: {
      Customer: '',
      Operator: 'operator',
    },
  },
};

const CustomerRoute: React.FC<{ navigation: any }> = ({ navigation }) => (
  <CustomerApp onStaffLogin={() => navigation.navigate('Operator')} />
);

const OperatorRoute: React.FC<{ navigation: any }> = ({ navigation }) => (
  <OperatorApp onExitToCustomer={() => navigation.navigate('Customer')} />
);

const RootNavigator: React.FC = () => (
  <RootStack.Navigator screenOptions={{ headerShown: false }}>
    <RootStack.Screen name="Customer" component={CustomerRoute} />
    <RootStack.Screen name="Operator" component={OperatorRoute} />
  </RootStack.Navigator>
);

export default function App() {
  return (
    <SafeAreaProvider>
      <AppAlertProvider>
        <StoreProvider>
          <OperatorAuthProvider>
            <StatusBar style="dark" />
            <NavigationContainer linking={linking}>
              <RootNavigator />
            </NavigationContainer>
          </OperatorAuthProvider>
        </StoreProvider>
      </AppAlertProvider>
    </SafeAreaProvider>
  );
}
