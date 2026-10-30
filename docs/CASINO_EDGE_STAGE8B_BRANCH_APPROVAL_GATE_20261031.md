# Stage 8B — real wallet RPC, branch-gated preparation (2026-10-31)

## Current status: blocked pending explicit cost approval

The existing connected Supabase project `mqygiufkubxxxjodsycu` is the **production** finance database. Do not run synthetic wallet debits/credits on it or its existing user accounts.

Attempted creation of a data-less branch `betvima-casino-stage8b-finance-isolated` via Supabase management API was refused by the connector because explicit **billing confirmation ID** is required. The provider quoted a branching charge of **US$0.01344 per hour** for organization `Uoni` (the only one visible). No staging branch was created, no charge was authorized.

## Production read-only signature/schema inspection

`nova.post_wallet_entry` exists and is SECURITY DEFINER, returns jsonb with args:
`p_user_id uuid, p_type nova.wallet_tx_type, p_amount_minor bigint, p_currency text, p_idempotency_key text, p_reference text, p_bet_id uuid, p_payment_transaction_id uuid, p_reversal_of uuid, p_reason text, p_actor_id uuid, p_metadata jsonb, p_balance_floor bigint, p_allow_frozen boolean`.

RLS is enabled on `nova.profiles`, `nova.wallets`, `nova.wallet_transactions`, `nova.softaggregator_callback_receipts`, `nova.softaggregator_round_fx`, and `nova.softaggregator_player_wallet_bindings`.

## Next after cost approval

1. Create a wholly independent data-less Supabase staging branch, record its **different project ref**, validate health, schema, original wallet RPC, lack of copied auth users/wallet data, and any inherited Edge code and webhook settings. Immediately disable/avoid external provider integrations.
2. Prepare a single dedicated synthetic test identity in that staging branch only. Disable access to any real provider callback. Ensure no production secrets, no source code environment key leaks and no cross-project DB credentials. Use authz-controlled server-only SQL and signed Ed25519 canary.
3. Test real `nova.post_wallet_entry` debit, credit, refund, reversal, concurrent replay, overdraft and immutable receipts on staging with database transaction consistency and wall-clock timings from Edge, not fake in-memory latency.
4. Compare identical debit request timings against the current production read-only baseline and supplier-visible spin timing. Keep any real account trial separate and gated by authorized territory, eligibility, financial reconciliation, provider ingress proof, and a reversible routing plan.
5. Delete/stop staging branch when no longer required, to avoid hourly charges.

**No production writes, no listener or callback routing changes, no promotion of draft PR #370.**
