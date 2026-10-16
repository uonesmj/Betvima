/**
 * Read-only, bounded, publicly rendered 1Win sample (three football fixtures).
 * Observes the same 1X2 market in the DOM every 2s for up to 75s.
 * No API, private endpoint, WebSocket capture, login, evasion, bypass, database
 * access, order placement or change to BetVima. Research evidence only.
 */
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
const bin=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(existsSync);
const url='https://1win.com/betting/live';
function parseMarket(lines){
  const idx=lines.findIndex(x=>x.toLowerCase()==='full time result');
  if(idx<5)return null;
  const home=lines[idx-4],away=lines[idx-3];
  if(!home||!away||home.length<2||away.length<2||/\d+\.\d+/.test(home+away))return null;
  const prices={};
  for(let j=idx+1;j<Math.min(idx+14,lines.length-1);j++){
    const key=lines[j].toLowerCase();
    const num=Number(lines[j+1]);
    if(['1','x','2'].includes(key) && /^\d+[.,]\d{1,3}$/.test(lines[j+1]) && num>=1.01 && num<1000)
      prices[key]=num;
  }
  if(Object.keys(prices).length!==3)return null;
  const score=lines.slice(idx-2,idx);
  const status=lines[idx-5]??null;
  return {home,away,market:'Full time result',prices,score:score.join('-'),status};
}
async function extract(page){
  return page.evaluate((parseSource)=>{
    const read=Function('return '+parseSource)();
    const odds=[...document.querySelectorAll('button')].filter(b=>
      String(b.className).includes('_odd_') &&
      /\b\d{1,3}\.\d{1,3}\b/.test(b.innerText??''));
    const chosen=new Map();
    const diagnostics=[];
    for(const button of odds){
      let node=button.parentElement;
      for(let depth=0;depth<12&&node;depth++,node=node.parentElement){
        const txt=node.innerText??'';
        if(txt.length>900)break;
        const lines=txt.split(/\n+/).map(x=>x.trim()).filter(Boolean);
        const parsed=read(lines);
        if(parsed){
          const key=(parsed.home+'|'+parsed.away).toLowerCase().normalize('NFKC');
          if(!chosen.has(key))chosen.set(key,parsed);
          break;
        }
        if(diagnostics.length<3 && depth>=5 && txt.includes('Full time result') && txt.length>20)
          diagnostics.push({depth,length:txt.length,lines:lines.slice(0,22)});
      }
    }
    return {events:[...chosen.values()].slice(0,10),oddsButtonCount:odds.length,
      diagnostics:chosen.size?[]:diagnostics};
  },parseMarket.toString());
}
if(!bin){console.log(JSON.stringify({status:'NO_SYSTEM_CHROME'}));process.exit(0);}
const out={status:'started',source:url,betvimaSource:'https://betvima.com/live',
  sampledFixtures:[],matchedBetvimaFixtures:[],sampleCount:0,
  verifiedSameFixturePriceChanges:0,changedFixtureIds:[],
  demonstratedLiveOddsSyncToBetvima:false,
  authorizedForProduction:false,financialSystemTouched:false,
  notes:['DOM observation is not a feed licence or guaranteed quote freshness.']};
let browser;
try {
  browser=await chromium.launch({headless:true,executablePath:bin,timeout:20000});
  const context=await browser.newContext({viewport:{width:1365,height:900}});
  const page=await context.newPage();
  const res=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
  out.sourceHTTP=res?.status();
  await page.waitForTimeout(6000);
  const initial=await extract(page);
  out.visibleOddsButtons=initial.oddsButtonCount;
  out.extractDiagnostics=initial.diagnostics;
  out.initialParsedFixtures=initial.events.length;
  const selected=initial.events.slice(0,3);
  out.sampledFixtures=selected.map(e=>({home:e.home,away:e.away,market:e.market,
    initialPrices:e.prices,initialScore:e.score,initialStatus:e.status,
    priceChanges:[],scoreOrStatusChanges:[],observations:0,missingPolls:0}));
  const map=new Map(out.sampledFixtures.map(e=>[(e.home+'|'+e.away).toLowerCase().normalize('NFKC'),e]));
  for(let i=0;i<30;i++){
    await page.waitForTimeout(2500);
    const poll=await extract(page);
    out.sampleCount++;
    const now=new Date().toISOString();
    const ids=new Set();
    for(const e of poll.events) {
      const id=(e.home+'|'+e.away).toLowerCase().normalize('NFKC'), item=map.get(id);
      if(!item)continue;
      ids.add(id);
      item.observations++;
      const prior=item.latestPrices ?? item.initialPrices;
      if(JSON.stringify(prior)!==JSON.stringify(e.prices)){
        item.priceChanges.push({at:now,from:prior,to:e.prices});
        item.latestPrices=e.prices;
      }
      if((item.latestScore??item.initialScore)!==e.score ||
        (item.latestStatus??item.initialStatus)!==e.status){
        item.scoreOrStatusChanges.push({at:now,score:e.score,status:e.status});
        item.latestScore=e.score;
        item.latestStatus=e.status;
      }
    }
    for(const [id,item] of map)if(!ids.has(id))item.missingPolls++;
  }
  out.verifiedSameFixturePriceChanges=out.sampledFixtures.reduce((s,e)=>s+e.priceChanges.length,0);
  out.changedFixtureIds=out.sampledFixtures.filter(e=>e.priceChanges.length>0)
     .map(e=>e.home+' — '+e.away);
  // Side-by-side comparison against public BetVima UI only. No mutation.
  const preview=await context.newPage();
  try{
    const r=await preview.goto(out.betvimaSource,{waitUntil:'domcontentloaded',timeout:25000});
    out.betvimaHTTP=r?.status();
    await preview.waitForTimeout(2500);
    const rendered=await preview.locator('body').innerText();
    out.betvimaPublicTextSize=rendered.length;
    out.matchedBetvimaFixtures=out.sampledFixtures.filter(e=>
       rendered.toLowerCase().includes(e.home.toLowerCase()) &&
       rendered.toLowerCase().includes(e.away.toLowerCase()))
       .map(e=>({home:e.home,away:e.away,matchIdentityOnly:true,priceMatched:false}));
  }catch(err){out.betvimaError=err instanceof Error?err.name:'Error';}
  await preview.close();
  await context.close();
  out.status='SAMPLED_LIVE_PUBLIC_DOM_NOT_PRODUCTION_INTEGRATION';
}catch(e){out.status='OBSERVATION_FAILED';out.error=e instanceof Error?e.name:'Error';}
finally{await browser?.close().catch(()=>{});}
console.log(JSON.stringify(out,null,2));
