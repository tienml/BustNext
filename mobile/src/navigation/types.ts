import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Route, Stop } from '../api/client';

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  StopDetails: { stop: Stop };
  RouteDetails: { route: Route };
  JourneyPlanner: undefined;
  TripSearch: undefined;
  TripDetails: { tripId: string; title?: string; serviceDate?: string };
  Admin: undefined;
  VersionDetails: { versionId: number; datasetId: number };
  CompareVersions: { datasetId: number; baseVersionId?: number; targetVersionId?: number };
  SavedQueries: { datasetId: number };
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
