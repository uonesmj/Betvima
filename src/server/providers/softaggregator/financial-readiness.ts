import type { Db } from '@/lib/ports/db';

/**
 * Validate the actual installed DB schema, not a feature flag alone.
 * Pending financial migrations 0208..0212 have deliberately NOT been
 * installed in production. Wager launches must fail closed until their
 * append-only audit and idempotent rollback protections exist.
 *
 * A config boolean is insufficient: a deploy may keep older DB schema.
 */
export async function casinoFinancialSchemaReady(db: Pick<Db, 'queryOne'>): Promise<boolean> {
  try {
    const row = await db.queryOne<{ ready: boolean }>(`
      select (
        to_regclass('nova.softaggregator_callback_receipts') is not null
        and to_regclass('nova.softaggregator_round_fx') is not null
        and to_regclass('nova.softaggregator_player_wallet_bindings') is not null
        and to_regclass('nova.sa_unique_reversed_debit') is not null
        and to_regclass('nova.sa_unique_reversed_credit') is not null
        and exists (
          select 1 from information_schema.columns
          where table_schema = 'nova'
            and table_name = 'softaggregator_callback_receipts'
            and column_name = 'original_credit_call_id'
        )
        and exists (
          select 1 from pg_trigger
          where tgrelid = to_regclass('nova.softaggregator_round_fx')
            and tgname = 'sa_fx_round_immutable' and tgenabled <> 'D'
        )
        and exists (
          select 1 from pg_trigger
          where tgrelid = to_regclass('nova.softaggregator_callback_receipts')
            and tgname = 'sa_receipt_immutable' and tgenabled <> 'D'
        )
        and exists (
          select 1 from pg_trigger
          where tgrelid = to_regclass('nova.softaggregator_player_wallet_bindings')
            and tgname = 'sa_player_wallet_binding_immutable' and tgenabled <> 'D'
        )
        and exists (
          select 1 from pg_trigger
          where tgrelid = to_regclass('nova.softaggregator_callback_receipts')
            and tgname = 'sa_receipt_integrity_on_insert' and tgenabled <> 'D'
        )
        and exists (
          select 1 from pg_constraint
          where conrelid = to_regclass('nova.softaggregator_callback_receipts')
            and conname = 'sa_receipt_posting_coherent' and convalidated
        )
        -- All three tables must enforce RLS even if a DBA accidentally
        -- changed their owner, policy or default grants.
        and (
          select count(*) from pg_class c
          where c.oid in (
            to_regclass('nova.softaggregator_callback_receipts'),
            to_regclass('nova.softaggregator_round_fx'),
            to_regclass('nova.softaggregator_player_wallet_bindings')
          )
            and c.relrowsecurity
        ) = 3
        -- A named index alone is not proof of a working idempotency guard.
        and (
          select count(*) from pg_index ix
          where ix.indexrelid in (
            to_regclass('nova.sa_unique_reversed_debit'),
            to_regclass('nova.sa_unique_reversed_credit')
          )
            and ix.indisunique and ix.indisvalid and ix.indisready
        ) = 2
        -- Do not accept partial migrations where the rollback foreign keys,
        -- target exclusivity or successful rollback constraints are absent.
        and (
          select count(*) from pg_constraint con
          where con.conrelid = to_regclass('nova.softaggregator_callback_receipts')
            and con.convalidated and con.conname = any(array[
              'sa_original_debit_receipt_fk',
              'sa_successful_rollback_has_original',
              'sa_original_credit_receipt_fk',
              'sa_successful_reverse_win_has_original',
              'sa_rollback_target_exclusive',
              'sa_receipt_posting_coherent'
            ])
        ) = 6
        and exists (
          select 1 from pg_constraint con
          where con.conrelid = to_regclass('nova.softaggregator_round_fx')
            and con.conname = 'casino_fx_rate_consistency' and con.convalidated
        )
        -- No anonymous or signed-in API role may directly insert, rewrite
        -- or delete vendor financial facts.
        and not exists (
          select 1 from (values
            (to_regclass('nova.softaggregator_callback_receipts')),
            (to_regclass('nova.softaggregator_round_fx')),
            (to_regclass('nova.softaggregator_player_wallet_bindings'))
          ) rel(table_oid)
          cross join (values ('anon'), ('authenticated')) role(role_name)
          where has_table_privilege(role.role_name, rel.table_oid,
            'INSERT, UPDATE, DELETE')
        )
      ) as ready
    `);
    return row?.ready === true;
  } catch {
    // Database unavailable, unknown migration, incomplete privilege or
    // legacy schema: do not launch a wagering session.
    return false;
  }
}
