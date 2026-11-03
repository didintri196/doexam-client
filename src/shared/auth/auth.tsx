import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { authApi } from '@/shared/api/auth';
import { tokenStore } from '@/shared/api/client';
import type { Me } from '@/shared/api/types';
import { setTimeZone } from '@/shared/lib/format';
import { Loading } from '@/shared/ui';

/** UNAUTHORIZED_EVENT is dispatched by the API client when a token is rejected (401). */
export const UNAUTHORIZED_EVENT = 'doexam:unauthorized';

type Status = 'loading' | 'anon' | 'ready';
interface AuthState {
  me: Me | null;
  status: Status;
  login: (username: string, password: string, tenant?: string) => Promise<Me>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * AuthProvider keeps the session of one entry. accept() returns an error message when a
 * signed-in account does not belong in this entry (e.g. a pure participant in the panel);
 * such a login is undone right away.
 */
export function AuthProvider({ accept, children }: { accept: (me: Me) => string | null; children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<Status>(tokenStore.get() ? 'loading' : 'anon');

  const loadTimeZone = useCallback(() => {
    authApi.tenant().then((t) => setTimeZone(t.settings.timezone), () => {});
  }, []);

  const refresh = useCallback(async () => {
    const m = await authApi.me();
    setMe(m);
    setStatus('ready');
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) return;
    authApi.me().then(
      (m) => {
        if (accept(m)) {
          tokenStore.clear();
          setStatus('anon');
          return;
        }
        setMe(m);
        setStatus('ready');
        loadTimeZone();
      },
      () => {
        // offline with a stored token: keep it, the exam client works from its local copy
        setStatus(tokenStore.get() ? 'ready' : 'anon');
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setMe(null);
      setStatus('anon');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = useCallback(
    async (username: string, password: string, tenant?: string) => {
      const res = await authApi.login(username, password, tenant);
      tokenStore.set(res.token);
      const rejected = accept(res.user);
      if (rejected) {
        await authApi.logout().catch(() => {});
        tokenStore.clear();
        throw new Error(rejected);
      }
      setMe(res.user);
      setStatus('ready');
      loadTimeZone();
      return res.user;
    },
    [accept, loadTimeZone],
  );

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    tokenStore.clear();
    setMe(null);
    setStatus('anon');
  }, []);

  return <AuthContext.Provider value={{ me, status, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

/** RequireAuth guards routes: login first, then a forced password change. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, status } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <Loading />;
  if (status === 'anon') return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (me?.must_change_password && loc.pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}
