'use client';

import { useApp } from '@/components/layout/providers';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { clearedPasswordRecoveryPath, parsePasswordRecoveryGrant } from '@/lib/auth/password-recovery';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, BadgeCheck, Check, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, MailCheck, ShieldCheck, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { createIsolatedRecoveryClient } from '@/lib/supabase/recovery-email';
import type { SupabaseClient } from '@supabase/supabase-js';

export default function ResetPasswordPage() {
  const { t, locale } = useApp();
  const fa = locale === 'fa';
  const tr = (en: string, persian: string) => fa ? persian : en;
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'complete'>('checking');
  const checkPromise = useRef<Promise<void> | null>(null);
  const recoveryClient = useRef<SupabaseClient | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        // Legacy PKCE email codes need the ordinary browser verifier.
        // New app/email implicit tokens must never touch the PKCE SSR client.
        const supabase = grant.kind === 'code'
          ? getSupabaseBrowserClient()
          : createIsolatedRecoveryClient();
        recoveryClient.current = supabase;
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
      const supabase = recoveryClient.current;
      if (!supabase) throw new Error('RECOVERY_SESSION_EXPIRED');
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

  const passwordStrength = [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const strengthLabel = passwordStrength <= 1
    ? tr('Weak', 'ضعیف')
    : passwordStrength === 2
      ? tr('Fair', 'متوسط')
      : passwordStrength === 3
        ? tr('Good', 'خوب')
        : tr('Strong', 'قوی');
  const strengthColor = passwordStrength <= 1 ? '#FB7185'
    : passwordStrength === 2 ? '#F6B95E' : '#00E3A0';
  const maskedIconColor = 'text-[#B9C9DB]';
  const backIcon = fa ? <ArrowRight size={17} /> : <ArrowLeft size={17} />;

  return (
    <main dir={fa ? 'rtl' : 'ltr'} className="relative isolate min-h-[100dvh] overflow-hidden bg-[#06111D] text-white">
      {/* Ambient stadium lighting, designed without an external image or network dependency. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse 90% 50% at 50% -10%,rgba(6,112,130,.28),transparent 65%), radial-gradient(ellipse 58% 25% at -9% 45%,rgba(0,188,170,.17),transparent 72%),radial-gradient(ellipse 58% 25% at 109% 48%,rgba(9,111,227,.20),transparent 72%),linear-gradient(180deg,#05111F 5%,#092039 52%,#04111B 100%)',
        }} />
        <div className="absolute inset-x-[-30%] bottom-[-32%] h-[62%] rounded-[50%] border border-[#0AAFA4]/20 shadow-[0_0_100px_rgba(0,180,153,.08)]" />
        <div className="absolute inset-x-[-24%] bottom-[-39%] h-[67%] rounded-[50%] border border-[#0AAFA4]/10" />
        <div className="absolute -left-20 top-36 h-44 w-72 rotate-[-24deg] bg-gradient-to-r from-emerald-400/10 to-transparent blur-3xl" />
        <div className="absolute -right-20 top-28 h-44 w-72 rotate-[24deg] bg-gradient-to-l from-sky-400/10 to-transparent blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-56 opacity-30" style={{
          background: 'repeating-linear-gradient(90deg,transparent 0px,transparent 60px,rgba(6,182,168,.13) 61px,transparent 63px),linear-gradient(0deg,rgba(0,98,96,.22),transparent)',
          maskImage: 'linear-gradient(0deg,black,transparent)',
        }} />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[720px] flex-col items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
        <header className="mb-7 flex flex-col items-center gap-2 text-center sm:mb-9">
          <div className="flex items-center gap-2.5">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-300/20 bg-gradient-to-br from-[#18F2B8]/20 to-[#0B78A8]/20 shadow-[0_0_25px_rgba(0,232,170,.11)]">
              <span className="text-[30px] font-black italic leading-none tracking-tighter text-[#00EBAA]">B</span>
            </span>
            <Image src="/brand/betvima-wordmark.svg" alt="BetVima" width={204} height={52}
              priority className="h-11 w-auto max-w-[210px]" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[.28em] text-[#A5C2D0]">
            {tr('SECURE ACCOUNT CENTER', 'مرکز امنیت حساب کاربری')}
          </p>
        </header>

        <section aria-label={tr('Password recovery', 'بازیابی رمز عبور')}
          className="w-full rounded-[29px] bg-gradient-to-br from-[#2DDEBE]/75 via-[#264F69]/80 to-[#008C79]/60 p-[1px] shadow-[0_32px_95px_rgba(0,0,0,.50),0_0_42px_rgba(0,215,165,.08)] sm:rounded-[34px]">
          <div className="relative overflow-hidden rounded-[28px] bg-[#071626]/95 px-5 pb-6 pt-7 sm:rounded-[33px] sm:px-10 sm:pb-9 sm:pt-9">
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[-160px] h-[350px] w-[440px] -translate-x-1/2 rounded-full bg-[#00CFA0]/[.08] blur-[70px]" />
            <div className="relative">
              <div className="mx-auto mb-5 grid h-[76px] w-[76px] place-items-center rounded-[26px] border border-[#1EF5BA]/35 bg-gradient-to-br from-[#07D89D]/20 via-[#06334A] to-[#081B2A] shadow-[inset_0_0_30px_rgba(0,230,172,.07),0_0_40px_rgba(0,220,160,.13)] sm:h-[86px] sm:w-[86px]">
                <ShieldCheck size={42} strokeWidth={1.7} className="text-[#19EEB3] drop-shadow-[0_0_10px_rgba(0,240,180,.32)]" />
              </div>
              <div className="text-center">
                <div className="mb-2 flex items-center justify-center gap-2">
                  <Sparkles size={13} className="text-[#27DBB4]" />
                  <span className="text-[10px] font-black uppercase tracking-[.20em] text-[#5DE2C4]">
                    {tr('BETVIMA ACCOUNT PROTECTION', 'حفاظت از حساب بت‌ویما')}
                  </span>
                  <Sparkles size={13} className="text-[#27DBB4]" />
                </div>
                <h1 className="text-[clamp(1.55rem,5vw,2.35rem)] font-black leading-tight tracking-[-.035em]">
                  {tr('Create your new', 'رمز عبور جدید')} <span className="text-[#0EE7A6]">{tr('password', 'بسازید')}</span>
                </h1>
                <p className="mx-auto mt-3 max-w-[450px] text-[13px] leading-6 text-[#B4C6DA] sm:text-[14px]">
                  {tr('Choose a strong new password for your BetVima account.', 'برای حساب بت‌ویما یک رمز عبور جدید و قوی انتخاب کنید.')}
                </p>
              </div>

              {state === 'checking' && (
                <div role="status" aria-live="polite"
                  className="mt-6 flex items-center gap-3 rounded-[17px] border border-[#236A80] bg-[#0B2B3C]/65 px-4 py-4">
                  <span className="h-[19px] w-[19px] shrink-0 animate-spin rounded-full border-2 border-[#23DDB3] border-t-transparent" />
                  <div>
                    <p className="text-sm font-bold text-white">{tr('Verifying your reset link', 'در حال بررسی لینک بازیابی')}</p>
                    <p className="mt-1 text-xs text-[#A8BED0]">{tr('Please wait while we securely validate your request.', 'لطفاً تا تأیید امن درخواست منتظر بمانید.')}</p>
                  </div>
                </div>
              )}

              {state === 'ready' && (
                <div className="mt-6 flex items-center gap-3 rounded-[17px] border border-[#14D69C]/40 bg-gradient-to-r from-[#0B443D]/75 to-[#0B2935]/70 px-4 py-3.5 shadow-[inset_0_0_15px_rgba(0,230,160,.05)]">
                  <BadgeCheck className="h-7 w-7 shrink-0 text-[#24E8B1]" />
                  <div>
                    <p className="text-[13px] font-extrabold text-[#73FFCF]">{tr('Secure reset link verified', 'لینک امن بازیابی تأیید شد')}</p>
                    <p className="mt-0.5 text-[11px] leading-5 text-[#C0D4DD]">
                      {tr('You can now set a new password.', 'اکنون می‌توانید رمز جدید را تنظیم کنید.')}
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div role="alert" className="mt-5 rounded-2xl border border-rose-400/35 bg-rose-400/10 px-4 py-3.5 text-[13px] leading-6 text-[#FFAFBB]">
                  {state === 'invalid'
                    ? tr('This reset link is invalid or expired. Please request a new link from the login page.', 'لینک بازیابی نامعتبر است یا منقضی شده. لطفاً از صفحه ورود لینک تازه درخواست کنید.')
                    : error}
                </div>
              )}

              {state === 'ready' && (
                <form onSubmit={submit} className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="new-password" className="mb-2 block text-[13px] font-bold text-[#E1ECF8]">
                      {tr('New password', 'رمز عبور جدید')}
                    </label>
                    <div className="group relative">
                      <LockKeyhole aria-hidden="true" className={`pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 ${maskedIconColor}`} />
                      <input id="new-password" type={showPassword ? 'text' : 'password'}
                        dir="ltr" autoComplete="new-password" minLength={8} maxLength={128} required
                        value={password} onChange={(event) => setPassword(event.target.value)}
                        placeholder={tr('At least 8 characters', 'حداقل ۸ کاراکتر')}
                        className="h-[57px] w-full rounded-[16px] border border-[#386181] bg-[#0A2138] px-12 text-[15px] text-white outline-none transition duration-200 placeholder:text-[#7F9AB3] focus:border-[#12DEAB] focus:ring-[3px] focus:ring-[#09D4A0]/15" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute end-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-[#AEC0D4] transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15E9B1]"
                        aria-label={showPassword ? tr('Hide password', 'پنهان کردن رمز') : tr('Show password', 'نمایش رمز')}>
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    {password.length > 0 && (
                      <div className="mt-2.5 flex items-center gap-2" aria-live="polite">
                        <div className="flex flex-1 gap-1.5" aria-hidden="true">
                          {[1, 2, 3, 4].map((level) => (
                            <span key={level} className="h-[5px] flex-1 rounded-full transition-colors duration-300"
                              style={{ backgroundColor: passwordStrength >= level ? strengthColor : '#294257' }} />
                          ))}
                        </div>
                        <span className="min-w-14 text-end text-[11px] font-bold" style={{ color: strengthColor }}>
                          {strengthLabel}
                        </span>
                      </div>
                    )}
                    <p className="mt-1.5 text-[11px] text-[#8FA6BB]">
                      {tr('8–128 characters. Avoid reusing an old password.', '۸ تا ۱۲۸ کاراکتر. از رمز قبلی استفاده نکنید.')}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className="mb-2 block text-[13px] font-bold text-[#E1ECF8]">
                      {tr('Confirm password', 'تکرار رمز عبور')}
                    </label>
                    <div className="group relative">
                      <LockKeyhole aria-hidden="true" className={`pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 ${maskedIconColor}`} />
                      <input id="confirm-password" type={showConfirm ? 'text' : 'password'}
                        dir="ltr" autoComplete="new-password" minLength={8} maxLength={128} required
                        value={confirm} onChange={(event) => setConfirm(event.target.value)}
                        placeholder={tr('Repeat your new password', 'رمز جدید را دوباره وارد کنید')}
                        className="h-[57px] w-full rounded-[16px] border border-[#386181] bg-[#0A2138] px-12 text-[15px] text-white outline-none transition duration-200 placeholder:text-[#7F9AB3] focus:border-[#12DEAB] focus:ring-[3px] focus:ring-[#09D4A0]/15" />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute end-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-[#AEC0D4] transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15E9B1]"
                        aria-label={showConfirm ? tr('Hide confirmation', 'پنهان کردن تکرار رمز') : tr('Show confirmation', 'نمایش تکرار رمز')}>
                        {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    {confirm.length > 0 && (
                      <p aria-live="polite" className={`mt-2 flex items-center gap-1.5 text-[11px] font-semibold ${confirm === password ? 'text-[#37E6B0]' : 'text-[#F7A2AD]'}`}>
                        {confirm === password && <Check size={15} />}
                        {confirm === password
                          ? tr('Passwords match', 'رمزها یکسان هستند')
                          : tr('Passwords do not match yet', 'رمزها هنوز یکسان نیستند')}
                      </p>
                    )}
                  </div>

                  <button type="submit" disabled={busy || password.length < 8 || password.length > 128 || password !== confirm}
                    className="flex min-h-[57px] w-full items-center justify-center gap-3 rounded-[17px] bg-gradient-to-r from-[#39F1A3] to-[#00D99B] px-5 text-[15px] font-black text-[#03251F] shadow-[0_8px_27px_rgba(0,231,157,.25)] transition hover:from-[#5EFFBB] hover:to-[#08F0A9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6AFFC8] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none">
                    {busy ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#03251F] border-t-transparent" />
                        {tr('Updating password…', 'در حال تغییر رمز…')}
                      </>
                    ) : (
                      <>
                        <KeyRound size={19} />
                        {tr('Update password', 'تغییر رمز عبور')}
                        {fa ? <ArrowLeft size={19} /> : <ArrowRight size={19} />}
                      </>
                    )}
                  </button>
                </form>
              )}

              {state === 'complete' && (
                <div className="mt-6 rounded-[19px] border border-[#0FE1A5]/35 bg-[#0B463E]/45 px-5 py-6 text-center" role="status">
                  <CheckCircle2 size={44} className="mx-auto text-[#23F0B1]" />
                  <h2 className="mt-3 text-xl font-black text-[#CBFFE8]">{tr('Password updated', 'رمز عبور تغییر کرد')}</h2>
                  <p className="mt-2 text-[13px] leading-6 text-[#C1D7D7]">
                    {tr('Your new password is ready. Sign in again to continue.', 'رمز جدید ثبت شد. برای ادامه دوباره وارد حساب شوید.')}
                  </p>
                </div>
              )}

              {state !== 'checking' && (
                <button type="button" onClick={goBackToLogin}
                  className={`mx-auto mt-5 flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-semibold text-[#B8D0DC] transition hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#23E4AC] ${state === 'complete' || state === 'invalid' ? 'w-full border border-[#365A67] bg-[#122C3E]' : ''}`}>
                  {backIcon}
                  {state === 'invalid' ? tr('Request a new link', 'دریافت لینک جدید')
                    : tr('Back to login', 'بازگشت به ورود')}
                </button>
              )}

              <div className="mt-6 flex items-center gap-3 border-t border-[#244558]/70 pt-5">
                <div className="h-px flex-1 bg-[#244558]" />
                <ShieldCheck size={17} className="shrink-0 text-[#7EB9B7]" />
                <span className="text-center text-[10px] font-medium text-[#8EAABD]">
                  {tr('Secure BetVima password recovery', 'بازیابی امن رمز بت‌ویما')}
                </span>
                <div className="h-px flex-1 bg-[#244558]" />
              </div>
            </div>
          </div>
        </section>
        <p className="mt-6 text-center text-[11px] text-[#7897AA]">
          {tr('© BetVima · Account security', '© بت‌ویما · امنیت حساب کاربری')}
        </p>
      </div>
    </main>
  );
}
