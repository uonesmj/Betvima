'use client';
import {useEffect,useRef,useState} from 'react';
import type {MatchLiveFacts} from '@/providers/betsapi-match-facts';

type Pulse={id:string;side:'home'|'away';label:string;count:number};
const eventKeys=new Set(['corners','throwins','fouls','offsides','yellowcards','redcards','attacks','dangerous_attacks','on_target','off_target']);

export function LiveMatchPulseBoard({facts,home,away,fa,compact=false}:{
 facts:MatchLiveFacts|null;home:string;away:string;fa:boolean;compact?:boolean;
}){
 const [tick,setTick]=useState(0),[pulse,setPulse]=useState<Pulse|null>(null);
 const previous=useRef<MatchLiveFacts|null>(null);
 useEffect(()=>{
  const old=previous.current;previous.current=facts;
  if(!old||!facts||!old.stats.length||!facts.stats.length||old.updatedAt===facts.updatedAt)return;
  const changes:Pulse[]=[];
  for(const entry of facts.stats){
   if(!eventKeys.has(entry.key))continue;
   const past=old.stats.find(m=>m.key===entry.key);if(!past)continue;
   for(const side of ['home','away'] as const){
    const before=past[side],after=entry[side];
    if(before!=null&&after!=null&&after>before&&after-before<=(entry.key.includes('attack')?8:3))
     changes.push({id:entry.key+':'+side+':'+facts.updatedAt,side,
       count:after-before,label:fa?entry.fa:entry.en});
   }
  }
  if(changes.length)setPulse(changes[0]!);
 },[facts,fa]);
 useEffect(()=>{
  if(!pulse)return;
  const id=setTimeout(()=>setPulse(p=>p?.id===pulse.id?null:p),5800);
  return()=>clearTimeout(id);
 },[pulse]);
 useEffect(()=>{
  if(!facts?.clockRunning||facts.clockSeconds==null)return;
  const id=window.setInterval(()=>{if(document.visibilityState==='visible')setTick(v=>v+1);},1000);
  return()=>window.clearInterval(id);
 },[facts?.clockRunning,facts?.clockSeconds]);
 void tick;
 const updated=facts?.updatedAt?Date.parse(facts.updatedAt):NaN;
 const elapsed=facts?.clockRunning&&Number.isFinite(updated)&&facts.clockSeconds!=null
  ?Math.max(0,Math.min(70,Math.floor((Date.now()-updated)/1000))):0;
 const secs=facts?.clockSeconds!=null?facts.clockSeconds+elapsed:null;
 const time=secs!=null?String(Math.floor(secs/60))+':'+String(secs%60).padStart(2,'0')
  :facts?.minute!=null?String(facts.minute)+'′':'—';
 const stat=(key:string)=>facts?.stats.find(s=>s.key===key);
 const attacks=stat('attacks')??stat('dangerous_attacks');
 const ah=attacks?.home??null,aa=attacks?.away??null,total=(ah??0)+(aa??0);
 const pressure=total>0?Math.max(5,Math.min(95,100*(ah??0)/total)):50;
 const summary=[{key:'corners',fa:'کرنر',en:'Corners'},
 {key:'attacks',fa:'حمله',en:'Attacks'},
 {key:'fouls',fa:'خطا',en:'Fouls'},
 {key:'throwins',fa:'اوت',en:'Throw-ins'}];
 return <div className="overflow-hidden rounded-2xl border border-[#DCE7EF] bg-[#F8FBFD] p-3 sm:p-4">
  <div className="mb-3 flex items-center justify-between gap-2">
   <div className="flex items-center gap-2">
    <span className="relative flex h-2 w-2">
     {facts?.clockRunning&&<span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"/>}
     <span className="relative h-2 w-2 rounded-full bg-emerald-500"/>
    </span>
    <strong className="text-xs font-extrabold text-[#253B50]">{fa?'جریان مسابقه':'Live match flow'}</strong>
   </div>
   <span className="rounded-lg border border-[#D3E4EF] bg-white px-2 py-1 font-mono text-sm font-extrabold tabular-nums text-[#1573BF]">{time}</span>
  </div>
  <div className="relative overflow-hidden rounded-xl border border-[#2B795B] bg-gradient-to-br from-[#115C49] to-[#164C46] p-3 text-white">
   <div className="pointer-events-none absolute inset-2 rounded-lg border border-white/20"/>
   <div className="pointer-events-none absolute inset-y-2 left-1/2 border-l border-white/25"/>
   <div className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25"/>
   <div className="relative flex justify-between gap-3 text-[11px] font-semibold">
    <span className="max-w-[44%] truncate">{home}</span><span className="max-w-[44%] truncate text-right">{away}</span>
   </div>
   <div className="relative mt-3 flex h-2.5 overflow-hidden rounded-full bg-black/30">
    <div className="bg-[#3CEBB0] transition-[width] duration-1000 ease-out" style={{width:String(pressure)+'%'}}/>
    <div className="flex-1 bg-[#FFCA73]"/>
   </div>
   <div className="relative mt-1 flex justify-between gap-2 text-[10px] text-white/90">
    <span>{ah??'—'} {fa?'حمله':'attacks'}</span><span>{aa??'—'} {fa?'حمله':'attacks'}</span>
   </div>
   {pulse?<div key={pulse.id} aria-live="polite" className="relative mx-auto mt-2 w-fit animate-pulse rounded-full border border-white/50 bg-white/20 px-3 py-1 text-center text-xs font-bold">
     {pulse.side==='home'?home:away} · +{pulse.count} {pulse.label}</div>:
    <p className="relative mt-2 text-center text-[10px] text-white/70">
      {fa?'نمای نسبی حملات ثبت‌شده، نه موقعیت واقعی توپ':'Reported attacking balance, not real ball tracking'}</p>}
  </div>
  <div className={'mt-3 grid grid-cols-2 gap-2 '+(compact?'sm:grid-cols-4':'')}>
   {summary.map(item=>{
    const line=item.key==='attacks'?attacks:stat(item.key);
    return <div key={item.key} className="rounded-lg border border-[#E0EAF2] bg-white p-2">
     <p className="mb-1 text-center text-[10px] font-bold text-slate-500">{fa?item.fa:item.en}</p>
     <div className="flex justify-between text-xs font-extrabold tabular-nums text-[#2D4962]">
      <span>{line?.home??'—'}</span><span className="text-slate-300">:</span><span>{line?.away??'—'}</span>
     </div>
    </div>;
   })}
  </div>
  {!facts?.stats?.length&&<p className="mt-3 text-center text-xs text-slate-500">
   {fa?'API هنوز آمار این بازی را ارائه نکرده است':'Verified live statistics not available for this match'}</p>}
 </div>;
}
