-- 0182 - repair freshness timestamps corrupted by migration 0160
-- Only rows where odds_updated_at was artificially advanced more than
-- 30 seconds beyond the actual provider timestamp are repaired.

update nova.selections
set odds_updated_at = provider_timestamp
where provider_timestamp is not null
  and odds_updated_at is not null
  and odds_updated_at > provider_timestamp + interval '30 seconds';

create index if not exists selections_provider_timestamp_idx
  on nova.selections (provider_timestamp);
