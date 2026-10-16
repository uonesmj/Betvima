-- PENDING ONLY: 0212. Must follow 0208..0211 on isolated staging first.
-- The application already posts an atomic wallet entry before the receipt.
-- Enforce a second, database-native defence against forged/mislinked receipts.
-- In particular a rollback must target the SAME user/game/round/currency,
-- same provider USD amount, and original native wallet movement.
alter table nova.softaggregator_callback_receipts
  add constraint sa_receipt_posting_coherent check (
    (response_error = 0 and ledger_transaction_id is not null and
      wallet_amount_minor > 0 and wallet_currency in ('USD','IRT','IRR') and
      length(round_id) between 1 and 240 and length(game_id) between 1 and 240)
    or
    (response_error <> 0 and ledger_transaction_id is null and
      coalesce(wallet_amount_minor, 0) = 0)
  );

create or replace function nova.validate_sa_receipt_integrity()
returns trigger
language plpgsql
security invoker
set search_path = nova, public
as $casino_receipt_integrity$
declare
  target nova.softaggregator_callback_receipts%rowtype;
  movement nova.wallet_transactions%rowtype;
  expected_amount bigint;
  expected_type text;
begin
  -- No original may be linked to a normal (non-rollback) movement.
  if not new.rollback and
    (new.original_debit_call_id is not null or new.original_credit_call_id is not null) then
    raise exception 'CASINO_UNEXPECTED_ROLLBACK_TARGET' using errcode = '23514';
  end if;
  if new.response_error <> 0 then
    if new.original_debit_call_id is not null or new.original_credit_call_id is not null then
      raise exception 'CASINO_FAILED_RECEIPT_HAS_TARGET' using errcode = '23514';
    end if;
    return new;
  end if;

  if not exists (
    select 1 from nova.softaggregator_round_fx fx
      where fx.user_id = new.user_id and fx.round_id = new.round_id
        and fx.game_id = new.game_id and fx.wallet_currency = new.wallet_currency
  ) then
    raise exception 'CASINO_RECEIPT_ROUND_CURRENCY_MISMATCH' using errcode = '23514';
  end if;

  expected_amount := case when new.action = 'debit'
    then -new.wallet_amount_minor else new.wallet_amount_minor end;
  expected_type := case
    when new.rollback and new.action = 'debit' then 'reversal'
    when new.rollback and new.action = 'credit' then 'bet_refund'
    when new.action = 'debit' then 'bet_debit'
    else 'win_credit'
  end;

  select * into movement
    from nova.wallet_transactions
    where id = new.ledger_transaction_id;
  if not found or movement.user_id <> new.user_id
    or movement.currency <> new.wallet_currency
    or movement.amount_minor <> expected_amount
    or movement.type::text <> expected_type
    or movement.reference is distinct from ('softaggregator:' || new.call_id)
  then
    raise exception 'CASINO_RECEIPT_LEDGER_MISMATCH' using errcode = '23514';
  end if;

  if new.rollback then
    select * into target from nova.softaggregator_callback_receipts
      where call_id = case when new.action = 'credit'
        then new.original_debit_call_id else new.original_credit_call_id end;
    if not found or target.user_id <> new.user_id
      or target.game_id is distinct from new.game_id
      or target.round_id is distinct from new.round_id
      or target.wallet_currency is distinct from new.wallet_currency
      or target.action <> (case when new.action = 'credit' then 'debit' else 'credit' end)
      or target.response_error <> 0 or target.rollback
      or target.amount_minor <> new.amount_minor
      or target.wallet_amount_minor <> new.wallet_amount_minor
    then
      raise exception 'CASINO_RECEIPT_ROLLBACK_TARGET_MISMATCH' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$casino_receipt_integrity$;

create trigger sa_receipt_integrity_on_insert
  before insert on nova.softaggregator_callback_receipts
  for each row execute function nova.validate_sa_receipt_integrity();

comment on function nova.validate_sa_receipt_integrity() is
  'Database-level one-to-one reconciliation of supplier receipt to wallet ledger; validates exact rollback native amount and source round.';
