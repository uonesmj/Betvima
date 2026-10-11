import { Pool, type PoolClient, type PoolConfig } from 'pg';
import type { Db, DbQueryOptions, SqlParam } from '@/lib/ports/db';
import { param } from './rows';

/** Marker for a raw SQL expression in an RPC argument (used to pass an explicit NULL). */
export interface RawSql { readonly __rawSql: string }
export const rawSql = (expression: string): RawSql => ({ __rawSql: expression });
const isRaw = (v: unknown): v is RawSql => typeof v === 'object' && v !== null && '__rawSql' in v;

export interface PgDbConfig {
  connectionString?: string;
  host?: string; port?: number; user?: string; password?: string; database?: string;
  max?: number;
  statementTimeoutMs?: number;
  applicationName?: string;
  ssl?: PoolConfig['ssl'];
}

export function pgConfigFromEnv(env = process.env): PgDbConfig {
  if (env.SUPABASE_DB_URL) return { connectionString: env.SUPABASE_DB_URL };
  if (env.DATABASE_URL) return { connectionString: env.DATABASE_URL };
  return {
    host: env.PGHOST ?? '127.0.0.1',
    port: Number(env.PGPORT ?? 5432),
    user: env.PGUSER ?? 'postgres',
    password: env.PGPASSWORD ?? '',
    database: env.PGDATABASE ?? 'postgres',
  };
}

/**
 * Direct Postgres driver. All financial statements are executed through the
 * authoritative SQL functions in the `nova` schema.
 */
export class PostgresDb implements Db {
  readonly kind: 'postgres' | 'supabase' = 'postgres';
  private pool: Pool;
  private statementTimeoutMs: number;

  constructor(config: PgDbConfig = pgConfigFromEnv()) {
    this.statementTimeoutMs = config.statementTimeoutMs ?? 15_000;
    this.pool = new Pool({
      ...config,
      max: config.max ?? 10,
      application_name: config.applicationName ?? 'nova-sportsbook',
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
      statement_timeout: config.statementTimeoutMs ?? 15_000,
    });
    this.pool.on('error', (err) => console.error(JSON.stringify({ level: 'error', msg: 'pg.pool.error', error: err.message })));
  }

  static fromEnv(): PostgresDb {
    return new PostgresDb(pgConfigFromEnv());
  }

  private options(params: SqlParam[] | undefined, options?: DbQueryOptions) {
    return [params?.map(param) ?? [], options?.timeoutMs ?? this.statementTimeoutMs] as const;
  }

  async query<T = Record<string, unknown>>(sql: string, params?: SqlParam[], options?: DbQueryOptions): Promise<T[]> {
    const [values, timeout] = this.options(params, options);
    const result = await this.pool.query(sql, values as unknown[]);
    return result.rows as T[];
  }

  async queryOne<T = Record<string, unknown>>(sql: string, params?: SqlParam[], options?: DbQueryOptions): Promise<T | null> {
    const rows = await this.query<T>(sql, params, options);
    return rows[0] ?? null;
  }

  /**
   * Call an authoritative SQL function with NAMED arguments, e.g.
   *   rpc('place_bet', { p_user_id: '...', p_stake_minor: 100000n })
   * Arguments that are null/undefined are omitted so the SQL defaults apply.
   */
  async rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}, options?: DbQueryOptions): Promise<T> {
    const parts: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(args)) {
      if (value === undefined) continue;
      if (isRaw(value)) { parts.push(`${key} => ${value.__rawSql}`); continue; }
      if (value === null) { parts.push(`${key} => null`); continue; }
      values.push(param(value));
      parts.push(`${key} => $${values.length}`);
    }
    const sql = `select * from nova.${fn}(${parts.join(', ')})`;
    const rows = await this.query<Record<string, unknown>>(sql, values as SqlParam[], options);
    const row = rows[0];
    if (!row) return null as T;
    const keys = Object.keys(row);
    if (keys.length === 1) return row[keys[0]!] as T;   // scalar-returning functions
    return row as unknown as T;
  }

  async rpcRows<T = Record<string, unknown>>(fn: string, args: Record<string, unknown> = {}, options?: DbQueryOptions): Promise<T[]> {
    const parts: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(args)) {
      if (value === undefined) continue;
      if (isRaw(value)) { parts.push(`${key} => ${value.__rawSql}`); continue; }
      if (value === null) { parts.push(`${key} => null`); continue; }
      values.push(param(value));
      parts.push(`${key} => $${values.length}`);
    }
    const sql = `select * from nova.${fn}(${parts.join(', ')})`;
    return this.query<Record<string, unknown>>(sql, values as SqlParam[], options) as Promise<T[]>;
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin read write');
      const tx = new TransactionDb(client, this.statementTimeoutMs, this.kind);
      const result = await fn(tx);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
    const started = Date.now();
    try {
      const row = await this.queryOne<{ ok: number }>('select 1 as ok');
      return { ok: row?.ok === 1, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : 'unknown' };
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

class TransactionDb implements Db {
  readonly kind: 'postgres' | 'supabase';
  constructor(private client: PoolClient, private statementTimeoutMs: number, kind: 'postgres' | 'supabase') {
    this.kind = kind;
  }

  private async run<T>(sql: string, params?: SqlParam[], options?: DbQueryOptions): Promise<T[]> {
    const values = params?.map(param) ?? [];
    const timeout = options?.timeoutMs ?? this.statementTimeoutMs;
    await this.client.query(`set local statement_timeout = ${Math.max(1000, Math.trunc(timeout))}`);
    const result = await this.client.query(sql, values as unknown[]);
    return result.rows as T[];
  }

  query<T = Record<string, unknown>>(sql: string, params?: SqlParam[], options?: DbQueryOptions): Promise<T[]> {
    return this.run<T>(sql, params, options);
  }

  async queryOne<T = Record<string, unknown>>(sql: string, params?: SqlParam[], options?: DbQueryOptions): Promise<T | null> {
    const rows = await this.run<T>(sql, params, options);
    return rows[0] ?? null;
  }

  async rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}, options?: DbQueryOptions): Promise<T> {
    const parts: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(args)) {
      if (value === undefined) continue;
      if (isRaw(value)) { parts.push(`${key} => ${value.__rawSql}`); continue; }
      values.push(param(value));
      parts.push(`${key} => $${values.length}`);
    }
    const rows = await this.run<Record<string, unknown>>(`select * from nova.${fn}(${parts.join(', ')})`, values as SqlParam[], options);
    const row = rows[0];
    if (!row) return null as T;
    const keys = Object.keys(row);
    if (keys.length === 1) return row[keys[0]!] as T;
    return row as unknown as T;
  }

  async rpcRows<T = Record<string, unknown>>(fn: string, args: Record<string, unknown> = {}, options?: DbQueryOptions): Promise<T[]> {
    const parts: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(args)) {
      if (value === undefined) continue;
      if (isRaw(value)) { parts.push(`${key} => ${value.__rawSql}`); continue; }
      if (value === null) { parts.push(`${key} => null`); continue; }
      values.push(param(value));
      parts.push(`${key} => $${values.length}`);
    }
    return this.run<Record<string, unknown>>(
      `select * from nova.${fn}(${parts.join(', ')})`,
      values as SqlParam[],
      options,
    ) as Promise<T[]>;
  }

  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return fn(this);   // already inside a transaction (no nested BEGIN)
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number }> {
    const started = Date.now();
    await this.client.query('select 1');
    return { ok: true, latencyMs: Date.now() - started };
  }
}
