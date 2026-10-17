'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { Card, EmptyState, ErrorNote, Field, Skeleton, Stat, StatusPill } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';
import { voucherIrrToWalletMinor, voucherMinimumWalletMinor, voucherUsdToWalletMinor, voucherWalletMinorToIrr, voucherWalletToUsdMinor, voucherWithdrawalDebit } from '@/lib/voucher-fx';
function formatVoucherRials(value: bigint, locale: string): string {
  return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', { maximumFractionDigits: 0 }).format(value);
}
function voucherQuoteFresh(quote: UwalletReferenceQuote | null): boolean {
  if (!quote || quote.source !== 'uwallet') return false;
  const age = Date.now() - Date.parse(quote.quotedAt);
  return Number.isFinite(age) && age >= -5_000 && age < 60_000;
}
function parsedVoucherRials(value: string, currency: string): bigint | null {
  const raw = normalizeNumericInput(value);
  if (!/^\d{1,19}$/.test(raw) || (currency !== 'IRT' && currency !== 'IRR')) return null;
  try { return voucherIrrToWalletMinor(BigInt(raw), currency); } catch { return null; }
}
type UwalletReferenceQuote = { source:'uwallet'; rateIrrPerUsd:string; quotedAt:string; signature:string; distinctBuySellRatesAvailable:boolean };
function normalizeNumericInput(value: string): string {
  return String(value ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/٬/g, '')
    .replace(/,/g, '')
    .trim();
}

import { ArrowDownToLine, ArrowUpFromLine, CalendarDays, Check, ChevronDown, CircleCheck, Copy, CreditCard, Eye, History, Info, QrCode, Search, ShieldCheck, SlidersHorizontal, WalletCards, X } from 'lucide-react';

