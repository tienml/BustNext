import { createContext, createElement, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient, type User } from '../api/client';
import { deleteStoredToken, getStoredToken, setStoredToken } from '../utils/tokenStorage';

const TOKEN_KEY = 'busnext_access_token';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, confirmation: string) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const savedToken = await getStoredToken(TOKEN_KEY);
    if (!savedToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.withToken(savedToken).me();
      setUser(response.data);
      setToken(savedToken);
    } catch {
      await deleteStoredToken(TOKEN_KEY);
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await apiClient.login(email, password);
    await setStoredToken(TOKEN_KEY, response.data.token);
    setUser(response.data.user);
    setToken(response.data.token);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string, confirmation: string) => {
    const response = await apiClient.register(name, email, password, confirmation);
    await setStoredToken(TOKEN_KEY, response.data.token);
    setUser(response.data.user);
    setToken(response.data.token);
  }, []);

  const signOut = useCallback(async () => {
    if (token) {
      try {
        await apiClient.withToken(token).logout();
      } catch {
        // Local credentials are cleared even when the network is unavailable.
      }
    }
    await deleteStoredToken(TOKEN_KEY);
    setUser(null);
    setToken(null);
  }, [token]);

  const value = useMemo(() => ({ user, token, loading, signIn, signUp, signOut, reload }), [user, token, loading, signIn, signUp, signOut, reload]);
  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
