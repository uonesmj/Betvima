/**
 * Bounded public DOM research for 1-3 displayed football matches.
 * READ ONLY. No interception of requests, no hidden APIs, no cookies/login,
 * no throttling evasions, no odds persistence, no bookmaker data publishing.
 */
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
const binaries = ['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'];
const targetURLs = ['https://1win.com/betting/live', 'https://betvima.com/'];
const executablePath = binaries.find(existsSync);
const report = {source:'browser-dom', urls:[], sampleMarketsVerified:false, fixtureOddsComparisonVerified:false};
if (!executablePath) {
  console.log(JSON.stringify({...report, status:'browser_missing'}));
  process.exit(0);
}
const browser = await chromium.launch({headless:true,executablePath});
try {
  for (const url of targetURLs) {
    const page = await browser.newPage({viewport:{width:1365,height:900}});
    const one = {domain:new URL(url).hostname, status:null, error:null, first:null, second:null};
    try {
      const response = await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
      one.status = response?.status() ?? null;
      await page.waitForTimeout(5500);
      async function inspect() {
        return await page.evaluate(() => {
          const body = document.body?.innerText || '';
          const lines = body.split(/\n+/).map(s=>s.trim()).filter(Boolean);
          const odds = /^\d{1,3}[.,]\d{2,3}$/;
          const anchors = [...document.querySelectorAll('a[href]')].filter(a=>
            /\/betting\/|\/match|\/events?|\/live/i.test(a.getAttribute('href') ?? '')).slice(0,15);
          const tokens = [...document.querySelectorAll('button,span,div')]
            .filter(el=>el.children.length<2 && odds.test(el.textContent?.trim() ?? ''))
            .slice(0,15).map(el=>{
              const ancestors=[];
              let cur=el;
              for(let j=0;j<4&&cur;j++,cur=cur.parentElement){
                ancestors.push([cur.tagName, String(cur.className||'').slice(0,115)]);
              }
              return {text:el.textContent.trim().slice(0,18),ancestors};
            });
          // A bounded snippet to determine whether teams and prices are even
          // present. Do not copy full HTML or harvest hidden JSON.
          return {
            visibleTextLength:body.length,
            visibleTextStart:body.slice(0,1200),
            lines: lines.slice(0,38).map(x=>x.slice(0,92)),
            anchorSamples:anchors.map(a=>({href:a.getAttribute('href')?.slice(0,175),text:a.innerText.slice(0,100)})),
            decimalNodes:tokens,
            numberOfDistinctDecimalTokens:new Set(lines.filter(x=>odds.test(x))).size,
          };
        });
      }
      one.first = await inspect();
      await page.waitForTimeout(6500);
      const later = await inspect();
      one.second = {visibleTextLength:later.visibleTextLength,
         numberOfDistinctDecimalTokens:later.numberOfDistinctDecimalTokens,
         changed:JSON.stringify(one.first.decimalNodes.map(n=>n.text)) !== JSON.stringify(later.decimalNodes.map(n=>n.text)),
         samples:later.decimalNodes.slice(0,5).map(n=>n.text)};
    } catch(e) {one.error=e instanceof Error?e.name:'Error';}
    report.urls.push(one);
    await page.close();
  }
} finally {await browser.close().catch(()=>{});}
console.log(JSON.stringify(report,null,2));
