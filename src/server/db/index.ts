import { PostgresDb } from './postgres';
import { SupabaseDb } from './supabase';
import type { Db } from '@/lib/ports/db';

let instance: Db | null = null;

/**
 * Resolve the database driver once per process.
 *  - DB_DRIVER=postgres  -> direct pg pool (local, containers, CI)
 *  - DB_DRIVER=supabase  -> Supabase-managed Postgres (service-role for auth APIs)
 */
export function getDb(): Db {
  if (instance) return instance;
  const driver = (process.env.DB_DRIVER ?? (process.env.SUPABASE_DB_URL ? 'supabase' : 'postgres')).toLowerCase();
  instance = driver === 'supabase' ? SupabaseDb.fromEnv() : PostgresDb.fromEnv();
  return instance;
}

/** Test/worker helper: close the pool (no-op for externally injected drivers). */
export async function closeDb(): Promise<void> {
  if (instance instanceof PostgresDb) await instance.close();
  instance = null;
}

/** Injectable driver for integration tests. */
export function setDb(db: Db | null): void {
  instance = db;
}

export { PostgresDb, pgConfigFromEnv, rawSql } from './postgres';
export { SupabaseDb } from './supabase';
export * from './rows';
