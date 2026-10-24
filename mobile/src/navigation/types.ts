import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Stop } from '../api/client';

export type RootStackParamList = {
  StopSearch: NavigatorScreenParams<never> | undefined;
  StopDetails: { stop: Stop };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
