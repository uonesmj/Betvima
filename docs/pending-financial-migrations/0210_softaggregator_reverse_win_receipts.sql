-- Pending only: applied to isolated casino staging; NEVER to Production automatically.
-- Record exactly-once rollback debits against a previously successful credit.
alter table nova.softaggregator_callback_receipts
  add column if not exists original_credit_call_id text;

alter table nova.softaggregator_callback_receipts
  add constraint sa_original_credit_receipt_fk
    foreign key (original_credit_call_id)
    references nova.softaggregator_callback_receipts(call_id) on delete restrict;

create unique index if not exists sa_unique_reversed_credit
  on nova.softaggregator_callback_receipts (original_credit_call_id)
  where original_credit_call_id is not null;

alter table nova.softaggregator_callback_receipts
  add constraint sa_successful_reverse_win_has_original
  check (not (rollback and action = 'debit' and response_error = 0)
         or original_credit_call_id is not null);

alter table nova.softaggregator_callback_receipts
  add constraint sa_rollback_target_exclusive
  check (not (original_debit_call_id is not null
             and original_credit_call_id is not null));

comment on column nova.softaggregator_callback_receipts.original_credit_call_id is
  'Target credit for an exactly-once rollback debit; settlement records the original local wallet amount.';
