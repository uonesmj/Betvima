'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileCheck2, ShieldCheck, UploadCloud, Clock3, LockKeyhole } from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';

type Status = {
  kycStatus: string;
  gameAccessApproved: boolean;
  canSubmit: boolean;
  submission: null | {
    id: string; status: string; documentType: string; createdAt: string; reviewNote: string | null;
  };
};

export function KycClient() {
  const { locale, session } = useApp();
  const fa = locale === 'fa';
  const label = (en: string, persian: string) => fa ? persian : en;
  const { data, loading, error, reload } = useApiQuery<Status>(
    session?.authenticated ? '/api/v1/account/kyc' : null,
  );
  const [documentType, setDocumentType] = useState('national_id');
  const [document, setDocument] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const verified = data?.gameAccessApproved === true;
  const pending = data?.kycStatus === 'pending' && data?.submission?.status === 'pending';

  const submit = async () => {
    if (!document || !consent || busy) return;
    setBusy(true); setMessage('');
    try {
      const form = new FormData();
      form.set('documentType', documentType);
      form.set('document', document);
      if (selfie) form.set('selfie', selfie);
      form.set('consent', 'yes');
      await apiRequest('/api/v1/account/kyc', { method: 'POST', body: form });
      setMessage(label('Documents submitted for review.', 'مدارک شما برای بررسی ارسال شد.'));
      setDocument(null); setSelfie(null); setConsent(false);
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : label('Upload failed.', 'ارسال مدارک ناموفق بود.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir={fa ? 'rtl' : 'ltr'} className="mx-auto max-w-3xl space-y-5 text-[#17212D]">
      <div className="rounded-[24px] border border-[#E2E7EE] bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,.055)] sm:p-7">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#E8F2FF] text-[#087FF5]">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black">{label('Identity verification', 'احراز هویت')}</h2>
            <p className="mt-1 text-sm text-[#69778A]">
              {label(
                'View casino games and manage your wallet while verification is pending. Playing requires approval of your ID and legal age by BetVima.',
                'می‌توانید بازی‌های کازینو را ببینید و کیف پول را مدیریت کنید. اجرای بازی منوط به بررسی مدارک هویتی و تأیید سن قانونی توسط بت‌ویما است.',
              )}
            </p>
          </div>
        </div>

        {!session?.authenticated ? (
          <Link href="/auth/login" className="nova-btn-primary inline-block">{label('Sign in', 'ورود به حساب')}</Link>
        ) : (
          <>
            <div role="status" className={
              'mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ' +
              (verified ? 'bg-[#E6F8EF] text-[#107047]' : pending
                ? 'bg-[#FFF5E6] text-[#895414]' : 'bg-[#EFF4FB] text-[#2F527A]')
            }>
              {verified ? <FileCheck2 size={20} /> : <Clock3 size={20} />}
              {loading ? label('Checking status…', 'در حال بررسی وضعیت…')
                : verified ? label('Verified — identity approved', 'تأیید شده — احراز هویت کامل است')
                : pending ? label('Documents awaiting operator review', 'مدارک در انتظار بررسی مدیر است')
                : data?.kycStatus === 'rejected' ? label('Rejected — submit corrected documents', 'رد شده — مدارک اصلاح‌شده ارسال کنید')
                : label('Verification required to play', 'برای بازی احراز هویت لازم است')}
            </div>
            {data?.submission?.reviewNote ? (
              <div className="mb-4 rounded-xl border border-[#FFD8D8] bg-[#FFF7F7] p-3 text-sm">
                {label('Review note:', 'دلیل بررسی:')} {data.submission.reviewNote}
              </div>
            ) : null}
            {error ? <p role="alert" className="mb-3 text-sm text-red-600">{error}</p> : null}
            {message ? <p role="status" className="mb-3 text-sm font-semibold">{message}</p> : null}

            {!verified && data?.canSubmit && !loading ? (
              <div className="space-y-4">
                <label className="block text-sm font-bold">
                  {label('Document type', 'نوع مدرک شناسایی')}
                  <select className="nova-input mt-1 block w-full" value={documentType}
                    onChange={(event) => setDocumentType(event.target.value)}>
                    <option value="national_id">{label('National identity card', 'کارت ملی')}</option>
                    <option value="passport">{label('Passport', 'گذرنامه')}</option>
                    <option value="drivers_license">{label('Driving licence', 'گواهینامه رانندگی')}</option>
                  </select>
                </label>
                <label className="block rounded-2xl border-2 border-dashed border-[#BDCCE0] bg-[#F8FAFD] px-4 py-6 text-center">
                  <UploadCloud className="mx-auto mb-2 text-[#087FF5]" size={30} />
                  <span className="block text-sm font-black">{label('Upload identity document', 'بارگذاری تصویر مدرک')}</span>
                  <span className="mt-1 block break-all text-xs text-[#69778A]">{document?.name ?? label('JPEG, PNG, WebP or PDF · up to 8 MB', 'JPEG، PNG، WebP یا PDF · حداکثر ۸ مگابایت')}</span>
                  <input className="mt-3 block w-full text-xs" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(event) => setDocument(event.target.files?.[0] ?? null)} />
                </label>
                <label className="block rounded-2xl border border-[#DFE6EF] bg-[#F8FAFD] p-4">
                  <span className="block text-sm font-bold">{label('Selfie with ID (optional)', 'سلفی همراه با مدرک (اختیاری)')}</span>
                  <span className="mt-1 block break-all text-xs text-[#69778A]">{selfie?.name ?? label('Clear photo · up to 8 MB', 'تصویر واضح · حداکثر ۸ مگابایت')}</span>
                  <input className="mt-2 block w-full text-xs" type="file" accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setSelfie(event.target.files?.[0] ?? null)} />
                </label>
                <label className="flex items-start gap-2 text-xs text-[#59677A]">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5" />
                  <span>{label('I consent to private processing of these documents for identity and age verification by authorized BetVima reviewers.', 'با پردازش محرمانه مدارک برای تأیید هویت و سن توسط مسئول مجاز بت‌ویما موافقم.')}</span>
                </label>
                <button type="button" onClick={() => void submit()} disabled={busy || !document || !consent}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#087FF5] text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                  <LockKeyhole size={17} />
                  {busy ? label('Uploading securely…', 'در حال ارسال امن…') : label('Submit for review', 'ارسال برای تأیید')}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
      <Link href="/account/profile" className="inline-block text-sm font-bold text-[#087FF5]">
        {label('Back to settings', 'بازگشت به تنظیمات')}
      </Link>
    </div>
  );
}
