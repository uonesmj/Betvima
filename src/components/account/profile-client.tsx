'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft, ArrowUpRight, ChevronRight, Clock3, Copy, Gift,
  Globe2, Headphones, IdCard, LogOut, Mail, MessageCircle,
  Phone, Plus, ReceiptText, Settings, ShieldCheck, Trophy,
  UserRound, WalletCards, X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/layout/providers';
import { LanguageSelector } from '@/components/layout/language-selector';
import { Card, ErrorNote, Field } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { formatDateTime, formatMinor } from '@/lib/i18n';

interface ProfileData {
  id?: string;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  preferredLocale?: string | null;
  timezone?: string | null;
  currency?: string | null;
  status?: string | null;
  publicId?: string | null;
  numericId?: number | null;
}

interface ProfilePayload {
  profile: ProfileData | null;
  session?: {
    id?: string;
    email?: string;
    username?: string | null;
    currency?: string;
    publicId?: string | null;
    numericId?: number | null;
  };
}

interface WalletTransaction {
  id: string;
  type: string;
  direction: string;
  amountMinor: string;
  balanceAfterMinor: string;
  status: string;
  description: string | null;
  createdAt: string;
}

interface WalletPayload {
  wallet: {
    balanceMinor: string;
    availableMinor: string;
    heldMinor: string;
    currency: string;
    status: string;
  } | null;
  transactions?: {
    items: WalletTransaction[];
    hasMore: boolean;
  };
}

interface KycPayload {
  kycStatus?: string | null;
  status?: string | null;
}

function normalize(value: string | null | undefined) {
  return String(value ?? '').toUpperCase().replaceAll('-', '_');
}

function transactionLabel(value: string) {
  return value.replaceAll('_', ' ').split(' ').map((part) =>
    part ? part.charAt(0).toUpperCase() + part.slice(1) : part
  ).join(' ');
}

function kycApproved(status: string | null | undefined) {
  return ['APPROVED', 'VERIFIED'].includes(normalize(status));
}

function kycLabel(status: string | null | undefined) {
  switch (normalize(status)) {
    case 'APPROVED':
    case 'VERIFIED':
      return 'Approved';
    case 'PENDING':
      return 'Under review';
    case 'REJECTED':
      return 'Needs attention';
    default:
      return 'Start verification';
  }
}

