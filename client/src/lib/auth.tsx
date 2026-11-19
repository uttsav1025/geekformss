import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, refreshSession, setSessionLostHandler, tokenStore } from './api';
import type { AuthSession, User } from '../types/api';

export type AuthMode = 'login' | 'register';
export interface Credentials {
  email: string;
  password: string;
  name?: string;
}

interface AuthValue {
  user: User | null;
  loading: boolean;
  authenticate: (mode: AuthMode, payload: Credentials) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * On load the app has no access token (memory only), so it asks the server to
 * refresh using the httpOnly cookie. Success = still signed in; failure = show login.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setSessionLostHandler(clear);
    refreshSession()
      .then((d) => setUser(d.user))
      .catch(() => clear())
      .finally(() => setLoading(false));
  }, [clear]);

  const authenticate = useCallback(async (mode: AuthMode, payload: Credentials) => {
    const d = await api.post<AuthSession>(`/auth/${mode}`, payload, { anonymous: true });
    tokenStore.set(d.accessToken);
    setUser(d.user);
    return d.user;
  }, []);

  // Revoke the refresh token server-side (whole rotation family), then forget locally.
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', undefined, { anonymous: true });
    } catch {
      /* offline: the cookie still expires on its own */
    }
    clear();
  }, [clear]);

  const value = useMemo(() => ({ user, loading, authenticate, logout }), [user, loading, authenticate, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
