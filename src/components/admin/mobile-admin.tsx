'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
 Activity, ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Bell,
 Check, ChevronRight, CircleDollarSign, ClipboardList, CreditCard, Headphones,
 LayoutDashboard, LockKeyhole, LogOut, Menu, Plus, RefreshCcw, Search,
 Send, ShieldCheck, SlidersHorizontal, Ticket, Trophy, Users, Wallet, X,
} from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import { AuthSheet } from '@/components/account/auth-sheet';
import { TwoFactorSettings } from '@/components/account/two-factor-settings';

type Tab = 'home'|'users'|'bets'|'payments'|'support'|'casino'|'matches'|'more';
type Period = '24h'|'7d'|'30d';
type AnyRow = Record<string, any>;
const PERIODS: { key: Period; text: string }[] = [{ key:'24h',text:'روزانه' },{key:'7d',text:'هفتگی'},{key:'30d',text:'ماهانه'}];
const NAV = [
 {key:'home',label:'خانه',icon:LayoutDashboard},
 {key:'users',label:'کاربران',icon:Users},
 {key:'bets',label:'شرط‌ها',icon:Ticket},
 {key:'payments',label:'مالی',icon:Wallet},
 {key:'more',label:'بیشتر',icon:Menu},
] as const;
const MENU = [
 {key:'support',label:'پشتیبانی و تیکت‌ها',icon:Headphones,sub:'پاسخ و پیگیری'},
 {key:'casino',label:'مدیریت کازینو',icon:CircleDollarSign,sub:'گزارش بازی‌ها و سود'},
 {key:'matches',label:'مدیریت مسابقات',icon:Trophy,sub:'ثبت دستی بازی و نتایج'},
] as const;
const ADVANCED = [
 {name:'گزارش‌های پیشرفته',url:'/admin/reports',icon:BarChart3},
 {name:'تنظیمات سایت',url:'/admin/settings',icon:SlidersHorizontal},
 {name:'تسویه شرط‌ها',url:'/admin/settlements',icon:Check},
 {name:'مدیریت برداشت‌ها',url:'/admin/payments',icon:CreditCard},
 {name:'افیلیت و کمیسیون',url:'/admin/affiliates',icon:Users},
 {name:'مدیریت کارکنان',url:'/admin/roles',icon:ShieldCheck},
 {name:'گزارش امنیتی',url:'/admin/audit',icon:LockKeyhole},
 {name:'اعلان‌ها',url:'/admin/notifications',icon:Bell},
] as const;
function fmtMoney(value: unknown, currency = 'USD') {
 const n=Number(value ?? 0)/100;
 if(!Number.isFinite(n)) return '—';
 return new Intl.NumberFormat('en-US',{style:'decimal',maximumFractionDigits:2,minimumFractionDigits:2}).format(n) + ' ' + currency;
}
function fmtDate(value: unknown) {
 if(!value) return '—';
 const d=new Date(String(value)); return Number.isNaN(d.getTime())?'—':d.toLocaleString('fa-IR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
}
function display(value:unknown){ return value===null||value===undefined||value===''?'—':String(value); }
async function getData<T>(url:string, options?:RequestInit):Promise<T> {
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,headers:{...(options?.body?{'Content-Type':'application/json'}:{}),...(options?.headers??{})}});
 const raw=await response.json().catch(()=>({}));
 if(!response.ok||raw.ok===false)throw new Error(raw.message||raw.error?.message||'خطا در دریافت اطلاعات');
 return (raw.data??raw) as T;
}
function Panel({children,className=''}:{children:React.ReactNode;className?:string}) {return <section className={'bvm-panel '+className}>{children}</section>;}
function Empty({text}:{text:string}) {return <div className="bvm-empty">{text}</div>;}
function Pill({value}:{value:unknown}) {const s=String(value??'unknown');return <span className={'bvm-pill '+(/succeeded|settled|accepted|active|resolved|completed/i.test(s)?'good':/failed|suspended|cancelled|rejected/i.test(s)?'bad':'')}>{s.replaceAll('_',' ')}</span>;}

