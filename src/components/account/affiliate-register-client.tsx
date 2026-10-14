'use client';

import { useState } from 'react';
import { translateVisibleText } from '@/lib/i18n/ui-phrases';
import { useApp } from '@/components/layout/providers';
import { Card, Field } from '@/components/ui/primitives';
import { apiRequest } from '@/lib/hooks/useApi';

export function AffiliateRegisterClient() {
  const { locale } = useApp();
  const tr = (value: string | undefined) => { const copy = value ?? ''; return locale === 'fa' ? translateVisibleText(copy) : copy; };
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    payoutAccountId: '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid =
    form.email.includes('@') &&
    /^[a-z0-9_]{3,32}$/.test(form.username) &&
    form.password.length >= 8 &&
    form.payoutAccountId.trim().length >= 4;

  const submit = async () => {
    setBusy(true);
    setMessage(null);

    try {
      await apiRequest('/api/v1/affiliate/register', {
        method: 'POST',
        json: form,
      });

      window.location.replace('/affiliate/login?registered=1');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to create affiliate account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="affiliate-register-v2 mx-auto max-w-3xl">
      <section className="register-hero mb-5 overflow-hidden rounded-[24px] bg-[#071A31] p-6 text-white shadow-[0_14px_40px_rgba(7,26,49,.18)] sm:p-8">
        <div className="text-[11px] font-black tracking-[.22em] text-[#58A6FF]">
          {tr("BETVIMA AFFILIATE")}
        </div>

        <div className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black sm:text-4xl">
              {tr("Earn 70% commission")}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#AFC3DA]">
              Create your independent Affiliate account and start building your
              referral network.
            </p>
          </div>

          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-center">
            <div className="text-[10px] font-black uppercase tracking-[.16em] text-[#8FA7C2]">
              {tr("Commission")}
            </div>
            <div className="mt-1 text-4xl font-black text-white">70%</div>
            <div className="text-xs font-semibold text-[#8FA7C2]">
              {tr("Profit / Loss")}
            </div>
          </div>
        </div>
      </section>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['70%', 'Commission'],
          ['USD', 'Settlement'],
          ['5', 'Active users / week'],
          ['$40', 'Minimum payout'],
        ].map(([value, label]) => (
          <div
            key={label}
            className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,.05)]"
          >
            <div className="text-xl font-black text-[#087FF5]">{value}</div>
            <div className="mt-1 text-[11px] font-bold text-[#64748B]">
              {label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <Card className="border-[#E2E8F0] bg-white text-[#172033] shadow-[0_5px_22px_rgba(15,23,42,.05)]">
          {message ? (
            <div className="mb-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">
              {message}
            </div>
          ) : null}

          <div className="mb-5 rounded-2xl border border-[#DCEBFA] bg-[#F5FAFF] p-4">
            <div className="text-sm font-black text-[#172033]">
              {tr("Create your Affiliate account")}
            </div>
            <p className="mt-1 text-xs leading-5 text-[#64748B]">
              This account is independent from your regular BetVima sportsbook
              account.
            </p>
          </div>

          <div className="space-y-4">
            <Field label="Email">
              <input
                className="nova-input"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                autoComplete="email"
                placeholder="you@example.com"
              />
            </Field>

            <Field
              label="Username"
              hint="3–32 characters: lowercase letters, numbers and underscore."
            >
              <input
                className="nova-input"
                value={form.username}
                onChange={(e) =>
                  setForm({
                    ...form,
                    username: e.target.value.toLowerCase(),
                  })
                }
                autoComplete="username"
                placeholder="your_username"
              />
            </Field>

            <Field label="Password">
              <input
                className="nova-input"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
              />
            </Field>

            <Field
              label="Payout Account ID"
              hint="Used for Affiliate settlement. It is not included in referral links."
            >
              <input
                className="nova-input"
                value={form.payoutAccountId}
                onChange={(e) =>
                  setForm({ ...form, payoutAccountId: e.target.value })
                }
                autoComplete="off"
                placeholder="Your payout account ID"
              />
            </Field>

            <button
              type="button"
              className="nova-btn-primary w-full"
              disabled={busy || !valid}
              onClick={() => void submit()}
            >
              {busy ? 'Creating account...' : 'Create Affiliate Account'}
            </button>

            <div className="text-center text-sm text-[#64748B]">
              Already have an Affiliate account?{' '}
              <a
                href="/affiliate/login"
                className="font-bold text-[#087FF5] hover:underline"
              >
                {tr("Login")}
              </a>
            </div>
          </div>
        </Card>

        <Card className="border-[#E2E8F0] bg-white text-[#172033] shadow-[0_5px_22px_rgba(15,23,42,.05)]">
          <h2 className="mb-1 text-lg font-black">{tr("Weekly settlement")}</h2>
          <p className="mb-4 text-xs leading-5 text-[#64748B]">
            {tr("Affiliate earnings follow the existing NOVA settlement rules.")}
          </p>

          <ul className="space-y-3">
            <li className="rounded-xl bg-[#F8FAFC] p-3">
              <strong>{tr("USD settlement")}</strong>
              <div className="mt-1 text-xs text-[#64748B]">
                {tr("Affiliate earnings and payouts are settled in USD.")}
              </div>
            </li>

            <li className="rounded-xl bg-[#F8FAFC] p-3">
              <strong>5 active users</strong>
              <div className="mt-1 text-xs text-[#64748B]">
                {tr("At least 5 active referred users are required each week.")}
              </div>
            </li>

            <li className="rounded-xl bg-[#F8FAFC] p-3">
              <strong>$40 minimum</strong>
              <div className="mt-1 text-xs text-[#64748B]">
                {tr("Weekly payout eligibility starts at $40 commission.")}
              </div>
            </li>

            <li className="rounded-xl bg-[#F8FAFC] p-3 text-xs text-[#64748B]">
              Your unique referral link is generated from the Affiliate portal
              after registration.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
