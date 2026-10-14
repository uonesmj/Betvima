'use client';

import { useEffect, useState } from 'react';
import { translateVisibleText } from '@/lib/i18n/ui-phrases';
import { useApp } from '@/components/layout/providers';
import { Card, EmptyState, ErrorNote, Field, Skeleton, Stat, StatusPill } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';

type AffiliateWalletAsset = 'USDT_TRC20' | 'TRX' | 'DOGE';

interface Payout {
  id: string;
  publicId: string;
  amountMinor: string;
  currency: string;
  status: string;
  method: string | null;
  destinationMasked: string | null;
  payoutAsset?: AffiliateWalletAsset | null;
  requestedAt: string;
  paidAt: string | null;
  dualApprovalRequired: boolean;
  failedReason: string | null;
}

interface Wallet {
  id: string;
  affiliateId: string;
  asset: AffiliateWalletAsset;
  addressMasked: string | null;
  addressHidden?: boolean;
  createdAt: string;
  updatedAt: string;
}

const WALLET_ASSETS: AffiliateWalletAsset[] = ['USDT_TRC20', 'TRX', 'DOGE'];

function walletLabel(asset: AffiliateWalletAsset) {
  if (asset === 'USDT_TRC20') return 'USDT — TRC20';
  return asset;
}

function walletHint(asset: AffiliateWalletAsset) {
  if (asset === 'USDT_TRC20') return 'TRON network · USDT';
  if (asset === 'TRX') return 'TRON network · TRX';
  return 'Dogecoin network · DOGE';
}

