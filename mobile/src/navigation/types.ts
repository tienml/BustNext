import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Route, Stop } from '../api/client';

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  StopDetails: { stop: Stop };
  RouteDetails: { route: Route };
  JourneyPlanner: undefined;
  TripDetails: { tripId: string; title?: string };
};

export type MainTabParamList = {
  Home: undefined;
  StopSearch: undefined;
  RouteSearch: undefined;
  Favorites: undefined;
  Account: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
