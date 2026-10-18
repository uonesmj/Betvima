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
    const [a = NaN, b = NaN] = original.split('/').map(Number);
    if (!b || !Number.isFinite(a / b) || a > 1000000) return null;
    const decimal = (1 + a / b).toFixed(4);
    return safePrice(decimal);
  }
  return safePrice(original);
}

/** Use only explicit provider labels. Missing sides/names must not be invented. */
function outcomeLabel(row: Record<string, unknown>, id: string, line = ''): string {
  // The upstream "header" often contains the GROUP or a positional marker
  // rather than another part of the participant name (e.g. name="1-0",
  // header="1"). Concatenating all columns produced misleading "1-0 1"
  // results in Correct Score markets. Prefer one explicit identity field;
  // keep the handicap separately when supplied.
  const identity = [row.NA, row.name, row.team_name, row.player_name,
    row.player, row.team, row.header]
    .map(string).map(value => value.trim())
    .find(value => value &&
      !/^(?:selection|outcome|option)(?:\s*\((?:yes|no)\))?$/i.test(value));
  const handicap = line.trim();
  if (identity) {
    return handicap && !identity.includes(handicap)
      ? `${identity.slice(0, 135)} (${handicap})` : identity.slice(0, 135);
  }
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
    if (record.results) visit(record.results, depth + 1);
  }
  visit(value, 0);
  return found;
}

export function parseBet365LivePreview(fixtureId: string, results: unknown): Bet365PreviewResult {
  if (!/^\d{1,16}$/.test(fixtureId)) throw new Error('INVALID_BET365_FI');
  const markets: Bet365PreviewMarket[] = [];
  let current: Bet365PreviewMarket | null = null;
  let currentSubmarket = '';
  const seenKeys = new Set<string>();
  for (const data of liveRecords(results)) {
    if (data.type === 'MG') {
      currentSubmarket = '';
      const id = string(data.ID);
      const title = string(data.NA).slice(0, 150);
      const key = `bet365:${fixtureId}:${id}`;
      current = id && title && data.SU !== '1' && !seenKeys.has(key)
        ? { key, title, selections: [] }
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
      currentSubmarket = data.SU === '1' ? '' : string(data.NA).trim().slice(0, 110);
      continue;
    }
    if (data.type !== 'PA' || !current || data.SU === '1') continue;
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
export function parseBet365PrematchPreview(fixtureId: string, results: unknown): Bet365PreviewResult {
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
      const selections = group.odds.map(item => {
        const row = object(item);
        const decimal = bet365OddsDecimal(row.odds);
        const id = string(row.id);
        const label = outcomeLabel(row, id, string(row.handicap));
        return decimal && id ? { id, label, decimal } : null;
      }).filter((row): row is NonNullable<typeof row> => row !== null).slice(0, 250);
      if (selections.length) {
        seen.add(key);
        markets.push({ key, title: string(group.name) || category.replaceAll('_', ' '), selections });
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
