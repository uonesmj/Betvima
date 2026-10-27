'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, FileCheck2, Loader2, ShieldCheck } from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';

type Applicant = {
  id: string; publicId: string; email: string | null; phone: string | null;
  status: string; kycStatus: string; registeredAt: string; casinoIdentityApproved: boolean;
};
type Queue = { items: Applicant[]; page: number; pageSize: number; total: number };
type DocumentType = 'national_id' | 'passport' | 'drivers_license';

export function CasinoApprovalsClient() {
  const { locale } = useApp();
  const fa = locale === 'fa';
  const tr = (en: string, persian: string) => fa ? persian : en;
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApiQuery<Queue>(
    '/api/v1/admin/casino-approvals?page=' + page + '&pageSize=25',
  );
  const [selected, setSelected] = useState<Applicant | null>(null);
  const [document, setDocument] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>('national_id');
  const [telegramReference, setTelegramReference] = useState('');
  const [reason, setReason] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const reset = () => {
    setDocument(null); setDocumentType('national_id'); setTelegramReference('');
    setReason(''); setAgeConfirmed(false); setIdentityConfirmed(false);
    setConsentConfirmed(false);
  };
  const open = (item: Applicant) => {
    setSelected(item); setNotice(''); reset();
  };
  const canApprove = Boolean(
    document && telegramReference.trim().length >= 4 && reason.trim().length >= 8 &&
    ageConfirmed && identityConfirmed && consentConfirmed,
  );
  const approve = async () => {
    if (!selected || busy || !document || !canApprove) return;
    if (!window.confirm(tr(
      'Approve verified identity and legal age for this specific user? This is an audited financial-access decision.',
      'هویت و سن قانونی این کاربر را پس از بررسی واقعی مدارک تأیید می‌کنید؟ این اقدام ثبت و ممیزی می‌شود.',
    ))) return;
    const form = new FormData();
    form.set('document', document);
    form.set('documentType', documentType);
    form.set('telegramReference', telegramReference.trim());
    form.set('reason', reason.trim());
    form.set('ageConfirmed', String(ageConfirmed));
    form.set('identityConfirmed', String(identityConfirmed));
    form.set('consentConfirmed', String(consentConfirmed));
    setBusy(true); setNotice('');
    try {
      await apiRequest('/api/v1/admin/casino-approvals/' + encodeURIComponent(selected.id), {
        method: 'POST', body: form,
      });
      setNotice(tr('Identity approved and review recorded.', 'هویت تأیید و سابقه بررسی ثبت شد.'));
      setSelected(null); reset();
      await reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : tr('Approval failed', 'تأیید ناموفق بود'));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-nova-line bg-nova-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 text-nova-gold" size={24} aria-hidden="true" />
            <div>
              <h2 className="font-bold">{tr('Casino identity approvals', 'تأیید هویت کازینو')}</h2>
              <p className="mt-1 max-w-3xl text-xs nova-muted">
                {tr(
                  'Newest registrations first. After you inspect a genuine ID received in Telegram, securely upload the document here and confirm age, identity and consent. No user is approved just by clicking a button.',
                  'کاربران جدید در بالا هستند. پس از بررسی مدرک واقعی دریافتی در تلگرام، مدرک را اینجا در فضای خصوصی ثبت کرده و سن، هویت و رضایت کاربر را تأیید کنید.',
                )}
              </p>
            </div>
          </div>
          <button type="button" className="nova-btn-ghost text-xs" onClick={() => void reload()}>
            {tr('Refresh', 'بروزرسانی')}
          </button>
        </div>
      </section>
      {notice ? <p className="rounded-xl border border-nova-line bg-nova-surface p-3 text-sm" role="status">{notice}</p> : null}
      {error ? <p className="text-sm text-red-500" role="alert">{error}</p> : null}
      {loading ? <p className="text-xs nova-muted">{tr('Loading users…', 'در حال دریافت کاربران...')}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-nova-line bg-nova-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-nova-surface2 text-xs nova-muted">
            <tr>
              <th className="p-3">{tr('User', 'کاربر')}</th>
              <th className="p-3">{tr('Joined', 'عضویت')}</th>
              <th className="p-3">{tr('KYC', 'احراز هویت')}</th>
              <th className="p-3">{tr('Casino identity', 'هویت کازینو')}</th>
              <th className="p-3">{tr('Action', 'عملیات')}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((item) => (
              <tr key={item.id} className="border-t border-nova-line">
                <td className="p-3">
                  <Link href={'/admin/users/' + item.id} className="font-medium hover:underline">
                    {item.email ?? item.phone ?? item.publicId}
                  </Link>
                  <div className="font-mono text-[11px] nova-muted">{item.publicId}</div>
                </td>
                <td className="whitespace-nowrap p-3 text-xs nova-muted">
                  {new Date(item.registeredAt).toLocaleString(fa ? 'fa-IR' : 'en-US')}
                </td>
                <td className="p-3 text-xs">{item.kycStatus}</td>
                <td className="p-3 text-xs">
                  {item.casinoIdentityApproved
                    ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 size={15} />{tr('Verified', 'تأیید شده')}</span>
                    : <span className="nova-muted">{tr('Not approved', 'تأیید نشده')}</span>}
                </td>
                <td className="p-3">
                  {item.casinoIdentityApproved ? (
                    <span className="whitespace-nowrap text-xs nova-muted">{tr('Already approved', 'قبلاً تأیید شده')}</span>
                  ) : item.kycStatus === 'pending' ? (
                    <Link href="/admin/kyc" className="nova-btn-ghost inline-flex whitespace-nowrap text-xs">
                      {tr('Review pending ID', 'بررسی مدرک در انتظار')}
                    </Link>
                  ) : item.kycStatus === 'verified' ? (
                    <span className="text-xs nova-muted">{tr('Check existing KYC record', 'سوابق KYC بررسی شود')}</span>
                  ) : (
                    <button type="button" className="nova-btn-primary whitespace-nowrap text-xs"
                      disabled={item.status !== 'active'} onClick={() => open(item)}>
                      {tr('Approve casino', 'تأیید کازینو')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && !data?.items?.length ? (
              <tr><td colSpan={5} className="p-8 text-center text-sm nova-muted">
                {tr('No registered users found.', 'کاربری یافت نشد.')}
              </td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs nova-muted">
        <span>{data?.total ?? 0} {tr('users', 'کاربر')}</span>
        <div className="flex gap-2">
          <button type="button" className="nova-btn-ghost text-xs" disabled={page <= 1}
            onClick={() => setPage((n) => Math.max(1, n - 1))}>{tr('Previous', 'قبلی')}</button>
          <span className="self-center">{page}</span>
          <button type="button" className="nova-btn-ghost text-xs"
            disabled={!data || page * data.pageSize >= data.total}
            onClick={() => setPage((n) => n + 1)}>{tr('Next', 'بعدی')}</button>
        </div>
      </div>

      {selected ? (
        <section className="rounded-2xl border border-nova-line bg-nova-surface p-5" aria-label="Manual casino identity approval">
          <div className="mb-3 flex items-center gap-2">
            <FileCheck2 className="text-nova-gold" size={23} />
            <h3 className="font-bold">{tr('Manual review for', 'بررسی دستی کاربر')} {selected.publicId}</h3>
          </div>
          <p className="mb-4 text-xs nova-muted">
            {tr(
              'Check the Telegram sender matches this account. Inspect the government ID and legal age. Upload a protected copy. Remove unneeded Telegram copies according to your retention policy.',
              'ابتدا ارتباط فرستنده تلگرام با این حساب را بررسی کنید، مدرک و سن قانونی را کنترل کنید و یک نسخه در مخزن خصوصی ثبت نمایید.',
            )}
          </p>
          <div className="grid max-w-2xl gap-3">
            <label className="block text-xs">
              {tr('Document type', 'نوع مدرک')}
              <select className="nova-input mt-1 w-full" value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocumentType)}>
                <option value="national_id">{tr('National ID', 'کارت ملی')}</option>
                <option value="passport">{tr('Passport', 'گذرنامه')}</option>
                <option value="drivers_license">{tr('Driving license', 'گواهینامه')}</option>
              </select>
            </label>
            <label className="block text-xs">
              {tr('Reviewed document (JPEG, PNG, WEBP or PDF; maximum 8 MB)', 'مدرک بررسی‌شده (عکس یا PDF، حداکثر ۸ مگابایت)')}
              <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                className="nova-input mt-1 w-full" onChange={(e) => setDocument(e.target.files?.[0] ?? null)} />
            </label>
            <label className="block text-xs">
              {tr('Telegram message / review case reference', 'شناسه پیام تلگرام یا پرونده بررسی')}
              <input className="nova-input mt-1 w-full" maxLength={160} value={telegramReference}
                onChange={(e) => setTelegramReference(e.target.value)}
                placeholder={tr('Reference only — do not paste sensitive chat content', 'فقط شناسه؛ اطلاعات حساس را وارد نکنید')} />
            </label>
            <label className="block text-xs">
              {tr('Review justification (at least 8 characters)', 'توضیح بررسی (حداقل ۸ کاراکتر)')}
              <textarea className="nova-input mt-1 w-full" rows={3} maxLength={500} value={reason}
                onChange={(e) => setReason(e.target.value)} />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={identityConfirmed} onChange={(e) => setIdentityConfirmed(e.target.checked)} />
              {tr('I checked authenticity and matched the document to this account.', 'اصالت مدرک و تعلق آن به این حساب را بررسی کرده‌ام.')}
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={ageConfirmed} onChange={(e) => setAgeConfirmed(e.target.checked)} />
              {tr('I verified legal gambling age from the document.', 'سن قانونی فعالیت از روی مدرک تأیید شده است.')}
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={consentConfirmed} onChange={(e) => setConsentConfirmed(e.target.checked)} />
              {tr('I confirmed this customer consented to secure identity processing.', 'رضایت کاربر برای پردازش امن مدارک تأیید شده است.')}
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="nova-btn-primary inline-flex items-center gap-2 text-xs"
                disabled={busy || !canApprove} onClick={() => void approve()}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {tr('Confirm casino identity', 'تأیید هویت کازینو')}
              </button>
              <button type="button" className="nova-btn-ghost text-xs" disabled={busy}
                onClick={() => { setSelected(null); reset(); }}>
                {tr('Cancel', 'لغو')}
              </button>
            </div>
          </div>
        </section>
      ) : null}
      <p className="text-xs nova-muted">
        {tr(
          'Identity approval is not a separate permission to bypass casino feature flags, restricted territories or responsible-gaming controls.',
          'تأیید هویت به معنی دورزدن محدودیت‌های کشور، کنترل‌های مالی یا فعال‌سازی مستقل کازینو نیست.',
        )}
      </p>
    </div>
  );
}
