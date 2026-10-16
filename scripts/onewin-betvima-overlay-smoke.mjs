/**
 * Ephemeral visual smoke: 1win public DOM -> BetVima page in isolated CI browser.
 * Important: no source API, network interception, login, production deploy,
 * BetVima server writes, real bet placement, wallet or settlement changes.
 * The demonstration panel exists ONLY inside the ephemeral test browser.
 */
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
const bin=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(existsSync);
if(!bin){console.log(JSON.stringify({status:'NO_CHROME'}));process.exit(0);}
const b=await chromium.launch({headless:true,executablePath:bin});
const r={source:'1win.com/betting/live',target:'betvima.com/live',sampled:0,
  targetQuotesRendered:0,sourcePriceChanges:0,targetUpdates:0,parityErrors:0,
  licensedForProduction:false,liveBettingEnabled:false,sourceStatus:null,targetStatus:null};
try {
 const cx=await b.newContext({viewport:{width:1365,height:900}});
 const src=await cx.newPage(), dst=await cx.newPage();
 r.sourceStatus=(await src.goto('https://1win.com/betting/live',{waitUntil:'domcontentloaded',timeout:25000}))?.status();
 r.targetStatus=(await dst.goto('https://betvima.com/live',{waitUntil:'domcontentloaded',timeout:25000}))?.status();
 await src.waitForTimeout(5500);
 async function getMatches(){
   return src.evaluate(()=>{
     const found=new Map();
     const buttons=[...document.querySelectorAll('button')].filter(b=>
       String(b.className).includes('_odd_') && /\d+\.\d+/.test(b.innerText||''));
     for(const btn of buttons){
       let node=btn.parentElement;
       for(let depth=0;depth<12&&node;depth++,node=node.parentElement){
         const text=node.innerText||'';
         if(text.length>900)break;
         const ls=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
         const k=ls.findIndex(x=>x.toLowerCase()==='full time result');
         if(k<5)continue;
         const home=ls[k-4],away=ls[k-3];
         if(!home||!away||home.length<2||away.length<2||/\d+\.\d+/.test(home+away))continue;
         const odds={};
         for(let i=k+1;i<Math.min(k+14,ls.length-1);i++){
           const key=ls[i].toLowerCase(),price=ls[i+1];
           if(['1','x','2'].includes(key) && /^\d+\.\d{1,3}$/.test(price)
             && Number(price)>=1.01 && Number(price)<1000)odds[key]=price;
         }
         if(Object.keys(odds).length!==3)continue;
         const id=(home+'|'+away).toLowerCase().normalize('NFKC');
         if(!found.has(id))found.set(id,{id,home,away,score:ls.slice(k-2,k).join('-'),
           minute:ls[k-5],market:'Full time result',odds});
         break;
       }
     }
     return [...found.values()].slice(0,9);
   });
 }
 const first=(await getMatches()).slice(0,3);
 r.sampled=first.length;
 if(!first.length){r.status='NO_STABLE_FIXTURE_QUOTES';console.log(JSON.stringify(r,null,2));process.exitCode=1;}
 else{
   const prev=new Map();
   const selected=new Set(first.map(x=>x.id));
   const render=async(items)=>{
     return dst.evaluate((items)=>{
       const id='betvima-read-only-1win-smoke';
       let box=document.getElementById(id);
       if(!box){
         box=document.createElement('section');box.id=id;box.setAttribute('aria-label','Read-only 1win quote smoke');
         box.style.cssText='position:fixed;z-index:2147483647;bottom:12px;right:12px;'+
           'width:min(92vw,390px);max-height:50vh;overflow:auto;background:#18222f;color:#fff;'+
           'padding:16px;border:2px solid #a1c5e2;border-radius:14px;'+
           'font:14px/1.5 sans-serif;box-shadow:0 8px 25px #0008';
         document.body.appendChild(box);
       }
       const texts=['BETVIMA — READ ONLY RESEARCH TEST','Public 1win UI observations; NO BETTING'];
       for(const v of items)texts.push(v.home+' — '+v.away+' | '+v.minute+' | '+v.score+
           ' | 1 '+v.odds['1']+' X '+v.odds.x+' 2 '+v.odds['2']);
       box.textContent=texts.join('\n');
       box.style.whiteSpace='pre-line';
       return {count:items.length,text:box.textContent};
     },items);
   };
   for(let i=0;i<16;i++){
     const latest=(await getMatches()).filter(x=>selected.has(x.id));
     if(!latest.length)break;
     for(const v of latest){
       const before=prev.get(v.id);
       if(before && JSON.stringify(before)!==JSON.stringify(v.odds))r.sourcePriceChanges++;
       prev.set(v.id,v.odds);
     }
     const displayed=await render(latest);
     r.targetUpdates++;
     r.targetQuotesRendered=Math.max(r.targetQuotesRendered,displayed.count);
     for(const v of latest){
       const expected='1 '+v.odds['1']+' X '+v.odds.x+' 2 '+v.odds['2'];
       if(!displayed.text.includes(expected))r.parityErrors++;
     }
     await src.waitForTimeout(3500);
   }
   r.previewPanelPresent=await dst.locator('#betvima-read-only-1win-smoke').count()===1;
   r.status=r.parityErrors===0&&r.targetQuotesRendered>0
     ? 'EPHEMERAL_BROWSER_PREVIEW_SUCCESS_NOT_PRODUCTION'
     : 'BROWSER_PREVIEW_FAILED';
   await cx.close();
 }
}catch(e){r.status='BROWSER_TEST_FAILED';r.error=e instanceof Error?e.name:'Error';}
finally{await b.close().catch(()=>{});}
console.log(JSON.stringify(r,null,2));
