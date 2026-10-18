/** Read-only real-response assessment. Never imports wallet, persistence, or wager services. */
import { readFileSync } from 'node:fs';
import { parseBet365Catalogue, summarizeBet365Catalogue } from '../src/providers/betsapi-bet365-catalogue';

const [fi, mode] = process.argv.slice(2);
if (!fi || !/^\d{1,16}$/.test(fi) || (mode !== 'live' && mode !== 'upcoming')) {
  console.error('USAGE: node --import tsx scripts/betsapi-market-coverage.mts <FI> <live|upcoming> < response.json');
  process.exit(2);
}
try {
  const payload: unknown = JSON.parse(readFileSync(0, 'utf8'));
  const object = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown> : null;
  if (!object || !Array.isArray(object.results) || String(object.success) !== '1') {
    throw new Error('INVALID_BETSAPI_RESPONSE');
  }
  const catalogue = parseBet365Catalogue(fi, mode, object.results);
  const totals = summarizeBet365Catalogue(catalogue);
  const groups = catalogue.markets.map(market => ({
    name: market.name,
    status: market.status,
    selections: market.selections.length,
    open: market.selections.filter(s => s.status === 'open').length,
    exactCandidate: market.selections.filter(s => s.status === 'open' && !!s.selectionCandidate).length,
  })).sort((a, b) => b.selections - a.selections).slice(0, 20);
  console.log(JSON.stringify({
    source: 'bet365', fixtureId: fi, mode,
    ...totals, largestMarketGroups: groups,
    verifiedFixtureIdentity: false, authoritativeSettlement: false,
    warning: 'Diagnostic only. All prices remain read-only and cannot be staked.',
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'INVALID_INPUT');
  process.exitCode = 1;
}
