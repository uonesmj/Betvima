alter table nova.payment_transactions
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

create index if not exists payment_tx_provider_metadata_payment_id_idx
  on nova.payment_transactions ((provider_metadata->>'payment_id'))
  where provider_metadata ? 'payment_id';

create index if not exists payment_tx_provider_metadata_asset_idx
  on nova.payment_transactions ((provider_metadata->>'pay_currency'))
  where provider_metadata ? 'pay_currency';

create index if not exists payment_tx_provider_metadata_network_idx
  on nova.payment_transactions ((provider_metadata->>'network'))
  where provider_metadata ? 'network';
