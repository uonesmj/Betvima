'use client';

import { useApp } from '@/components/layout/providers';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { clearedPasswordRecoveryPath, parsePasswordRecoveryGrant } from '@/lib/auth/password-recovery';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, KeyRound, LockKeyhole, CheckCircle2 } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function ResetPasswordPage() {
  const { t, dir } = useApp();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'complete'>('checking');
  const checkPromise = useRef<Promise<void> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // The browser may already be signed into a DIFFERENT account. Only
    // one-use recovery credentials from the emailed link grant permission.
    // Keep one shared promise because React Strict Mode replays effects.
    if (!checkPromise.current) {
      checkPromise.current = (async () => {
        const grant = parsePasswordRecoveryGrant(window.location.href);
        if (grant.kind === 'invalid') {
          throw new Error('This reset link is invalid or has expired. Request a new link.');
        }

        const supabase = getSupabaseBrowserClient();
        try {
          if (grant.kind === 'tokens') {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: grant.accessToken,
              refresh_token: grant.refreshToken,
            });
            if (sessionError) throw sessionError;
          } else if (grant.kind === 'code') {
            const { error: exchangeError } =
              await supabase.auth.exchangeCodeForSession(grant.code);
            if (exchangeError) throw exchangeError;
          } else {
            const { error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: grant.tokenHash,
              type: 'recovery',
            });
            if (verifyError) throw verifyError;
          }

          // An exchange can finish without a usable local session (notably
          // in an email client's in-app browser). Do not show a password form
          // in that case. getUser validates the session against Supabase.
          const { data: sessionResult, error: sessionError } =
            await supabase.auth.getSession();
          if (sessionError || !sessionResult.session?.access_token) {
            throw new Error('Recovery session missing.');
          }
          const { data: userResult, error: userError } =
            await supabase.auth.getUser();
          if (userError || !userResult.user ||
              userResult.user.id !== sessionResult.session.user.id) {
            throw new Error('Recovery session could not be verified.');
          }
        } finally {
          // Never leave access or refresh tokens in browser history.
          window.history.replaceState(
            {}, document.title, clearedPasswordRecoveryPath(window.location.href),
          );
        }
      })();
    }

    let mounted = true;
    void checkPromise.current.then(() => {
      if (mounted) {
        setState('ready');
        setError(null);
      }
    }).catch(() => {
      if (mounted) {
        setState('invalid');
        setError('This reset link is invalid or has expired. Request a new link.');
        setPassword('');
        setConfirm('');
      }
    });
    return () => { mounted = false; };
  }, []);

  const goBackToLogin = () => {
    const fromAffiliate =
      new URLSearchParams(window.location.search).get('from') === 'affiliate';
    router.push(fromAffiliate ? '/affiliate/login' : '/auth/login');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (state !== 'ready' || busy) return;
    setError(null);

    if (password.length < 8 || password.length > 128) {
      setError('Password must be between 8 and 128 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error('RECOVERY_SESSION_EXPIRED');
      }
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user ||
          userData.user.id !== sessionData.session.user.id) {
        throw new Error('RECOVERY_SESSION_EXPIRED');
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        if (/auth session missing|session.+(missing|expired)|invalid jwt|jwt expired/i
          .test(updateError.message)) {
          throw new Error('RECOVERY_SESSION_EXPIRED');
        }
        throw updateError;
      }
      setPassword('');
      setConfirm('');
      setState('complete');
      // The update has succeeded; sign out without losing the success page.
      await supabase.auth.signOut().catch(() => undefined);
    } catch (err) {
      if (err instanceof Error && err.message === 'RECOVERY_SESSION_EXPIRED') {
        setState('invalid');
        setError('Your recovery session has expired. Request a new reset link.');
        setPassword('');
        setConfirm('');
      } else {
        setError(
          err instanceof Error ? err.message : 'Unable to update your password.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main dir={dir} className="min-h-screen bg-[#07111F] px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-[560px] items-center justify-center">
        <section className="w-full rounded-[28px] border border-[#24324A] bg-[#0B1728] p-6 shadow-[0_20px_70px_rgba(0,0,0,.35)] sm:p-8">
          {state === 'complete' ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-[#00E07A]" />
              <h1 className="mt-4 text-2xl font-black">{t('auth.passwordUpdated')}</h1>
              <p className="mt-2 text-sm leading-6 text-[#91A1BA]">
                Your BetVima password has been changed successfully. You can now sign in with your new password.
              </p>
              <button
                type="button"
                onClick={goBackToLogin}
                className="mt-6 min-h-[54px] w-full rounded-[15px] bg-[#00D47A] px-5 text-sm font-black text-[#03140D]"
              >
                Back to login
              </button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <KeyRound className="mx-auto h-10 w-10 text-[#00E07A]" />
                <h1 className="mt-4 text-2xl font-black">{t('auth.createNewPassword')}</h1>
                <p className="mt-2 text-sm leading-6 text-[#91A1BA]">
                  Choose a new password for your BetVima account.
                </p>
              </div>

              {error ? (
                <div className="mt-5 rounded-[14px] border border-[#F0A3A3]/25 bg-[#F0A3A3]/[0.08] p-3 text-sm leading-5 text-[#F0A3A3]">
                  {error}
                </div>
              ) : null}

              {state === 'ready' ? (
                <form className="mt-6 space-y-4" onSubmit={submit}>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[#9AAAC0]">
                      New password
                    </span>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#91A5C2]" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        minLength={8}
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={t("auth.passwordMinimum")}
                        className="nova-input w-full !h-[54px] !rounded-[15px] !border-[#2B4263] !bg-[#0D1B2E] !pl-12 !pr-12 !text-white placeholder:!text-[#7185A2] focus:!border-[#00D47A]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-[#91A5C2]"
                        aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[#9AAAC0]">
                      Confirm password
                    </span>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#91A5C2]" />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        minLength={8}
                        required
                        value={confirm}
                        onChange={(event) => setConfirm(event.target.value)}
                        placeholder={t("auth.repeatPassword")}
                        className="nova-input w-full !h-[54px] !rounded-[15px] !border-[#2B4263] !bg-[#0D1B2E] !pl-12 !pr-12 !text-white placeholder:!text-[#7185A2] focus:!border-[#00D47A]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((value) => !value)}
                        className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-[#91A5C2]"
                        aria-label={showConfirm ? t("auth.hidePassword") : t("auth.showPassword")}
                      >
                        {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={busy}
                    className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[15px] bg-[#00D47A] px-5 text-[15px] font-black text-[#03140D] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Updating password...
                      </>
                    ) : (
                      <>
                        <KeyRound className="h-5 w-5" />
                        Update password
                      </>
                    )}
                  </button>
                </form>
              ) : state === 'checking' ? (
                <div className="mt-6 text-center text-sm text-[#91A1BA]">
                  Verifying your reset link...
                </div>
              ) : (
                <button
                  type="button"
                  onClick={goBackToLogin}
                  className="mt-6 min-h-[54px] w-full rounded-[15px] border border-[#2B4263] bg-[#0D1B2E] px-5 text-sm font-black text-white"
                >
                  Back to login
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
