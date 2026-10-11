alter table nova.affiliate_payout_profiles enable row level security;

revoke all on nova.affiliate_payout_profiles from anon, authenticated;

grant select, insert, update, delete on nova.affiliate_payout_profiles to service_role;

comment on table nova.affiliate_payout_profiles is
  'Private affiliate payout profile. Access is restricted to the server-side service role; account_number must never be exposed through public referral URLs or client-side queries.';
