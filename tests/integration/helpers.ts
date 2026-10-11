/**
 * Integration harness: a REAL PostgreSQL database with the real migrations, the real
 * SQL functions and the real adapters. Nothing is mocked. If a database is not
 * reachable the integration suite reports SKIPPED (never a false pass).
 */
import { randomUUID } from 'node:crypto';
import { PostgresDb } from '@/server/db/postgres';
import type { Db } from '@/lib/ports/db';

export function integrationDb(): PostgresDb | null {
  const integrationUrl = process.env.INTEGRATION_DATABASE_URL;
  if (integrationUrl) return new PostgresDb({ connectionString: integrationUrl, max: 6 });
  if (!process.env.PGHOST && !process.env.DATABASE_URL) return null;
  return new PostgresDb({
    host: process.env.PGHOST ?? "127.0.0.1",
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? "nova",
    password: process.env.PGPASSWORD ?? "nova_local_dev",
    database: process.env.PGDATABASE ?? "nova",
    max: 6,
  });
}

export const uuid = (): string => randomUUID();

/** Deterministic-but-unique keys so repeated runs never collide. */
export const key = (prefix: string): string => `${prefix}-${randomUUID().slice(0, 12)}`;

export async function createUser(db: Db, options: { balanceMinor?: bigint; currency?: string; role?: string; status?: string } = {}): Promise<{ userId: string; email: string }> {
  const email = `it-${randomUUID().slice(0, 10)}@nova.test`;
  const authRow = await db.queryOne<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email]);
  const userId = authRow!.id;
  await db.query(
    `insert into nova.profiles (id, public_id, email, email_hash, role, status, age_verified, email_verified, preferred_currency, kyc_status)
     values ($1, 'IT-' || upper(substr(md5(random()::text),1,8)), $2, encode(digest(lower($2),'sha256'),'hex'), $3, $4, true, true, $5, 'verified')`,
    [userId, email, options.role ?? 'user', options.status ?? 'active', options.currency ?? 'IRT'],
  );
  await db.query(`insert into nova.wallets (user_id, currency, balance_minor) values ($1,$2,0)`, [userId, options.currency ?? 'IRT']);
  if (options.balanceMinor && options.balanceMinor > 0n) {
    await db.rpc('post_wallet_entry', {
      p_user_id: userId, p_type: 'deposit', p_amount_minor: options.balanceMinor.toString(),
      p_currency: options.currency ?? 'IRT', p_idempotency_key: key('it-seed'), p_reason: 'integration seed',
      p_metadata: { integration: true },
    });
  }
  return { userId, email };
}

export async function createMatchWithMarket(db: Db, options: { odds?: bigint; status?: string } = {}): Promise<{ matchId: string; marketId: string; selectionId: string }> {
  const sport = await db.queryOne<{ id: string }>(`select id from nova.sports where slug = 'football'`);
  // Fixed code + upsert: a random code collided with itself across runs (countries_code_key),
  // which made the suite flaky. The fixture is now idempotent.
  const country = await db.queryOne<{ id: string }>(
    `insert into nova.countries (code, name_en) values ('ITX', 'Integration Land')
     on conflict (code) do update set name_en = excluded.name_en returning id`,
  );
  const league = await db.queryOne<{ id: string }>(
    `insert into nova.leagues (sport_id, country_id, slug, name) values ($1,$2,$3,'Integration League') returning id`,
    [sport!.id, country!.id, `it-${randomUUID().slice(0, 8)}`],
  );
  const home = await db.queryOne<{ id: string }>(`insert into nova.teams (sport_id, country_id, slug, name) values ($1,$2,$3,'IT Home') returning id`, [sport!.id, country!.id, `it-h-${randomUUID().slice(0, 8)}`]);
  const away = await db.queryOne<{ id: string }>(`insert into nova.teams (sport_id, country_id, slug, name) values ($1,$2,$3,'IT Away') returning id`, [sport!.id, country!.id, `it-a-${randomUUID().slice(0, 8)}`]);
  const match = await db.queryOne<{ id: string }>(
    `insert into nova.matches (sport_id, league_id, home_team_id, away_team_id, status, scheduled_at, provider, provider_id)
     values ($1,$2,$3,$4,$5, now() + interval '3 hours', 'integration', $6) returning id`,
    [sport!.id, league!.id, home!.id, away!.id, options.status ?? 'scheduled', `it-${randomUUID().slice(0, 10)}`],
  );
  const market = await db.queryOne<{ id: string }>(
    `insert into nova.markets (match_id, key, type, name, status, display_order, is_live) values ($1,'1X2','1X2','Match Result','open',10,false) returning id`,
    [match!.id],
  );
  const selection = await db.queryOne<{ id: string }>(
    `insert into nova.selections (market_id, match_id, code, name, participant_type, odds_scaled, odds_version, odds_updated_at, provider)
     values ($1,$2,'HOME','IT Home','HOME',$3,1, now(),'integration') returning id`,
    [market!.id, match!.id, (options.odds ?? 25_000n).toString()],
  );
  return { matchId: match!.id, marketId: market!.id, selectionId: selection!.id };
}

export async function asRole<T>(db: Db, role: string, fn: () => Promise<T>): Promise<T> {
  try {
    await db.query(`select set_config('nova.user_role', $1, false)`, [role]);
    return await fn();
  } finally {
    await db.query(`select set_config('nova.user_role', '', false)`);
  }
}
