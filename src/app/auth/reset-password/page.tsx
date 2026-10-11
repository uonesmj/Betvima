'use client';

import { useApp } from '@/components/layout/providers';

import { FormEvent, useEffect, useState } from 'react';
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
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData.session) {
        if (active) setReady(true);
        return;
      }

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          if (active) setError('This reset link is invalid or has expired.');
          return;
        }

        window.history.replaceState(
          {},
          document.title,
          window.location.pathname + window.location.search,
        );

        if (active) setReady(true);
        return;
      }

      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          if (active) setError('This reset link is invalid or has expired.');
          return;
        }

        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );

        if (active) setReady(true);
        return;
      }

      if (active) {
        setError('This reset link is invalid or has expired.');
      }
    };

    void init();

    return () => {
      active = false;
    };
  }, []);

  const goBackToLogin = () => {
    const fromAffiliate =
      new URLSearchParams(window.location.search).get('from') === 'affiliate';
    router.push(fromAffiliate ? '/affiliate/login' : '/auth/login');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      await supabase.auth.signOut();
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update your password.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main dir={dir} className="min-h-screen bg-[#07111F] px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-[560px] items-center justify-center">
        <section className="w-full rounded-[28px] border border-[#24324A] bg-[#0B1728] p-6 shadow-[0_20px_70px_rgba(0,0,0,.35)] sm:p-8">
          {success ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-[#00E07A]" />
              <h1 className="mt-4 text-2xl font-black">{t('auth.passwordUpdated')}</h1>
              <p className="mt-2 text-sm leading-6 text-[#91A1BA]">
                Your NOVA password has been changed successfully. You can now sign in with your new password.
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
                  Choose a new password for your NOVA account.
                </p>
              </div>

              {error ? (
                <div className="mt-5 rounded-[14px] border border-[#F0A3A3]/25 bg-[#F0A3A3]/[0.08] p-3 text-sm leading-5 text-[#F0A3A3]">
                  {error}
                </div>
              ) : null}

              {ready ? (
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
              ) : !error ? (
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
