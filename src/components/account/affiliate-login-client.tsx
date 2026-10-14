'use client';

import { useEffect, useRef, useState } from 'react';
import { translateVisibleText } from '@/lib/i18n/ui-phrases';
import { useApp } from '@/components/layout/providers';
import { useRouter } from 'next/navigation';
import { Card, Field } from '@/components/ui/primitives';
import { apiRequest } from '@/lib/hooks/useApi';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export function AffiliateLoginClient() {
  const { locale } = useApp();
  const tr = (value: string | undefined) => { const copy = value ?? ''; return locale === 'fa' ? translateVisibleText(copy) : copy; };
  const router = useRouter();
  const turnstileWidgetRef = useRef<string | null>(null);
  const turnstileTokenRef = useRef<string | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const turnstileSiteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  useEffect(() => {
    if (!forgotPassword || !turnstileSiteKey) return;

    let active = true;

    const renderTurnstile = () => {
      if (!active || !window.turnstile) return;

      const container = document.getElementById(
        'affiliate-forgot-turnstile',
      );

      if (!container) return;

      if (turnstileWidgetRef.current) {
        try {
          window.turnstile.remove(turnstileWidgetRef.current);
        } catch {}
        turnstileWidgetRef.current = null;
      }

      turnstileTokenRef.current = null;

      turnstileWidgetRef.current = window.turnstile.render(
        container,
        {
          sitekey: turnstileSiteKey,
          theme: 'light',
          action: 'forgot-password',
          callback: (token: string) => {
            turnstileTokenRef.current = token;
          },
          'expired-callback': () => {
            turnstileTokenRef.current = null;
          },
          'error-callback': () => {
            turnstileTokenRef.current = null;
          },
        },
      );
    };

    if (window.turnstile) {
      renderTurnstile();
    } else {
      const existing = document.querySelector(
        'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
      );

      if (!existing) {
        const script = document.createElement('script');
        script.src =
          'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        script.onload = renderTurnstile;
        document.head.appendChild(script);
      } else {
        existing.addEventListener('load', renderTurnstile, {
          once: true,
        });
      }
    }

    return () => {
      active = false;

      if (
        turnstileWidgetRef.current &&
        window.turnstile
      ) {
        try {
          window.turnstile.remove(
            turnstileWidgetRef.current,
          );
        } catch {}
      }

      turnstileWidgetRef.current = null;
      turnstileTokenRef.current = null;
    };
  }, [forgotPassword, turnstileSiteKey]);

  const submitForgotPassword = async () => {
    setBusy(true);
    setMessage(null);
    setMessageType('error');

    try {
      const email = resetEmail.trim().toLowerCase();

      if (!email || !email.includes('@')) {
        setMessage(
          'Please enter the email address used for your Affiliate account.',
        );
        setMessageType('error');
        return;
      }

      if (!turnstileSiteKey) {
        setMessage(
          'Password reset protection is not configured.',
        );
        setMessageType('error');
        return;
      }

      const turnstileToken =
        turnstileTokenRef.current;

      if (!turnstileToken) {
        setMessage(
          'Please complete the security verification.',
        );
        setMessageType('error');
        return;
      }

      await apiRequest(
        '/api/v1/auth/password-reset',
        {
          method: 'POST',
          json: { turnstileToken },
        },
      );

      const supabase =
        getSupabaseBrowserClient();

      await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            `${window.location.origin}/auth/reset-password?from=affiliate`,
        },
      );

      setMessage(
        'If an Affiliate account exists for this email, a password reset link has been sent.',
      );
      setMessageType('success');
      setResetSent(true);

      if (
        turnstileWidgetRef.current &&
        window.turnstile
      ) {
        try {
          window.turnstile.remove(
            turnstileWidgetRef.current,
          );
        } catch {}
      }

      turnstileWidgetRef.current = null;
      turnstileTokenRef.current = null;
    } catch {
      setMessage(
        'If an Affiliate account exists for this email, a password reset link has been sent.',
      );
      setMessageType('success');
      setResetSent(true);

      if (
        turnstileWidgetRef.current &&
        window.turnstile
      ) {
        try {
          window.turnstile.remove(
            turnstileWidgetRef.current,
          );
        } catch {}
      }

      turnstileWidgetRef.current = null;
      turnstileTokenRef.current = null;
    } finally {
      if (
        turnstileWidgetRef.current &&
        window.turnstile
      ) {
        try {
          window.turnstile.reset(
            turnstileWidgetRef.current,
          );
        } catch {}
      }

      turnstileTokenRef.current = null;
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setMessage(null);

    try {
      await apiRequest('/api/v1/affiliate/login', {
        method: 'POST',
        json: { username, password },
      });

      window.location.replace(
        '/affiliate/dashboard',
      );
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : 'Unable to sign in',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <section className="mb-5 overflow-hidden rounded-[24px] bg-[#071A31] p-6 text-white shadow-[0_14px_40px_rgba(7,26,49,.18)] sm:p-8">
        <div className="text-[11px] font-black tracking-[.22em] text-[#58A6FF]">
          {tr("BETVIMA AFFILIATE")}
        </div>

        <h1 className="mt-2 text-3xl font-black sm:text-4xl">
          {tr("Affiliate Login")}
        </h1>

        <p className="mt-2 max-w-xl text-sm leading-6 text-[#AFC3DA]">
          {tr("Sign in to your independent BetVima Affiliate account.")}
        </p>
      </section>

      <div className="mx-auto max-w-xl">
        <Card className="border-[#E2E8F0] bg-white text-[#172033] shadow-[0_5px_22px_rgba(15,23,42,.05)]">
          {message ? (
            <div
              className={
                messageType === 'success'
                  ? 'mb-4 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-sm font-medium text-[#15803D]'
                  : 'mb-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]'
              }
            >
              {message}
            </div>
          ) : null}

          {forgotPassword ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#DCEBFA] bg-[#F5FAFF] p-4">
                <div className="text-sm font-black text-[#172033]">
                  {tr("Reset your Affiliate password")}
                </div>

                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  Enter the email address registered to
                  your Affiliate account. We&apos;ll send
                  you a secure password reset link.
                </p>
              </div>

              <Field label="Affiliate Email">
                <input
                  className="nova-input"
                  type="email"
                  value={resetEmail}
                  onChange={(e) =>
                    setResetEmail(e.target.value)
                  }
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </Field>

              {!resetSent && turnstileSiteKey ? (
                <div
                  id="affiliate-forgot-turnstile"
                  className="flex min-h-[65px] justify-center"
                />
              ) : null}

              <button
                type="button"
                className="nova-btn-primary w-full"
                disabled={
                  busy ||
                  resetSent ||
                  !resetEmail.trim()
                }
                onClick={() =>
                  void submitForgotPassword()
                }
              >
                {busy
                  ? 'Sending reset link...'
                  : resetSent
                    ? 'Reset Link Sent'
                    : 'Send Reset Link'}
              </button>

              <button
                type="button"
                className="w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-bold text-[#475569] hover:bg-[#F8FAFC]"
                onClick={() => {
                  setForgotPassword(false);
                  setResetSent(false);
                  setMessage(null);
                  setMessageType('error');
                }}
              >
                {tr("Back to Affiliate Login")}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="Username">
                <input
                  className="nova-input"
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value.toLowerCase(),
                    )
                  }
                  autoComplete="username"
                  placeholder="your_username"
                />
              </Field>

              <Field label="Password">
                <input
                  className="nova-input"
                  type="password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  autoComplete="current-password"
                  placeholder="Your password"
                />
              </Field>

              <div className="text-right">
                <button
                  type="button"
                  className="text-sm font-bold text-[#087FF5] hover:underline"
                  onClick={() => {
                    setForgotPassword(true);
                    setResetSent(false);
                    setMessage(null);
                    setMessageType('error');
                  }}
                >
                  {tr("Forgot password?")}
                </button>
              </div>

              <button
                type="button"
                className="nova-btn-primary w-full"
                disabled={
                  busy ||
                  username.trim().length < 3 ||
                  password.length < 8
                }
                onClick={() => void submit()}
              >
                {busy ? 'Signing in...' : 'Login'}
              </button>

              <div className="text-center text-sm text-[#64748B]">
                Don&apos;t have an Affiliate account?{' '}
                <a
                  href="/affiliate/register"
                  className="font-bold text-[#087FF5] hover:underline"
                >
                  {tr("Create one")}
                </a>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
