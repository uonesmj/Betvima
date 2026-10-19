'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/layout/providers';
import { useBetSlip, type SlipItem } from '@/lib/store/betslip';

interface Selection {
  code: 'HOME' | 'DRAW' | 'AWAY';
  selectionId: string;
  oddsScaled: string;
  oddsVersion: number;
}
interface Match {
  home: string;
  away: string;
  matchId: string;
  marketId: string;
  marketLabel: string;
  expiresAt: string;
  selections: Selection[];
}
type Response = { ok: boolean; data?: { available: boolean; match: Match | null; message?: string } };
const labels: Record<Selection['code'], { en: string; fa: string }> = {
  HOME: { en: 'Home', fa: 'میزبان' },
  DRAW: { en: 'Draw', fa: 'مساوی' },
  AWAY: { en: 'Away', fa: 'میهمان' },
};

/** Owner-only one-leg test; the normal wallet-authoritative bet slip performs placement. */
export function BetsApiSingleBetTest() {
  const { locale, session, sessionLoading } = useApp();
  const replaceItems = useBetSlip(s => s.replaceItems);
  const [match, setMatch] = useState<Match | null>(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const fa = locale === 'fa';
  const admin = session?.user?.isAdmin === true;

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/v1/admin/betsapi/single-test-odds', {
        method: 'GET', cache: 'no-store', signal,
      });
      if (!response.ok) throw new Error('TEST_NOT_AVAILABLE');
      const body = await response.json() as Response;
      if (!body.ok || !body.data) throw new Error('TEST_NOT_AVAILABLE');
      if (signal?.aborted) return;
      setMatch(body.data.available ? body.data.match : null);
      setNotice(body.data.available ? '' : 'NO_FRESH_CANONICAL_1X2');
    } catch {
      if (!signal?.aborted) {
        setMatch(null);
        setNotice('TEST_NOT_AVAILABLE');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(controller.signal);
    }, 10_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [admin, refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const fresh = match !== null && now < Date.parse(match.expiresAt) - 1000;
  const choose = (selection: Selection) => {
    if (!admin || !fresh || !match) return;
    const item: SlipItem = {
      matchId: match.matchId,
      marketId: match.marketId,
      selectionId: selection.selectionId,
      oddsScaled: selection.oddsScaled,
      oddsVersionSeen: selection.oddsVersion,
      label: labels[selection.code][fa ? 'fa' : 'en'],
      marketLabel: match.marketLabel,
      matchLabel: match.home + ' - ' + match.away,
      sportSlug: 'football',
      addedAt: Date.now(),
    };
    // Deliberately replace any old slip and use SINGLE mode for this one-bet test.
    // This action only selects a price; it never submits or debits a wallet.
    replaceItems([item], 'SINGLE');
  };

  return <main className="mx-auto max-w-xl space-y-4 px-3 py-5 pb-32">
    <Link href="/live?sport=football" className="text-sm font-semibold text-[#087FF5]">
      {fa ? 'بازگشت به مسابقات زنده' : 'Back to live matches'}
    </Link>
    <h1 className="text-xl font-extrabold text-[#243547]">
      {fa ? 'آزمایش یک شرط BetsAPI' : 'BetsAPI single bet test'}
    </h1>
    <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
      {fa
        ? 'این حالت شبیه‌سازی نیست. اگر در بت‌اسلیپ «ثبت شرط» را تأیید کنی، مبلغ واقعی حساب کسر می‌شود. فقط با حساب و موجودی آزمایشی و حداقل مبلغ مجاز تست کن.'
        : 'This is NOT a simulation. Confirming the normal bet slip can debit real funds. Use a designated test account and the minimum permitted stake.'}
    </p>
    {sessionLoading ? <p className="text-sm text-slate-500">{fa ? 'در حال بررسی دسترسی…' : 'Checking access…'}</p> :
      !admin ? <p role="alert" className="rounded-xl bg-white p-4 text-sm text-red-600">
        {fa ? 'این صفحه فقط برای مدیر احرازشده در دسترس است.' : 'An authenticated administrator is required.'}
      </p> : <>
        <p className="text-xs text-slate-600">
          {fa
            ? 'فقط یک مارکت معتبر 1X2 از دیتابیس انتخاب می‌شود. ضریب‌های قدیمی یا تأییدنشده غیرفعال می‌مانند.'
            : 'Only one verified canonical 1X2 market is offered. Unverified or stale prices stay disabled.'}
        </p>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {match ? <>
            <p className="font-bold text-[#243547]">{match.home} — {match.away}</p>
            <p className="mb-3 mt-1 text-xs text-slate-500">{match.marketLabel}</p>
            <div className="grid grid-cols-3 gap-2">
              {match.selections.map(selection => <button
                key={selection.selectionId} type="button" disabled={!fresh}
                onClick={() => choose(selection)}
                className="rounded-xl border border-sky-200 bg-[#EFF6FF] px-2 py-4 text-center disabled:cursor-not-allowed disabled:opacity-35"
              >
                <span className="block text-xs text-slate-600">{labels[selection.code][fa ? 'fa' : 'en']}</span>
                <strong className="mt-1 block text-lg font-black text-sky-700">
                  {(Number(selection.oddsScaled) / 10000).toFixed(2)}
                </strong>
              </button>)}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {fresh
                ? (fa ? 'روی یک ضریب بزن، سپس بت‌اسلیپ را بررسی کن.' : 'Select one price, then review the bet slip.')
                : (fa ? 'ضریب منقضی شد؛ منتظر بروزرسانی بعدی بمان.' : 'Price expired; waiting for the next refresh.')}
            </p>
          </> : <p className="py-8 text-center text-sm text-slate-500">
            {loading ? (fa ? 'در حال بررسی ضرایب…' : 'Checking fresh prices…') :
              notice === 'TEST_NOT_AVAILABLE' ?
                (fa ? 'خطا در دریافت ضریب معتبر؛ دسترسی مدیر و اتصال دیتابیس را بررسی کن.' : 'Test odds unavailable. Check admin access and DB connectivity.') :
                (fa ? 'در حال حاضر هیچ مارکت 1X2 با سه ضریب تازه وجود ندارد. هر ۱۰ ثانیه بررسی می‌شود.' :
                  'No complete, fresh 1X2 market right now. Automatically checking every 10 seconds.')}
          </p>}
        </div>
        <button type="button" onClick={() => { setLoading(true); void refresh(); }}
          className="rounded-lg border border-sky-300 bg-white px-4 py-2 text-sm font-bold text-sky-700">
          {fa ? 'بررسی مجدد' : 'Refresh prices'}
        </button>
      </>}
  </main>;
}