export function AffiliatePayoutsClient() {
  const { t, locale, session } = useApp();
  const tr = (value: string | undefined) => { const copy = value ?? ''; return locale === 'fa' ? translateVisibleText(copy) : copy; };

  const { data, loading, error, reload } = useApiQuery<{
    items: Payout[];
    total: number;
    payable: {
      payableMinor: string;
      carryForwardMinor: string;
      suppressedMinor: string;
    };
  }>(session?.authenticated ? '/api/v1/affiliate/payouts' : null);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletSaving, setWalletSaving] = useState<AffiliateWalletAsset | null>(null);
  const [walletDrafts, setWalletDrafts] = useState<Record<AffiliateWalletAsset, string>>({
    USDT_TRC20: '',
    TRX: '',
    DOGE: '',
  });
  const [walletMessage, setWalletMessage] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  const [form, setForm] = useState({
    amountMinor: '',
    method: 'crypto',
    payoutAsset: 'USDT_TRC20' as AffiliateWalletAsset,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadWallets = async () => {
    setWalletLoading(true);
    setWalletError(null);

    try {
      const response = await fetch('/api/v1/affiliate/wallets', {
        credentials: 'same-origin',
        cache: 'no-store',
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error?.message || 'Unable to load withdrawal wallets');
      }

      setWallets(Array.isArray(json?.data?.items) ? json.data.items : []);
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Unable to load withdrawal wallets');
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    if (session?.authenticated) {
      void loadWallets();
    }
  }, [session?.authenticated]);

  const getWallet = (asset: AffiliateWalletAsset) =>
    wallets.find((wallet) => wallet.asset === asset) ?? null;

  const saveWallet = async (asset: AffiliateWalletAsset) => {
    const address = walletDrafts[asset].trim();

    if (!address) {
      setWalletError(`Enter the ${walletLabel(asset)} wallet address.`);
      return;
    }

    setWalletSaving(asset);
    setWalletMessage(null);
    setWalletError(null);

    try {
      await apiRequest('/api/v1/affiliate/wallets', {
        method: 'POST',
        json: { asset, address },
      });

      setWalletDrafts((current) => ({
        ...current,
        [asset]: '',
      }));

      setWalletMessage(`${walletLabel(asset)} wallet saved successfully.`);
      await loadWallets();
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Unable to save wallet');
    } finally {
      setWalletSaving(null);
    }
  };

  const request = async () => {
    const selectedWallet = getWallet(form.payoutAsset);

    if (!selectedWallet) {
      setMessage(`Please save your ${walletLabel(form.payoutAsset)} wallet before requesting a payout.`);
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await apiRequest('/api/v1/affiliate/payouts', {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        json: {
          amountMinor: form.amountMinor,
          method: form.method,
          payoutAsset: form.payoutAsset,
        },
      });

      setMessage('Payout request submitted for manual review.');
      setForm((current) => ({
        ...current,
        amountMinor: '',
      }));
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  if (!session?.authenticated) return <EmptyState title={t('nav.login')} />;
  if (loading) return <Skeleton className="h-48 w-full" />;

  const selectedWallet = getWallet(form.payoutAsset);

  return (
    <div className="affiliate-payouts-v2 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />

        {(data?.items.length ?? 0) === 0 ? (
          <EmptyState title={t('common.empty')} />
        ) : (
          <Card className="payout-history-card !p-0">
            <table className="nova-table">
              <thead>
                <tr>
                  <th>{t('bets.date')}</th>
                  <th>{t('wallet.amount')}</th>
                  <th>{t('wallet.method')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {data!.items.map((payout) => (
                  <tr key={payout.id}>
                    <td className="whitespace-nowrap text-xs nova-muted">
                      {formatDateTime(payout.requestedAt, locale)}
                    </td>
                    <td>{formatMinor(payout.amountMinor, payout.currency, locale)}</td>
                    <td className="text-xs">
                      {payout.payoutAsset
                        ? walletLabel(payout.payoutAsset)
                        : payout.method ?? '—'}
                      <div className="nova-muted">{payout.destinationMasked ?? ''}</div>
                    </td>
                    <td>
                      <StatusPill status={payout.status} />
                      {payout.dualApprovalRequired ? (
                        <div className="mt-1 text-[10px] nova-muted">{tr("dual approval")}</div>
                      ) : null}
                      {payout.failedReason ? (
                        <div className="mt-1 text-[10px] text-nova-danger">{payout.failedReason}</div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card className="affiliate-payout-wallets border-[#DCE6F1] shadow-[0_8px_24px_rgba(15,23,42,.06)]">
          <div className="mb-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[#64748B]">
              {tr("Withdrawal wallets")}
            </div>
            <div className="mt-1 text-xl font-black text-[#172033]">
              {tr("Your crypto addresses")}
            </div>
            <div className="mt-1 text-xs leading-5 text-[#64748B]">
              {tr("Save the address for each network you want to use. Payouts are reviewed and paid manually.")}
            </div>
          </div>

          {walletMessage ? (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              {walletMessage}
            </div>
          ) : null}

          {walletError ? (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
              {walletError}
            </div>
          ) : null}

          <div className="space-y-3">
            {WALLET_ASSETS.map((asset) => {
              const wallet = getWallet(asset);

              return (
                <div
                  key={asset}
                  className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-black text-[#172033]">
                        {walletLabel(asset)}
                      </div>
                      <div className="mt-0.5 text-[10px] text-[#64748B]">
                        {walletHint(asset)}
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${
                        wallet
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {wallet ? (wallet.addressHidden ? 'SAVED · HIDDEN' : 'SAVED') : 'NOT SET'}
                    </span>
                  </div>

                  {wallet ? (
                    <div className="mb-2 rounded-xl border border-[#DCE6F1] bg-white px-3 py-2 text-xs font-bold text-[#334155]">
                      {wallet.addressMasked}
                    </div>
                  ) : null}

                  <input
                    className="nova-input w-full"
                    value={walletDrafts[asset]}
                    onChange={(event) =>
                      setWalletDrafts((current) => ({
                        ...current,
                        [asset]: event.target.value,
                      }))
                    }
                    placeholder={
                      wallet
                        ? 'Enter a new address to replace it'
                        : asset === 'DOGE'
                          ? 'Enter DOGE address'
                          : 'Enter TRON address'
                    }
                    autoComplete="off"
                    spellCheck={false}
                  />

                  <button
                    type="button"
                    className="nova-btn-primary mt-2 w-full"
                    disabled={walletSaving !== null || walletLoading || !walletDrafts[asset].trim()}
                    onClick={() => void saveWallet(asset)}
                  >
                    {walletSaving === asset
                      ? 'Saving...'
                      : wallet
                        ? 'Update Wallet'
                        : 'Save Wallet'}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="payout-create-card border-[#DCE6F1] shadow-[0_8px_24px_rgba(15,23,42,.06)]">
          <div className="payout-crypto-hero mb-4 rounded-xl p-4 text-white">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#8FB7E8]">
              {tr("Crypto payout")}
            </div>
            <div className="mt-1 text-xl font-black">
              {tr("Withdraw your commission")}
            </div>
            <div className="mt-1 text-xs text-[#B8C7D9]">
              USD settlement · Manual crypto payout
            </div>
          </div>

          <div className="payout-balance-grid mb-3 grid grid-cols-2 gap-2">
            <Stat
              label={t('affiliate.payable')}
              value={formatMinor(data?.payable.payableMinor ?? '0', 'USD', locale)}
              tone="success"
            />
            <Stat
              label={t('affiliate.carry')}
              value={formatMinor(data?.payable.carryForwardMinor ?? '0', 'USD', locale)}
            />
          </div>

          {message ? (
            <div className="mb-3 rounded-lg border border-nova-line bg-nova-surface2 p-2 text-xs">
              {message}
            </div>
          ) : null}

          <div className="space-y-3">
            <Field label="Currency">
              <div className="rounded-xl border border-[#DCE6F1] bg-[#F8FAFC] px-4 py-3 font-bold text-[#172033]">
                {tr("USD")}
              </div>
            </Field>

            <Field label={t('wallet.amount')}>
              <input
                className="nova-input"
                inputMode="numeric"
                value={form.amountMinor}
                onChange={(event) =>
                  setForm({
                    ...form,
                    amountMinor: event.target.value.replace(/[^\d]/g, ''),
                  })
                }
              />
            </Field>

            <Field label="Withdrawal network">
              <select
                className="nova-input w-full"
                value={form.payoutAsset}
                onChange={(event) =>
                  setForm({
                    ...form,
                    payoutAsset: event.target.value as AffiliateWalletAsset,
                  })
                }
              >
                <option value="USDT_TRC20">{tr("USDT — TRC20")}</option>
                <option value="TRX">{tr("TRX")}</option>
                <option value="DOGE">{tr("DOGE")}</option>
              </select>
            </Field>

            <div
              className={`rounded-xl border px-4 py-3 ${
                selectedWallet
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-[#64748B]">
                {tr("Payout destination")}
              </div>

              <div className="mt-1 text-xs font-bold text-[#172033]">
                {selectedWallet
                  ? selectedWallet.addressMasked
                  : `No ${walletLabel(form.payoutAsset)} wallet saved`}
              </div>

              <div className="mt-1 text-[10px] text-[#64748B]">
                {selectedWallet
                  ? 'This saved address will be used for the payout request.'
                  : 'Save this network wallet above before requesting a payout.'}
              </div>
            </div>

            <button
              type="button"
              className="nova-btn-primary w-full"
              disabled={busy || !form.amountMinor || !selectedWallet}
              onClick={() => void request()}
            >
              {busy ? t('common.loading') : t('affiliate.requestPayout')}
            </button>

            <p className="text-[11px] nova-muted">
              Payout requests are reviewed manually. The affiliate team transfers the funds
              to the saved wallet and marks the payout as paid after the transfer.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
