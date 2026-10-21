'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LockKeyhole, RefreshCcw, WalletCards } from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import {
  parseOriginalsWalletSnapshot,
  type OriginalsWalletSnapshot,
} from '@/lib/originals/wallet-readonly';

/**
 * Authenticated real-wallet balance display ONLY.
 *
 * A live wallet snapshot is not wagering authority. All Royal Vault spins
 * continue using non-redeemable CR demo credits; no debit, credit, hold,
 * settlement, external vendor callback or conversion is performed here.
 */
export function OriginalsWalletReadonly() {
  const { locale, session, sessionLoading } = useApp();
  const t = (en: string, fa: string) => locale === 'fa' ? fa : en;
  const [snapshot, setSnapshot] = useState<OriginalsWalletSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const currency = session?.user?.currency ?? null;
  const authenticated = session?.authenticated === true;

  useEffect(() => {
    setSnapshot(null);
    setFailed(false);
    if (!authenticated || !currency) return;

    const abort = new AbortController();
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || abort.signal.aborted || document.visibilityState !== 'visible') return;
      inFlight = true;
      setUpdating(true);
      try {
        const response = await fetch(
          '/api/v1/wallet?currency=' + encodeURIComponent(currency) + '&pageSize=1',
          { method: 'GET', credentials: 'same-origin', cache: 'no-store', signal: abort.signal },
        );
        if (!response.ok) throw new Error('ORIGINALS_WALLET_FETCH_FAILED');
        const payload: unknown = await response.json();
        const verified = parseOriginalsWalletSnapshot(payload, currency, locale);
        if (!abort.signal.aborted) {
          setSnapshot(verified);
          setFailed(false);
        }
      } catch {
        if (!abort.signal.aborted) {
          setSnapshot(null); // Do not display stale real balances.
          setFailed(true);
        }
      } finally {
        inFlight = false;
        if (!abort.signal.aborted) setUpdating(false);
      }
    };

    const onFocus = () => void refresh();
    void refresh();
    const poll = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      abort.abort();
      window.clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [authenticated, currency, locale, session?.user?.id]);

  return (
    <div className="rv-wallet-readonly" aria-label={t('Real wallet, read-only', 'کیف پول واقعی، فقط مشاهده')}>
      <div className="rv-wallet-readonly__heading">
        <WalletCards size={18} />
        <span>{t('BetVima real wallet', 'کیف پول واقعی بت‌ویما')}</span>
        <span className="rv-wallet-readonly__tag"><LockKeyhole size={11} />{t('VIEW ONLY', 'فقط مشاهده')}</span>
      </div>
      {sessionLoading
        ? <span className="rv-wallet-readonly__amount">—</span>
        : !authenticated
          ? <span className="rv-wallet-readonly__prompt">{t('Sign in to view your real balance.', 'برای مشاهده موجودی واقعی وارد حساب شوید.')}</span>
          : failed
            ? <span role="status" className="rv-wallet-readonly__prompt">{t('Wallet verification unavailable. No cash play is possible.', 'اعتبارسنجی کیف پول در دسترس نیست. بازی نقدی غیرفعال است.')}</span>
            : <span className="rv-wallet-readonly__amount" data-testid="royal-vault-readonly-wallet">{snapshot?.availableFormatted ?? '—'}</span>}
      <div className="rv-wallet-readonly__bottom">
        <span>{updating ? <RefreshCcw size={13} className="animate-spin" /> : <LockKeyhole size={13} />}
          {t('Your real balance cannot be staked in this demo.', 'موجودی واقعی در این نسخه قابل شرط‌بندی نیست.')}
        </span>
        <Link href="/wallet">{t('Open wallet', 'باز کردن کیف پول')} →</Link>
      </div>
    </div>
  );
}
