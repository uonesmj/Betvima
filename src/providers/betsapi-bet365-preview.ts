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
  status?: 'open' | 'suspended';
  selections: Array<{ id: string; label: string; decimal: string; status?: 'open' | 'suspended'; line?: string | null }>;
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
    const [a = NaN, b = NaN] = original.split('/').map(Number);
    if (!b || !Number.isFinite(a / b) || a > 1000000) return null;
    const decimal = (1 + a / b).toFixed(4);
    return safePrice(decimal);
  }
  return safePrice(original);
}

/** Use only explicit provider labels. Missing sides/names must not be invented. */
function outcomeLabel(row: Record<string, unknown>, id: string, line = ''): string {
  const raw = [row.NA, row.name, row.header, row.player_name, row.player,
    row.team_name, row.team].map(string).map(x => x.trim()).filter(Boolean);
  const unique = [...new Set(raw)];
  const name = unique.filter(x => !/^selection(?:\s*\([^)]*\))?$/i.test(x)).join(' ').slice(0, 135);
  const handicap = line.trim();
  if (name) return handicap && !name.includes(handicap)
    ? `${name} (${handicap})` : name;
  // Unlabelled source rows are diagnostic only, not executable outcomes.
  return `Unlabelled outcome #${id}${handicap ? ` · line ${handicap}` : ''}`;
}

/** Recursively gather documented Bet365 event MG / PA records without
 * flattening away sibling records or assuming a single nesting level. */
function liveRecords(value: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  function visit(node: unknown, depth: number): void {
    if (depth > 7 || found.length > 50_000) return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child, depth + 1);
      return;
    }
    const record = object(node);
    if (record.type === 'MG' || record.type === 'PA' || record.type === 'MA') {
      found.push(record);
      return;
    }
    // BetsAPI commonly nests one or more arrays under results; preserve record order.
    for (const child of Object.values(record)) {
      if (child !== null && typeof child === 'object') visit(child, depth + 1);
    }
  }
  visit(value, 0);
  return found;
}

export function parseBet365LivePreview(fixtureId: string, results: unknown, includeSuspended = false): Bet365PreviewResult {
  if (!/^\d{1,16}$/.test(fixtureId)) throw new Error('INVALID_BET365_FI');
  const markets: Bet365PreviewMarket[] = [];
  let current: Bet365PreviewMarket | null = null;
  let currentSubmarket = '';
  let submarketSuspended = false;
  const seenKeys = new Set<string>();
  for (const data of liveRecords(results)) {
    if (data.type === 'MG') {
      currentSubmarket = '';
      submarketSuspended = false;
      const id = string(data.ID);
      const title = string(data.NA).slice(0, 150);
      const key = `bet365:${fixtureId}:${id}`;
      const isSuspended = data.SU === '1';
      current = id && title && !seenKeys.has(key)
        ? { key, title, status: isSuspended ? 'suspended' : 'open', selections: [] }
        : null;
      if (current) {
        markets.push(current);
        seenKeys.add(key);
      }
      continue;
    }
    if (data.type === 'MA') {
      // Bet365 MA rows hold the group/line context for following PA rows.
      // Never guess missing Over/Under, player, or team names.
      submarketSuspended = data.SU === '1';
      currentSubmarket = string(data.NA).trim().slice(0, 110);
      continue;
    }
    if (data.type !== 'PA' || !current || (!includeSuspended && (data.SU === '1' || submarketSuspended || current.status === 'suspended'))) continue;
    const price = bet365OddsDecimal(data.OD);
    const id = string(data.ID);
    const handicap = string(data.HA || data.HD || data.HC);
    if (!price || !id || current.selections.length >= 250) continue;
    if (current.selections.some(s => s.id === id)) continue;
    current.selections.push({
      id, label: (() => {
        const label = outcomeLabel(data, id, handicap);
        if (!currentSubmarket || label.toLowerCase().includes(currentSubmarket.toLowerCase())) return label;
        return `${currentSubmarket} · ${label}`.slice(0, 200);
      })(), decimal: price,
      status: data.SU === '1' || submarketSuspended || current.status === 'suspended' ? 'suspended' : 'open',
      line: handicap || null,
    });
  }
  const offered = markets.filter(m => m.selections.length >= 1).slice(0, 1000);
  return {
    source: 'betsapi_bet365', fixtureId,
    marketCount: offered.length,
    priceCount: offered.reduce((sum, market) => sum + market.selections.length, 0),
    markets: offered,
  };
}

/** Version 4 prematch payload: results[0] has main, asian_lines, goals, half,
 * corners_cards, others (possibly nested arrays), and sport-specific groups.
 * Traverse actual `sp` objects in every section instead of hardcoding only
 * first two response items or omitting `others`. */
export function parseBet365PrematchPreview(fixtureId: string, results: unknown, includeSuspended = false): Bet365PreviewResult {
  if (!/^\d{1,16}$/.test(fixtureId)) throw new Error('INVALID_BET365_FI');
  const markets: Bet365PreviewMarket[] = [];
  const seen = new Set<string>();
  function parseSection(data: unknown, category: string, depth: number): void {
    if (depth > 9 || markets.length >= 1000) return;
    if (Array.isArray(data)) {
      for (const entry of data) parseSection(entry, category, depth + 1);
      return;
    }
    const group = object(data);
    if (Array.isArray(group.odds)) {
      const id = string(group.id) || category;
      const key = `bet365:${fixtureId}:${category}:${id}`;
      if (seen.has(key)) return;
      const groupSuspended = group.SU === '1' || group.suspended === true || group.status === 'suspended';
      const selections = group.odds.map(item => {
        const row = object(item);
        const decimal = bet365OddsDecimal(row.odds);
        const id = string(row.id);
        const label = outcomeLabel(row, id, string(row.handicap));
        return decimal && id && (includeSuspended || !(groupSuspended || row.SU === '1' || row.suspended === true)) ? { id, label, decimal, status: groupSuspended || row.SU === '1' || row.suspended === true ? 'suspended' as const : 'open' as const, line: string(row.handicap) || null } : null;
      }).filter((row): row is NonNullable<typeof row> => row !== null).slice(0, 250);
      if (selections.length) {
        seen.add(key);
        markets.push({ key, title: string(group.name) || category.replaceAll('_', ' '), status: groupSuspended ? 'suspended' : 'open', selections });
      }
      return;
    }
    if (group.sp) parseSection(group.sp, category, depth + 1);
    else for (const [key, value] of Object.entries(group)) {
      if (key === 'updated_at' || key === 'FI' || key === 'event_id') continue;
      parseSection(value, category === 'root' ? key : `${category}:${key}`, depth + 1);
    }
  }
  parseSection(results, 'root', 0);
  const offered = markets.slice(0, 1000);
  return {
    source: 'betsapi_bet365', fixtureId,
    marketCount: offered.length,
    priceCount: offered.reduce((n, market) => n + market.selections.length, 0),
    markets: offered,
  };
}
