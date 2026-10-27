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
  const [documentType, setDocumentType] = useState<DocumentType | ''>('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const open = (item: Applicant) => {
    setSelected(item); setNotice(''); setDocumentType('');
  };

  const approve = async () => {
    if (!selected || busy || !documentType) return;
    if (!window.confirm(tr(
      "I have personally inspected this user's ID outside BetVima, matched it to the account, verified legal gambling age and consent, and will retain the evidence privately using the Public ID shown. Approve?",
      'تأیید می‌کنم مدرک این کاربر را خارج از بت‌ویما شخصاً بررسی کرده‌ام، تعلق آن به حساب و سن قانونی و رضایت کاربر را کنترل کرده‌ام و مدارک را با شناسه عمومی نشان‌داده‌شده نزد خود نگه می‌دارم. تأیید شود؟',
    ))) return;

    setBusy(true); setNotice('');
    try {
      await apiRequest('/api/v1/admin/casino-approvals/' + encodeURIComponent(selected.id), {
        method: 'POST',
        json: {
          documentType,
          ageConfirmed: true,
          identityConfirmed: true,
          consentConfirmed: true,
          externalCustodyConfirmed: true,
        },
      });
      setNotice(tr('Identity approval recorded. No document was uploaded.', 'تأیید هویت ثبت شد. هیچ مدرکی آپلود نشد.'));
      setSelected(null); setDocumentType('');
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
                  'Newest registrations first. Review customer documents outside BetVima and keep them securely yourself. Approve only after checking the real ID, legal age, account ownership and customer consent. No documents are uploaded.',
                  'کاربران جدید در بالا هستند. مدارک را در تلگرام یا آرشیو شخصی خود بررسی و نگهداری کنید. پس از تأیید واقعی هویت، سن قانونی، تعلق مدرک به حساب و رضایت کاربر، فقط دکمه تأیید را بزنید. هیچ مدرکی آپلود نمی‌شود.',
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
        <section className="rounded-2xl border border-nova-line bg-nova-surface p-5" aria-label="External identity review">
          <div className="mb-3 flex items-center gap-2">
            <FileCheck2 className="text-nova-gold" size={23} />
            <h3 className="font-bold">{tr('Approve identity for', 'تأیید هویت کاربر')} {selected.publicId}</h3>
          </div>
          <p className="mb-4 text-xs nova-muted">
            {tr(
              'Documents stay entirely with you outside BetVima. Keep the reviewed documents organized by the Public ID shown below. The approval records your admin identity and the time of review; no file, ID number or Telegram content is transferred.',
              'مدارک کاملاً خارج از بت‌ویما و نزد خودت باقی می‌مانند. مدارک بررسی‌شده را بر اساس شناسه عمومی زیر نگه دار. فقط نام ادمین و زمان تأیید ثبت می‌شود؛ فایل یا شماره مدرک و اطلاعات تلگرام منتقل نمی‌شود.',
            )}
          </p>
          <div className="mb-4 inline-flex rounded-lg border border-nova-line bg-nova-surface2 px-3 py-2 font-mono text-sm">
            {selected.publicId}
          </div>
          <div className="grid max-w-2xl gap-3">
            <label className="block text-xs">
              {tr('Document inspected externally', 'نوع مدرک بررسی‌شده نزد خودت')}
              <select className="nova-input mt-1 w-full" value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocumentType | '')}>
                <option value="">{tr('Select actual document type', 'نوع واقعی مدرک را انتخاب کن')}</option>
                <option value="national_id">{tr('National ID', 'کارت ملی')}</option>
                <option value="passport">{tr('Passport', 'گذرنامه')}</option>
                <option value="drivers_license">{tr('Driving license', 'گواهینامه')}</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="nova-btn-primary inline-flex items-center gap-2 text-xs"
                disabled={busy || !documentType} onClick={() => void approve()}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {tr('Approve casino identity', 'تأیید کازینو')}
              </button>
              <button type="button" className="nova-btn-ghost text-xs" disabled={busy}
                onClick={() => { setSelected(null); setDocumentType(''); }}>
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
