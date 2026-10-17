'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, translate, type Locale } from '@/lib/i18n';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

interface SessionInfo {
  authenticated: boolean; authUnavailable: boolean;
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
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch('/api/v1/auth/session', {
        credentials: 'same-origin',
        signal: controller.signal,
        cache: 'no-store',
      });
      const payload = await response.json();
      if (requestId !== sessionRequestRef.current) return;
      setSession(payload?.data ?? null);
    } catch {
      if (requestId !== sessionRequestRef.current) return;
      setSession({ authenticated: false, authUnavailable: true, user: null });
    } finally {
      if (requestId !== sessionRequestRef.current) return;
      setSessionLoading(false);
      window.clearTimeout(timeout);
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
