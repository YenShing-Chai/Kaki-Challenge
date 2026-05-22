/**
 * Home-grown auth context. Replaces @clerk/clerk-expo.
 *
 * Stores a JWT in expo-secure-store. Exposes drop-in hooks (`useAuth`,
 * `useUser`) shaped like Clerk's so the rest of the app doesn't have to know
 * we changed providers.
 */

import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { apiRequest } from './api';

const TOKEN_KEY = 'dae.authToken';

/**
 * Platform-safe token storage.
 * - Native (iOS/Android via Expo Go or dev client): real Keychain via SecureStore.
 * - Web: localStorage. Not as secure but the only viable option in the browser,
 *   and good enough for our staging/dev use of `expo start --web`.
 */
const storage = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async set(value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(TOKEN_KEY, value);
      } catch {
        /* best-effort */
      }
      return;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, value);
  },
  async remove(): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.removeItem(TOKEN_KEY);
      } catch {
        /* best-effort */
      }
      return;
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  timezone: string;
  hasCompletedOnboarding: boolean;
  createdAt: string;
};

type SignInResponse = { token: string; user: AuthUser };

type AuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AuthUser | null;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Returns the latest token (or null) — async to match Clerk's signature. */
  getToken: () => Promise<string | null>;
  /** Refresh the cached user record from /users/me. */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // On mount: restore token from storage, then fetch user.
  useEffect(() => {
    (async () => {
      try {
        const stored = await storage.get();
        if (stored) {
          setToken(stored);
          try {
            const { user: u } = await apiRequest<{ user: AuthUser | null }>('/users/me', {
              token: stored,
            });
            if (u) setUser(u);
            else {
              // Token is bad / user deleted — clear it.
              await storage.remove();
              setToken(null);
            }
          } catch {
            await storage.remove();
            setToken(null);
          }
        }
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next: SignInResponse) => {
    await storage.set(next.token);
    setToken(next.token);
    setUser(next.user);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await apiRequest<SignInResponse>('/auth/signin', {
        method: 'POST',
        body: { email, password },
      });
      await persist(res);
    },
    [persist],
  );

  const signUp = useCallback(
    async (email: string, password: string, name?: string) => {
      const res = await apiRequest<SignInResponse>('/auth/signup', {
        method: 'POST',
        body: { email, password, ...(name ? { name } : {}) },
      });
      await persist(res);
    },
    [persist],
  );

  const signOut = useCallback(async () => {
    await storage.remove();
    setToken(null);
    setUser(null);
  }, []);

  const getToken = useCallback(async () => token, [token]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const { user: u } = await apiRequest<{ user: AuthUser | null }>('/users/me', { token });
      if (u) setUser(u);
    } catch {
      // best-effort
    }
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoaded,
      isSignedIn: !!token && !!user,
      user,
      token,
      signIn,
      signUp,
      signOut,
      getToken,
      refreshUser,
    }),
    [isLoaded, token, user, signIn, signUp, signOut, getToken, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

/**
 * Clerk-compatibility shim. Some screens import `useUser` from Clerk and
 * destructure `{ user }`. Expose the same shape here so we don't have to
 * touch every callsite.
 */
export function useUser(): { user: AuthUser | null; isLoaded: boolean } {
  const { user, isLoaded } = useAuth();
  return { user, isLoaded };
}
