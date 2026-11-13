import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { JourneyPlannerScreen } from './src/screens/JourneyPlannerScreen';
import { RouteDetailsScreen } from './src/screens/RouteDetailsScreen';
import { RouteSearchScreen } from './src/screens/RouteSearchScreen';
import { StopDetailsScreen } from './src/screens/StopDetailsScreen';
import { StopSearchScreen } from './src/screens/StopSearchScreen';
import { TripDetailsScreen } from './src/screens/TripDetailsScreen';
import { TripSearchScreen } from './src/screens/TripSearchScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import { AdminScreen } from './src/screens/AdminScreen';
import { VersionDetailsScreen } from './src/screens/VersionDetailsScreen';
import { CompareVersionsScreen } from './src/screens/CompareVersionsScreen';
import { SavedQueriesScreen } from './src/screens/SavedQueriesScreen';
import type { MainTabParamList, RootStackParamList } from './src/navigation/types';
import { useTheme } from './src/theme';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import type { IconName } from './src/components/ui';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, [IconName, IconName]> = {
  Home: ['home', 'home-outline'],
  StopSearch: ['location', 'location-outline'],
  RouteSearch: ['bus', 'bus-outline'],
  Favorites: ['heart', 'heart-outline'],
  Account: ['person-circle', 'person-circle-outline'],
};

/** Admin screens exist only for admin accounts; passengers never see them. */
function useIsAdmin() {
  const { user } = useAuth();
  return user?.role === 'admin';
}

function MainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs.Navigator
      initialRouteName="Home"
      screenLayout={({ children }) => (
        // Tabs have no native header. The tab bar owns the bottom safe area.
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
          {children}
        </SafeAreaView>
      )}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarStyle: { minHeight: 64 + insets.bottom, paddingBottom: Math.max(insets.bottom, 8), paddingTop: 6, borderTopColor: colors.border, backgroundColor: colors.surface },
        tabBarItemStyle: { minHeight: 48 },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = TAB_ICONS[route.name];
          return <Ionicons name={focused ? active : inactive} size={size - 2} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Trang chủ', tabBarAccessibilityLabel: 'Trang chủ' }} />
      <Tabs.Screen name="StopSearch" component={StopSearchScreen} options={{ tabBarLabel: 'Tìm trạm', tabBarAccessibilityLabel: 'Tìm trạm' }} />
      <Tabs.Screen name="RouteSearch" component={RouteSearchScreen} options={{ tabBarLabel: 'Tuyến xe', tabBarAccessibilityLabel: 'Tra cứu tuyến xe' }} />
      <Tabs.Screen name="Favorites" component={FavoritesScreen} options={{ tabBarLabel: 'Yêu thích', tabBarAccessibilityLabel: 'Yêu thích' }} />
      <Tabs.Screen name="Account" component={AccountScreen} options={{ tabBarLabel: 'Tài khoản', tabBarAccessibilityLabel: 'Tài khoản' }} />
    </Tabs.Navigator>
  );
}

function RootNavigator() {
  const { colors, dark } = useTheme();
  const { token } = useAuth();
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();

  // Admin data was fetched with the previous account's token; drop it.
  useEffect(() => {
    queryClient.removeQueries({ queryKey: ['admin'] });
  }, [queryClient, token]);
  const navTheme = useMemo<Theme>(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.ink,
        border: colors.border,
      },
    };
  }, [colors, dark]);

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          headerTintColor: colors.ink,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontWeight: '800' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="JourneyPlanner" component={JourneyPlannerScreen} options={{ title: 'Tìm đường' }} />
        <Stack.Screen name="StopDetails" component={StopDetailsScreen} options={{ title: 'Giờ xe' }} />
        <Stack.Screen name="RouteDetails" component={RouteDetailsScreen} options={{ title: 'Chi tiết tuyến' }} />
        <Stack.Screen name="TripSearch" component={TripSearchScreen} options={{ title: 'Tra cứu chuyến' }} />
        <Stack.Screen name="TripDetails" component={TripDetailsScreen} options={{ title: 'Lộ trình chuyến' }} />
        {isAdmin ? (
          <Stack.Group>
            <Stack.Screen name="Admin" component={AdminScreen} options={{ title: 'Quản lý dữ liệu' }} />
            <Stack.Screen name="VersionDetails" component={VersionDetailsScreen} options={{ title: 'Chi tiết phiên bản' }} />
            <Stack.Screen name="CompareVersions" component={CompareVersionsScreen} options={{ title: 'So sánh phiên bản' }} />
            <Stack.Screen name="SavedQueries" component={SavedQueriesScreen} options={{ title: 'Truy vấn mẫu' }} />
          </Stack.Group>
        ) : null}
      </Stack.Navigator>
    </NavigationContainer>
  );
}


export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <RootNavigator />
        </QueryClientProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
