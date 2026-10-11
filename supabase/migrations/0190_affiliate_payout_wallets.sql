begin;

create table if not exists nova.affiliate_wallets (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references nova.affiliates(id) on delete cascade,
  asset text not null check (asset in ('USDT_TRC20','TRX','DOGE')),
  address text not null,
  address_masked text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (affiliate_id, asset)
);

create index if not exists affiliate_wallets_affiliate_idx
  on nova.affiliate_wallets (affiliate_id);

alter table nova.affiliate_payouts
  add column if not exists payout_asset text;

alter table nova.affiliate_payouts
  add column if not exists destination_address text;

alter table nova.affiliate_payouts
  drop constraint if exists affiliate_payouts_payout_asset_check;

alter table nova.affiliate_payouts
  add constraint affiliate_payouts_payout_asset_check
  check (payout_asset is null or payout_asset in ('USDT_TRC20','TRX','DOGE'));

create index if not exists affiliate_payouts_asset_idx
  on nova.affiliate_payouts (affiliate_id, payout_asset);

alter table nova.affiliate_wallets enable row level security;

drop policy if exists affiliate_wallets_select_own on nova.affiliate_wallets;

create policy affiliate_wallets_select_own
  on nova.affiliate_wallets
  for select
  using (
    affiliate_id in (
      select a.id
      from nova.affiliates a
      where a.user_id = auth.uid()
    )
  );

create or replace function nova.affiliate_wallets_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists affiliate_wallets_updated_at on nova.affiliate_wallets;

create trigger affiliate_wallets_updated_at
before update on nova.affiliate_wallets
for each row execute function nova.affiliate_wallets_set_updated_at();

create or replace function nova.transition_affiliate_payout(
  p_payout_id uuid, p_status affiliate_payout_status, p_reason text default null, p_provider_reference text default null
) returns jsonb
language plpgsql security definer set search_path = nova, public as $$
declare
  v_actor uuid := nova.current_user_id();
  v_payout nova.affiliate_payouts%rowtype;
  v_allowed text[];
begin
  perform nova.require_admin();
  select * into v_payout from nova.affiliate_payouts where id = p_payout_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

  v_allowed := case v_payout.status
    when 'pending' then array['eligible','cancelled','rejected','manual_review','approved']
    when 'eligible' then array['approved','manual_review','cancelled','rejected']
    when 'approved' then array['processing','cancelled','failed']
    when 'processing' then array['paid','failed']
    when 'failed' then array['pending','cancelled']
    when 'manual_review' then array['eligible','approved','rejected','cancelled']
    when 'rejected' then array['pending','cancelled']
    else array[]::text[] end;

  if not (p_status::text = any(v_allowed)) then
    raise exception 'INVALID_STATE_TRANSITION: % -> %', v_payout.status, p_status using errcode = 'P0001';
  end if;
  if p_status in ('rejected','failed','cancelled') and (p_reason is null or length(trim(p_reason)) < 8) then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  if p_status = 'paid' and (p_provider_reference is null or length(trim(p_provider_reference)) < 4) then
    raise exception 'PROVIDER_REFERENCE_REQUIRED' using errcode = '22023';
  end if;
  if p_status = 'paid' and v_payout.dual_approval_required and v_payout.second_approver_id is null
     and v_payout.approved_by is distinct from v_actor then
    raise exception 'DUAL_APPROVAL_REQUIRED' using errcode = '42501';
  end if;

  update nova.affiliate_payouts
     set status = p_status,
         approved_by = case when p_status in ('approved') and approved_by is null then v_actor else approved_by end,
         approved_at = case when p_status in ('approved') and approved_at is null then now() else approved_at end,
         second_approver_id = case when p_status = 'paid' and dual_approval_required and second_approver_id is null
                                   then v_actor else second_approver_id end,
         second_approved_at = case when p_status = 'paid' and dual_approval_required and second_approved_at is null
                                   then now() else second_approved_at end,
         processing_at = case when p_status = 'processing' then now() else processing_at end,
         paid_at = case when p_status = 'paid' then now() else paid_at end,
         failed_reason = case when p_status in ('failed','rejected','cancelled') then p_reason else failed_reason end,
         provider_reference = coalesce(p_provider_reference, provider_reference),
         notes = coalesce(p_reason, notes)
   where id = p_payout_id;

  -- On payment, settle the corresponding ledger entries as paid.
  if p_status = 'paid' then
    update nova.affiliate_ledger
       set status = 'paid'
     where affiliate_id = v_payout.affiliate_id and status = 'settled' and type <> 'payout';
    update nova.affiliate_settlements set status = 'paid', settled_at = now()
     where id = v_payout.settlement_id;
  end if;

  perform nova.audit_event(v_actor, 'affiliate.payout.transition', 'affiliate_payout', v_payout.public_id,
    jsonb_build_object('status', v_payout.status), jsonb_build_object('status', p_status, 'reason', p_reason),
    p_reason, null, jsonb_build_object('provider_reference', p_provider_reference));

  return jsonb_build_object('ok', true, 'status', p_status, 'payout_id', p_payout_id);
end $$;

grant execute on function nova.transition_affiliate_payout(uuid, affiliate_payout_status, text, text) to authenticated;
grant execute on function nova.transition_affiliate_payout(uuid, affiliate_payout_status, text, text) to service_role;

commit;
