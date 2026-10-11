/**
 * Database seam.
 *
 * Every money-moving operation is an authoritative SQL function; TypeScript never
 * writes balances, odds, or commissions by hand. Two implementations exist:
 *  - `PostgresDb`  : direct `pg` pool (local/containers/CI, integration tests)
 *  - `SupabaseDb`  : PostgREST RPC + REST reads (managed Supabase deployment)
 * Both satisfy the same interface, so services are storage-agnostic.
 */
export type SqlParam = string | number | boolean | bigint | null | undefined | Date | object | unknown[];

export interface DbQueryOptions { timeoutMs?: number }

export interface Db {
  /** Parameterised read query. Results are JSON-ish rows with snake_case columns. */
  query<T = Record<string, unknown>>(sql: string, params?: SqlParam[], options?: DbQueryOptions): Promise<T[]>;
  /** Single-row helper; returns null when no rows. */
  queryOne<T = Record<string, unknown>>(sql: string, params?: SqlParam[], options?: DbQueryOptions): Promise<T | null>;
  /** Call an authoritative SQL function, e.g. rpc('place_bet', {...}). */
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>, options?: DbQueryOptions): Promise<T>;
  /** Call a set-returning SQL function and return all rows. */
  rpcRows<T = Record<string, unknown>>(fn: string, args?: Record<string, unknown>, options?: DbQueryOptions): Promise<T[]>;
  /** Run several statements inside one transaction (used for multi-step reads/admin writes). */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  /** Lightweight connectivity probe for health checks. */
  ping(): Promise<{ ok: boolean; latencyMs: number; message?: string }>;
  readonly kind: 'postgres' | 'supabase';
}

/** Actor context resolved server-side; never accepted from the client payload. */
export interface ActorContext {
  userId: string | null;
  role: 'anon' | 'authenticated' | 'service_role';
  /** Admin staff id when the actor is acting through the admin panel. */
  adminId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
  locale?: 'en';
}
