'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useApp } from '@/components/layout/providers';

type TotpEnrollment = { id: string; totp?: { qr_code?: string; secret?: string; uri?: string } };

/** Supabase owns TOTP secrets, challenge rate limiting, and factor verification.
 * The application never saves or logs an authenticator secret.
 */
export function TwoFactorSettings({
  adminRequired = false, onVerified,
}: { adminRequired?: boolean; onVerified?: () => void }) {
  const { refreshSession, locale } = useApp();
  const fa = locale === 'fa';
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [isAal2, setIsAal2] = useState(false);
  const [disableRequested, setDisableRequested] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    const [{ data: factors, error: factorsError }, { data: aal, error: aalError }] =
      await Promise.all([client.auth.mfa.listFactors(), client.auth.mfa.getAuthenticatorAssuranceLevel()]);
    if (factorsError || aalError) throw factorsError ?? aalError;
    setFactorId(factors?.totp?.find((factor) => factor.status === 'verified')?.id ?? null);
    setIsAal2(aal?.currentLevel === 'aal2');
  }, []);

  useEffect(() => {
    let mounted = true;
    reload().catch((err) => { if (mounted) setError(err instanceof Error ? err.message : 'Unable to load security settings'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [reload]);

  const perform = async (operation: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await operation(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Verification failed'); }
    finally { setBusy(false); }
  };

  const begin = () => perform(async () => {
    const client = getSupabaseBrowserClient();
    // Clean up a previously abandoned (unverified) setup before starting over.
    const { data: current, error: listError } = await client.auth.mfa.listFactors();
    if (listError) throw listError;
    for (const factor of current?.all ?? []) {
      if (factor.factor_type === 'totp' && factor.status === 'unverified') {
        const { error } = await client.auth.mfa.unenroll({ factorId: factor.id });
        if (error) throw error;
      }
    }
    const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'BetVima Authenticator' });
    if (error || !data) throw error ?? new Error('Enrollment unavailable');
    setEnrollment({ id: data.id, totp: data.totp });
  });

  const verify = () => perform(async () => {
    if (!/^\d{6}$/.test(code)) throw new Error(fa ? 'کد ۶ رقمی را وارد کنید' : 'Enter a six-digit code');
    const id = enrollment?.id ?? factorId;
    if (!id) throw new Error('Authenticator factor is missing');
    const client = getSupabaseBrowserClient();
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId: id, code });
    if (error) throw error;
    setEnrollment(null); setCode('');
    await reload();
    await refreshSession();
    setMessage(fa ? 'تأیید دومرحله‌ای با موفقیت انجام شد' : 'Authenticator verified successfully');
    onVerified?.();
  });

  const disable = () => perform(async () => {
    if (adminRequired) throw new Error('Administrator accounts must keep two-factor authentication enabled');
    if (!factorId) throw new Error('No enrolled authenticator');
    if (!/^\d{6}$/.test(code)) throw new Error('Enter a fresh six-digit authenticator code');
    if (!window.confirm(fa ? 'تأیید می‌کنید که حفاظت دومرحله‌ای غیرفعال شود؟' : 'Disable two-factor authentication on this account?')) return;
    const client = getSupabaseBrowserClient();
    const verified = await client.auth.mfa.challengeAndVerify({ factorId, code });
    if (verified.error) throw verified.error;
    const { error } = await client.auth.mfa.unenroll({ factorId });
    if (error) throw error;
    setFactorId(null); setCode(''); setIsAal2(false); setDisableRequested(false);
    await refreshSession();
    setMessage(fa ? 'تأیید دومرحله‌ای غیرفعال شد' : 'Two-factor authentication disabled');
  });

  if (loading) return <p className="py-3 text-sm text-slate-500">{fa ? 'در حال بررسی امنیت حساب...' : 'Checking security status...'}</p>;
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900" dir={fa ? 'rtl' : 'ltr'}>
      <h3 className="text-base font-bold">{fa ? 'احراز هویت دومرحله‌ای' : 'Google Authenticator · Two-factor security'}</h3>
      <p className="text-xs leading-5 text-slate-600">
        {adminRequired
          ? (fa ? 'برای مدیران اجباری است. برای ورود به پنل باید کد برنامه Authenticator را تأیید کنید.' : 'Required for administrators. Verify your authenticator code before accessing the admin panel.')
          : (fa ? 'اختیاری است. بعد از فعال‌سازی، ورود شما به کد ۶ رقمی نیز نیاز دارد.' : 'Optional. Once enabled, every new sign-in requires your six-digit authenticator code.')}
      </p>
      <p className="text-sm font-semibold">{factorId
        ? (isAal2 ? (fa ? 'فعال و تأییدشده' : 'Enabled and verified') : (fa ? 'برای ادامه کد را تأیید کنید' : 'Verify your code to continue'))
        : (fa ? 'غیرفعال' : 'Not enabled')}</p>

      {!factorId && !enrollment ? (
        <button type="button" disabled={busy} onClick={begin} className="rounded-lg bg-[#1268d4] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {fa ? 'فعال‌سازی Google Authenticator' : 'Set up authenticator'}
        </button>
      ) : null}

      {enrollment ? (
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <p className="text-xs text-slate-700">{fa ? 'QR را در Google Authenticator اسکن کنید، یا کلید را دستی اضافه کنید.' : 'Scan this QR in your authenticator app, or enter the setup key manually.'}</p>
          {enrollment.totp?.qr_code?.startsWith('data:image/') ? (
            // QR is an image served by Supabase Auth, not an executable element.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={enrollment.totp.qr_code} alt="TOTP setup QR" className="h-44 w-44 rounded-lg bg-white p-2" />
          ) : null}
          <p className="break-all rounded bg-slate-100 p-2 font-mono text-xs" aria-label="Manual authenticator setup key">{enrollment.totp?.secret ?? ''}</p>
        </div>
      ) : null}

      {enrollment || (factorId && (!isAal2 || disableRequested)) ? (
        <div className="flex flex-wrap items-center gap-2">
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            aria-label="Six-digit authenticator code" placeholder="000000"
            className="w-32 rounded-lg border border-slate-300 px-3 py-2.5 font-mono tracking-widest" />
          <button type="button" disabled={busy || code.length !== 6}
            onClick={disableRequested ? disable : verify}
            className="rounded-lg bg-[#087849] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {disableRequested ? (fa ? 'تأیید و غیرفعال‌سازی' : 'Verify and disable') : (fa ? 'تأیید کد' : 'Verify code')}
          </button>
        </div>
      ) : null}

      {factorId && isAal2 && !adminRequired && !disableRequested ? (
        <button type="button" disabled={busy} onClick={() => setDisableRequested(true)} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
          {fa ? 'غیرفعال‌سازی دومرحله‌ای' : 'Disable two-factor authentication'}
        </button>
      ) : null}

      <p className="text-xs text-slate-500">{fa
        ? 'کد بازیابی اختصاصی در Supabase پشتیبانی نمی‌شود. پیش از تعویض گوشی، یک دستگاه Authenticator دوم ثبت کنید.'
        : 'Supabase does not issue recovery codes. Set up a second authenticator factor before changing phones.'}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
    </section>
  );
}
