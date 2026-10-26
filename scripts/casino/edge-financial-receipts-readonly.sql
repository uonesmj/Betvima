-- BetVima casino Edge migration: operator-only READ-ONLY ledger readiness audit.
-- Uses aggregates exclusively; no user IDs, balances, tokens, or amounts returned.
-- No writes and no new API/grants/functions. Validates historical receipts only.
-- Database errors and missing objects must fail the audit, not be interpreted
-- as successful. Operational audit, NOT legal/licensing/KYC approval.

WITH receipts AS (
  SELECT
    COUNT(*)::bigint AS total_receipts,
    COUNT(*) FILTER (WHERE r.response_error = 0)::bigint AS successful_receipts,
    COUNT(*) FILTER (WHERE r.response_error <> 0)::bigint AS rejected_receipts,
    COUNT(*) FILTER (WHERE r.rollback IS TRUE AND r.response_error = 0)::bigint AS successful_rollbacks,
    COUNT(*) FILTER (WHERE r.response_error = 0 AND r.ledger_transaction_id IS NULL)::bigint AS successful_without_ledger_id,
    COUNT(*) FILTER (WHERE r.response_error <> 0 AND r.ledger_transaction_id IS NOT NULL)::bigint AS rejected_with_ledger_id,
    COUNT(*) FILTER (WHERE r.response_error = 0 AND wt.id IS NULL)::bigint AS successful_missing_ledger_row,
    COUNT(*) FILTER (WHERE r.response_error = 0 AND wt.id IS NOT NULL AND
      (wt.currency IS DISTINCT FROM r.wallet_currency OR ABS(wt.amount_minor) <> r.wallet_amount_minor)
    )::bigint AS successful_ledger_currency_or_amount_mismatch,
    COUNT(*) FILTER (WHERE r.rollback IS TRUE AND r.response_error = 0
      AND r.original_debit_call_id IS NULL AND r.original_credit_call_id IS NULL)::bigint
      AS successful_rollback_without_original,
    COUNT(*) FILTER (WHERE r.response_error = 0 AND fx.user_id IS NULL)::bigint
      AS successful_receipt_without_round_fx,
    COUNT(*) FILTER (WHERE r.response_error = 0 AND fx.user_id IS NOT NULL
      AND fx.wallet_currency IS DISTINCT FROM r.wallet_currency)::bigint
      AS successful_round_currency_mismatch,
    COUNT(*) FILTER (WHERE r.response_error = 0 AND bind.user_id IS NOT NULL
      AND bind.wallet_currency IS DISTINCT FROM r.wallet_currency)::bigint
      AS successful_binding_currency_mismatch
  FROM nova.softaggregator_callback_receipts r
  LEFT JOIN nova.wallet_transactions wt ON wt.id = r.ledger_transaction_id
  LEFT JOIN nova.softaggregator_round_fx fx ON fx.user_id = r.user_id
    AND fx.round_id = r.round_id AND fx.game_id = r.game_id
  LEFT JOIN nova.softaggregator_player_wallet_bindings bind ON bind.user_id = r.user_id
),
double_refund AS (
  SELECT COUNT(*)::bigint AS count FROM (
    SELECT original_debit_call_id FROM nova.softaggregator_callback_receipts
    WHERE original_debit_call_id IS NOT NULL AND response_error=0
    GROUP BY original_debit_call_id HAVING COUNT(*)>1
  ) s
),
double_win_reversal AS (
  SELECT COUNT(*)::bigint AS count FROM (
    SELECT original_credit_call_id FROM nova.softaggregator_callback_receipts
    WHERE original_credit_call_id IS NOT NULL AND response_error=0
    GROUP BY original_credit_call_id HAVING COUNT(*)>1
  ) s
),
duplicate_ledger_reference AS (
  SELECT COUNT(*)::bigint AS count FROM (
    SELECT ledger_transaction_id FROM nova.softaggregator_callback_receipts
    WHERE ledger_transaction_id IS NOT NULL AND response_error=0
    GROUP BY ledger_transaction_id HAVING COUNT(*)>1
  ) s
)
SELECT r.*,d.count AS double_refund_targets,
       w.count AS double_win_reversal_targets,
       l.count AS duplicated_success_ledger_reference,
       (r.successful_without_ledger_id = 0 AND
        r.rejected_with_ledger_id = 0 AND
        r.successful_missing_ledger_row = 0 AND
        r.successful_ledger_currency_or_amount_mismatch = 0 AND
        r.successful_rollback_without_original = 0 AND
        r.successful_receipt_without_round_fx = 0 AND
        r.successful_round_currency_mismatch = 0 AND
        r.successful_binding_currency_mismatch = 0 AND
        d.count = 0 AND w.count = 0 AND l.count = 0
       ) AS historical_receipts_pass
FROM receipts r
CROSS JOIN double_refund d
CROSS JOIN double_win_reversal w
CROSS JOIN duplicate_ledger_reference l;