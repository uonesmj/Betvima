'use client';

import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Clock3, MapPin, Activity } from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import { LeagueLogo, TeamLogo } from '@/components/ui/logo';
import { sportByKey } from '@/lib/betsapi-sports-map';
import { LiveMatchPulseBoard } from '@/components/betsapi/betsapi-live-activity';
import type { MatchView } from '@/components/betting/match-card';
import type { MatchLiveFacts, MatchBackground, MatchEventItem } from '@/providers/betsapi-match-facts';

type Envelope<T> = { ok: boolean; data?: T };
const empty: MatchBackground = {
  matched:false, stadium:null, city:null, country:null, referee:null,
  home:null, away:null, kickoff:null, pastHome:[], pastAway:[], h2h:[],
  nextHome:[], nextAway:[], updatedAt:'', error:null,
};
function Results({ items, fa }: {items:MatchEventItem[]; fa:boolean}) {
  return items.length ? <div className="space-y-1.5">
    {items.slice(0,5).map(item => <div key={item.id} className="grid grid-cols-[70px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-[#F5F8FC] px-2 py-2 text-[11px]">
      <span className="text-[10px] text-slate-500">{item.kickoff ? new Date(item.kickoff).toLocaleDateString(fa?'fa-IR':'en-GB') : '—'}</span>
      <span className="truncate" title={item.home+' – '+item.away}>{item.home} – {item.away}</span>
      <strong className="tabular-nums">{item.score ?? (item.status==='upcoming' ? (fa?'آینده':'Next') : '—')}</strong>
    </div>)}
  </div> : <p className="p-2 text-xs text-slate-400">{fa?'اطلاعاتی موجود نیست':'No data provided'}</p>;
}
const phrases = {
  en: ['Score','Live statistics','Match information'],
  fa: ['نتیجه بازی','آمار زنده','اطلاعات و سوابق'],
};
export function BetsApiMatchOverview({fixture,fi,sportKey,mode,initial}:{
  fixture:MatchView|null; fi:string; sportKey:string; mode:'live'|'upcoming';
  initial?: {home:string;away:string;kickoff:string};
}) {
  const {locale}=useApp(), fa=locale==='fa';
  const [tab,setTab]=useState(0);
  const [stats,setStats]=useState<MatchLiveFacts|null>(null);
  const [statsBusy,setStatsBusy]=useState(mode==='live');
  const [info,setInfo]=useState<MatchBackground>(empty);
  const [infoBusy,setInfoBusy]=useState(false);
  const [infoRequested,setInfoRequested]=useState(false);
  const touch=useRef<number|null>(null);
  const sportId=sportByKey(sportKey)?.id??1;
  const ht=fixture?.participants.find(p=>p.role==='HOME');
  const at=fixture?.participants.find(p=>p.role==='AWAY');
  const home=ht?.name||stats?.home||initial?.home||'', away=at?.name||stats?.away||initial?.away||'';
  const kickoff=fixture?.scheduledAt||initial?.kickoff||'';
  const score=stats?.score??(fixture?.homeScore!=null&&fixture?.awayScore!=null?
    String(fixture.homeScore)+'-'+String(fixture.awayScore):null);
  const minute=stats?.clockSeconds!=null?
    Math.floor(stats.clockSeconds/60):stats?.minute??fixture?.minute;
  const names=fa?phrases.fa:phrases.en;
  const showTab=(n:number)=>setTab(Math.max(0,Math.min(2,n)));

  useEffect(()=>{
    if(mode!=='live')return;
    let active=true, busy=false;
    const fetchStats=async()=>{
      if(!active||busy||document.visibilityState!=='visible'||!navigator.onLine)return;
      busy=true;
      try {
        const qs=new URLSearchParams({section:'stats',fi,mode,sportId:String(sportId)});
        const res=await fetch('/api/v1/betsapi/match-facts?'+qs,{cache:'no-store'});
        if(!res.ok)throw Error('NETWORK');
        const body=await res.json() as Envelope<MatchLiveFacts>;
        if(active&&body.ok&&body.data)setStats(body.data);
      }catch {
        if(active)setStats(old=>old??{fi,home:null,away:null,score:null,minute:null,stats:[],updatedAt:'',error:'UPSTREAM_UNAVAILABLE'});
      }finally{busy=false;if(active)setStatsBusy(false);}
    };
    void fetchStats();
    const timer=window.setInterval(()=>{void fetchStats();},20000);
    const visible=()=>{if(document.visibilityState==='visible')void fetchStats();};
    document.addEventListener('visibilitychange',visible);
    return()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[mode,fi,sportId]);

  useEffect(()=>{
    if(tab!==2||infoRequested)return;
    setInfoRequested(true);
    if(!home||!away||!kickoff)return;
    let active=true;
    setInfoBusy(true);
    const qs=new URLSearchParams({section:'background',fi,mode,
      sportId:String(sportId),home,away,kickoff});
    void fetch('/api/v1/betsapi/match-facts?'+qs,{cache:'no-store'})
      .then(async r=>{if(!r.ok)throw Error('NETWORK');return r.json() as Promise<Envelope<MatchBackground>>;})
      .then(body=>{if(active&&body.ok&&body.data)setInfo(body.data);})
      .catch(()=>{if(active)setInfo({...empty,error:'UPSTREAM_UNAVAILABLE'});})
      .finally(()=>{if(active)setInfoBusy(false);});
    return()=>{active=false;};
  },[tab,infoRequested,home,away,kickoff,fi,mode,sportId]);

  const sections=[
    {title:fa?'بازی‌های گذشته میزبان':'Home recent matches',rows:info.pastHome},
    {title:fa?'بازی‌های گذشته مهمان':'Away recent matches',rows:info.pastAway},
    {title:fa?'بازی‌های رو در رو':'Head-to-head',rows:info.h2h},
    {title:fa?'بازی‌های آینده میزبان':'Home upcoming matches',rows:info.nextHome},
    {title:fa?'بازی‌های آینده مهمان':'Away upcoming matches',rows:info.nextAway},
  ];
  return <section className="overflow-hidden rounded-2xl border border-[#DDE5EE] bg-white shadow-sm" aria-label={fa?'اطلاعات بازی':'Match facts'}>
    <div role="tablist" className="flex gap-1 border-b border-[#E3EBF2] bg-[#F5F8FB] p-2">
      {names.map((name,i)=><button key={i} type="button" role="tab" aria-selected={tab===i}
        onClick={()=>showTab(i)}
        className={'min-w-0 flex-1 rounded-lg px-1 py-2.5 text-[11px] font-extrabold '+(tab===i?'bg-[#087FF5] text-white':'text-[#52667A]')}>{name}</button>)}
    </div>
    <div onTouchStart={e=>{touch.current=e.touches[0]?.clientX??null;}}
      onTouchEnd={e=>{const x=e.changedTouches[0]?.clientX;
        if(touch.current!==null&&x!==undefined&&Math.abs(x-touch.current)>55)
          showTab(tab+(x<touch.current?1:-1));
        touch.current=null;
      }}>
      {tab===0&&<div role="tabpanel">
        <div className="flex items-center justify-between border-b border-slate-100 bg-[#FAFCFE] px-3 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <LeagueLogo url={fixture?.leagueLogoUrl??null} name={fixture?.leagueName??sportKey} sportKey={sportKey} size={32}/>
            <strong className="truncate text-xs text-[#253345]">{fixture?.leagueName??sportKey}</strong>
          </div>
          <span className={'rounded-lg px-2 py-1 text-xs font-bold '+(mode==='live'?'bg-pink-50 text-pink-700':'bg-emerald-50 text-emerald-700')}>
            {mode==='live'?(fa?'زنده':'LIVE'):(fa?'آینده':'UPCOMING')}
            {mode==='live'&&minute!=null?' '+minute+'′':''}
          </span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] items-center gap-1 px-3 py-5">
          <div className="flex min-w-0 flex-col items-center gap-2 text-center">
            <TeamLogo url={ht?.logoUrl??null} name={home} size={46}/>
            <strong className="line-clamp-2 text-xs font-extrabold text-[#243344]">{home||'—'}</strong>
            <span className="text-[10px] text-slate-400">{fa?'میزبان':'Home'}</span>
          </div>
          <div className="text-center">
            <strong className="text-2xl font-black tabular-nums text-[#223345]">{score?.replace('-',':')??'VS'}</strong>
            {kickoff&&<p className="mt-1 text-[10px] text-slate-400">
              {new Date(kickoff).toLocaleString(fa?'fa-IR':'en-GB',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
            </p>}
          </div>
          <div className="flex min-w-0 flex-col items-center gap-2 text-center">
            <TeamLogo url={at?.logoUrl??null} name={away} size={46}/>
            <strong className="line-clamp-2 text-xs font-extrabold text-[#243344]">{away||'—'}</strong>
            <span className="text-[10px] text-slate-400">{fa?'مهمان':'Away'}</span>
          </div>
        </div>
        {mode==='live'&&<div className="px-3 pb-3">
          <LiveMatchPulseBoard facts={stats} home={home} away={away} fa={fa} compact/>
        </div>}
      </div>}
      {tab===1&&<div role="tabpanel" className="p-3">
        {mode==='live'&&<div className="mb-3">
          <LiveMatchPulseBoard facts={stats} home={home} away={away} fa={fa}/>
        </div>}
        <div className="mb-3 flex items-center justify-between">
          <strong className="flex items-center gap-1 text-sm text-[#253345]"><Activity size={16}/>{fa?'آمار مسابقه':'Match statistics'}</strong>
          {mode==='live'&&<span className="text-[10px] text-slate-400">{fa?'بررسی هر ۲۰ ثانیه':'Checks every 20s'}</span>}
        </div>
        {mode!=='live'?<p className="p-4 text-center text-xs text-slate-400">{fa?'این مسابقه هنوز شروع نشده است':'Match has not started'}</p>:
          statsBusy?<p className="p-4 text-center text-xs text-slate-400">{fa?'دریافت آمار…':'Loading stats…'}</p>:
          !stats?.stats.length?<p className="p-4 text-center text-xs text-slate-400">{fa?'آمار مسابقه از API موجود نیست':'No match statistics supplied'}{stats?.error?' ('+stats.error+')':''}</p>:
          <div className="max-h-[340px] space-y-2 overflow-y-auto">
            {stats.stats.map(m=>{
              const sum=(m.home??0)+(m.away??0),pct=sum>0?100*(m.home??0)/sum:50;
              return <div key={m.key} className="rounded-lg bg-[#F6F9FC] p-2">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <strong className="tabular-nums text-[#135BA0]">{m.home??'—'}</strong>
                  <span className="font-semibold text-[#58718A]">{fa?m.fa:m.en}</span>
                  <strong className="tabular-nums text-[#135BA0]">{m.away??'—'}</strong>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full">
                  <div className="bg-[#087FF5]" style={{width:String(pct)+'%'}}/>
                  <div className="bg-[#FFB454]" style={{width:String(100-pct)+'%'}}/>
                </div>
              </div>;
            })}
            <p className="text-right text-[10px] text-slate-400">{fa?'آخرین دریافت':'Last checked'}: {new Date(stats.updatedAt).toLocaleTimeString(fa?'fa-IR':'en-GB')}</p>
          </div>}
      </div>}
      {tab===2&&<div role="tabpanel" className="space-y-3 p-3">
        <h3 className="flex items-center gap-1 text-sm font-extrabold text-[#253345]"><MapPin size={16}/>{fa?'اطلاعات بازی و سوابق':'Venue and team history'}</h3>
        {infoBusy&&<p className="text-xs text-slate-500">{fa?'در حال دریافت اطلاعات…':'Loading information…'}</p>}
        {!infoBusy&&!info.matched&&<p className="rounded-lg bg-[#F5F8FC] p-3 text-xs text-slate-500">
          {fa?'ارتباط معتبر با آرشیو مسابقات یافت نشد؛ آمار مربوط به تیم دیگری نشان داده نمی‌شود.':'Verified historical match not found; unrelated teams are never shown.'}
        </p>}
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#F6F9FC] p-3 text-xs">
          {[
            [fa?'میزبان':'Home',info.home||home],
            [fa?'مهمان':'Away',info.away||away],
            [fa?'ورزشگاه':'Stadium',info.stadium],
            [fa?'شهر':'City',info.city],
            [fa?'کشور':'Country',info.country],
            [fa?'داور':'Referee',info.referee],
          ].map(([name,value],i)=><div key={i} className="min-w-0">
            <span className="text-slate-400">{name}: </span>
            <strong className="break-words text-[#33465A]">{value||'—'}</strong>
          </div>)}
          <div className="col-span-2 flex items-center gap-1"><Clock3 size={13}/>
            {fa?'تاریخ بازی':'Date'}:
            {info.kickoff||kickoff?new Date(info.kickoff||kickoff).toLocaleString(fa?'fa-IR':'en-GB'):'—'}
          </div>
        </div>
        {info.matched&&<div className="max-h-[390px] space-y-4 overflow-y-auto">
          {sections.map(section=><div key={section.title}>
            <h4 className="mb-1 text-xs font-extrabold text-[#21527B]">{section.title}</h4>
            <Results items={section.rows} fa={fa}/>
          </div>)}
        </div>}
      </div>}
    </div>
    <div className="flex items-center justify-center gap-5 border-t border-slate-100 bg-[#FAFBFD] py-2">
      <button aria-label="Previous" type="button" disabled={tab===0} onClick={()=>showTab(tab-1)} className="text-[#087FF5] disabled:opacity-30"><ChevronLeft size={19}/></button>
      <div className="flex gap-1.5">
        {names.map((name,i)=><button key={i} type="button" aria-label={name} aria-current={tab===i?'page':undefined}
          onClick={()=>showTab(i)} className={'h-1.5 rounded-full '+(tab===i?'w-6 bg-[#087FF5]':'w-2 bg-[#B6C9DC]')}/>)}
      </div>
      <button aria-label="Next" type="button" disabled={tab===2} onClick={()=>showTab(tab+1)} className="text-[#087FF5] disabled:opacity-30"><ChevronRight size={19}/></button>
    </div>
  </section>;
}
