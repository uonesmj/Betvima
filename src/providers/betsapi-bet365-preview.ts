/**
 * Independent bookmaker-specific Bet365 parser for BetsAPI.
 * IMPORTANT: FI identity != Events API event ID. Read-only coverage preview.
 * Do not ingest into wagering selections until market settlement rules,
 * fixture-ID reconciliation, and authorization are independently verified.
 */
import { object, string, safePrice } from './betsapi-normalization';

export interface Bet365PreviewMarket {
  key: string;
  title: string;
  selections: Array<{ id: string; label: string; decimal: string }>;
}
export interface Bet365PreviewResult {
  source: 'betsapi_bet365';
  fixtureId: string;
  marketCount: number;
  priceCount: number;
  markets: Bet365PreviewMarket[];
}

export function bet365OddsDecimal(value: unknown): string | null {
  const original = string(value).trim();
  if (/^\d+\/\d+$/.test(original)) {
    const [a, b] = original.split('/').map(Number);
    if (!b || !Number.isFinite(a / b) || a > 1000000) return null;
    const decimal = (1 + a / b).toFixed(4);
    return safePrice(decimal);
  }
  return safePrice(original);
}

export function parseBet365LivePreview(fixtureId: string, results: unknown): Bet365PreviewResult {
  if (!/^\d{1,16}$/.test(fixtureId)) throw new Error('INVALID_BET365_FI');
  // Bet365 inplay event returns nested arrays of records. Never assume they
  // are shaped like v2/event/odds or silently match on team names.
  const groups = Array.isArray(results) ? results : [];
  const items = groups.flatMap(group => Array.isArray(group) ? group : []);
  const markets: Bet365PreviewMarket[] = [];
  let active: Bet365PreviewMarket | null = null;
  for (const entry of items.slice(0, 10_000)) {
    const data = object(entry);
    if (data.type === 'MG') {
      const id = string(data.ID);
      const title = string(data.NA).slice(0, 125);
      active = id && title ? {
        key: `bet365:${fixtureId}:${id}`, title, selections: [],
      } : null;
      if (active) markets.push(active);
      continue;
    }
    if (data.type !== 'PA' || !active || data.SU === '1') continue;
    const price = bet365OddsDecimal(data.OD);
    const id = string(data.ID);
    const label = string(data.NA).slice(0, 110);
    if (!price || !id || !label || active.selections.length >= 50) continue;
    if (active.selections.some(s => s.id === id)) continue;
    active.selections.push({ id, label, decimal: price });
  }
  const offered = markets.filter(m => m.selections.length >= 2).slice(0, 150);
  return {
    source: 'betsapi_bet365', fixtureId,
    marketCount: offered.length,
    priceCount: offered.reduce((sum, market) => sum + market.selections.length, 0),
    markets: offered,
  };
}

export function parseBet365PrematchPreview(fixtureId: string, results: unknown): Bet365PreviewResult {
  if (!/^\d{1,16}$/.test(fixtureId)) throw new Error('INVALID_BET365_FI');
  const markets: Bet365PreviewMarket[] = [];
  const sections = Array.isArray(results) ? results : [];
  const add = (entries: Record<string, unknown>, category: string) => {
    const groups = object(entries.sp);
    for (const [groupKey, value] of Object.entries(groups)) {
      const obj = object(value);
      if (!Array.isArray(obj.odds)) continue;
      const data = obj.odds.map(item => {
        const row = object(item);
        const decimal = bet365OddsDecimal(row.odds);
        return decimal && string(row.id) && string(row.name || row.header)
          ? { id: string(row.id), label: string(row.name || row.header).slice(0, 110), decimal }
          : null;
      }).filter((v): v is NonNullable<typeof v> => v !== null);
      if (data.length >= 2) markets.push({
        key: `bet365:${fixtureId}:${category}:${groupKey}`,
        title: string(obj.name) || groupKey,
        selections: data.slice(0, 50),
      });
    }
  };
  for (const event of sections.slice(0, 2)) {
    const obj = object(event);
    for (const [category, value] of Object.entries(obj)) {
      if (!['main', 'asian_lines', 'goals', 'half', 'corners_cards', 'others'].includes(category)) continue;
      add(object(value), category);
    }
  }
  const offered = markets.slice(0, 150);
  return {
    source: 'betsapi_bet365', fixtureId, marketCount: offered.length,
    priceCount: offered.reduce((n, m) => n + m.selections.length, 0),
    markets: offered,
  };
}
