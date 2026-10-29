import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { HomeScreen } from './src/screens/HomeScreen';
import { JourneyPlannerScreen } from './src/screens/JourneyPlannerScreen';
import { RouteDetailsScreen } from './src/screens/RouteDetailsScreen';
import { RouteSearchScreen } from './src/screens/RouteSearchScreen';
import { StopDetailsScreen } from './src/screens/StopDetailsScreen';
import { StopSearchScreen } from './src/screens/StopSearchScreen';
import { TripDetailsScreen } from './src/screens/TripDetailsScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import type { MainTabParamList, RootStackParamList } from './src/navigation/types';
import { colors } from './src/theme';
import { AuthProvider } from './src/hooks/useAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tabs.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 6, borderTopColor: colors.border, backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Trang chủ', tabBarAccessibilityLabel: 'Trang chủ' }} />
      <Tabs.Screen name="StopSearch" component={StopSearchScreen} options={{ tabBarLabel: 'Tìm trạm', tabBarAccessibilityLabel: 'Tìm trạm' }} />
      <Tabs.Screen name="RouteSearch" component={RouteSearchScreen} options={{ tabBarLabel: 'Tuyến xe', tabBarAccessibilityLabel: 'Tra cứu tuyến xe' }} />
      <Tabs.Screen name="Favorites" component={FavoritesScreen} options={{ tabBarLabel: 'Yêu thích', tabBarAccessibilityLabel: 'Yêu thích' }} />
      <Tabs.Screen name="Account" component={AccountScreen} options={{ tabBarLabel: 'Tài khoản', tabBarAccessibilityLabel: 'Tài khoản' }} />
    </Tabs.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <StatusBar style="dark" />
          <Stack.Navigator
            initialRouteName="MainTabs"
            screenOptions={{
              headerTintColor: colors.ink,
              headerTitleStyle: { fontWeight: '800' },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="JourneyPlanner" component={JourneyPlannerScreen} options={{ title: 'Tìm đường' }} />
            <Stack.Screen name="StopDetails" component={StopDetailsScreen} options={{ title: 'Giờ xe' }} />
            <Stack.Screen name="RouteDetails" component={RouteDetailsScreen} options={{ title: 'Chi tiết tuyến' }} />
            <Stack.Screen name="TripDetails" component={TripDetailsScreen} options={{ title: 'Timeline chuyến' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </AuthProvider>
  );
}