export function MobileAdmin(){
 const {session,refreshSession}=useApp();
 const [tab,setTab]=useState<Tab>('home'); const [period,setPeriod]=useState<Period>('24h');
 const [loading,setLoading]=useState(false); const [error,setError]=useState('');
 const [dashboard,setDashboard]=useState<AnyRow|null>(null); const [casino,setCasino]=useState<AnyRow|null>(null);
 const [rows,setRows]=useState<AnyRow[]>([]);const [search,setSearch]=useState('');const [selected,setSelected]=useState<AnyRow|null>(null);
 const [detail,setDetail]=useState<AnyRow|null>(null);const [reply,setReply]=useState('');const [sending,setSending]=useState(false);
 const [showLogin,setShowLogin]=useState(false); const [showManual,setShowManual]=useState(false);
 const [form,setForm]=useState({sport:'football',league:'',home:'',away:'',scheduledAt:''});
 const [notice,setNotice]=useState('');const [refresh,setRefresh]=useState(0);
 const authenticated=Boolean(session?.authenticated && session.user?.isAdmin && session.user?.mfaEnrolled && session.user?.mfaLevel==='aal2');
 const load=useCallback(async()=>{
  if(!authenticated) return;
  setLoading(true);setError('');
  try{
   if(tab==='home'){
    const [d,c]=await Promise.all([getData<AnyRow>('/api/v1/admin/dashboard?window='+period),getData<AnyRow>('/api/v1/admin/mobile/casino?window='+period)]);
    setDashboard(d);setCasino(c);
   } else if(tab==='casino')setCasino(await getData<AnyRow>('/api/v1/admin/mobile/casino?window='+period));
   else if(tab==='users'||tab==='bets'||tab==='payments'||tab==='support'||tab==='matches'){
    const query=new URLSearchParams({page:'1',pageSize:'40'});
    if(tab==='users'||tab==='bets')query.set('q',search);
    if(tab==='support'&&search)query.set('search',search);
    const url=tab==='users'?'/api/v1/admin/users':tab==='bets'?'/api/v1/admin/bets':tab==='payments'?'/api/v1/admin/payments':tab==='support'?'/api/v1/admin/support':'/api/v1/admin/mobile/manual-matches';
    const data=await getData<AnyRow>(url+'?'+query.toString());
    setRows(tab==='support'?(Array.isArray(data.tickets)?data.tickets:data.tickets?.items??[]):data.items??[]);
   }
  }catch(e){setError(e instanceof Error?e.message:'خطا در اتصال به سرور');}
  finally{setLoading(false);}
 },[authenticated,tab,period,search,refresh]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{if(!authenticated||tab!=='home')return;const timer=window.setInterval(()=>void load(),60000);return()=>window.clearInterval(timer);},[authenticated,tab,load]);
 useEffect(()=>{setSelected(null);setDetail(null);setRows([]);setSearch('');setNotice('');},[tab]);
 async function openRow(item:AnyRow){
  setSelected(item);setDetail(null);setError('');
  try{
   if(tab==='users')setDetail(await getData('/api/v1/admin/users/'+encodeURIComponent(item.id)));
   if(tab==='support')setDetail(await getData('/api/v1/admin/support/'+encodeURIComponent(item.id)));
   if(tab==='bets')setDetail(await getData('/api/v1/admin/bets/'+encodeURIComponent(item.id)));
  }catch(e){setError(e instanceof Error?e.message:'خطا در بارگذاری جزئیات');}
 }
 async function sendReply(event:FormEvent){
  event.preventDefault();if(!selected?.id||!reply.trim()||sending)return;
  setSending(true);setError('');
  try{await getData('/api/v1/admin/support/'+encodeURIComponent(selected.id)+'/messages',{method:'POST',body:JSON.stringify({body:reply.trim()})});
   setReply('');setDetail(await getData('/api/v1/admin/support/'+encodeURIComponent(selected.id)));setNotice('پاسخ برای کاربر ارسال شد');}
  catch(e){setError(e instanceof Error?e.message:'ارسال ناموفق بود');}finally{setSending(false);}
 }
 async function saveManual(event:FormEvent){
  event.preventDefault();setSending(true);setError('');setNotice('');
  try{await getData('/api/v1/admin/mobile/manual-matches',{method:'POST',body:JSON.stringify({...form,scheduledAt:new Date(form.scheduledAt).toISOString()})});
   setShowManual(false);setForm({sport:'football',league:'',home:'',away:'',scheduledAt:''});setNotice('مسابقه دستی ذخیره شد؛ تا زمان تعریف مارکت، بدون ضریب نمایش داده می‌شود.');setRefresh(n=>n+1);}
  catch(e){setError(e instanceof Error?e.message:'ثبت مسابقه ناموفق بود');}finally{setSending(false);}
 }
 const metrics=dashboard?.metrics;
 if(!session||session.authUnavailable) return <main className="bv-mobile" dir="rtl"><div className="bvm-auth"><div className="bvm-logo">B</div><h1>BetVima Admin</h1><p>برقراری اتصال امن به پنل مدیریت</p><button className="bvm-primary" onClick={()=>void refreshSession()}>بررسی اتصال <RefreshCcw size={18}/></button></div></main>;
 if(!session.authenticated||!session.user?.isAdmin) return <main className="bv-mobile" dir="rtl"><div className="bvm-auth"><div className="bvm-logo">B</div><span className="bvm-eyebrow">ADMINISTRATOR PORTAL</span><h1>کنترل کامل BetVima</h1><p>با ایمیل و رمز عبور حساب ادمین خود وارد شوید. هیچ حساب جدیدی ساخته نمی‌شود.</p><button className="bvm-primary" onClick={()=>setShowLogin(true)}><LockKeyhole size={18}/> ورود امن به پنل</button><small>دسترسی فقط برای نقش‌های مدیریتی تأییدشده</small>{showLogin?<AuthSheet mode="login" onClose={()=>{setShowLogin(false);void refreshSession();}}/>:null}<button className="bvm-secondary" onClick={()=>void refreshSession()}>بررسی ورود</button></div></main>;
 if(!session.user.mfaEnrolled||session.user.mfaLevel!=='aal2')return <main className="bv-mobile" dir="rtl"><div className="bvm-auth"><div className="bvm-logo">B</div><h1>تأیید دومرحله‌ای ادمین</h1><p>برای ورود به اطلاعات مالی و مدیریتی، کد Google Authenticator را تأیید کنید.</p><TwoFactorSettings adminRequired onVerified={()=>void refreshSession()}/></div></main>;
 const heading=tab==='home'?'نمای کلی':tab==='users'?'کاربران':tab==='bets'?'شرط‌های ثبت‌شده':tab==='payments'?'واریز و برداشت':tab==='support'?'تیکت‌ها و پشتیبانی':tab==='casino'?'کازینو':tab==='matches'?'بازی‌های دستی':'مدیریت سایت';
 return <main className="bv-mobile" dir="rtl">
  <header className="bvm-top"><div className="bvm-brand"><div className="bvm-symbol">B</div><span><strong>BetVima</strong><small>ADMIN CONTROL</small></span></div><div className="bvm-topright"><span className="bvm-live"><i/>LIVE</span><button aria-label="بروزرسانی" className="bvm-icon" onClick={()=>setRefresh(n=>n+1)}><RefreshCcw size={18}/></button></div></header>
  <div className="bvm-container">
   <div className="bvm-title"><div><span className="bvm-eyebrow">پنل اختصاصی مدیریت</span><h1>{selected?'جزئیات':heading}</h1><p>{selected?'برای بازگشت، فلش بالا را انتخاب کنید': 'اطلاعات زنده و متصل به سرور BetVima'}</p></div>{selected?<button className="bvm-icon bvm-back" onClick={()=>{setSelected(null);setDetail(null);}}><ArrowRight size={21}/></button>:null}</div>
   {notice?<div className="bvm-notice"><Check size={17}/>{notice}<button onClick={()=>setNotice('')} aria-label="بستن"><X size={16}/></button></div>:null}
   {error?<div className="bvm-error" role="alert">{error}<button onClick={()=>setRefresh(n=>n+1)}>تلاش مجدد</button></div>:null}
   {(tab==='home'||tab==='casino')?<div className="bvm-switch">{PERIODS.map(p=><button key={p.key} aria-pressed={p.key===period} className={p.key===period?'active':''} onClick={()=>setPeriod(p.key)}>{p.text}</button>)}</div>:null}
   {loading?<div className="bvm-loading"><RefreshCcw size={19} className="bvm-spin"/> دریافت اطلاعات...</div>:null}
   {tab==='home'&&<><Panel className="bvm-hero"><div className="bvm-herotag"><Activity size={14}/> PERFORMANCE REPORT</div><span>سود ناخالص شرط‌بندی ورزشی</span><strong className="bvm-big">{metrics?fmtMoney(metrics.betting?.ggr24hMinor):'—'}</strong><div className="bvm-herorow"><span>{PERIODS.find(p=>p.key===period)?.text}</span><span>بر اساس شرط‌های تسویه‌شده</span></div><div className="bvm-herodeco"/></Panel>
    <div className="bvm-stats">
     <Panel><div className="bvm-stat-head"><span>ثبت‌نام‌های جدید</span><Users size={19}/></div><strong>{display(metrics?.users?.new24h)}</strong><small>کل کاربران: {display(metrics?.users?.total)}</small></Panel>
     <Panel><div className="bvm-stat-head"><span>شرط‌های جدید</span><Ticket size={19}/></div><strong>{display(metrics?.betting?.bets24h)}</strong><small>باز: {display(metrics?.betting?.openBets)}</small></Panel>
     <Panel><div className="bvm-stat-head"><span>واریزی‌ها</span><ArrowDownLeft size={19}/></div><strong className="bvm-amount">{metrics?fmtMoney(metrics.wallet?.deposits24hMinor):'—'}</strong><small>کل مبلغ دوره</small></Panel>
     <Panel><div className="bvm-stat-head"><span>برداشت‌ها</span><ArrowUpRight size={19}/></div><strong className="bvm-amount">{metrics?fmtMoney(metrics.wallet?.withdrawals24hMinor):'—'}</strong><small>در انتظار: {display(metrics?.wallet?.pendingWithdrawals)}</small></Panel>
    </div>
    <div className="bvm-subtitle"><h2>مدیریت سریع</h2><span>دسترسی یک‌لمسی</span></div>
    <div className="bvm-quick">{MENU.map(m=><button key={m.key} onClick={()=>setTab(m.key)}><span className="bvm-quick-icon"><m.icon size={21}/></span><strong>{m.label}</strong><small>{m.sub}</small><ChevronRight size={18} className="bvm-quick-arrow"/></button>)}</div>
    <div className="bvm-subtitle"><h2>نمای کازینو</h2><button onClick={()=>setTab('casino')}>مشاهده <ArrowLeft size={15}/></button></div>
    <Panel>{(casino?.periods??[]).length?(casino.periods as AnyRow[]).slice(0,3).map((r:AnyRow,i:number)=><div className="bvm-listrow" key={i}><span><strong>{r.source==='slot'?'اسلات داخلی':'SoftAggregator'}</strong><small>ارز: {r.currency} · دورها: {r.rounds}</small></span><b>{fmtMoney(r.netMinor,r.currency)}</b></div>):<Empty text="تراکنش تأییدشده کازینو در این بازه ثبت نشده است."/>}</Panel>
   </>}
   {(tab==='users'||tab==='bets'||tab==='payments'||tab==='support'||tab==='matches')&&!selected&&<>
     <div className="bvm-toolbar">{(tab==='users'||tab==='bets'||tab==='support')?<div className="bvm-search"><Search size={18}/><input aria-label="جستجو" value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==='users'?'ایمیل، شناسه یا شماره کاربر':tab==='support'?'جستجوی تیکت':'شناسه شرط یا کاربر'}/></div>:<div className="bvm-toolbar-hint">آخرین فعالیت‌های ثبت‌شده</div>}{tab==='matches'?<button className="bvm-add" onClick={()=>setShowManual(true)}><Plus size={17}/> بازی جدید</button>:null}</div>
     <Panel className="bvm-list">{rows.length?rows.map((r:AnyRow,i:number)=>{
       const title=tab==='users'?(r.email||r.username||r.publicId):tab==='bets'?'شرط '+display(r.publicId||r.id?.slice(0,8)):tab==='payments'?((r.direction||r.type)==='deposit'?'واریز':'برداشت')+' · '+display(r.publicId||r.id?.slice(0,8)):tab==='support'?r.subject:display(r.home)+' - '+display(r.away);
       const subtitle=tab==='users'?'شناسه '+display(r.publicId)+' · '+fmtDate(r.registeredAt):tab==='bets'?'کاربر: '+display(r.userId?.slice(0,8))+' · '+fmtDate(r.placedAt):tab==='payments'?'کاربر: '+display(r.userId?.slice(0,8))+' · '+fmtDate(r.createdAt||r.initiatedAt):tab==='support'?display(r.userEmail)+' · '+fmtDate(r.updatedAt):display(r.league)+' · '+fmtDate(r.scheduledAt);
       const amount=tab==='users'?fmtMoney(r.usdBalanceMinor):tab==='bets'?fmtMoney(r.usdStakeMinor||r.stakeMinor):tab==='payments'?fmtMoney(r.usdAmountMinor||r.amountMinor):tab==='support'?null:'بدون ضریب';
       return <button key={r.id||i} className="bvm-item" onClick={()=>{if(tab==='matches')setSelected(r);else void openRow(r);}}><span className="bvm-avatar">{tab==='users'?<Users size={19}/>:tab==='bets'?<Ticket size={19}/>:tab==='payments'?<Wallet size={19}/>:tab==='support'?<Headphones size={19}/>:<Trophy size={19}/>}</span><span className="bvm-item-text"><strong>{display(title)}</strong><small>{subtitle}</small><span><Pill value={r.status}/></span></span>{amount?<span className="bvm-item-amount">{amount}</span>:null}<ChevronRight className="bvm-item-arrow" size={17}/></button>;
     }):<Empty text={loading?'در حال دریافت...':'موردی برای نمایش وجود ندارد.'}/>}</Panel>
     <p className="bvm-footnote">۴۰ مورد آخر نمایش داده می‌شود. برای جستجوی کامل و فیلترهای پیشرفته از پنل اصلی استفاده کنید.</p>
   </>}
   {selected&&<Panel className="bvm-detail">
     <div className="bvm-detail-head"><span>شماره پیگیری</span><strong>{display(selected.publicId||selected.id)}</strong><Pill value={selected.status}/></div>
     {tab==='users'&&<><h3>اطلاعات حساب</h3>{[['ایمیل',selected.email],['شناسه عددی',selected.publicId],['نقش',selected.role],['موجودی USD',fmtMoney(selected.usdBalanceMinor)],['مجموع شرط',fmtMoney(selected.totalStakeMinor)],['سود / زیان کاربر',fmtMoney(selected.netResultMinor)]].map(([k,v])=><div className="bvm-data" key={String(k)}><span>{k}</span><b>{display(v)}</b></div>)}<h3>آخرین واریز و برداشت</h3>{(detail?.payments?.items??[]).map((r:AnyRow)=><div className="bvm-data" key={r.id}><span>{display(r.direction)} · {fmtDate(r.createdAt||r.initiatedAt)}</span><b>{fmtMoney(r.amountMinor,r.currency)}</b></div>)}<Link href={'/admin/users/'+encodeURIComponent(selected.id)} className="bvm-wide">مدیریت کامل حساب <ArrowLeft size={17}/></Link></>}
     {tab==='bets'&&<><h3>مشخصات شرط</h3>{[['نوع',selected.type],['ارز',selected.currency],['مبلغ شرط',fmtMoney(selected.stakeMinor,selected.currency)],['برد احتمالی',fmtMoney(selected.potentialPayoutMinor,selected.currency)],['تسویه',fmtMoney(selected.settledPayoutMinor??0,selected.currency)]].map(([k,v])=><div className="bvm-data" key={String(k)}><span>{k}</span><b>{display(v)}</b></div>)}<Link href={'/admin/bets/'+encodeURIComponent(selected.id)} className="bvm-wide">عملیات شرط و تسویه <ArrowLeft size={17}/></Link></>}
     {tab==='support'&&<><h3>{display(selected.subject)}</h3><div className="bvm-messages">{(detail?.messages??[]).map((m:AnyRow)=><div key={m.id} className={'bvm-message '+(m.senderRole==='support'?'ours':'')}><small>{m.senderRole==='support'?'پشتیبانی':'کاربر'} · {fmtDate(m.createdAt)}</small><p>{m.body}</p></div>)}</div><form onSubmit={sendReply} className="bvm-reply"><textarea value={reply} onChange={e=>setReply(e.target.value)} placeholder="پاسخ خود را بنویسید..." rows={3}/><button disabled={sending||!reply.trim()} className="bvm-primary"><Send size={17}/> ارسال پاسخ</button></form><Link href="/admin/support" className="bvm-wide">مدیریت و ضمیمه‌های تیکت <ArrowLeft size={17}/></Link></>}
     {tab==='matches'&&<><h3>بازی دستی</h3>{[['رشته',selected.sport],['لیگ',selected.league],['میزبان',selected.home],['میهمان',selected.away],['شروع',fmtDate(selected.scheduledAt)]].map(([k,v])=><div className="bvm-data" key={String(k)}><span>{k}</span><b>{display(v)}</b></div>)}<p className="bvm-muted">این مسابقه تا اتصال مارکت و ضرایب معتبر امکان ثبت شرط ندارد.</p></>}
     {tab==='payments'&&<><h3>جزئیات تراکنش</h3>{[['کاربر',selected.userId],['مبلغ',fmtMoney(selected.amountMinor,selected.currency)],['مبلغ دلار',fmtMoney(selected.usdAmountMinor)],['ارائه‌دهنده',selected.provider],['زمان',fmtDate(selected.createdAt||selected.initiatedAt)]].map(([k,v])=><div className="bvm-data" key={String(k)}><span>{k}</span><b>{display(v)}</b></div>)}<Link href="/admin/payments" className="bvm-wide">بررسی عملیات مالی <ArrowLeft size={17}/></Link></>}
   </Panel>}
   {tab==='casino'&&<><Panel className="bvm-hero bvm-casinohero"><div className="bvm-herotag"><CircleDollarSign size={16}/> CASINO ANALYTICS</div><span>گزارش تراکنش‌های تکمیل‌شده کازینو</span><strong className="bvm-big">{display(casino?.totalRounds)} <small>دور</small></strong><div className="bvm-herorow"><span>اسلات داخلی و SoftAggregator</span><span>تفکیک ارز</span></div></Panel><div className="bvm-subtitle"><h2>گزارش سود و گردش مالی</h2><span>ارزها جداگانه</span></div>{(casino?.periods??[]).map((r:AnyRow,i:number)=><Panel key={i}><div className="bvm-casinohead"><strong>{r.source==='slot'?'بازی‌های اسلات داخلی':'SoftAggregator'}</strong><Pill value={r.currency}/></div><div className="bvm-data"><span>تعداد دور / تراکنش</span><b>{r.rounds}</b></div><div className="bvm-data"><span>جمع شرط</span><b>{fmtMoney(r.stakeMinor,r.currency)}</b></div><div className="bvm-data"><span>پرداخت برد</span><b>{fmtMoney(r.payoutMinor,r.currency)}</b></div><div className="bvm-data"><span>سود ناخالص</span><b>{fmtMoney(r.netMinor,r.currency)}</b></div></Panel>)}<p className="bvm-footnote">سود کازینو و ورزش به علت تفاوت ارز و منابع مالی بدون تبدیل معتبر با هم جمع نمی‌شوند. داده‌ها از تراکنش‌های موفق و نهایی دریافت می‌شوند.</p></>}
   {tab==='more'&&<><div className="bvm-subtitle"><h2>بخش‌های اصلی</h2></div><div className="bvm-quick">{MENU.map(m=><button key={m.key} onClick={()=>setTab(m.key)}><span className="bvm-quick-icon"><m.icon size={21}/></span><strong>{m.label}</strong><small>{m.sub}</small><ChevronRight size={18} className="bvm-quick-arrow"/></button>)}</div><div className="bvm-subtitle"><h2>ابزارهای پیشرفته</h2><span>پنل وب ادمین</span></div><Panel className="bvm-morelist">{ADVANCED.map(m=><Link key={m.url} href={m.url}><m.icon size={19}/><span>{m.name}</span><ChevronRight size={16}/></Link>)}</Panel><div className="bvm-account"><ShieldCheck size={18}/><div><strong>{session.user.email||'Admin'}</strong><small>اتصال رمزگذاری‌شده · احراز هویت دومرحله‌ای</small></div><Link href="/admin/dashboard" aria-label="پنل کامل"><ArrowUpRight size={20}/></Link></div></>}
   {showManual?<div className="bvm-overlay" role="dialog" aria-modal="true" aria-label="ثبت مسابقه دستی"><form className="bvm-modal" onSubmit={saveManual}><div className="bvm-modal-head"><div><small>NEW MANUAL FIXTURE</small><h2>افزودن مسابقه</h2></div><button type="button" onClick={()=>setShowManual(false)}><X size={21}/></button></div><label>رشته ورزشی<select value={form.sport} onChange={e=>setForm({...form,sport:e.target.value})}><option value="football">فوتبال</option><option value="basketball">بسکتبال</option><option value="tennis">تنیس</option><option value="volleyball">والیبال</option><option value="hockey">هاکی</option><option value="handball">هندبال</option></select></label><label>نام لیگ<input required minLength={2} maxLength={100} value={form.league} onChange={e=>setForm({...form,league:e.target.value})} placeholder="مثلاً Premier League"/></label><label>تیم میزبان<input required minLength={2} maxLength={100} value={form.home} onChange={e=>setForm({...form,home:e.target.value})}/></label><label>تیم میهمان<input required minLength={2} maxLength={100} value={form.away} onChange={e=>setForm({...form,away:e.target.value})}/></label><label>زمان مسابقه<input required type="datetime-local" value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})}/></label><p>بازی ابتدا بدون ضریب ثبت می‌شود؛ ایجاد شرط تا انتشار مارکت امن غیرفعال می‌ماند.</p><button className="bvm-primary" disabled={sending} type="submit"><Plus size={17}/> ثبت بازی دستی</button></form></div>:null}
  </div>
  <nav className="bvm-bottom" aria-label="ناوبری اپلیکیشن">{NAV.map(n=><button key={n.key} className={(tab===n.key||n.key==='more'&&!NAV.some(x=>x.key===tab))?'active':''} onClick={()=>setTab(n.key)}><n.icon size={21} strokeWidth={1.8}/><span>{n.label}</span></button>)}</nav>
 </main>;
}
