-- Independent migration: PostgreSQL enum additions must commit before first use.
-- This is metadata only; the payment switch remains OFF by default.
alter type nova.wallet_tx_type add value if not exists 'vip_cashback';
