import { bet365OddsDecimal } from '../src/providers/betsapi-bet365-preview';
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

  const shape = (value: unknown) => {
    const counts: Record<string, number> = {};
    const seen = new Set<unknown>();
    let visited = 0;
    function walk(node: unknown, depth: number): void {
      if (depth > 10 || visited++ > 100000 || node === null || typeof node !== 'object' || seen.has(node)) return;
      seen.add(node);
      if (Array.isArray(node)) { for (const child of node) walk(child, depth + 1); return; }
      const record = node as Record<string, unknown>;
      const kind = typeof record.type === 'string' ? record.type : '';
      if (kind === 'MG' || kind === 'MA' || kind === 'PA') counts[kind] = (counts[kind] ?? 0) + 1;
      if (Array.isArray(record.odds)) counts.oddsArrays = (counts.oddsArrays ?? 0) + 1;
      for (const value of Object.values(record)) walk(value, depth + 1);
    }
    walk(value, 0);
    return {
      rootResults: Array.isArray(value) ? value.length : null,
      firstItemType: Array.isArray(value) && value.length ? (Array.isArray(value[0]) ? 'array' : typeof value[0]) : null,
      records: counts,
      truncatedScan: visited > 100000,
    };
  };
  const upstreamShape = shape(object.results);

  const rejectionCounts = { paRecords: 0, suspended: 0, missingId: 0, missingLabel: 0, missingOdds: 0, invalidPrice: 0, validPrice: 0 };
  const oddsFormats: Record<string, number> = {};
  function diagnose(node: unknown, depth = 0): void {
    if (depth > 10 || node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const item of node) diagnose(item, depth + 1); return; }
    const record = node as Record<string, unknown>;
    if (record.type === 'PA') {
      rejectionCounts.paRecords++;
      if (record.SU === '1') rejectionCounts.suspended++;
      if (record.ID === undefined || record.ID === null || String(record.ID).trim() === '') rejectionCounts.missingId++;
      if (record.NA === undefined || record.NA === null || String(record.NA).trim() === '') rejectionCounts.missingLabel++;
      if (record.OD === undefined || record.OD === null || String(record.OD).trim() === '') rejectionCounts.missingOdds++;
      else if (bet365OddsDecimal(record.OD)) rejectionCounts.validPrice++;
      else rejectionCounts.invalidPrice++;
      const format = typeof record.OD;
      oddsFormats[format] = (oddsFormats[format] ?? 0) + 1;
      return;
    }
    for (const child of Object.values(record)) diagnose(child, depth + 1);
  }
  diagnose(object.results);

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
    ...totals, upstreamShape, rejectionCounts, oddsFormats, largestMarketGroups: groups,
    verifiedFixtureIdentity: false, authoritativeSettlement: false,
    warning: 'Diagnostic only. All prices remain read-only and cannot be staked.',
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'INVALID_INPUT');
  process.exitCode = 1;
}