export function ProfileClient() {
  const router = useRouter();
  const { t, dir, locale, session, sessionLoading, refreshSession } = useApp();
  const accountCurrency = session?.user?.currency ?? 'IRR';

  const profilePath = session?.authenticated
    ? '/api/v1/account/profile' : null;

  const walletPath = session?.authenticated
    ? `/api/v1/wallet?currency=${encodeURIComponent(accountCurrency)}&page=1&pageSize=5`
    : null;

  const kycPath = session?.authenticated
    ? '/api/v1/account/kyc' : null;

  const { data, loading, error, reload } =
    useApiQuery<ProfilePayload>(profilePath);

  const {
    data: walletData,
    loading: walletLoading,
    error: walletError,
    reload: reloadWallet,
  } = useApiQuery<WalletPayload>(walletPath);

  const {
    data: kycData,
    loading: kycLoading,
    error: kycError,
    reload: reloadKyc,
  } = useApiQuery<KycPayload>(kycPath);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const profile = data?.profile;
  const account = data?.session ?? session?.user;

  const [form, setForm] = useState({
    displayName: '',
    phone: '',
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      displayName: profile.username ?? '',
      phone: profile.phone ?? '',
    });
  }, [profile]);
  const displayName =
    profile?.username || account?.email?.split('@')[0] || 'NOVA User';
  const numericId = profile?.numericId ?? '—';
  const currency =
    walletData?.wallet?.currency ||
    profile?.currency ||
    account?.currency ||
    accountCurrency;
  const balance = walletData?.wallet?.balanceMinor ?? '0';
  const available = walletData?.wallet?.availableMinor ?? '0';
  const held = walletData?.wallet?.heldMinor ?? '0';
  const verified = kycApproved(
    kycData?.kycStatus ?? kycData?.status,
  );
  const profileCompletion = useMemo(() => {
    const fields = [
      Boolean(account?.email || profile?.email),
      Boolean(profile?.username),
      Boolean(profile?.phone),
    ];
    return Math.round(
      (fields.filter(Boolean).length / fields.length) * 100,
    );
  }, [
    account?.email, profile?.email,
    profile?.username, profile?.phone,
  ]);

  const saveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await apiRequest('/api/v1/account/profile', {
        method: 'PATCH',
        json: {
          ...(form.displayName.trim()
            ? { displayName: form.displayName.trim() } : {}),
          ...(form.phone.trim()
            ? { phone: form.phone.trim() } : {}),
        },
      });
      setMessage('Profile saved successfully.');
      setEditing(false);
      await reload();
      await refreshSession();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setMessage(null);
    try {
      await getSupabaseBrowserClient().auth.signOut();
      await apiRequest('/api/v1/auth/logout', { method: 'POST' });
      await refreshSession();
      window.location.href = '/';
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : 'Unable to sign out.',
      );
      setLoggingOut(false);
    }
  };

  const refreshAll = () => {
    void reload();
    void reloadWallet();
    void reloadKyc();
  };

  const latestTransactions =
    walletData?.transactions?.items?.slice(0, 4) ?? [];

  const latestDeposit =
    walletData?.transactions?.items?.find((entry) => {
      const type = normalize(entry.type);
      return entry.direction === 'credit' &&
        (type.includes('DEPOSIT') || type.includes('TOP_UP') || type.includes('TOPUP'));
    }) ?? null;

  const latestWithdrawal =
    walletData?.transactions?.items?.find((entry) => {
      const type = normalize(entry.type);
      return entry.direction !== 'credit' &&
        (type.includes('WITHDRAW') || type.includes('PAYOUT'));
    }) ?? null;

  if (sessionLoading || session === null) {
    return (
      <main dir={dir} className="min-h-[calc(100dvh-68px)] bg-[#F1F3F7] px-4 py-10">
        <Card className="mx-auto max-w-md rounded-[28px] p-8 text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-pulse rounded-full bg-[#E7EAF0]" />
          <div className="mx-auto h-5 w-28 animate-pulse rounded bg-[#E7EAF0]" />
          <div className="mx-auto mt-5 h-11 w-32 animate-pulse rounded-xl bg-[#E7EAF0]" />
        </Card>
      </main>
    );
  }

  if (!session.authenticated) {
    return (
      <main dir={dir} className="min-h-[calc(100dvh-68px)] bg-[#F1F3F7] px-4 py-10">
        <Card className="mx-auto max-w-md rounded-[28px] p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E7EAF0]">
            <UserRound className="h-8 w-8 text-[#687180]" />
          </div>
          <h2 className="text-xl font-bold">
            {session?.authUnavailable ? t('auth.authUnavailable') : t('nav.login')}
          </h2>
          <a href="/auth/login" className="nova-btn-primary mt-5 inline-flex min-w-32 justify-center">
            {t('nav.login')}
          </a>
        </Card>
      </main>
    );
  }

  return (
    <main dir={dir} className="min-h-[calc(100dvh-68px)] bg-[#F0F3F7] text-[#111827]">
      <div className="mx-auto w-full max-w-[920px] px-3 pb-28 pt-3 sm:px-5 sm:pt-5">
        <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_10px_40px_rgba(15,23,42,.07)]">
          <header className="flex h-[60px] items-center justify-between border-b border-[#E8EBEF] px-3 sm:px-6">
            <button type="button" onClick={() => router.back()} aria-label={t("common.back")}
              className="grid h-10 w-10 place-items-center rounded-full text-[#18212D] hover:bg-[#F1F3F6]">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-[21px] font-black tracking-[-.035em]">{t("profile.title")}</h1>
            
          </header>

          <div className="space-y-3 bg-[#F3F5F8] p-3 sm:space-y-3 sm:p-5">
          <section className="rounded-[20px] border border-[#E8EBEF] bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,.045)] sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-[78px] w-[78px] shrink-0 place-items-center rounded-full bg-[#E8ECF2] ring-8 ring-[#F7F8FA]">
                  <UserRound className="h-9 w-9 text-[#7C5CFF]" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-[23px] font-black">
                    {loading ? '—' : displayName}
                  </h2>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-[#687384]">
                    <IdCard className="h-4 w-4 text-[#1597FF]" />
                    <span>ID {numericId}</span>
                  </div>
                  <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                    verified
                      ? 'bg-[#DDF8E9] text-[#0B9D55]'
                      : 'bg-[#EEF1F5] text-[#667181]'
                  }`}>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {verified ? 'Approved' : kycLoading ? 'Verifying...' : kycLabel(kycData?.kycStatus ?? kycData?.status)}
                  </div>
                </div>
              </div>

            </div>
          </section>

          <section className="rounded-[20px] border border-[#E8EBEF] bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,.045)] sm:p-5">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <div className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EDF0F4] sm:grid">
                  <WalletCards className="h-6 w-6 text-[#3478F6]" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#707A88]">{t("profile.accountBalance")}</div>
                  <div className="mt-0.5 truncate text-[18px] font-black sm:text-[25px]">
                    {walletLoading ? '—' : formatMinor(available, currency, locale)}
                  </div>
                </div>
              </div>
              <a href="/wallet?tab=deposit" className="flex min-h-[62px] min-w-0 items-center gap-2 rounded-[17px] bg-nova-primary px-2.5 text-[#04140C] sm:gap-3 sm:px-4">
                <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/55 sm:grid">
                  <Plus className="h-5 w-5 text-[#087D45]" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-bold opacity-70 sm:text-[11px]">{t("profile.deposit")}</span>
                  <span className="block truncate text-sm font-black">
                    {latestDeposit ? formatMinor(latestDeposit.amountMinor, currency, locale) : 'No deposits yet'}
                  </span>
                </span>
              </a>
              <a href="/wallet?tab=withdraw" className="flex min-h-[62px] min-w-0 items-center gap-2 rounded-[17px] bg-[#E9EDF2] px-2.5 text-[#18212D] sm:gap-3 sm:px-4">
                <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl bg-white sm:grid">
                  <ArrowUpRight className="h-5 w-5 rotate-90 text-[#E05A6D]" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-bold text-[#7A8492] sm:text-[11px]">{t("profile.withdraw")}</span>
                  <span className="block truncate text-sm font-black">
                    {latestWithdrawal ? formatMinor(latestWithdrawal.amountMinor, currency, locale) : 'No withdrawals yet'}
                  </span>
                </span>
              </a>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-[#F5F6F8] p-2.5">
                <div className="text-[#7A8492]">{t("profile.available")}</div>
                <div className="mt-1 font-black">{formatMinor(available, currency, locale)}</div>
              </div>
              <div className="rounded-xl bg-[#F5F6F8] p-2.5">
                <div className="text-[#7A8492]">{t("profile.held")}</div>
                <div className="mt-1 font-black">{formatMinor(held, currency, locale)}</div>
              </div>
              <div className="rounded-xl bg-[#F5F6F8] p-2.5">
                <div className="text-[#7A8492]">{t("profile.currency")}</div>
                <div className="mt-1 font-black">{currency}</div>
              </div>
            </div>
          </section>
          <div className="space-y-2.5">
              <button type="button" onClick={() => setOpenSection(openSection === 'quick' ? null : 'quick')} className="flex min-h-[64px] w-full items-center justify-between gap-3 px-4 text-left">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EAF3FF]"><ReceiptText className="h-5 w-5 text-[#3478F6]" /></div>
                  <div><div className="text-sm font-black">{t("profile.quickActions")}</div><div className="text-[11px] text-[#7A8492]">{t("profile.quickActionsDescription")}</div></div>
                </div>
                <ChevronRight className={`h-5 w-5 shrink-0 text-[#89929E] transition-transform ${openSection === 'quick' ? 'rotate-90' : ''}`} />
              </button>
              {openSection === 'quick' ? (
                <div className="border-t border-[#E9ECF0] px-3 pb-3">
                  <a href="/bets" className="flex min-h-14 items-center justify-between border-b border-[#EEF0F3] px-1">
                    <div className="flex items-center gap-3"><ReceiptText className="h-5 w-5 text-[#3478F6]" /><div><div className="text-sm font-bold">{t("profile.myBets")}</div><div className="text-[11px] text-[#89929E]">{t("profile.viewYourBets")}</div></div></div><ChevronRight className="h-4 w-4 text-[#9AA2AD]" />
                  </a>
                  <a href="/bonuses" className="flex min-h-14 items-center justify-between border-b border-[#EEF0F3] px-1 text-left">
                    <div className="flex items-center gap-3"><Gift className="h-5 w-5 text-[#C35CFF]" /><div><div className="text-sm font-bold">{t("profile.bonuses")}</div><div className="text-[11px] text-[#89929E]">{t("profile.viewActiveBonuses")}</div></div></div><ChevronRight className="h-4 w-4 text-[#9AA2AD]" />
                  </a>
                  <a href="/help" className="flex min-h-14 items-center justify-between border-b border-[#EEF0F3] px-1">
                    <div className="flex items-center gap-3"><Headphones className="h-5 w-5 text-[#1597FF]" /><div><div className="text-sm font-bold">{t("profile.support")}</div><div className="text-[11px] text-[#89929E]">{t("profile.getHelp")}</div></div></div><ChevronRight className="h-4 w-4 text-[#9AA2AD]" />
                  </a>
                  <a href="/wallet" className="flex min-h-14 items-center justify-between px-1">
                    <div className="flex items-center gap-3"><WalletCards className="h-5 w-5 text-[#12A866]" /><div><div className="text-sm font-bold">{t("profile.transactions")}</div><div className="text-[11px] text-[#89929E]">{t("profile.depositsWithdrawals")}</div></div></div><ChevronRight className="h-4 w-4 text-[#9AA2AD]" />
                  </a>
                </div>
                ) : null}


              <button type="button" onClick={() => setOpenSection(openSection === 'preferences' ? null : 'preferences')} className="flex min-h-[64px] w-full items-center justify-between gap-3 px-4 text-left">
                <div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F0EBFF]"><Globe2 className="h-5 w-5 text-[#7C5CFF]" /></div><div><div className="text-sm font-black">Language & Preferences</div><div className="text-[11px] text-[#7A8492]">Language and help</div></div></div>
                <ChevronRight className={`h-5 w-5 text-[#89929E] transition-transform ${openSection === 'preferences' ? 'rotate-90' : ''}`} />
              </button>
              {openSection === 'preferences' ? (
                <div className="border-t border-[#E9ECF0] px-3 pb-2">
                  <ProfileMenuRow icon={<Globe2 className="text-[#7C5CFF]" />} title="Language" description="Select your preferred language"><LanguageSelector variant="footer" /></ProfileMenuRow>
                  <ProfileMenuRow icon={<Headphones className="text-[#1597FF]" />} title="Help & Contact" description="Get help from BetVima support" href="/help" />
                </div>
              ) : null}
            </div>

              <a href="/account/kyc" className="flex min-h-[64px] w-full items-center justify-between gap-3 px-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E8F2FF]">
                    <ShieldCheck className="h-5 w-5 text-[#087FF5]" />
                  </div>
                  <div>
                    <div className="text-sm font-black">{locale === 'fa' ? 'احراز هویت' : 'Identity verification'}</div>
                    <div className="text-[11px] text-[#7A8492]">{locale === 'fa' ? 'ارسال مدارک و تأیید دسترسی کازینو' : 'Upload ID and request casino access'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#687384]">{kycLabel(kycData?.kycStatus)}</span>
                  <ChevronRight className="h-5 w-5 text-[#89929E]" />
                </div>
              </a>
              <button type="button" onClick={() => setOpenSection(openSection === 'transactions' ? null : 'transactions')} className="flex min-h-[64px] w-full items-center justify-between gap-3 px-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAFBF2]">
                    <ReceiptText className="h-5 w-5 text-[#12A866]" />
                  </div>
                  <div>
                    <div className="text-sm font-black">{t("profile.recentTransactions")}</div>
                    <div className="text-[11px] text-[#7A8492]">
                      {walletLoading ? 'Loading wallet activity…' : 'Latest wallet activity'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href="/wallet" onClick={(event) => event.stopPropagation()} className="text-[11px] font-black text-[#0A9E58]">View all</a>
                  <ChevronRight className={`h-5 w-5 text-[#89929E] transition-transform ${openSection === 'transactions' ? 'rotate-90' : ''}`} />
                </div>
              </button>
              {openSection === 'transactions' ? (
                <div className="min-h-[72px] border-t border-[#E9ECF0] px-4">
                  {walletLoading ? (
                    <div className="space-y-3 py-4">
                      <div className="h-10 animate-pulse rounded-xl bg-[#F0F2F5]" />
                      <div className="h-10 animate-pulse rounded-xl bg-[#F0F2F5]" />
                    </div>
                  ) : latestTransactions.length ? (
                    <div className="divide-y divide-[#E8EBEF]">
                      {latestTransactions.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F0F2F5]">
                              <ReceiptText className="h-4 w-4 text-[#596474]" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold">{transactionLabel(entry.type)}</div>
                              <div className="text-[11px] text-[#7B8592]">{formatDateTime(entry.createdAt, locale)}</div>
                            </div>
                          </div>
                          <strong className={entry.direction === 'credit' ? 'text-[#0A9E58]' : 'text-[#17202B]'}>
                            {entry.direction === 'credit' ? '+' : '-'}{formatMinor(entry.amountMinor, currency, locale)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-5 text-center text-xs font-semibold text-[#89929E]">No recent transactions</div>
                  )}
                </div>
              ) : null}
          {message ? (
            <div className="rounded-xl bg-[#EAF8F0] px-4 py-3 text-sm font-bold text-[#087D45]">
              {message}
            </div>
          ) : null}

          {error ? <ErrorNote message={error} retryLabel="Retry" onRetry={() => { void reload(); void reloadWallet(); }} /> : null}

          <button type="button" onClick={logout}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[16px] bg-[#FDECEE] font-black text-[#C6283D]">
            <LogOut className="h-5 w-5 text-[#C6283D]" />
            Log out
          </button>

          <div className="pb-2 text-center text-xs text-[#8A929D]">
            Account currency: <strong>{currency}</strong>
          </div>
        </div>
      </div>
        </div>
    </main>
  );
}

function QuickCard({
  icon, title, description, href, onClick,
}: {
  icon: ReactNode; title: string; description: string; href?: string; onClick?: () => void;
}) {
  const className = "flex min-h-[84px] flex-col justify-between rounded-[18px] border border-[#E8EBEF] bg-white p-3 text-left shadow-[0_3px_14px_rgba(15,23,42,.04)] transition hover:-translate-y-0.5 hover:shadow-md";
  if (href) {
    return <a href={href} className={className}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EEF1F5] text-[#27313D]">{icon}</span>
      <span><strong className="block text-sm">{title}</strong><span className="text-[10px] text-[#7B8592]">{description}</span></span>
    </a>;
  }
  return <button type="button" onClick={onClick} className={className}>
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EEF1F5] text-[#27313D]">{icon}</span>
    <span><strong className="block text-sm">{title}</strong><span className="text-[10px] text-[#7B8592]">{description}</span></span>
  </button>;
}

function ProfileActionRow({
  icon, title, description, status, success, href, onClick,
}: {
  icon: ReactNode; title: string; description: string; status: string; success: boolean; href?: string; onClick?: () => void;
}) {
  const content = (
    <div className="flex items-center gap-3 border-b border-[#E8EBEF] px-4 py-3.5 last:border-b-0 sm:px-5">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${success ? 'bg-[#E7F8EE] text-[#0A9E58]' : 'bg-[#EEF1F5] text-[#566171]'}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-black">{title}</div>
        <div className="truncate text-xs text-[#7B8592]">{description}</div>
      </div>
      <span className={`shrink-0 text-[11px] font-black ${success ? 'text-[#0A9E58]' : 'text-[#687384]'}`}>{status}</span>
      {href ? <ChevronRight className="h-4 w-4 text-[#98A1AD]" /> : null}
    </div>
  );
  if (href) return <a href={href} className="block w-full cursor-pointer">{content}</a>;
  if (onClick) return <button type="button" onClick={onClick} className="block w-full text-left">{content}</button>;
  return content;
}

function ProfileMenuRow({
  icon, title, description, href, children,
}: {
  icon: ReactNode; title: string; description: string; href?: string; children?: ReactNode;
}) {
  const content = (
    <div className="flex min-h-[64px] items-center gap-3 border-b border-[#E8EBEF] last:border-b-0">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F1F3F7]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-black">{title}</div>
        <div className="truncate text-xs text-[#7B8592]">{description}</div>
      </div>
      {children ?? (href ? <ChevronRight className="h-5 w-5 text-[#98A1AD]" /> : null)}
    </div>
  );
  return href ? <a href={href}>{content}</a> : content;
}

