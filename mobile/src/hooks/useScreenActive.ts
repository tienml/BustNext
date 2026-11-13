import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

/** Suspend automatic work while a screen is covered or the app is backgrounded. */
export function useScreenActive() {
  const focused = useIsFocused();
  const [active, setActive] = useState(() => Platform.OS === 'web' && typeof document !== 'undefined'
    ? document.visibilityState !== 'hidden'
    : AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  return focused && active;
}