interface WalletPayload {
  wallet: { balanceMinor: string; heldMinor: string; currency: string; status: string } | null;
  integrity: 'ok' | 'mismatch';
  transactions: {
    items: {
      id: string;
      type: string;
      direction: string;
      amountMinor: string;
      balanceAfterMinor: string;
      createdAt: string;
      description: string | null;
    }[];
    totals: { creditMinor: string; debitMinor: string; netMinor: string };
  };
  payments: {
    items: {
      id: string;
      publicId: string;
      direction: string;
      status: string;
      amountMinor: string;
      currency: string;
      providerId: string | null;
      failureCode: string | null;
      failureMessage: string | null;
      createdAt: string;
      completedAt: string | null;
    }[];
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

type DepositKind = 'fiat' | 'crypto' | 'uvoucher' | 'hotvoucher';

function paymentStatusLabel(direction: string, status: string, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (status === 'succeeded') return direction === 'deposit' ? t('wallet.statusDeposited') : t('wallet.statusSent');
  if (['failed', 'cancelled', 'refunded', 'reversed'].includes(status)) return t('wallet.statusCancelled');
  return direction === 'withdrawal' ? t('wallet.statusSending') : t('wallet.statusAwaitingDeposit');
}

function paymentStatusClass(direction: string, status: string) {
  if (status === 'succeeded') return 'bg-[#E8F8EF] text-[#07883F]';
  if (['failed', 'cancelled', 'refunded', 'reversed'].includes(status)) return 'bg-[#FFF0F2] text-[#D8324D]';
  return direction === 'withdrawal'
    ? 'bg-[#EEF4FF] text-[#087FF5]'
    : 'bg-[#FFF8E8] text-[#A66A00]';
}
interface CryptoPaymentResult {
  publicId: string;
  status: string;
  providerId: string | null;
  providerMetadata?: Record<string, unknown> | null;
}


function SelectBox({
  label,
  value,
  onClick,
  icon,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[52px] w-full items-center justify-between rounded-[14px] bg-[#F1F3F6] px-4 text-left transition hover:bg-[#E9ECF0] active:scale-[.995]"
    >
      <span className="flex min-w-0 items-center gap-3">
        {icon ? <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[#15945B] shadow-sm">{icon}</span> : null}
        <span className="truncate text-[14px] font-semibold text-[#30343A]">{value}</span>
      </span>
      <ChevronDown size={22} strokeWidth={2.2} className="shrink-0 text-[#747B84]" />
    </button>
  );
}

function NovaDropdown({ label, value, options, onChange, icon }: { label: string; value: string; options: { value: string; label: string; icon?: React.ReactNode }[]; onChange: (value: string) => void; icon?: React.ReactNode }) { const [open, setOpen] = useState(false); const selected = options.find((item) => item.value === value) ?? options[0]; return (<div className="relative"><button type="button" onClick={() => setOpen((v) => !v)} className={`flex min-h-[58px] w-full items-center justify-between rounded-[18px] border px-3.5 text-left transition-all ${open ? "border-[#087FF5] bg-[#F7FAFF] ring-4 ring-[#087FF5]/10" : "border-[#DDE3EA] bg-white hover:border-[#C8D5E5]"}`}><span className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#087FF5]">{icon}</span><span className="min-w-0"><span className="block text-[10px] font-black uppercase tracking-[.08em] text-[#8994A5]">{label}</span><span className="mt-0.5 block truncate text-[13px] font-black text-[#172033]">{selected?.label ?? value}</span></span></span><ChevronDown className={`h-5 w-5 shrink-0 text-[#697586] transition-transform ${open ? "rotate-180" : ""}`} /></button>{open ? <div className="absolute left-0 right-0 top-[64px] z-[60] overflow-hidden rounded-[18px] border border-[#DDE3EA] bg-white p-1.5 shadow-[0_18px_45px_rgba(15,23,42,.16)]">{options.map((option) => { const active = option.value === value; return <button key={option.value} type="button" onClick={() => { onChange(option.value); setOpen(false); }} className={`flex min-h-[50px] w-full items-center gap-3 rounded-[14px] px-3 text-left transition ${active ? "bg-[#EEF4FF]" : "hover:bg-[#F7F9FC]"}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? "bg-[#087FF5] text-white" : "bg-[#F1F4F8] text-[#738197]"}`}>{option.icon}</span><span className={`flex-1 text-[13px] font-black ${active ? "text-[#087FF5]" : "text-[#344054]"}`}>{option.label}</span>{active ? <CircleCheck className="h-5 w-5 text-[#087FF5]" /> : null}</button>; })}</div> : null}</div>); }
function DepositQrPlaceholder() {
  return (
    <div className="relative grid h-[118px] w-[118px] place-items-center overflow-hidden rounded-xl bg-white">
      <QrCode size={112} strokeWidth={1.35} className="text-[#171B20]" />
      <span className="absolute bottom-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[7px] font-bold text-[#8A9097]">
        QR PREVIEW
      </span>
    </div>
  );
}

function DepositPanel({
  currency, methods, form, setForm, loadMethods, message, messageTone, payment, submitting, onCreatePayment, onVoucherDeposit, voucherQuote, voucherQuoteLoading,
}: {
  currency:string;
  methods:{id:string;nameFa:string;nameEn:string;isAvailable:boolean;unavailableReason?:string;minAmountMinor:string;maxAmountMinor:string}[];
  form:{amount:string;methodId:string;destination:string};
  setForm:React.Dispatch<React.SetStateAction<{amount:string;methodId:string;destination:string}>>;
  loadMethods:(methodCurrency?: string)=>Promise<void>;
  message:string|null;
  messageTone:'success'|'error'|'neutral';
  payment:CryptoPaymentResult|null;
  onCreatePayment:(asset:string,network:string)=>Promise<void>;
  onVoucherDeposit:(methodId:string,amount:string,code:string)=>Promise<void>;
  submitting:boolean;
  voucherQuote:UwalletReferenceQuote|null;
  voucherQuoteLoading:boolean;
}) {
  const { t, locale } = useApp();
  const [kind,setKind]=useState<DepositKind>('crypto');
  const [asset,setAsset]=useState(currency==='IRT'?'IRT':currency);
  const [network,setNetwork]=useState('Tron (TRC-20)');
  const [currencyOpen,setCurrencyOpen]=useState(false);
  const [networkOpen,setNetworkOpen]=useState(false);
  const [currencySearch,setCurrencySearch]=useState('');
  const [showDepositInstructions,setShowDepositInstructions]=useState(false);
  const [voucherCode,setVoucherCode]=useState('');
  const fiatCurrencies=[
    {code:'USD',name:'US dollar',symbol:'$',tone:'bg-[#173DAA] text-white'},
    {code:'EUR',name:'Euro',symbol:'€',tone:'bg-[#2558B8] text-white'},
    {code:'GBP',name:'British pound',symbol:'£',tone:'bg-[#243B8B] text-white'},
    {code:'IRT',name:'Iranian toman',symbol:'IRR',tone:'bg-[#138A55] text-white'},
  ];
  const cryptoCurrencies=[
    {code:'USDT',name:'Tether USD',symbol:'₮',tone:'bg-[#45B99A] text-white'},
    {code:'BTC',name:'Bitcoin',symbol:'₿',tone:'bg-[#F7931A] text-white'},
    {code:'ETH',name:'Ethereum',symbol:'◆',tone:'bg-[#6877E8] text-white'},
    {code:'TRX',name:'TRON',symbol:'T',tone:'bg-[#E63946] text-white'},
    {code:'XRP',name:'XRP',symbol:'✕',tone:'bg-[#23292F] text-white'},
    {code:'DOGE',name:'Dogecoin',symbol:'Ð',tone:'bg-[#C2A633] text-white'},
    {code:'ADA',name:'Cardano',symbol:'₳',tone:'bg-[#0033AD] text-white'},
  ];
  const networkMap:Record<string,{name:string;time:string}[]>={
    USDT:[{name:'Tron (TRC-20)',time:'≈ 1 min'},{name:'Ethereum (ERC-20)',time:'≈ 3 min'},{name:'BNB Smart Chain (BEP-20)',time:'≈ 1 min'},{name:'SOLANA',time:'≈ 1 min'}],
    BTC:[{name:'Bitcoin',time:'≈ 10 min'}],
    ETH:[{name:'Ethereum (ERC-20)',time:'≈ 3 min'}],
    TRX:[{name:'Tron (TRC-20)',time:'≈ 1 min'}],
    XRP:[{name:'XRP Ledger',time:'≈ 1 min'}],
    DOGE:[{name:'Dogecoin',time:'≈ 5 min'}],
    ADA:[{name:'Cardano',time:'≈ 5 min'}],
  };
  const currencies=kind==='crypto'?cryptoCurrencies:fiatCurrencies;
  const selected=currencies.find(x=>x.code===asset)??currencies[0]!;
  const networks=networkMap[asset] || [];
  const filtered=currencies.filter(x=>`${x.name} ${x.code}`.toLowerCase().includes(currencySearch.toLowerCase()));
  const chooseKind=(next:DepositKind)=>{ if(next==='fiat') return;
    setKind(next);setCurrencyOpen(false);setNetworkOpen(false);setCurrencySearch('');setForm(v=>({...v,amount:''}));
    if(next==='crypto'){setAsset('USDT');setNetwork('Tron (TRC-20)');}else if(next==='uvoucher' || next==='hotvoucher'){setAsset('USD');setNetwork('');setVoucherCode('');setForm(v=>({...v,methodId:next==='uvoucher'?'voucher_uvoucher':'voucher_hotvoucher'}));}else{setAsset(currency);setNetwork('');setForm(v=>({...v,methodId:''}));}
    void loadMethods(next === 'crypto' || next === 'uvoucher' || next === 'hotvoucher' ? 'USD' : currency);
  };
  return <div className="overflow-hidden rounded-[24px] border border-[#E1E7EF] bg-white shadow-[0_12px_36px_rgba(15,23,42,.07)]">
    <div className="flex items-center gap-3 border-b border-[#E8ECF2] px-4 py-4 sm:px-6">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EAF8F0] text-[#0A9E58]"><ArrowDownToLine className="h-5 w-5"/></div>
      <div><h2 className="text-[18px] font-black text-[#111827]">{t("wallet.deposit")}</h2><p className="mt-0.5 text-xs font-medium text-[#7A8494]">{t("wallet.addFundsToWallet")}</p></div>
    </div>
    <div className="space-y-5 p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F1F4F8] p-1.5 sm:grid-cols-4">
        {(['fiat','crypto','uvoucher','hotvoucher'] as const).map(x=><button key={x} type="button" disabled={x==='fiat'} onClick={()=>x==='fiat'?undefined:chooseKind(x)} className={`flex h-12 items-center justify-center gap-2 rounded-xl text-[11px] font-black sm:text-xs ${kind==='fiat'?'cursor-not-allowed opacity-50 text-[#A0A8B5]':kind===x?'bg-white text-[#111827] shadow-sm':'text-[#7A8494]'}`}>
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[9px] font-black ${kind===x?(x==='fiat'?'bg-[#0A9E58]':x==='crypto'?'bg-[#F7931A]':x==='uvoucher'?'bg-[#6D28D9]':'bg-[#E11D48]')+' text-white':'bg-[#DDE3EA] text-[#7A8494]'}`}>{x==='fiat'?'🔒':x==='crypto'?'₿':x==='uvoucher'?'UV':'HV'}</span>{x==='fiat'?t("wallet.fiat"):x==='crypto'?t("wallet.crypto"):x==='uvoucher'?t("wallet.uVoucher") : t("wallet.hotVoucher")}
        </button>)}
      </div>
      {kind!=='uvoucher' && kind!=='hotvoucher' ? (
      <div className="grid gap-2">
        <label className="text-xs font-black uppercase tracking-[.08em] text-[#697586]">{t("wallet.currency")}</label>
        <div className="relative">
          <button type="button" onClick={()=>{setCurrencyOpen(v=>!v);setNetworkOpen(false);setCurrencySearch('')}} className="flex min-h-[62px] w-full items-center justify-between rounded-2xl border border-[#DDE3EA] bg-white px-4 text-left shadow-sm">
            <span className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-full text-sm font-black ${selected.tone}`}>{selected.symbol}</span><span><b className="block text-sm text-[#172033]">{kind==='crypto'?selected.code:selected.name}</b><small className="text-[11px] font-semibold text-[#8994A5]">{selected.name}</small></span></span>
            <ChevronDown className={`h-5 w-5 text-[#697586] ${currencyOpen?'rotate-180':''}`}/>
          </button>
          {currencyOpen?<div className="absolute left-0 right-0 top-[70px] z-50 overflow-hidden rounded-2xl border border-[#DDE3EA] bg-white shadow-xl">
            <div className="p-3"><div className="flex h-12 items-center gap-3 rounded-xl bg-[#F3F5F8] px-3"><Search className="h-5 w-5 text-[#687589]"/><input autoFocus value={currencySearch} onChange={e=>setCurrencySearch(e.target.value)} placeholder={t("wallet.searchCurrency")} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"/></div></div>
            <div className="max-h-72 overflow-y-auto px-2 pb-2">{filtered.map(item=><button key={item.code} type="button" onClick={()=>{setAsset(item.code);setNetwork(networkMap[item.code]?.[0]?.name??'Tron (TRC-20)');setCurrencyOpen(false);setCurrencySearch('')}} className="flex min-h-[64px] w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-[#F5F7FA]">
              <span className={`grid h-9 w-9 place-items-center rounded-full text-xs font-black ${item.tone}`}>{item.symbol}</span><span className="flex-1"><b className="block text-sm text-[#172033]">{item.name}</b><small className="text-[11px] text-[#8994A5]">{item.code}</small></span>{asset===item.code?<CircleCheck className="h-5 w-5 text-[#0A9E58]"/>:null}
            </button>)}</div>
          </div>:null}
        </div>
      </div>
      ) : null}
      {kind==='crypto'?<div className="grid gap-2"><label className="text-xs font-black uppercase tracking-[.08em] text-[#697586]">{t("wallet.network")}</label><div className="relative">
        <button type="button" onClick={()=>{setNetworkOpen(v=>!v);setCurrencyOpen(false)}} className="flex min-h-[58px] w-full items-center justify-between rounded-2xl border border-[#DDE3EA] bg-white px-4 text-left shadow-sm"><span><b className="block text-sm text-[#172033]">{network}</b><small className="text-[11px] font-semibold text-[#0A9E58]">{t("wallet.fastConfirmation")}</small></span><ChevronDown className={`h-5 w-5 ${networkOpen?'rotate-180':''}`}/></button>
        {networkOpen?<div className="absolute left-0 right-0 top-[64px] z-40 overflow-hidden rounded-2xl border bg-white shadow-xl">{networks.map(item=><button key={item.name} type="button" onClick={()=>{setNetwork(item.name);setNetworkOpen(false)}} className="flex min-h-[60px] w-full items-center justify-between border-b px-4 text-left last:border-0 hover:bg-[#F6F8FA]"><span><b className="block text-sm text-[#172033]">{item.name}</b><small className="text-[11px] text-[#8994A5]">{item.time}</small></span>{network===item.name?<CircleCheck className="h-5 w-5 text-[#0A9E58]"/>:null}</button>)}</div>:null}
      </div></div>:null}
      {kind==='crypto'?<>
        <div className="grid gap-2"><label className="text-xs font-black uppercase tracking-[.08em] text-[#697586]">{t("wallet.amountDeposit")}</label><div className="flex min-h-[60px] items-center rounded-2xl border border-[#DDE3EA] px-4 shadow-sm focus-within:border-[#087FF5] focus-within:ring-4 focus-within:ring-[#087FF5]/10"><input className="min-w-0 flex-1 bg-transparent text-[17px] font-black outline-none" type="number" min="20" step=".01" inputMode="decimal" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder={t("wallet.amountPlaceholder")}/><b className="text-sm text-[#7B8798]">USD</b></div><small className="px-1 text-[11px] font-semibold text-[#8994A5]">{t("wallet.minimumDeposit")}</small></div>
        <button type="button" disabled={submitting||!form.amount||Number(normalizeNumericInput(form.amount))<20} onClick={()=>setShowDepositInstructions(true)} className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#087FF5] to-[#1769E8] text-sm font-black text-white shadow-lg disabled:opacity-50"><ArrowDownToLine className="h-5 w-5"/>{submitting?t("wallet.creatingPayment"):t("wallet.createCryptoPayment")}</button>
        {showDepositInstructions?<div className="fixed inset-0 z-[100] grid place-items-center bg-[#07111F]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[430px] overflow-hidden rounded-[24px] border border-[#DDE5EF] bg-white shadow-[0_25px_70px_rgba(15,23,42,.25)]">
            <div className="border-b border-[#E8ECF2] px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EAF8F0] text-[#0A9E58]"><ArrowDownToLine className="h-5 w-5"/></div>
                <div><h3 className="text-[18px] font-black text-[#172033]">{t("wallet.depositGuide")}</h3><p className="mt-0.5 text-[11px] font-semibold text-[#8994A5]">{t("wallet.reviewBeforeContinue")}</p></div>
              </div>
            </div>
            <div className="space-y-3 px-5 py-5 text-[12px] font-semibold leading-5 text-[#526074]">
              <div className="rounded-2xl border border-[#BCE8CE] bg-[#ECFBF2] p-4"><b className="block text-[#087A3D]">{t("wallet.minimumDeposit")}</b><span className="mt-1 block">{t("wallet.minimumDepositWarning")}</span></div>
              <div className="rounded-2xl border border-[#F1D59A] bg-[#FFF9EA] p-4"><b className="block text-[#8A5A00]">{t("wallet.checkNetworkCarefully")}</b><span className="mt-1 block">{t("wallet.networkWarning")}</span></div>
              <div className="rounded-2xl border border-[#D8E5F7] bg-[#F2F7FF] p-4"><b className="block text-[#087FF5]">{t("wallet.confirmationTime")}</b><span className="mt-1 block">{t("wallet.confirmationDescription")}</span></div>
            </div>
            <div className="flex gap-2 border-t border-[#E8ECF2] bg-[#FAFBFC] p-4">
              <button type="button" onClick={()=>setShowDepositInstructions(false)} className="min-h-[50px] flex-1 rounded-2xl border border-[#DDE3EA] bg-white text-sm font-black text-[#526074]">{t("common.cancel")}</button>
              <button type="button" disabled={submitting} onClick={()=>{setShowDepositInstructions(false);void onCreatePayment(asset,network)}} className="min-h-[50px] flex-1 rounded-2xl bg-[#087FF5] text-sm font-black text-white disabled:opacity-50">{submitting?t("wallet.creating"):t("common.continue")}</button>
            </div>
          </div>
        </div>:null}
        {payment?.providerMetadata?.pay_address?<div className="rounded-2xl border bg-[#F7FAFD] p-4"><b className="text-sm text-[#172033]">{t("wallet.depositAddress")}</b><p className="mt-2 break-all text-[11px] font-semibold leading-5 text-[#718096]">{String(payment.providerMetadata.pay_address)}</p><button type="button" onClick={()=>void navigator.clipboard.writeText(String(payment.providerMetadata?.pay_address))} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-[#087FF5]"><Copy className="h-4 w-4"/>{t("wallet.copyAddress")}</button></div>:null}
      </>:kind==='uvoucher' || kind==='hotvoucher'?<div className="space-y-4 rounded-2xl border border-[#DDE5EF] bg-[#F7F9FB] p-5">
        {(() => {
          const methodId=kind==='uvoucher'?'voucher_uvoucher':'voucher_hotvoucher';
          const method=methods.find(m=>m.id===methodId);
          const available=Boolean(method?.isAvailable);
          const isRialWallet=currency==='IRT'||currency==='IRR';
          const rate=voucherQuoteFresh(voucherQuote)?voucherQuote!.rateIrrPerUsd:null;
          const configuredMin=BigInt(method?.minAmountMinor??'0');
          const minimumUsdMinor=configuredMin>150n?configuredMin:150n;
          const maximumUsdMinor=BigInt(method?.maxAmountMinor??'0');
          const minRials=isRialWallet&&rate?voucherWalletMinorToIrr(voucherMinimumWalletMinor(minimumUsdMinor,currency,rate),currency):null;
          const maxRials=isRialWallet&&rate&&maximumUsdMinor>0n?voucherWalletMinorToIrr(voucherUsdToWalletMinor(maximumUsdMinor,currency,rate),currency):null;
          const raw=normalizeNumericInput(form.amount);
          const requestedMinor=isRialWallet?parsedVoucherRials(raw,currency):null;
          const usdMinor=isRialWallet
            ? requestedMinor!==null&&rate?voucherWalletToUsdMinor(requestedMinor,currency,rate):null
            : /^\d+(?:\.\d{1,2})?$/.test(raw)?(()=>{const [whole,fraction='']=raw.split('.');return BigInt(whole!)*100n+BigInt(fraction.padEnd(2,'0'));})():null;
          const validAmount=usdMinor!==null&&usdMinor>=minimumUsdMinor&&(maximumUsdMinor===0n||usdMinor<=maximumUsdMinor)&&(!isRialWallet||Boolean(rate));
          const unit=locale==='fa'?'ریال':'IRR';
          return <>
            <div>
              {isRialWallet?<div className="mb-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-[#DEE8F4] bg-white p-3"><span className="block text-[11px] text-[#7A8494]">{locale==='fa'?'حداقل واریز':'Minimum deposit'}</span><b className="mt-1 block break-words text-sm text-[#172033]">{minRials!==null?formatVoucherRials(minRials,locale)+' '+unit:'—'}</b></div>
                <div className="rounded-xl border border-[#DEE8F4] bg-white p-3"><span className="block text-[11px] text-[#7A8494]">{locale==='fa'?'حداکثر واریز':'Maximum deposit'}</span><b className="mt-1 block break-words text-sm text-[#172033]">{maxRials!==null?formatVoucherRials(maxRials,locale)+' '+unit:maximumUsdMinor===0n?(locale==='fa'?'طبق اعتبار کد':'Voucher face value'):'—'}</b></div>
              </div>:<p className="mb-2 text-xs font-semibold text-[#526074]">Min {(Number(minimumUsdMinor)/100).toFixed(2)} USD{maximumUsdMinor>0n?' · Max '+(Number(maximumUsdMinor)/100).toFixed(2)+' USD':''}</p>}
              <label className="mb-2 block text-xs font-black uppercase text-[#526074]">{isRialWallet?(locale==='fa'?'مبلغ واریز (ریال)':'Deposit amount (IRR)'):t('wallet.amountUsd')}</label>
              <div className="flex min-h-[60px] items-center rounded-2xl border border-[#DDE5EF] bg-white px-4 focus-within:border-[#087FF5] focus-within:ring-4 focus-within:ring-[#087FF5]/10">
                <input value={isRialWallet&&/^\d+$/.test(raw)?formatVoucherRials(BigInt(raw),locale):form.amount} onChange={e=>setForm(v=>({...v,amount:normalizeNumericInput(e.target.value),methodId}))} inputMode={isRialWallet?'numeric':'decimal'} dir="ltr" placeholder={isRialWallet?(minRials!==null?formatVoucherRials(minRials,'en'):'—'):'1.50'} className="min-w-0 flex-1 bg-transparent py-3 text-lg font-black text-[#172033] outline-none"/>
                <b className="shrink-0 text-xs font-black text-[#7B8798]">{isRialWallet?unit:'USD'}</b>
              </div>
              {isRialWallet?<p className="mt-3 rounded-xl border border-[#D8E5F7] bg-[#F1F7FF] p-3 text-xs font-semibold leading-5 text-[#506582]"><b className="mb-1 block text-[#173DAA]">{locale==='fa'?'نرخ زنده uWallet':'Live uWallet rate'}</b>{rate?formatVoucherRials(BigInt(Math.round(Number(rate))),locale)+' '+unit+(locale==='fa'?' به‌ازای هر دلار':' per USD'):voucherQuoteLoading?(locale==='fa'?'در حال دریافت نرخ...':'Loading rate...'):(locale==='fa'?'نرخ در دسترس نیست؛ واریز غیرفعال است.':'Rate unavailable; deposit disabled.')}<span className="mt-1 block text-[#78849A]">{locale==='fa'?'مبلغ نهایی پس از تأیید اعتبار کد در uWallet محاسبه می‌شود.':'Final amount is determined from the voucher value verified by uWallet.'}</span></p>:null}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#172033]">{t("wallet.voucherCode")}</label>
              <input value={voucherCode} onChange={e=>setVoucherCode(e.target.value)} autoComplete="off" placeholder={t("wallet.enterVoucherCode")} className="w-full rounded-xl border border-[#DDE5EF] bg-white px-4 py-3 text-[#172033] outline-none focus:border-[#173DAA]"/>
            </div>
            {!available?<div className="rounded-xl border border-[#F1D2D2] bg-[#FFF6F6] px-4 py-3 text-sm text-[#A33A3A]">{method?.unavailableReason==='UWALLET_COIN_NOT_CONFIGURED'?t("wallet.voucherTemporarilyUnavailable"):method?.unavailableReason==='UWALLET_NOT_CONFIGURED'?t("wallet.voucherServiceNotConfigured"):t("wallet.paymentMethodUnavailable")}</div>:null}
            <button type="button" disabled={!available||!validAmount||!voucherCode.trim()||submitting} onClick={()=>void onVoucherDeposit(methodId,form.amount,voucherCode.trim())} className="w-full rounded-xl bg-[#173DAA] px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50">{submitting?t('wallet.processing'):t('wallet.depositWithVoucher')}</button>
          </>;
        })()}
      </div>:<div className="rounded-2xl border bg-[#F7F9FB] p-5 text-center"><CreditCard className="mx-auto h-7 w-7 text-[#687589]"/><b className="mt-2 block text-sm text-[#172033]">{t("wallet.fiatPaymentMethods")}</b><p className="mt-1 text-xs text-[#8994A5]">{t("wallet.selectPaymentMethodToContinue")}</p></div>}
      {message?<div className={`rounded-xl border px-4 py-3 text-center text-xs font-bold ${messageTone==='success'?'border-[#BCE8CE] bg-[#ECFBF2] text-[#087A3D]':messageTone==='error'?'border-[#F2C5CC] bg-[#FFF1F3] text-[#C92F49]':'border-[#DDE3EA] bg-[#F7F9FB] text-[#526074]'}`}>{message}</div>:null}
    </div>
  </div>;
}

function WithdrawPanel({
  form,setForm,submitting,message,messageTone,onSubmit,onVoucherSubmit,onInsufficientBalance,availableMinor,currency,methods,voucherQuote,voucherQuoteLoading,
}: {
  form:{amount:string;methodId:string;destination:string};
  setForm:React.Dispatch<React.SetStateAction<{amount:string;methodId:string;destination:string}>>;
  submitting:boolean;
  message:string|null;
  messageTone:'success'|'error'|'neutral';
  onSubmit:(asset:string,network:string)=>Promise<void>;
  onVoucherSubmit:(methodId:'voucher_uvoucher'|'voucher_hotvoucher', amountMinor:string, requestedWalletMinor:string|null)=>Promise<void>;
  voucherQuote:UwalletReferenceQuote|null;
  voucherQuoteLoading:boolean;
  onInsufficientBalance:()=>void;
  availableMinor:string;
  currency:string;
  methods:{id:string;nameFa:string;nameEn:string;isAvailable:boolean;unavailableReason?:string;minAmountMinor:string;maxAmountMinor:string}[];
}) {
  const { t, locale } = useApp();
  const [asset,setAsset]=useState('TRX');
  const [withdrawMethod,setWithdrawMethod]=useState<'crypto'|'voucher_uvoucher'|'voucher_hotvoucher'>('crypto');
  const [network,setNetwork]=useState('Tron (TRC-20)');
  const [networkOpen,setNetworkOpen]=useState(false);
  const [showWithdrawConfirmation,setShowWithdrawConfirmation]=useState(false);
  const assets=[
    {code:'USDT',name:'Tether USD',symbol:'₮',tone:'bg-[#45B99A] text-white',networks:['Tron (TRC-20)','Ethereum (ERC-20)','BNB Smart Chain (BEP-20)','SOLANA']},
    {code:'BTC',name:'Bitcoin',symbol:'₿',tone:'bg-[#F7931A] text-white',networks:['Bitcoin']},
    {code:'ETH',name:'Ethereum',symbol:'◆',tone:'bg-[#6877E8] text-white',networks:['Ethereum (ERC-20)']},
    {code:'TRX',name:'TRON',symbol:'T',tone:'bg-[#E63946] text-white',networks:['Tron (TRC-20)']},
    {code:'XRP',name:'XRP',symbol:'✕',tone:'bg-[#23292F] text-white',networks:['XRP Ledger']},
    {code:'ADA',name:'Cardano',symbol:'₳',tone:'bg-[#0033AD] text-white',networks:['Cardano']},
    {code:'DOGE',name:'Dogecoin',symbol:'Ð',tone:'bg-[#C2A633] text-white',networks:['Dogecoin']},
  ];
  const selected=assets.find(x=>x.code===asset)??assets[0]!;
  const [usdIrrRate,setUsdIrrRate]=useState<string|null>(null);
  const [usdIrrRateLoading,setUsdIrrRateLoading]=useState(false);

  useEffect(() => {
    let cancelled = false;
    setUsdIrrRateLoading(true);
    apiRequest<{ symbol:string; value:string; timestamp:string|null }>('/api/v1/fx/usd-irr')
      .then((result) => {
        if (!cancelled) setUsdIrrRate(result.value);
      })
      .catch(() => {
        if (!cancelled) setUsdIrrRate(null);
      })
      .finally(() => {
        if (!cancelled) setUsdIrrRateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableUsd = (() => {
    try {
      if (!usdIrrRate || (currency !== 'IRR' && currency !== 'IRT')) return null;
      const rate = Number(usdIrrRate);
      if (!Number.isFinite(rate) || rate <= 0) return null;
      const factor = currency === 'IRT' ? 100 : 10;
      return Number(BigInt(availableMinor || '0')) * factor / rate / 100;
    } catch {
      return null;
    }
  })();

  const maxAmount = availableUsd === null
    ? '0.00'
    : (Math.floor(availableUsd * 100) / 100).toFixed(2);
  const cryptoMaxAmount = currency === 'USD'
    ? (Number(BigInt(availableMinor || '0')) / 100).toFixed(2)
    : availableMinor || '0';
  const cryptoMinimumMinor = (() => {
    if (currency === 'USD') return '2000';
    const rate = Number(usdIrrRate);
    if (!Number.isFinite(rate) || rate <= 0) return '0';
    const factor = currency === 'IRT' ? 100 : 10;
    return String(Math.ceil((2000 * rate) / factor));
  })();

  const methodSelector = (
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[#E1E6ED] bg-[#F7F9FC] p-1.5">
      {[
        { id: "crypto", label: "Crypto" },
        { id: "voucher_uvoucher", label: "U-Voucher" },
        { id: "voucher_hotvoucher", label: "Hot Voucher" },
      ].map((item) => {
        const available =
          item.id === "crypto" ||
          methods.find((method) => method.id === item.id)?.isAvailable === true;

        return (
          <button
            key={item.id}
            type="button"
            disabled={!available}
            onClick={() =>
              setWithdrawMethod(
                item.id as "crypto" | "voucher_uvoucher" | "voucher_hotvoucher",
              )
            }
            className={`min-h-[48px] rounded-xl px-2 text-xs font-black transition ${
              withdrawMethod === item.id
                ? "bg-white text-[#087FF5] shadow-sm ring-2 ring-[#087FF5]/10"
                : "text-[#697586] hover:bg-white/70"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );

  if (withdrawMethod !== "crypto") {
    const selectedVoucher = methods.find((method) => method.id === withdrawMethod);
    const voucherLabel = withdrawMethod === "voucher_uvoucher" ? t("wallet.uVoucher") : t("wallet.hotVoucher");
    const voucherAvailable = selectedVoucher?.isAvailable === true;
    const voucherRate = Number(voucherQuote?.rateIrrPerUsd ?? 0)/10;
    const voucherRateValid = Number.isFinite(voucherRate) && voucherRate > 0 &&
      Date.now()-Date.parse(voucherQuote?.quotedAt??'') < 60_000;
    const configuredUsdMinimum = selectedVoucher
      ? Number(BigInt(selectedVoucher.minAmountMinor || '0')) / 100
      : 0;
    const voucherWalletMin = currency === 'USD'
      ? configuredUsdMinimum
      : voucherRateValid
        ? Math.ceil(150 * voucherRate / (currency === 'IRT' ? 100 : 10))
        : null;
    const voucherWalletMax = currency === 'USD'
      ? Number(BigInt(availableMinor || '0')) / 100
      : Number(BigInt(availableMinor || '0'));
    const voucherWalletUnit = currency === 'IRT' ? (locale === 'fa' ? 'تومان' : 'toman') : currency === 'IRR' ? (locale === 'fa' ? 'ریال' : 'rial') : 'USD';
    const voucherMinIrrDisplay = voucherWalletMin === null
      ? null
      : new Intl.NumberFormat(locale.startsWith("fa") ? "fa-IR" : "en-US").format(voucherWalletMin);
    const voucherInputValid = currency === 'USD' || voucherRateValid;

    return (
      <div className="overflow-hidden rounded-[24px] border border-[#E1E7EF] bg-white shadow-[0_12px_36px_rgba(15,23,42,.07)]">
        <div className="flex items-center justify-between border-b border-[#E8ECF2] px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#EAF2FF] text-[#087FF5]">
              <ArrowUpFromLine className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[18px] font-black text-[#111827]">{t("wallet.withdraw")}</h2>
              <p className="mt-0.5 text-xs text-[#7A8494]">{t("wallet.withdrawFundsUsing")} {voucherLabel}</p>
            </div>
          </div>
          <ShieldCheck className="hidden h-5 w-5 text-[#0A9E58] sm:block" />
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          {methodSelector}

          {message ? (
            <div className={`rounded-xl border px-4 py-3 text-center text-xs font-bold ${messageTone === "success" ? "border-[#BCE8CE] bg-[#ECFBF2] text-[#087A3D]" : messageTone === "error" ? "border-[#F2C5CC] bg-[#FFF1F3] text-[#C92F49]" : "border-[#DDE3EA] bg-[#F7F9FB] text-[#526074]"}`}>
              {message}
            </div>
          ) : null}

          {!voucherAvailable ? (
            <div className="rounded-2xl border border-[#F2C5CC] bg-[#FFF1F3] p-4 text-center text-xs font-bold text-[#C92F49]">
              {selectedVoucher?.unavailableReason || `${voucherLabel} is currently unavailable.`}
            </div>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[.08em] text-[#697586]">{t("wallet.uwalletReceiver")}</label>
                <div className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-[#DDE3EA] px-4 shadow-sm focus-within:border-[#087FF5] focus-within:ring-4 focus-within:ring-[#087FF5]/10">
                  <WalletCards className="h-5 w-5 shrink-0 text-[#8B97A8]" />
                  <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" value={form.destination} onChange={e => setForm({...form, destination:e.target.value})} placeholder={t("wallet.enterUwalletReceiver")} autoComplete="off" spellCheck={false} />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-[.08em] text-[#697586]">{t("wallet.amountWithdrawal")}</label>
                  <span className="text-[11px] font-bold text-[#8994A5]">{t("wallet.available")}: {formatMinor(availableMinor || "0", currency, "en")}</span>
                </div>
                <div className="flex min-h-[64px] items-center rounded-2xl border border-[#DDE3EA] px-4 shadow-sm focus-within:border-[#087FF5] focus-within:ring-4 focus-within:ring-[#087FF5]/10">
                  <input className="min-w-0 flex-1 bg-transparent text-[20px] font-black outline-none" type="text" inputMode={currency === 'USD' ? 'decimal' : 'numeric'} dir="ltr" lang="en" value={normalizeNumericInput(form.amount)} onChange={e => setForm({...form,amount:normalizeNumericInput(e.target.value)})} placeholder={currency === 'USD' ? '1.50' : voucherWalletMin === null ? '—' : String(voucherWalletMin)} />
                  <b className="mr-2 text-sm text-[#7B8798]">{voucherWalletUnit}</b>
                  <button type="button" disabled={voucherWalletMax === null || !Number.isFinite(voucherWalletMax) || voucherWalletMax <= 0} onClick={()=>setForm({...form,amount:currency === 'USD' ? voucherWalletMax!.toFixed(2) : String(Math.floor(voucherWalletMax!))})} className="rounded-xl bg-[#EEF4FF] px-3 py-2 text-xs font-black text-[#087FF5] disabled:opacity-40">{t("wallet.max")}</button>
                </div>
                <div className="mt-2 flex justify-between px-1 text-[11px] font-semibold">
                  <span className="text-[#8994A5]">{t("wallet.minimumWithdrawal")}</span>
                  <b className="text-[#354052]">{currency === 'USD' ? `$${configuredUsdMinimum.toFixed(2)}` : '$1.50'}</b>
                </div>
                <div className="mt-1 flex items-center justify-between px-1 text-[11px] font-semibold">
                  <span className="text-[#8994A5]">{locale === 'fa' ? 'معادل حداقل برداشت' : 'Minimum withdrawal equivalent'}</span>
                  <b className="text-[#354052]">
                    {currency === 'USD' ? '$1.50' : voucherQuoteLoading ? (locale === 'fa' ? 'در حال دریافت نرخ uWallet...' : 'Loading uWallet exchange rate...') : voucherMinIrrDisplay !== null ? `${voucherMinIrrDisplay} ${voucherWalletUnit}` : (locale === 'fa' ? 'نرخ لحظه‌ای در دسترس نیست' : 'Live rate unavailable')}
                  </b>
                </div>
              </div>

              <div className="rounded-xl border border-[#D8E5F7] bg-[#F8FBFF] px-4 py-3 text-xs font-semibold text-[#506582]">
                {locale === 'fa' ? 'نرخ مرجع uWallet:' : 'uWallet reference rate:'} {voucherRateValid ? new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US',{maximumFractionDigits:2}).format(voucherRate) + (locale === 'fa' ? ' تومان به‌ازای هر دلار' : ' toman per USD') : (locale === 'fa' ? 'در دسترس نیست' : 'Unavailable')}
                {voucherRateValid && currency!=='USD' && /^\d+$/.test(normalizeNumericInput(form.amount)) ? (
                  <div className="mt-1 font-bold text-[#173DAA]">
                    {(() => { try {
                      const r=voucherWithdrawalDebit(BigInt(normalizeNumericInput(form.amount)),currency as 'IRT'|'IRR',voucherQuote!.rateIrrPerUsd);
                      return locale === 'fa' ? 'وچر قابل دریافت: $'+(Number(r.usdMinor)/100).toFixed(2)+' — کسر از کیف پول: '+new Intl.NumberFormat('fa-IR').format(r.walletMinor)+' '+(currency==='IRT'?'تومان':'ریال') : 'Voucher value: $'+(Number(r.usdMinor)/100).toFixed(2)+' — Wallet debit: '+new Intl.NumberFormat('en-US').format(r.walletMinor)+' '+voucherWalletUnit;
                    } catch { return locale === 'fa' ? 'مبلغ نامعتبر' : 'Invalid amount'; } })()}
                  </div>
                ):null}
                <div className="mt-1 text-[#7A8494]">{locale === 'fa' ? 'این نرخ تبدیل مرجع است؛ API فعلاً قیمت خرید و فروش جداگانه ارائه نمی‌کند.' : 'This is a reference exchange rate; the API currently does not provide separate buy and sell prices.'}</div>
              </div>
              <div className="rounded-2xl border border-[#D8E5F7] bg-[#F2F7FF] p-4">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 shrink-0 text-[#087FF5]" />
                  <div className="text-[11px] font-semibold leading-5 text-[#62728A]">
                    <p>{voucherLabel} withdrawals are processed automatically.</p>
                    <p>{t("wallet.checkUwalletReceiver")}</p>
                  </div>
                </div>
              </div>

              <button type="button" disabled={submitting || !form.amount || !voucherInputValid || !Number.isFinite(Number(normalizeNumericInput(form.amount))) || Number(normalizeNumericInput(form.amount)) < (voucherWalletMin ?? Number.POSITIVE_INFINITY) || (voucherWalletMax !== null && Number(normalizeNumericInput(form.amount)) > voucherWalletMax) || !form.destination.trim()} onClick={() => {
                const raw = normalizeNumericInput(form.amount);
                const entered = Number(raw);
                let amountMinor:string;
                let requestedWalletMinor:string|null=null;
                if(currency==='USD'){
                  if(!/^\d+(?:\.\d{1,2})?$/.test(raw))return;
                  amountMinor=String(Math.round(entered*100));
                }else{
                  if(!/^\d+$/.test(raw)||!voucherRateValid||!voucherQuote)return;
                  requestedWalletMinor=raw;
                  amountMinor=voucherWithdrawalDebit(BigInt(raw),currency as 'IRT'|'IRR',voucherQuote.rateIrrPerUsd).usdMinor.toString();
                }
                if(BigInt(amountMinor)<150n)return;
                void onVoucherSubmit(withdrawMethod,amountMinor,requestedWalletMinor);
              }} className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#087FF5] to-[#1769E8] text-[15px] font-black text-white shadow-lg disabled:opacity-45">
                <ArrowUpFromLine className="h-5 w-5" />
                {submitting ? t("wallet.submittingWithdrawal") : `${t("wallet.withdrawWith")} ${voucherLabel}`}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return <div className="overflow-hidden rounded-[24px] border border-[#E1E7EF] bg-white shadow-[0_12px_36px_rgba(15,23,42,.07)]">
    <div className="flex items-center justify-between border-b border-[#E8ECF2] px-4 py-4 sm:px-6"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#EAF2FF] text-[#087FF5]"><ArrowUpFromLine className="h-5 w-5"/></div><div><h2 className="text-[18px] font-black text-[#111827]">{t("wallet.withdraw")}</h2><p className="mt-0.5 text-xs text-[#7A8494]">{t("wallet.withdrawCryptoDescription")}</p></div></div><ShieldCheck className="hidden h-5 w-5 text-[#0A9E58] sm:block"/></div>
    <div className="space-y-5 p-4 sm:p-6">
      {methodSelector}
      {message?<div className={`rounded-xl border px-4 py-3 text-center text-xs font-bold ${messageTone==='success'?'border-[#BCE8CE] bg-[#ECFBF2] text-[#087A3D]':messageTone==='error'?'border-[#F2C5CC] bg-[#FFF1F3] text-[#C92F49]':'border-[#DDE3EA] bg-[#F7F9FB] text-[#526074]'}`}>{message}</div>:null}
      <div><div className="mb-2 text-xs font-black uppercase tracking-[.08em] text-[#697586]">{t("wallet.selectCryptocurrency")}</div><div className="flex gap-2 overflow-x-auto pb-1">{assets.map(item=><button key={item.code} type="button" onClick={()=>{setAsset(item.code);setNetwork(item.networks[0]!)}} className={`flex min-w-[92px] shrink-0 items-center gap-2 rounded-2xl border px-3 py-3 text-left ${asset===item.code?'border-[#087FF5] bg-[#F2F7FF] ring-2 ring-[#087FF5]/10':'border-[#E1E6ED]'}`}><span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black ${item.tone}`}>{item.symbol}</span><span><b className="block text-xs text-[#172033]">{item.code}</b><small className="block max-w-[52px] truncate text-[10px] text-[#8994A5]">{item.name}</small></span></button>)}</div></div>
      <div><label className="mb-2 block text-xs font-black uppercase tracking-[.08em] text-[#697586]">{t("wallet.step2Network")}</label><div className="relative"><button type="button" onClick={()=>setNetworkOpen(v=>!v)} className="flex min-h-[60px] w-full items-center justify-between rounded-2xl border border-[#DDE3EA] bg-white px-4 text-left shadow-sm"><span><b className="block text-sm text-[#172033]">{network}</b><small className="text-[11px] font-semibold text-[#0A9E58]">{t("wallet.recommendedNetwork")}</small></span><ChevronDown className={`h-5 w-5 ${networkOpen?'rotate-180':''}`}/></button>{networkOpen?<div className="absolute left-0 right-0 top-[66px] z-50 overflow-hidden rounded-2xl border bg-white shadow-xl">{selected.networks.map(item=><button key={item} type="button" onClick={()=>{setNetwork(item);setNetworkOpen(false)}} className="flex min-h-[60px] w-full items-center justify-between border-b px-4 text-left last:border-0"><span className="text-sm font-black text-[#172033]">{item}</span>{network===item?<CircleCheck className="h-5 w-5 text-[#0A9E58]"/>:null}</button>)}</div>:null}</div></div>
      <div><label className="mb-2 block text-xs font-black uppercase tracking-[.08em] text-[#697586]">{t("wallet.walletAddress")}</label><div className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-[#DDE3EA] px-4 shadow-sm focus-within:border-[#087FF5] focus-within:ring-4 focus-within:ring-[#087FF5]/10"><WalletCards className="h-5 w-5 shrink-0 text-[#8B97A8]"/><input className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})} placeholder={t("wallet.enterCryptoWalletAddress")} autoComplete="off" spellCheck={false}/><QrCode className="h-5 w-5 text-[#087FF5]"/></div><p className="mt-1 px-1 text-[11px] font-semibold text-[#8994A5]">{t("wallet.doubleCheckAddressNetwork")}</p></div>
      <div><div className="mb-2 flex items-center justify-between"><label className="text-xs font-black uppercase tracking-[.08em] text-[#697586]">{t("wallet.amountWithdrawal")}</label><span className="text-[11px] font-bold text-[#8994A5]">{t("wallet.available")}: {formatMinor(availableMinor||'0',currency,'en')}</span></div><div className="flex min-h-[64px] items-center rounded-2xl border border-[#DDE3EA] px-4 shadow-sm focus-within:border-[#087FF5] focus-within:ring-4 focus-within:ring-[#087FF5]/10"><input className="min-w-0 flex-1 bg-transparent text-[20px] font-black outline-none" type="text" inputMode="decimal" dir="ltr" lang="en" value={normalizeNumericInput(form.amount)} onChange={e=>setForm({...form,amount:normalizeNumericInput(e.target.value)})} placeholder={t("wallet.amountPlaceholder")}/><b className="mr-2 text-sm text-[#7B8798]">{currency}</b><button type="button" disabled={!availableMinor || availableMinor === "0"} onClick={()=>setForm({...form,amount:cryptoMaxAmount})} className="rounded-xl bg-[#EEF4FF] px-3 py-2 text-xs font-black text-[#087FF5] disabled:cursor-not-allowed disabled:opacity-40">{t("wallet.max")}</button></div><div className="mt-2 flex justify-between px-1 text-[11px] font-semibold"><span className="text-[#8994A5]">{t("wallet.minimumWithdrawal")}</span><b className="text-[#354052]">{formatMinor(cryptoMinimumMinor,currency,"en")}</b></div></div>
      <div className="rounded-2xl border border-[#D8E5F7] bg-[#F2F7FF] p-4"><div className="flex gap-3"><Info className="h-5 w-5 shrink-0 text-[#087FF5]"/><div className="text-[11px] font-semibold leading-5 text-[#62728A]"><p>{t("wallet.withdrawalAutoProcess")}</p><p>{t("wallet.checkAddressNetwork")}</p></div></div></div>
      <button type="button" disabled={submitting||!form.amount||!form.destination.trim()} onClick={()=>{
        const normalizedAmount=normalizeNumericInput(form.amount);
        const validUsdAmount = currency !== 'USD' || /^\d+(?:\.\d{1,2})?$/.test(normalizedAmount);
        const requestedMinorText = currency === 'USD'
          ? String(Math.round(Number(normalizedAmount) * 100))
          : normalizedAmount;
        if (!validUsdAmount || !/^\d+$/.test(requestedMinorText)) {
          onInsufficientBalance();
          return;
        }
        let requestedMinor: bigint;
        let availableWalletMinor: bigint;
        let minimumMinor: bigint;
        try {
          requestedMinor=BigInt(requestedMinorText);
          availableWalletMinor=BigInt(availableMinor||'0');
          minimumMinor=BigInt(cryptoMinimumMinor);
        } catch {
          onInsufficientBalance();
          return;
        }
        if (requestedMinor < minimumMinor || requestedMinor > availableWalletMinor) {
          onInsufficientBalance();
          return;
        }
        setShowWithdrawConfirmation(true);
      }} className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#087FF5] to-[#1769E8] text-[15px] font-black text-white shadow-lg disabled:opacity-45"><ArrowUpFromLine className="h-5 w-5"/>{submitting?t("wallet.submittingWithdrawal"):t("wallet.withdrawNow")}</button>
      {showWithdrawConfirmation?<div className="fixed inset-0 z-[100] grid place-items-center bg-[#07111F]/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-[430px] overflow-hidden rounded-[24px] border border-[#DDE5EF] bg-white shadow-[0_25px_70px_rgba(15,23,42,.25)]">
          <div className="border-b border-[#E8ECF2] px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EEF4FF] text-[#087FF5]"><ShieldCheck className="h-5 w-5"/></div>
              <div><h3 className="text-[18px] font-black text-[#172033]">{t("wallet.confirmWithdrawal")}</h3><p className="mt-0.5 text-[11px] font-semibold text-[#8994A5]">{t("wallet.reviewBeforeConfirm")}</p></div>
            </div>
          </div>
          <div className="space-y-3 px-5 py-5 text-[12px] font-semibold leading-5 text-[#526074]">
            <div className="rounded-2xl border border-[#DDE3EA] bg-[#F7F9FC] p-4">
              <div className="flex items-center justify-between"><span>{t("wallet.amountWithdrawal")}</span><b className="text-[15px] text-[#172033]">{formatMinor(currency === 'USD' ? String(Math.round(Number(normalizeNumericInput(form.amount) || '0') * 100)) : (normalizeNumericInput(form.amount)||"0"),currency,"en")}</b></div>
              <div className="mt-2 flex items-start justify-between gap-4"><span>{t("wallet.network")}</span><b className="text-right text-[#172033]">{network}</b></div>
              <div className="mt-2"><span>{t("wallet.walletAddress")}</span><p className="mt-1 break-all rounded-xl bg-white p-3 text-[10px] font-bold text-[#667085]">{form.destination}</p></div>
            </div>
            <div className="rounded-2xl border border-[#F1D59A] bg-[#FFF9EA] p-4"><b className="block text-[#8A5A00]">{t("wallet.checkNetworkAddress")}</b><span className="mt-1 block">{t("wallet.withdrawalIrreversible")}</span></div>
            <div className="rounded-2xl border border-[#D8E5F7] bg-[#F2F7FF] p-4"><b className="block text-[#087FF5]">{t("wallet.availableBalance")}</b><span className="mt-1 block">{t("wallet.currentAvailableBalance")} {(currency === 'IRR' || currency === 'IRT') && availableUsd !== null ? `${availableUsd.toFixed(2)} USD (${formatMinor(availableMinor||'0',currency,locale)})` : formatMinor(availableMinor||'0',currency,locale)}.</span></div>
          </div>
          <div className="flex gap-2 border-t border-[#E8ECF2] bg-[#FAFBFC] p-4">
            <button type="button" onClick={()=>setShowWithdrawConfirmation(false)} className="min-h-[50px] flex-1 rounded-2xl border border-[#DDE3EA] bg-white text-sm font-black text-[#526074]">{t("common.cancel")}</button>
            <button type="button" disabled={submitting} onClick={()=>{setShowWithdrawConfirmation(false);void onSubmit(asset,network)}} className="min-h-[50px] flex-1 rounded-2xl bg-[#087FF5] text-sm font-black text-white disabled:opacity-50">{submitting?t("wallet.submitting"):t("wallet.confirmWithdrawalAction")}</button>
          </div>
        </div>
      </div>:null}
    </div>
  </div>;
}

export function WalletClient() {
  const { t, locale, session, sessionLoading, refreshSession } = useApp();
  const [tab, setTab] = useState<'statement' | 'deposit' | 'withdraw'>('deposit');
  const { data, loading, error, reload } = useApiQuery<WalletPayload>(
    session?.authenticated
      ? `/api/v1/wallet?currency=${encodeURIComponent(session?.user?.currency ?? 'USD')}`
      : null,
    { pollMs: 2_000 },
  );
  const [methods, setMethods] = useState<{
    id: string;
    nameFa: string;
    nameEn: string;
    isAvailable: boolean;
    unavailableReason?: string;
    minAmountMinor: string;
    maxAmountMinor: string;
  }[]>([]);
  const [form, setForm] = useState({ amount: '', methodId: '', destination: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'success' | 'error' | 'neutral'>('neutral');
  const [cryptoPayment, setCryptoPayment] = useState<CryptoPaymentResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [voucherQuote,setVoucherQuote]=useState<UwalletReferenceQuote|null>(null);
  const [voucherQuoteLoading,setVoucherQuoteLoading]=useState(false);
  useEffect(()=>{
    if(!session?.authenticated) return;
    let cancelled=false;
    const load=async()=>{
      setVoucherQuoteLoading(true);
      try{
        const q=await apiRequest<UwalletReferenceQuote>('/api/v1/fx/uwallet-voucher');
        if(!cancelled) setVoucherQuote(q);
      }catch{if(!cancelled)setVoucherQuote(null)}
      finally{if(!cancelled)setVoucherQuoteLoading(false)}
    };
    void load();
    const timer=setInterval(()=>{void load()},20_000);
    return()=>{cancelled=true;clearInterval(timer)};
  },[session?.authenticated]);
  const currency = data?.wallet?.currency ?? session?.user?.currency ?? 'USD';
  const availableMinor = (() => {
    try {
      const value = BigInt(data?.wallet?.balanceMinor ?? '0') - BigInt(data?.wallet?.heldMinor ?? '0');
      return value > 0n ? value.toString() : '0';
    } catch {
      return '0';
    }
  })();

  const [statementType, setStatementType] = useState('all');
  const [statementRange, setStatementRange] = useState('30');
  const statementItems = (data?.transactions.items ?? []).filter((entry) => {
    if (statementType !== 'all' && entry.direction !== statementType) return false;
    if (statementRange === 'all') return true;
    const days = Number(statementRange);
    const time = new Date(entry.createdAt).getTime();
    return Number.isFinite(time) && Date.now() - time <= days * 86400000;
  });
  const loadMethods = async (
    methodCurrency: string = currency,
    direction: 'deposit' | 'withdrawal' = 'deposit',
  ) => {
    try {
      const result = await apiRequest<{ methods: typeof methods }>(
        `/api/v1/payments/methods?direction=${direction}&currency=${encodeURIComponent(methodCurrency)}`,
      );
      setMethods(result.methods);
    } catch {
      setMethods([]);
    }
  };

  if (sessionLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!session?.authenticated) {
    return (
      <div className="relative overflow-hidden rounded-[28px] border border-[#17233A] bg-[#080F1E] shadow-[0_22px_55px_rgba(5,12,28,.18)]">
        <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#00D47A]/[0.10] blur-[70px]" />
        <div className="absolute -bottom-24 -left-20 h-52 w-52 rounded-full bg-[#087FF5]/[0.08] blur-[70px]" />
        <div className="relative px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-[20px] border border-[#00D47A]/20 bg-[#00D47A]/[0.10] shadow-[0_0_30px_rgba(0,212,122,.10)]">
            <WalletCards className="h-8 w-8 text-[#00D47A]" strokeWidth={1.8} />
          </div>
          <h2 className="mt-5 text-[24px] font-black tracking-tight text-white sm:text-[28px]">{t("wallet.readyTitle")}</h2>
          <p className="mx-auto mt-2 max-w-[420px] text-[13px] font-medium leading-6 text-[#8E9AAF] sm:text-sm">{t("wallet.signInDescription")}</p>
          <div className="mx-auto mt-7 flex max-w-[360px] flex-col gap-3 sm:flex-row">
            <a href="/auth/login" className="flex min-h-[52px] flex-1 items-center justify-center rounded-[16px] bg-[#00D47A] px-5 text-sm font-black text-[#04120C] shadow-[0_10px_25px_rgba(0,212,122,.18)] transition hover:bg-[#12E68B] active:scale-[.98]">{t("nav.login")}</a>
            <a href="/auth/register" className="flex min-h-[52px] flex-1 items-center justify-center rounded-[16px] border border-[#26344D] bg-[#111A2B] px-5 text-sm font-black text-white transition hover:border-[#00D47A]/40 hover:bg-[#162238] active:scale-[.98]">{t("nav.register")}</a>
          </div>
          <div className="mx-auto mt-7 grid max-w-[520px] grid-cols-3 border-t border-white/[0.06] pt-6">
            <div className="px-2"><ShieldCheck className="mx-auto h-5 w-5 text-[#00D47A]" /><span className="mt-2 block text-[10px] font-bold text-[#8E9AAF]">Secure</span></div>
            <div className="border-x border-white/[0.06] px-2"><ArrowDownToLine className="mx-auto h-5 w-5 text-[#00D47A]" /><span className="mt-2 block text-[10px] font-bold text-[#8E9AAF]">{t("wallet.fastDeposits")}</span></div>
            <div className="px-2"><ArrowUpFromLine className="mx-auto h-5 w-5 text-[#00D47A]" /><span className="mt-2 block text-[10px] font-bold text-[#8E9AAF]">{t("wallet.easyWithdrawals")}</span></div>
          </div>
        </div>
      </div>
    );
  }
  const submitVoucher = async (methodId: string, amount: string, code: string) => {
    setSubmitting(true);
    setMessage(null);
    setMessageTone('neutral');

    try {
      const normalized = normalizeNumericInput(amount);
      let amountMinor:bigint;
      if(currency==='IRT'||currency==='IRR'){
        if(!/^\d{1,19}$/.test(normalized)||!voucherQuote)throw new Error('uWallet rate unavailable. Refresh quote.');
        amountMinor=voucherWalletToUsdMinor(BigInt(normalized),currency,voucherQuote.rateIrrPerUsd);
      }else{
        if(!/^\d+(?:\.\d{1,2})?$/.test(normalized))throw new Error('Invalid USD voucher amount.');
        const [whole,fraction='']=normalized.split('.');
        amountMinor=BigInt(whole!)*100n+BigInt(fraction.padEnd(2,'0'));
      }
      if (amountMinor < 150n) throw new Error('Minimum voucher deposit is $1.50.');
      const result = await apiRequest<{ intent: CryptoPaymentResult }>(
        '/api/v1/wallet/deposit',
        {
          method: 'POST',
          idempotencyKey: crypto.randomUUID(),
          json: {
            amountMinor: amountMinor.toString(),
            currency: 'USD',
            methodId,
            voucherCode: code.trim(),
          },
        }
      );

      let intent = result.intent;

      if (intent.status === 'pending' && intent.publicId) {
        setMessage(t("wallet.voucherPending"));
        setMessageTone('neutral');

        for (let attempt = 0; attempt < 20; attempt += 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));

          const statusResult = await apiRequest<{ intent: CryptoPaymentResult }>(
            `/api/v1/wallet/deposit/voucher/status?publicId=${encodeURIComponent(intent.publicId)}`,
            {
              method: 'GET',
            }
          );

          intent = statusResult.intent;

          if (intent.status === 'succeeded' || intent.status === 'failed') {
            break;
          }
        }
      }

      if (intent.status === 'succeeded') {
        setMessage(t("wallet.voucherDepositSuccess"));
        setMessageTone('success');
      } else if (intent.status === 'failed') {
        setMessage(t("wallet.voucherRejected"));
        setMessageTone('error');
      } else {
        setMessage(t("wallet.voucherPending"));
        setMessageTone('neutral');
      }

      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('common.error'));
      setMessageTone('error');
    } finally {
      setSubmitting(false);
      void refreshSession();
    }
  };

  const submitVoucherWithdrawal = async (methodId: 'voucher_uvoucher' | 'voucher_hotvoucher', amountMinor: string, requestedWalletMinor: string|null) => {
    setSubmitting(true);
    setMessage(null);
    setMessageTone('neutral');
    try {
      if (!/^\d+$/.test(amountMinor) || BigInt(amountMinor) < 150n) throw new Error(t("wallet.invalidWithdrawalAmount"));
      const email = form.destination.trim().toLowerCase();
      if (!email) throw new Error('Enter your account email.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(t("wallet.invalidEmail"));
      if(requestedWalletMinor && !voucherQuote)throw new Error('uWallet quote expired; refresh.');
      const result = await apiRequest<{ intent: CryptoPaymentResult }>('/api/v1/wallet/withdraw',{method:'POST',idempotencyKey:crypto.randomUUID(),json:{
        amountMinor,currency:'USD',methodId,email,
        ...(requestedWalletMinor && voucherQuote ? {
          walletRequestedAmountMinor:requestedWalletMinor,
          quoteRateIrrPerUsd:voucherQuote.rateIrrPerUsd,
          quoteTimestamp:voucherQuote.quotedAt,
          quoteSignature:voucherQuote.signature,
        }:{}),
      }});
      setMessage(result.intent.status === 'succeeded' ? t("wallet.voucherCreated") : t("wallet.voucherWithdrawalSubmitted"));
      setMessageTone(result.intent.status === 'succeeded' ? 'success' : 'neutral');
      setForm((current)=>({...current,amount:'',destination:''}));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("wallet.voucherWithdrawalFailed"));
      setMessageTone('error');
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (direction: 'deposit' | 'withdraw', selectedAsset?: string, selectedNetwork?: string) => {
    setSubmitting(true);
    setMessage(null);
    setMessageTone('neutral');
    try {
      const result = await apiRequest<{ intent: CryptoPaymentResult }>(
        direction === 'deposit' ? '/api/v1/wallet/deposit' : '/api/v1/wallet/withdraw',
        {
          method: 'POST',
          idempotencyKey: crypto.randomUUID(),
          json: {
            amountMinor: direction === 'deposit' && Boolean(selectedAsset)
              ? String(Math.round(Number(normalizeNumericInput(form.amount)) * 100))
              : direction === 'withdraw'
                ? currency === 'USD'
                  ? String(Math.round(Number(normalizeNumericInput(form.amount)) * 100))
                  : normalizeNumericInput(form.amount)
                : form.amount,
            currency: direction === 'deposit' && Boolean(selectedAsset) ? 'USD' : currency,
            methodId: direction === 'deposit' && Boolean(selectedAsset) ? 'crypto_usdt' : 'crypto_withdrawal',
            ...(direction === 'deposit' && Boolean(selectedAsset) ? { asset: selectedAsset, network: selectedNetwork } : {}),
            ...(direction === 'withdraw' ? { asset: selectedAsset, network: selectedNetwork, destination: form.destination } : {}),
          },
        }
      );
      if (direction === 'deposit' && Boolean(selectedAsset)) {
        setCryptoPayment(result.intent);
        setMessage(t("wallet.cryptoPaymentCreated"));
        setMessageTone('success');
      } else {
        if (direction === 'deposit') {
          setMessage(t("wallet.depositRequestCreated"));
          setMessageTone('success');
        } else {
          setMessage(t("wallet.withdrawalRequestSubmitted"));
          setMessageTone('success');
        }
      }
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('common.error'));
      setMessageTone('error');
    } finally {
      setSubmitting(false);
      void refreshSession();
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[26px] bg-gradient-to-br from-[#102A56] via-[#123A78] to-[#087FF5] p-5 text-white shadow-[0_18px_45px_rgba(8,76,170,.22)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-white/65"><WalletCards className="h-4 w-4"/>{t('wallet.balance')}</div>
            <div className="mt-2 text-[28px] font-black tracking-tight sm:text-[34px]">{loading ? '—' : formatMinor(availableMinor, currency, locale)}</div>
            <div className="mt-1 text-xs font-semibold text-white/65">{currency} {t("wallet.walletBalance")}</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">{data?.integrity === 'ok' ? <CircleCheck className="h-6 w-6 text-[#71E2A6]"/> : <Info className="h-6 w-6 text-[#FFD27A]"/>}</div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-white/55">{t("wallet.available")}</div><div className="mt-1 text-sm font-black">{loading ? '—' : formatMinor(availableMinor, currency, locale)}</div></div>
          <div className="rounded-2xl bg-white/10 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-white/55">{t("wallet.held")}</div><div className="mt-1 text-sm font-black">{loading ? '—' : formatMinor(data?.wallet?.heldMinor ?? '0', currency, locale)}</div></div>
          <div className="col-span-2 rounded-2xl bg-white/10 p-3 sm:col-span-1"><div className="text-[10px] font-bold uppercase tracking-wider text-white/55">Ledger</div><div className="mt-1 flex items-center gap-1.5 text-sm font-black"><CircleCheck className="h-4 w-4 text-[#71E2A6]"/>{data?.integrity === 'ok' ? t('wallet.verified') : t('wallet.needsReview')}</div></div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          {id:'deposit' as const,icon:ArrowDownToLine,title:t('wallet.deposit'),text:'Add funds'},
          {id:'withdraw' as const,icon:ArrowUpFromLine,title:t('wallet.withdraw'),text:'Send funds'},
          {id:'statement' as const,icon:History,title:t('wallet.statement'),text:'View activity'}
        ].map(item=>{const Icon=item.icon;return <button key={item.id} type="button" onClick={()=>{setTab(item.id);setMessage(null);setMessageTone('neutral');if(item.id==='deposit')void loadMethods(currency,'deposit');if(item.id==='withdraw')void loadMethods('USD','withdrawal')}} className={`min-h-[88px] rounded-[20px] border p-3 text-left transition active:scale-[.98] ${tab===item.id?'border-[#087FF5] bg-[#F2F7FF] shadow-[0_8px_24px_rgba(8,127,245,.10)]':'border-[#E2E7EE] bg-white'}`}><Icon className={`h-5 w-5 ${tab===item.id?'text-[#087FF5]':'text-[#66758A]'}`}/><div className="mt-2 text-xs font-black text-[#172033]">{item.title}</div><div className="mt-0.5 text-[10px] font-semibold text-[#8A95A5]">{item.text}</div></button>})}
      </div>
      <ErrorNote
        message={error && !/UNAUTHENTICATED/i.test(error) ? error : null}
        onRetry={() => void reload()}
        retryLabel={t('common.retry')}
      />

      {tab === 'statement' ? (
        loading ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-[22px] border border-[#E2E7EE] bg-white px-4 py-4 shadow-[0_6px_22px_rgba(15,23,42,.04)]">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#EEF4FF] text-[#087FF5]"><History className="h-5 w-5"/></div>
                <div>
                  <h2 className="text-[16px] font-black text-[#172033]">{t("wallet.transactionHistory")}</h2>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#8994A5]">{t("wallet.recentActivity")}</p>
                </div>
              </div>
              <span className="rounded-full bg-[#EAF8F0] px-2.5 py-1 text-[10px] font-black text-[#07883F]">{t("wallet.live")}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <NovaDropdown label={t("wallet.transactionType")} value={statementType} onChange={setStatementType} icon={<SlidersHorizontal className="h-4 w-4" />} options={[{ value: "all", label: t("wallet.allTransactions") }, { value: "credit", label: t("wallet.deposits") }, { value: "debit", label: t("wallet.withdrawals") }]} />
              <NovaDropdown label="Date range" value={statementRange} onChange={setStatementRange} icon={<CalendarDays className="h-4 w-4" />} options={[{ value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }, { value: "all", label: "All time" }]} />
              <div className="col-span-2 flex h-12 items-center justify-between rounded-2xl border border-[#DDE3EA] bg-[#F7F9FC] px-4 sm:col-span-1">
                <span className="text-[11px] font-semibold text-[#8994A5]">{t("wallet.transactions")}</span>
                <b className="text-sm text-[#172033]">{statementItems.length}</b>
              </div>
            </div>

            {(() => {
              const paymentItems = (data?.payments.items ?? []).filter((item) => {
                if (statementType === 'credit' && item.direction !== 'deposit') return false;
                if (statementType === 'debit' && item.direction !== 'withdrawal') return false;
                if (statementRange === 'all') return true;
                const days = Number(statementRange);
                const time = new Date(item.createdAt).getTime();
                return Number.isFinite(time) && Date.now() - time <= days * 86400000;
              });

              return paymentItems.length === 0 ? (
                <EmptyState title={t('wallet.noTransactions')} />
              ) : (
                <div className="overflow-hidden rounded-[22px] border border-[#DDE3EA] bg-white shadow-[0_8px_28px_rgba(15,23,42,.05)]">
                  <div className="hidden grid-cols-[1.1fr_1fr_1.4fr_1fr_100px] gap-3 border-b border-[#E8ECF2] bg-[#F7F9FC] px-4 py-3 text-[10px] font-black uppercase tracking-[.08em] text-[#7A8494] sm:grid">
                    <span>{t("common.date")}</span><span>{t("common.type")}</span><span>{t("common.id")}</span><span>{t("common.amount")}</span><span>{t("common.status")}</span>
                  </div>
                  <div>
                    {paymentItems.map((entry) => {
                      const deposit = entry.direction === 'deposit';
                      const statusLabel = paymentStatusLabel(entry.direction, entry.status, t);
                      return (
                        <div key={entry.id} className="border-b border-[#E8ECF2] px-3 py-3 last:border-0 sm:px-4 sm:py-4">
                          <div className="grid gap-2 sm:grid-cols-[1.1fr_1fr_1.4fr_1fr_100px] sm:items-center sm:gap-3">
                            <div className="order-2 min-w-0 sm:order-none">
                              <span className="text-[10px] font-semibold text-[#7E899A] sm:text-[11px]">{formatDateTime(entry.createdAt, locale)}</span>
                            </div>
                            <div className="order-1 flex min-w-0 items-center gap-2 sm:order-none">
                              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${deposit ? 'bg-[#E8F8EF] text-[#0A9E58]' : 'bg-[#FFF0F2] text-[#D8324D]'}`}>
                                {deposit ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                              </span>
                              <span className="min-w-0">
                                <b className="block truncate text-xs font-black text-[#172033]">{deposit ? t('wallet.deposit') : t('wallet.withdraw')}</b>
                                <span className="mt-0.5 block text-[9px] font-semibold text-[#8994A5]">{deposit ? t('wallet.fundsIn') : t('wallet.fundsOut')}</span>
                              </span>
                            </div>
                            <div className="order-3 min-w-0 sm:order-none">
                              <b className="block truncate text-[10px] font-bold text-[#667085] sm:text-xs">{entry.publicId}</b>
                              {entry.failureMessage ? <span className="mt-0.5 block truncate text-[9px] text-[#D8324D]">{entry.failureMessage}</span> : null}
                            </div>
                            <div className="order-4 text-right sm:order-none sm:text-left">
                              <b className={`text-sm font-black ${deposit ? 'text-[#0A9E58]' : 'text-[#E0445C]'}`}>
                                {deposit ? '+' : '−'}{formatMinor(entry.amountMinor, currency, locale)}
                              </b>
                              <span className="ml-1 text-[9px] text-[#8994A5] sm:ml-0 sm:mt-0.5 sm:block">{entry.currency}</span>
                            </div>
                            <div className="order-5 sm:order-none">
                              <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black sm:px-2.5 sm:py-1 sm:text-[10px] ${paymentStatusClass(entry.direction, entry.status)}`}>
                                {statusLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAFBFC] px-4 py-3">
                    <span className="text-[11px] font-semibold text-[#8994A5]">{t("wallet.showingPayments", { count: paymentItems.length })}</span>
                    <span className="rounded-xl bg-white px-3 py-2 text-[11px] font-black text-[#087FF5] shadow-sm">{t("wallet.live")}</span>
                  </div>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#DDE3EA] bg-white p-3"><span className="text-[10px] font-bold uppercase tracking-wider text-[#8994A5]">{t("wallet.deposit")}</span><b className="mt-1 block text-sm font-black text-[#07883F]">+{formatMinor(data?.transactions.totals.creditMinor ?? '0', currency, locale)}</b></div>
              <div className="rounded-2xl border border-[#DDE3EA] bg-white p-3"><span className="text-[10px] font-bold uppercase tracking-wider text-[#8994A5]">{t("wallet.withdraw")}</span><b className="mt-1 block text-sm font-black text-[#D8324D]">−{formatMinor(data?.transactions.totals.debitMinor ?? '0', currency, locale)}</b></div>
              <div className="col-span-2 rounded-2xl border border-[#DDE3EA] bg-white p-3 sm:col-span-1"><span className="text-[10px] font-bold uppercase tracking-wider text-[#8994A5]">{t("wallet.net")}</span><b className="mt-1 block text-sm font-black text-[#172033]">{formatMinor(data?.transactions.totals.netMinor ?? '0', currency, locale)}</b></div>
            </div>
            <div className="flex items-start gap-3 rounded-[20px] border border-[#D8E7FB] bg-[#F1F7FF] p-4">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#087FF5]" />
              <p className="text-[11px] font-semibold leading-5 text-[#64748B]">{t("wallet.transactionDelayNotice")}</p>
            </div>
          </div>
        )
      ) : tab === 'deposit' ? (
        <DepositPanel
          currency={currency}
          methods={methods}
          form={form}
          setForm={setForm}
          loadMethods={loadMethods}
          message={message}
          messageTone={messageTone}
          payment={cryptoPayment}
            submitting={submitting}
          onCreatePayment={async (selectedAsset, selectedNetwork) => {
            await submit('deposit', selectedAsset, selectedNetwork);
          }}
          onVoucherDeposit={submitVoucher}
          voucherQuote={voucherQuote}
          voucherQuoteLoading={voucherQuoteLoading}
        />
      ) : (
        <WithdrawPanel
          form={form}
          setForm={setForm}
          submitting={submitting}
          message={message}
          messageTone={messageTone}
          onSubmit={async (selectedAsset, selectedNetwork) => {
            await submit('withdraw', selectedAsset, selectedNetwork);
          }}
          onInsufficientBalance={() => {
            setMessage(t("wallet.insufficientBalanceRequested"));
            setMessageTone('error');
          }}
          availableMinor={availableMinor}
          currency={currency}
          methods={methods}
          onVoucherSubmit={submitVoucherWithdrawal}
          voucherQuote={voucherQuote}
          voucherQuoteLoading={voucherQuoteLoading}
        />
      )}
    </div>
  );
}
