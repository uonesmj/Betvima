import { chromium } from 'playwright';
import https from 'https';

const matchId = '361a60cb-a4bf-4356-be95-d335a048fcfa';

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'Cache-Control': 'no-cache' } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

const domain = (await new Promise((resolve, reject) => {
  const req = https.get('https://ifconfig.me', { headers: { 'User-Agent': 'curl/8' } }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => resolve(null));
  });
  req.on('error', () => resolve(null));
  req.end();
})) ?? null;

const candidates = [
  process.env.NOVA_URL,
  'https://one-vv6905.com',
  'https://one-vv3870.com',
].filter(Boolean);

let baseUrl = null;

for (const candidate of candidates) {
  try {
    const r = await getJson(`${candidate}/api/v1/matches/${matchId}/odds`);
    if (r.status === 200) {
      baseUrl = candidate;
      console.log(`Using production URL: ${baseUrl}`);
      break;
    }
  } catch {}
}

if (!baseUrl) {
  console.error('Could not determine a working public NOVA URL.');
  process.exit(2);
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/bin/chromium-browser',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
});

const samples = [];

for (let i = 0; i < 8; i++) {
  const api = await getJson(`${baseUrl}/api/v1/matches/${matchId}/odds`);
  const payload = api.data;
  const d = payload?.data ?? payload;

  const apiOdds = [];
  for (const m of Array.isArray(d?.markets) ? d.markets : []) {
    for (const s of Array.isArray(m?.selections) ? m.selections : []) {
      apiOdds.push({
        market: m.key,
        id: String(s.id),
        name: s.name,
        odds: String(s.oddsScaled),
        version: Number(s.version ?? 0),
      });
    }
  }

  if (i === 0) {
    await page.goto(`${baseUrl}/live`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
  } else {
    await page.waitForTimeout(2000);
  }

  const dom = await page.locator(`[data-match-id="${matchId}"]`).evaluate((el) => ({
    live: el.getAttribute('data-live'),
    odds: [...el.querySelectorAll('[data-testid="odds-button"]')].map((x) => x.innerText),
  })).catch(() => null);

  samples.push({
    t: new Date().toISOString(),
    apiStatus: d?.status,
    apiVersion: d?.version,
    apiOdds: apiOdds.slice(0, 12),
    domFound: !!dom,
    domLive: dom?.live ?? null,
    domOdds: dom?.odds ?? [],
  });
}

console.log(JSON.stringify(samples, null, 2));

console.log('\n===== FINAL RESULT =====');
console.log('DOM samples:', samples.filter((x) => x.domFound).length);
console.log('API versions:', samples.map((x) => x.apiVersion).join(' -> '));
console.log('DOM odds:', samples.map((x) => JSON.stringify(x.domOdds)).join(' -> '));
console.log('Unique DOM states:', new Set(samples.map((x) => JSON.stringify(x.domOdds))).size);

await browser.close();
