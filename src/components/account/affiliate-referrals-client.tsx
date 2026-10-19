'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';
import { ErrorNote, Skeleton } from '@/components/ui/primitives';

type Money = {
  currency:string; depositMinor:string; withdrawalMinor:string;
  wageredMinor:string; playerNetMinor:string; ledgerMinor:string; hasDeposited:boolean;
};
type Referral = {
  userId:string; numericId:string|null; publicId:string|null;
  code:string; status:string; registeredAt:string; confirmedAt:string|null;
  financialByCurrency:Money[]; periodFinancialByCurrency:Money[];
};
type ResponseData = {
  items:Referral[]; total:number; allTimeTotal:number; page:number; hasMore:boolean;
  statusCounts:{total:number;confirmed:number;review:number;pending:number};
  period:{from:string;to:string;timezone:string};
  periodSummary:{registrations:number;byCurrency:(Money & {depositingUsers:number})[]};
};

const DAY = 86_400_000;
function dateForTimeZone(timezone:string) {
  const parts = new Intl.DateTimeFormat('en-CA',{
    timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(new Date());
  const p=(name:string)=>parts.find(x=>x.type===name)?.value??'';
  return `${p('year')}-${p('month')}-${p('day')}`;
}
function daysBefore(day:string,count:number){
  return new Date(Date.parse(day+'T00:00:00Z')-count*DAY).toISOString().slice(0,10);
}
function negative(v:string){return /^-\d+$/.test(v)&&BigInt(v)<0n;}
function positive(v:string){return /^-?\d+$/.test(v)&&BigInt(v)>0n;}

export function AffiliateReferralsClient() {
  const {locale,session} = useApp();
  const word=(en:string,fa:string)=>locale==='fa'?fa:en;
  const [range,setRange]=useState<{from:string;to:string}|null>(null);
  const [draft,setDraft]=useState<{from:string;to:string}|null>(null);
  const [page,setPage]=useState(1);
  const [registeredOnly,setRegisteredOnly]=useState(false);
  const [open,setOpen]=useState<Record<string,boolean>>({});
  const path=session?.authenticated
    ? `/api/v1/affiliate/referrals?page=${page}&pageSize=20`
      + (range?`&from=${range.from}&to=${range.to}`:'')
      + (registeredOnly?'&registeredOnly=true':'')
    : null;
  const {data,loading,error,reload} = useApiQuery<ResponseData>(path);
  const timezone=data?.period.timezone??'Asia/Tehran';
  const today=dateForTimeZone(timezone);
  const selected=range??data?.period??{from:daysBefore(today,6),to:today};
  const effectiveDraft=draft??{from:selected.from,to:selected.to};
  const summary=data?.periodSummary;
  const stats=data?.statusCounts;
  const currentCount=data?.allTimeTotal ?? stats?.total;
  const currencies=useMemo(()=>summary?.byCurrency??[],[summary]);

  function choose(days:number){
    const from=days===1?today:daysBefore(today,days-1);
    setRange({from,to:today});setDraft(null);setPage(1);
  }
  function applyCustom(){
    if(!effectiveDraft.from||!effectiveDraft.to||effectiveDraft.from>effectiveDraft.to)return;
    setRange({from:effectiveDraft.from,to:effectiveDraft.to});setPage(1);
  }
  if(!session?.authenticated) return <div className="p-6">{word('Please log in','لطفاً وارد حساب شوید')}</div>;

  function moneyCells(values:Money[],periodLabel:string){
    return values.length ? values.map((money)=>(
      <div key={money.currency} className="rounded-2xl border border-[#DDE9E2] bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="rounded-lg bg-[#E1F6EA] px-2.5 py-1 text-xs font-black text-[#086943]">{money.currency}</span>
          <span className="text-[10px] text-[#627B6D]">{periodLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          {([
            [word('Deposits','واریز'),money.depositMinor],
            [word('Withdrawals','برداشت'),money.withdrawalMinor],
            [word('Settled player P/L','سود یا زیان تسویه‌شده کاربر'),money.playerNetMinor],
            [word('Recorded affiliate earnings','کمیسیون ثبت‌شده افیلیت'),money.ledgerMinor],
          ] as [string,string][]).map(([name,val])=>(
            <div key={name} className="min-w-0">
              <div className="text-[11px] leading-5 text-[#647B6F]">{name}</div>
              <div className={`mt-1 break-words text-sm font-extrabold tabular-nums ${negative(val)?'text-rose-700':positive(val)&&name.includes('P/L')?'text-emerald-700':'text-[#12251A]'}`}>
                {formatMinor(val,money.currency,locale)}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-[#6E8175]">{word('Different currencies are never combined. Earnings are recorded entries, not forecasts.','مبالغ ارزهای مختلف جمع نمی‌شوند. کمیسیون فقط مقادیر ثبت‌شده است، نه پیش‌بینی.')}</p>
      </div>
    )):<p className="rounded-2xl border border-[#E0EAE4] bg-white p-4 text-xs text-[#708779]">{word('No recorded transactions in this period','در این بازه تراکنشی ثبت نشده است')}</p>;
  }

  return (
    <section className="affiliate-referrals-v4 space-y-4 pb-10">
      <div className="overflow-hidden rounded-[25px] bg-gradient-to-br from-[#06170F] via-[#103A28] to-[#0A241A] px-5 py-7 text-white sm:px-7">
        <div className="text-[11px] font-bold uppercase tracking-[.19em] text-[#5EDD9D]">BETVIMA · PARTNERS</div>
        <h2 className="mt-2 text-2xl font-black">{word('Referrals & activity','زیرمجموعه‌ها و فعالیت‌ها')}</h2>
        <p className="mt-2 text-xs leading-6 text-[#C3DCCF]">{word('Every attributed account is visible, including accounts under review. All figures come from recorded transactions.','تمام کاربران معرفی‌شده، حتی افراد در حال بررسی، نمایش داده می‌شوند. همه مبالغ از تراکنش‌های واقعی استخراج می‌شوند.')}</p>
        <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-xl border border-white/15 bg-white/5">
          {([
            [word('All referrals','کل زیرمجموعه‌ها'),currentCount??'—'],
            [word('Confirmed','تأییدشده'),stats?.confirmed??'—'],
            [word('Under review','در انتظار بررسی'),stats?.review??'—'],
          ] as [string,number|string][]).map(([name,val])=>(
            <div key={name} className="border-r border-white/15 px-3 py-3 last:border-r-0">
              <div className="text-[10px] leading-4 text-[#B9D1C2]">{name}</div>
              <div className="mt-1 text-xl font-black tabular-nums">{val}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[22px] border border-[#DDE7E0] bg-white p-4 shadow-sm sm:p-5">
        <h3 className="font-black text-[#123421]">{word('Reporting period','بازه زمانی گزارش')}</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            [word('Today','امروز'),1],[word('Last 7 days','۷ روز گذشته'),7],
            [word('Last 30 days','۳۰ روز گذشته'),30],[word('Last 90 days','۹۰ روز گذشته'),90],
          ] as [string,number][]).map(([title,days])=>(
            <button key={days} type="button" onClick={()=>choose(days)}
              className="min-h-10 rounded-xl border border-[#D9E7DE] bg-[#F3FAF5] px-3 text-xs font-bold text-[#15583A] active:bg-[#CEF2DD]">{title}</button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="space-y-1 text-[11px] font-semibold text-[#5C7668]">
            <span>{word('From','از تاریخ')}</span>
            <input aria-label={word('From date','از تاریخ')} type="date" value={effectiveDraft.from}
              onChange={e=>setDraft({...effectiveDraft,from:e.target.value})}
              className="block h-11 w-full min-w-0 rounded-xl border border-[#D7E7DC] bg-white px-2 text-xs text-[#123421]"/>
          </label>
          <label className="space-y-1 text-[11px] font-semibold text-[#5C7668]">
            <span>{word('To','تا تاریخ')}</span>
            <input aria-label={word('To date','تا تاریخ')} type="date" value={effectiveDraft.to}
              onChange={e=>setDraft({...effectiveDraft,to:e.target.value})}
              className="block h-11 w-full min-w-0 rounded-xl border border-[#D7E7DC] bg-white px-2 text-xs text-[#123421]"/>
          </label>
        </div>
        <button type="button" disabled={effectiveDraft.from>effectiveDraft.to} onClick={applyCustom}
          className="mt-3 h-11 w-full rounded-xl bg-[#20C47B] text-sm font-extrabold text-[#08241A] disabled:opacity-40">
          {word('Apply date range','اعمال بازه زمانی')}
        </button>
        <p className="mt-2 text-[11px] text-[#667E6F]">{word('Dates use your affiliate reporting timezone','تاریخ‌ها براساس منطقه زمانی حساب افیلیت است')}: {timezone}</p>
      </div>

      {loading && !data && <Skeleton className="h-48 w-full"/>}
      {error && <ErrorNote message={error} onRetry={()=>void reload()} retryLabel={word('Retry','تلاش مجدد')}/>}

      {data && <>
        <div className="rounded-[22px] border border-[#DFEBE3] bg-[#ECF8F1] p-4">
          <div className="text-xs font-bold text-[#3A7355]">{word('New registrations during selected period','ثبت‌نام‌های جدید در بازه انتخاب‌شده')}</div>
          <div className="mt-1 text-3xl font-black text-[#123D29] tabular-nums">{summary?.registrations??0}</div>
          <div className="mt-1 text-xs text-[#4C735B]">{selected.from} — {selected.to}</div>
        </div>

        <div className="space-y-3">
          <h3 className="px-1 text-lg font-black text-[#142E20]">{word('Financial summary by currency','خلاصه مالی به تفکیک ارز')}</h3>
          {currencies.length===0
            ? <p className="rounded-2xl bg-white p-4 text-xs text-[#718477]">{word('No financial transactions in this period','در این بازه تراکنش مالی ثبت نشده است')}</p>
            : currencies.map(row=><div key={row.currency}>{moneyCells([row],word('Selected period','بازه انتخاب‌شده'))}
              <div className="mt-1 px-3 text-xs text-[#4E735C]">{word('Users with deposits','کاربران واریزکننده')}: <strong>{row.depositingUsers}</strong></div>
            </div>)}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h3 className="text-lg font-black text-[#143322]">{word('Referred users','کاربران زیرمجموعه')}</h3>
          <label className="flex items-center gap-2 text-xs font-semibold text-[#4A7056]">
            <input type="checkbox" checked={registeredOnly} onChange={e=>{setRegisteredOnly(e.target.checked);setPage(1)}}/>
            {word('Registered in period only','فقط ثبت‌نام‌های این بازه')}
          </label>
        </div>

        {(data.items.length===0&&!error)
          ? <p className="rounded-2xl bg-white p-5 text-xs text-[#667E6D]">{word('No referred users match this filter','کاربری مطابق این فیلتر وجود ندارد')}</p>
          : <div className="space-y-3">
              {data.items.map(user=>{
                const expanded=!!open[user.userId];
                const review=user.status==='review'||user.status==='pending';
                return <article key={user.userId} className="overflow-hidden rounded-[22px] border border-[#DCE8DF] bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F0F8F3] p-4">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold text-[#5F7B69]">{word('Player ID','شناسه کاربر')}</div>
                      <div className="mt-1 font-mono text-sm font-black text-[#153A26]">{user.numericId??user.publicId??user.userId.slice(0,13)+'…'}</div>
                      <div className="mt-1 text-[11px] text-[#6A8173]">{word('Registered','تاریخ ثبت‌نام')}: {formatDateTime(user.registeredAt,locale)}</div>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${review?'bg-amber-100 text-amber-800':user.status==='confirmed'?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-700'}`}>
                      {review?word('Under review','در حال بررسی'):user.status==='confirmed'?word('Confirmed','تأییدشده'):user.status}
                    </span>
                  </div>
                  <div className="p-3 sm:p-4">
                    <div className="grid grid-cols-1 gap-2">{moneyCells(user.periodFinancialByCurrency,word('Selected period','بازه انتخاب‌شده'))}</div>
                    <button type="button" onClick={()=>setOpen(s=>({...s,[user.userId]:!s[user.userId]}))}
                      aria-expanded={expanded}
                      className="mt-3 flex h-11 w-full items-center justify-center rounded-xl border border-[#CBE5D6] bg-[#E9F9F0] text-xs font-extrabold text-[#0A6843]">
                      {expanded?word('Hide all-time details','بستن جزئیات کل دوره'):word('View all-time deposits, withdrawals & P/L','نمایش مجموع واریز، برداشت و سود و زیان')}
                    </button>
                    {expanded&&<div className="mt-3 space-y-2">
                      {moneyCells(user.financialByCurrency,word('All time','از ابتدا تاکنون'))}
                      <p className="px-1 text-[11px] text-[#718477]">{word('Activity under review is visible but is not automatically confirmed for commission settlement.','فعالیت کاربران در حال بررسی دیده می‌شود، ولی کمیسیون آن‌ها خودکار تأیید نمی‌شود.')}</p>
                    </div>}
                  </div>
                </article>;
              })}
            </div>}
        <div className="flex items-center justify-between gap-3 px-1 py-2">
          <button type="button" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}
            className="h-10 rounded-xl border border-[#D7E5DA] bg-white px-4 text-xs font-bold text-[#175A3D] disabled:opacity-40">{word('Previous','قبلی')}</button>
          <span className="text-xs font-bold text-[#476F56]">{word('Page','صفحه')} {page}</span>
          <button type="button" disabled={!data.hasMore} onClick={()=>setPage(p=>p+1)}
            className="h-10 rounded-xl bg-[#0B8859] px-4 text-xs font-bold text-white disabled:opacity-40">{word('Next','بعدی')}</button>
        </div>
      </>}
    </section>
  );
}
