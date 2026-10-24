import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { StopDetailsScreen } from './src/screens/StopDetailsScreen';
import { StopSearchScreen } from './src/screens/StopSearchScreen';
import type { RootStackParamList } from './src/navigation/types';

const queryClient = new QueryClient();
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator
          initialRouteName="StopSearch"
          screenOptions={{
            headerTintColor: '#102A43',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: '#F5F7FA' },
          }}
        >
          <Stack.Screen
            name="StopSearch"
            component={StopSearchScreen}
            options={{ title: 'Tìm trạm' }}
          />
          <Stack.Screen
            name="StopDetails"
            component={StopDetailsScreen}
            options={{ title: 'Giờ xe' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}
