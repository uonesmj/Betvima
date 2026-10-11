/** Shared primitives. All money is BigInt minor units; all odds are decimals scaled by 10000. */
export type UUID = string;
export type ISODateString = string;

export type Currency = 'IRT' | 'IRR' | 'USD' | 'EUR' | 'GBP';
export type BetType = (typeof import('@/lib/db-enums').BET_TYPE)[number];
export type BetStatus = (typeof import('@/lib/db-enums').BET_STATUS)[number];
export type LegStatus = (typeof import('@/lib/db-enums').BET_LEG_STATUS)[number];
export type BetGrade = 'PENDING' | 'WON' | 'LOST' | 'VOID' | 'HALF_WON' | 'HALF_LOST' | 'MANUAL_REVIEW' | 'CANCELLED';
export type SportKey =
  | 'football'
  | 'basketball'
  | 'tennis'
  | 'volleyball'
  | 'handball'
  | 'hockey'
  | 'baseball'
  | 'american-football'
  | 'cricket'
  | 'mma'
  | 'boxing'
  | 'table-tennis'
  | 'esports'
  | 'other';
export type MatchStatus = (typeof import('@/lib/db-enums').MATCH_STATUS)[number] | 'unknown';
export type MarketStatus = (typeof import('@/lib/db-enums').MARKET_STATUS)[number];
export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number; hasMore: boolean };
export type SortDirection = 'asc' | 'desc';
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };
export type Percentage = number; // basis points where noted
export type Bps = number;
