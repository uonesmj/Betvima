-- 0213: in-app notification center and one-time registration welcome.
-- This migration does not credit wallets or create bonus grants.
create table if not exists nova.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 500),
  audience text not null check (audience in ('general','personal')),
  target_user_id uuid references nova.profiles(id) on delete set null,
  action_label text,
  action_path text,
  locale text not null default 'fa' check (locale in ('fa','en')),
  status text not null default 'draft' check (status in ('draft','sent','scheduled','archived')),
  scheduled_at timestamptz,
  created_by uuid references nova.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_campaign_action_pair check (
    (action_label is null and action_path is null) or
    (action_label is not null and action_path is not null and left(action_path, 1) = '/' and left(action_path, 2) <> '//')
  ),
  constraint notification_campaign_audience_target check (
    (audience = 'personal' and target_user_id is not null) or
    (audience = 'general' and target_user_id is null)
  )
);
create index if not exists notification_campaigns_created_idx
  on nova.notification_campaigns (created_at desc);
create index if not exists notification_campaigns_status_idx
  on nova.notification_campaigns (status, scheduled_at);
alter table nova.notification_campaigns enable row level security;
-- Server-only writes via the authenticated admin API/service-role.
revoke all on nova.notification_campaigns from anon, authenticated;
drop trigger if exists notification_campaign_touch on nova.notification_campaigns;
create trigger notification_campaign_touch before update on nova.notification_campaigns
  for each row execute function nova.set_updated_at();

-- A real user registration is represented by creation of nova.profiles. Existing
-- auth-user upserts won't trigger this, even after confirmation or repeat login.
-- Isolate messaging failure so notification infrastructure never blocks sign-up.
create or replace function nova.enqueue_registration_bonus_welcome()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_fa boolean := coalesce(new.preferred_locale, 'fa') <> 'en';
begin
  if new.role::text not in ('user', 'affiliate') then
    return new;
  end if;
  insert into nova.notifications (
    user_id, type, event_key, channel, title, body, data, locale,
    status, scheduled_at, sent_at, dedupe_key, template_key
  ) values (
    new.id, 'promotion', 'auth.welcome', 'in_app',
    case when v_fa then 'به بت‌ویما خوش آمدید! بونوس ۱۰۰٪ هر واریز'
      else 'Welcome to BetVima! 100% deposit bonus' end,
    case when v_fa then
      'برای هر واریز واجد شرایط، بونوس معادل دریافت کنید. اعتبار: ۲۴ ساعت. استفاده: یک شرط ترکیبی با دقیقاً ۴ انتخاب و ضریب حداقل ۱٫۶۰ برای هر انتخاب، از حساب بونوس. قوانین و محدودیت‌ها را بخوانید.'
      else
      'Each eligible deposit can receive a 100% matching bonus. Valid for 24 hours. Use it in one accumulator with exactly 4 picks at 1.60+ odds each, from the Bonus Account. Terms and eligibility apply.'
    end,
    jsonb_build_object('audience','personal','ctaHref','/bonuses',
      'ctaLabel',case when v_fa then 'مشاهده بونوس' else 'View bonus' end,
      'source','registration','bonusPercentage',100),
    case when v_fa then 'fa' else 'en' end,
    'sent', now(), now(), 'welcome-deposit-100:' || new.id::text, 'auth.welcome'
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
  return new;
exception when others then
  raise warning 'WELCOME_NOTIFICATION_FAILED user_id=% sqlstate=%', new.id, sqlstate;
  return new;
end;
$$;
revoke all on function nova.enqueue_registration_bonus_welcome() from public, anon, authenticated;
drop trigger if exists on_profile_created_bonus_welcome on nova.profiles;
create trigger on_profile_created_bonus_welcome
after insert on nova.profiles for each row
execute function nova.enqueue_registration_bonus_welcome();

-- Read acceleration; all user-facing reads still filter by ownership in the API.
create index if not exists notifications_visible_user_idx
  on nova.notifications (user_id, scheduled_at desc, created_at desc)
  where channel = 'in_app';
