'use client';

import { requestEmailPasswordRecovery } from '@/lib/supabase/recovery-email';
import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useApp } from '@/components/layout/providers';
import { ErrorNote, Field } from '@/components/ui/primitives';
import { apiRequest } from '@/lib/hooks/useApi';
import { ServiceNotice } from '@/components/layout/service-notice';
import {
  Eye,
  EyeOff,
  LockKeyhole,
  KeyRound,
  Mail,
  ShieldCheck,
  UserPlus,
  LogIn,
  ChevronDown,
} from 'lucide-react';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      theme?: 'auto' | 'light' | 'dark';
      size?: 'normal' | 'flexible' | 'compact';
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function AuthForms({
  initialMode,
}: {
  initialMode: 'login' | 'register';
}) {
  const { t, dir, session, refreshSession } = useApp();

  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({
    email: '',
    password: '',
    referralCode: '',
    currency: 'IRR',
    ageConfirmed: false,
    acceptTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetRef = useRef<string | null>(null);

  const isLogin = mode === 'login';
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlRef = params.get('app_ref')?.trim().toUpperCase() ?? '';
      const storedRef = window.localStorage.getItem('betvima_affiliate_ref')?.trim().toUpperCase() ?? '';
      const cookieRef = document.cookie
        .split('; ')
        .find((c) => c.startsWith('nova_ref='))
        ?.split('=')[1] ?? '';

      const candidate = urlRef || storedRef || cookieRef;
      if (/^[A-Z0-9_-]{3,64}$/.test(candidate)) {
        window.localStorage.setItem('betvima_affiliate_ref', candidate);
        setForm((f) => ({
          ...f,
          referralCode: candidate,
        }));
      }
    } catch {}
  }, []);

  const submitForgotPassword = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!form.email.trim()) {
        setError(t('auth.email'));
        return;
      }
      if (!turnstileToken) {
        setError(t('auth.turnstileRequired'));
        return;
      }

      await apiRequest('/api/v1/auth/password-reset', {
        method: 'POST',
        json: {
          turnstileToken,
        },
      });

      await requestEmailPasswordRecovery(form.email.trim(), 'sportsbook');

      setNotice('If an account exists for that email, a password reset link has been sent.');
    } catch {
      setNotice('If an account exists for that email, a password reset link has been sent.');
    } finally {
      if (turnstileWidgetRef.current && window.turnstile) {
        try {
          window.turnstile.reset(turnstileWidgetRef.current);
        } catch {}
      }
      setTurnstileToken(null);
      setBusy(false);
    }
  };

  const submit = async () => {
    if (forgotPassword) {
      await submitForgotPassword();
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === 'register') {
        try {
        } catch {}

        const result = await apiRequest<{
          authenticated: boolean;
          emailConfirmationRequired: boolean;
        }>('/api/v1/auth/register', {
          method: 'POST',
          json: {
            email: form.email,
            password: form.password,
            ageConfirmed: true,
            acceptTerms: true,
            currency: form.currency,
            referralCode: form.referralCode || undefined,
            locale: 'en',
            turnstileToken,
          },
        });

        if (result.authenticated) {
          await refreshSession();
          window.location.href = '/';
          return;
        }

        setNotice(
          result.emailConfirmationRequired
            ? 'Check your email to confirm the account.'
            : 'Account created. Please sign in.',
        );
        setMode('login');
      } else {
        const result = await apiRequest('/api/v1/auth/login', {
            method: 'POST',
            json: {
              email: form.email,
              password: form.password,
              turnstileToken,
            },
          });
          await refreshSession();
          window.location.href = '/';
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('common.error'),
      );
    } finally {
      if (turnstileWidgetRef.current && window.turnstile) {
        try {
          window.turnstile.reset(turnstileWidgetRef.current);
        } catch {}
      }
      setTurnstileToken(null);
      setBusy(false);
    }
  };


  useEffect(() => {
    if (!turnstileReady || !window.turnstile || !turnstileContainerRef.current || !turnstileSiteKey) {
      return;
    }

    if (turnstileWidgetRef.current) {
      try {
        window.turnstile.remove(turnstileWidgetRef.current);
      } catch {}
      turnstileWidgetRef.current = null;
    }

    setTurnstileToken(null);

    turnstileContainerRef.current.innerHTML = '';

    turnstileWidgetRef.current = window.turnstile.render(
      turnstileContainerRef.current,
      {
        sitekey: turnstileSiteKey,
        action: forgotPassword ? 'forgot-password' : isLogin ? 'login' : 'register',
        theme: 'dark',
        size: 'flexible',
        callback: (token) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(null),
        'error-callback': () => setTurnstileToken(null),
      },
    );

    return () => {
      if (turnstileWidgetRef.current && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetRef.current);
        } catch {}
      }
      turnstileWidgetRef.current = null;
      setTurnstileToken(null);
    };
  }, [turnstileReady, isLogin, forgotPassword, turnstileSiteKey]);



  if (session?.authUnavailable) {
    return (
      <ServiceNotice
        tone="warning"
        title={t('auth.authUnavailable')}
      >
        Configure the public authentication URL and key (plus the
        server-side credential, which is never sent to the browser) to
        enable accounts. Betting, wallet and affiliate surfaces stay
        hidden until then - nothing is simulated.
      </ServiceNotice>
    );
  }

  return (
    <>
    <div className="mx-auto w-full max-w-[560px]">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setTurnstileReady(true)}
      />
      <div className="pb-5 pt-1 text-center sm:pb-6">
        <h1 className="text-[25px] font-black tracking-[-0.02em] text-white sm:text-[28px]">
          {forgotPassword ? 'Reset your password' : isLogin ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mx-auto mt-2 max-w-[420px] text-sm leading-6 text-[#91A1BA]">
          {isLogin
            ? 'Sign in to your NOVA account and continue betting'
            : 'Create your NOVA account in a few seconds'}
        </p>
      </div>

      {!forgotPassword && (
        <>
      <div className="mb-5 grid grid-cols-2 rounded-[17px] border border-[#263752] bg-[#0B1728] p-1">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setTurnstileToken(null);
            setError(null);
            setNotice(null);
            setShowPassword(false);
          }}
          className={`flex min-h-[50px] items-center justify-center gap-2 rounded-[13px] text-sm font-black transition ${
            isLogin
              ? 'bg-[#0C2630] text-[#00E07A] shadow-[inset_0_0_0_1px_rgba(0,224,122,.55)]'
              : 'text-[#8FA0B9] hover:text-white'
          }`}
        >
          <LogIn className="h-4 w-4" />
          Login
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('register');
            setTurnstileToken(null);
            setError(null);
            setNotice(null);
            setShowPassword(false);
          }}
          className={`flex min-h-[50px] items-center justify-center gap-2 rounded-[13px] text-sm font-black transition ${
            !isLogin
              ? 'bg-[#0C2630] text-[#00E07A] shadow-[inset_0_0_0_1px_rgba(0,224,122,.55)]'
              : 'text-[#8FA0B9] hover:text-white'
          }`}
        >
          <UserPlus className="h-4 w-4" />
          Register
        </button>
      </div>
        </>
      )}

      <ErrorNote message={error} retryLabel={t('common.retry')} />

      {notice ? (
        <div className="mb-4 rounded-[14px] border border-[#00E07A]/25 bg-[#00E07A]/[0.08] p-3 text-sm leading-5 text-[#00E07A]">
          {notice}
        </div>
      ) : null}

      <form dir={dir}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label={t('auth.email')}>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#91A5C2]" />
            <input
              type="email"
              autoComplete="email"
              placeholder={t("auth.emailPlaceholder")}
              className="nova-input w-full !h-[54px] !rounded-[15px] !border-[#2B4263] !bg-[#0D1B2E] !text-white !pl-12 placeholder:!text-[#7185A2] focus:!border-[#00D47A] focus:!ring-2 focus:!ring-[#00D47A]/10"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
        </Field>

        {!forgotPassword ? (
          <>
        <Field
          label={t('auth.password')}
          hint={mode === 'register' ? 'At least 8 characters' : undefined}
        >
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#91A5C2]" />
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              placeholder={mode === "register" ? t("auth.passwordMinimum") : t("auth.passwordPlaceholder")}
              minLength={mode === 'register' ? 8 : undefined}
              className="nova-input w-full !h-[54px] !rounded-[15px] !border-[#2B4263] !bg-[#0D1B2E] !text-white !pl-12 !pr-12 placeholder:!text-[#7185A2] focus:!border-[#00D47A] focus:!ring-2 focus:!ring-[#00D47A]/10"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-[#91A5C2] transition hover:bg-white/[0.05] hover:text-white"
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </Field>

            {isLogin ? (
              <div className="-mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setForgotPassword(true);
                    setTurnstileToken(null);
                    setError(null);
                    setNotice(null);
                    setShowPassword(false);
                  }}
                  className="text-sm font-semibold text-[#00D47A] transition hover:text-[#12E68B]"
                >
                  Forgot password?
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {mode === 'register' ? (
          <>
            <Field label={t("auth.accountCurrency")} hint={t("auth.accountCurrencyHint")}>
              <div className="relative">
                <select
                  className="nova-input w-full !h-[54px] !rounded-[15px] !border-[#2B4263] !bg-[#0D1B2E] !text-white appearance-none !pr-11 focus:!border-[#00D47A] focus:!ring-2 focus:!ring-[#00D47A]/10"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  required
                >
                  <option value="IRR">IRR — Iranian Rial</option><option value="USD">USD — US Dollar ($)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="GBP">GBP — British Pound (£)</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#91A5C2]" />
              </div>
            </Field>

            <Field label={t('auth.referral')}>
              <input
                className="nova-input w-full !h-[54px] !rounded-[15px] !border-[#2B4263] !bg-[#0D1B2E] !text-white placeholder:!text-[#7185A2] focus:!border-[#00D47A] focus:!ring-2 focus:!ring-[#00D47A]/10"
                placeholder={t("auth.promoPlaceholder")}
                value={form.referralCode}
                onChange={(e) => setForm({ ...form, referralCode: e.target.value.toUpperCase() })}
              />
            </Field>

            <label className="flex cursor-pointer items-start gap-3 rounded-[15px] border border-[#263752] bg-[#0B1728] p-3.5">
              <input
                type="checkbox"
                checked={form.ageConfirmed}
                onChange={(e) =>
                  setForm({
                    ...form,
                    ageConfirmed: e.target.checked,
                    acceptTerms: e.target.checked,
                  })
                }
                required
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#00E07A]"
              />
              <span className="text-xs leading-5 text-[#9AAAC0]">
                {t('auth.ageConfirm')}
              </span>
            </label>
          </>
        ) : null}

        <div className="flex w-full items-center justify-center overflow-hidden rounded-[15px] border border-[#263752] bg-[#0B1728] px-1 py-0.5">
          <div
            ref={turnstileContainerRef}
            className="flex min-h-[58px] w-[300px] max-w-full scale-[0.88] items-center justify-center"
          />
        </div>
        {!turnstileSiteKey ? (
          <p className="text-center text-xs text-[#F0A3A3]">
            Security verification is not configured.
          </p>
        ) : null}

        <button
          type="submit"
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[15px] bg-[#00D47A] px-5 text-[15px] font-black text-[#03140D] shadow-[0_10px_28px_rgba(0,212,122,.18)] transition hover:bg-[#12E68B] active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy || !turnstileToken || !turnstileReady || !turnstileSiteKey}
        >
          {busy ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {t('common.loading')}
            </>
          ) : (
            <>
              {forgotPassword ? (
                <KeyRound className="h-5 w-5" />
              ) : isLogin ? (
                <LogIn className="h-5 w-5" />
              ) : (
                <UserPlus className="h-5 w-5" />
              )}
              {forgotPassword
                ? 'Send reset link'
                : isLogin
                  ? t('auth.submitLogin')
                  : t('auth.submitRegister')}
            </>
          )}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[#91A1BA]">
        <ShieldCheck className="h-4 w-4 text-[#00E07A]" />
        <span>{t("auth.secureAuthentication")}</span>
      </div>

      {forgotPassword ? (
        <button
          type="button"
          className="mt-4 w-full pb-1 text-center text-sm text-[#91A1BA] transition hover:text-white"
          onClick={() => {
            setForgotPassword(false);
            setTurnstileToken(null);
            setError(null);
            setNotice(null);
            setShowPassword(false);
          }}
        >
          ← Back to login
        </button>
      ) : (
        <button
          type="button"
          className="mt-4 w-full pb-1 text-center text-sm text-[#91A1BA] transition hover:text-white"
          onClick={() => {
            setMode(isLogin ? 'register' : 'login');
            setTurnstileToken(null);
            setError(null);
            setNotice(null);
            setShowPassword(false);
          }}
        >
          {isLogin
            ? `${t('auth.noAccount')} ${t('nav.register')}`
            : `${t('auth.hasAccount')} ${t('nav.login')}`}
        </button>
      )}
    </div>
    </>
  );
}
