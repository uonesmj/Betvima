begin;

create table if not exists nova.crypto_payout_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid not null
    references nova.payment_transactions(id) on delete restrict,
  status text not null default 'prepared'
    check (status in (
      'prepared',
      'submitting',
      'provider_created',
      'processing',
      'succeeded',
      'failed',
      'manual_review'
    )),
  provider text not null default 'nowpayments',
  provider_reference text,
  attempt_no integer not null default 1
    check (attempt_no > 0),
  destination text,
  payout_currency text,
  amount_minor bigint not null
    check (amount_minor > 0),
  request_started_at timestamptz,
  provider_created_at timestamptz,
  last_checked_at timestamptz,
  completed_at timestamptz,
  manual_review_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_transaction_id),
  unique (provider, provider_reference)
);

create index if not exists crypto_payout_attempts_status_idx
  on nova.crypto_payout_attempts (status, updated_at desc);

create index if not exists crypto_payout_attempts_provider_ref_idx
  on nova.crypto_payout_attempts (provider_reference)
  where provider_reference is not null;

create index if not exists crypto_payout_attempts_manual_review_idx
  on nova.crypto_payout_attempts (manual_review_at desc)
  where status = 'manual_review';

drop trigger if exists crypto_payout_attempts_updated_at
  on nova.crypto_payout_attempts;

create trigger crypto_payout_attempts_updated_at
before update on nova.crypto_payout_attempts
for each row execute function nova.set_updated_at();

comment on table nova.crypto_payout_attempts is
  'Durable provider-side payout execution state. A submitting attempt must never be automatically recreated because the provider may already have accepted the payout before the process crashed.';

comment on column nova.crypto_payout_attempts.status is
  'prepared can execute; submitting means the provider request may already have been accepted and must never be automatically recreated; provider_created means provider_reference is known; processing is provider-side processing; manual_review requires reconciliation before any new provider request.';

commit;
