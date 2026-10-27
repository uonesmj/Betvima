'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, translate, type Locale } from '@/lib/i18n';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

interface SessionInfo {
  authenticated: boolean; authUnavailable: boolean;
  /** Transport/API errors are NOT evidence that the auth backend is unconfigured. */
  sessionCheckFailed?: boolean;
  user: { id: string; email: string | null; role: string; currency: string; locale: Locale; isAdmin: boolean; permissions: string[]; affiliateId: string | null; mfaEnrolled?: boolean; mfaLevel?: 'aal1' | 'aal2' } | null;
}

interface AppContextValue {
  locale: Locale; setLocale: (locale: Locale) => void; dir: 'ltr' | 'rtl';
  t: (key: string, vars?: Record<string, string | number>) => string;
  session: SessionInfo | null; sessionLoading: boolean; refreshSession: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProviders({ children, initialLocale = DEFAULT_LOCALE }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale === 'fa' ? 'fa' : DEFAULT_LOCALE);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const sessionRequestRef = useRef(0);

  const refreshSession = useCallback(async () => {
    const requestId = ++sessionRequestRef.current;
    const controller = new AbortController();
    // Auth session verification requires upstream Supabase + profile DB reads.
    // A slow request must not be misreported as missing authentication config.
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/v1/auth/session', {
        credentials: 'same-origin',
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('SESSION_HTTP_UNAVAILABLE');
      const payload = await response.json() as { ok?: boolean; data?: SessionInfo };
      if (payload?.ok !== true || typeof payload?.data?.authenticated !== 'boolean'
        || typeof payload?.data?.authUnavailable !== 'boolean') {
        throw new Error('SESSION_INVALID_RESPONSE');
      }
      if (requestId !== sessionRequestRef.current) return;
      setSession({ ...payload.data, sessionCheckFailed: false });
    } catch {
      if (requestId !== sessionRequestRef.current) return;
      // Fail closed: no admin permissions or user identity are inferred on error.
      // Only an explicit, successful server reply may signal authUnavailable.
      setSession({ authenticated: false, authUnavailable: false, sessionCheckFailed: true, user: null });
    } finally {
      window.clearTimeout(timeout);
      if (requestId === sessionRequestRef.current) setSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    setHydrated(true);
    try {
      const stored = window.localStorage.getItem('nova-locale');
      if (stored === 'fa' || stored === 'en') {
        setLocaleState(stored);
      } else {
        setLocaleState(initialLocale === 'fa' ? 'fa' : DEFAULT_LOCALE);
      }
    } catch {
      setLocaleState(initialLocale === 'fa' ? 'fa' : DEFAULT_LOCALE);
    }
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    // The password reset route accepts implicit recovery tokens from email.
    // Initializing the shared PKCE browser client there can consume/reject
    // those tokens before the isolated recovery form has verified them.
    if (window.location.pathname === '/auth/reset-password') return;
    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase.auth.onAuthStateChange(() => {
        void refreshSession();
      });
      subscription = data.subscription;
    } catch {
      /* Server-side session endpoint remains the auth source of truth. */
    }
    return () => {
      subscription?.unsubscribe();
    };
  }, [refreshSession]);
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem('nova-locale', next);
    } catch { /* ignore storage failures */ }
    document.documentElement.lang = next;
    document.documentElement.dir = 'ltr';
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
  }, [locale]);

  const value = useMemo<AppContextValue>(() => ({
    locale, setLocale, dir: 'ltr',
    t: (key, vars) => translate(locale, key, vars),
    session: hydrated ? session : null,
    sessionLoading: hydrated ? sessionLoading : true,
    refreshSession,
  }), [locale, setLocale, session, sessionLoading, hydrated, refreshSession]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProviders');
  return context;
}

export function useT() {
  return useApp().t;
}
