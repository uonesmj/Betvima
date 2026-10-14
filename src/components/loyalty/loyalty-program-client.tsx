'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight, ArrowUpRight, Award, BadgeCheck, ChevronDown, ChevronRight,
  CircleHelp, Crown, Gem, Gift, Headphones, LockKeyhole, Medal,
  Plane, ShieldCheck, Sparkles, Star, Ticket, TrendingUp, Trophy, UsersRound,
} from 'lucide-react';
import { useApp } from '@/components/layout/providers';

type Copy = (english: string, persian: string) => string;
type Family = 'bronze' | 'silver' | 'gold' | 'platinum';

const families: Array<{
  id: Family; en: string; fa: string; metal: string; wash: string; border: string;
}> = [
  { id: 'bronze', en: 'Bronze', fa: 'برنزی', metal: '#DDA77A', wash: 'from-[#573826] to-[#181C24]', border: 'border-[#B77F59]/50' },
  { id: 'silver', en: 'Silver', fa: 'نقره‌ای', metal: '#D0E0F2', wash: 'from-[#384958] to-[#141D28]', border: 'border-[#9BB3CA]/50' },
  { id: 'gold', en: 'Gold', fa: 'طلایی', metal: '#F2CE7B', wash: 'from-[#54452A] to-[#151C22]', border: 'border-[#D9A84F]/50' },
  { id: 'platinum', en: 'Platinum', fa: 'پلاتینی', metal: '#95E9DD', wash: 'from-[#245551] to-[#101E24]', border: 'border-[#6DCEC0]/50' },
];

const milestones = [
  0, 5000, 10000, 25000, 50000, 100000,
  250000, 500000, 1000000, 2500000, 5000000, 10000000,
];

const benefits = [
  {
    icon: Gift, en: 'Cashback opportunities', fa: 'فرصت‌های بازگشت وجه',
    descEn: 'Access selected cashback offers when eligible under the active campaign terms.',
    descFa: 'دسترسی به طرح‌های منتخب بازگشت وجه، در صورت احراز شرایط کمپین فعال.',
  },
  {
    icon: TrendingUp, en: 'Rakeback offers', fa: 'پیشنهادهای بازگشت کارمزد',
    descEn: 'Explore potential rakeback benefits where the program makes them available.',
    descFa: 'بررسی مزایای احتمالی بازگشت کارمزد در صورت ارائه در برنامه.',
  },
  {
    icon: Crown, en: 'VIP Club access', fa: 'دسترسی به باشگاه ویژه',
    descEn: 'The published program places its VIP milestone at Gold Level 3.',
    descFa: 'طبق سطوح اعلام‌شده برنامه، نقطه ورود به باشگاه ویژه طلایی ۳ است.',
  },
  {
    icon: Trophy, en: 'Exclusive events', fa: 'رویدادهای اختصاصی',
    descEn: 'Eligible members may receive invitations to private tournaments and experiences.',
    descFa: 'اعضای واجد شرایط ممکن است برای تورنمنت‌ها و رویدادهای اختصاصی دعوت شوند.',
  },
  {
    icon: Headphones, en: 'Personal assistance', fa: 'رسیدگی شخصی‌سازی‌شده',
    descEn: 'Dedicated VIP assistance and concierge options may apply to eligible tiers.',
    descFa: 'در سطوح واجد شرایط، امکان خدمات پشتیبانی اختصاصی و شخصی فراهم می‌شود.',
  },
  {
    icon: Gem, en: 'Signature privileges', fa: 'امتیازهای ممتاز',
    descEn: 'Selected gifts, dedicated offers and special event opportunities.',
    descFa: 'هدایای منتخب، پیشنهادهای ویژه و فرصت شرکت در رویدادهای خاص.',
  },
];

const questions = [
  {
    en: 'How do I become a VIP member?', fa: 'چطور عضو باشگاه VIP می‌شوم؟',
    answerEn: 'The displayed loyalty ladder starts at Bronze 1 and identifies Gold 3 as the VIP Club milestone. Actual eligibility is determined by the program rules and verified account data.',
    answerFa: 'مسیر نمایش‌داده‌شده از برنزی ۱ شروع می‌شود و طلایی ۳ نقطه ورود به باشگاه VIP است. احراز شرایط واقعی بر اساس قوانین برنامه و اطلاعات تأییدشده حساب انجام می‌شود.',
  },
  {
    en: 'Are these figures my personal progress?', fa: 'آیا این اعداد پیشرفت شخصی من هستند؟',
    answerEn: 'No. The amounts shown in the level explorer are published reference thresholds, not your account turnover. Your personal VIP level and remaining requirement are not shown until verified account data is connected.',
    answerFa: 'خیر. مبالغ بخش سطوح، آستانه‌های مرجع برنامه هستند و نشان‌دهنده گردش حساب شما نیستند. سطح شخصی و مبلغ باقی‌مانده فقط زمانی نمایش داده می‌شود که اطلاعات تأییدشده حساب متصل باشد.',
  },
  {
    en: 'Which bets count toward my next level?', fa: 'کدام شرط‌ها برای ارتقای سطح محاسبه می‌شوند؟',
    answerEn: 'Qualifying activity, any exclusions and the calculation period are determined by the official loyalty terms. Please confirm them with support before relying on a turnover estimate.',
    answerFa: 'فعالیت‌های واجد شرایط، موارد استثنا و دوره محاسبه بر اساس قوانین رسمی باشگاه تعیین می‌شوند. برای برآورد گردش لازم، ابتدا جزئیات را از پشتیبانی تأیید کنید.',
  },
  {
    en: 'When can I use exclusive benefits?', fa: 'چه زمانی می‌توانم از مزایای اختصاصی استفاده کنم؟',
    answerEn: 'Availability depends on your confirmed membership, region and any relevant promotion conditions. An illustration of a benefit does not guarantee an immediate credit or award.',
    answerFa: 'دسترسی به مزایا به عضویت تأییدشده، منطقه و شرایط هر طرح بستگی دارد. نمایش یک مزیت به معنی واریز یا اعطای قطعی آن نیست.',
  },
  {
    en: 'Where can I ask about my VIP status?', fa: 'وضعیت عضویت VIP خود را از کجا پیگیری کنم؟',
    answerEn: 'Visit Support to ask about your verified status, qualifying activity and applicable rewards. You can also review your profile through the account page.',
    answerFa: 'از بخش پشتیبانی درباره سطح تأییدشده، فعالیت واجد شرایط و پاداش‌های قابل استفاده سؤال کنید. اطلاعات حساب نیز در صفحه پروفایل در دسترس است.',
  },
];

function money(amount: number) {
  return amount === 0 ? '—' : 'US$' + new Intl.NumberFormat('en-US').format(amount);
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.24em] text-[#44E8AB] sm:text-xs">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#00D47A] shadow-[0_0_12px_#00D47A]" />
      {children}
    </span>
  );
}

export function LoyaltyProgramClient() {
  const { locale, session, sessionLoading } = useApp();
  const copy: Copy = (en, fa) => locale === 'fa' ? fa : en;
  const [selected, setSelected] = useState(8);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const activeFamilyIndex = Math.floor(selected / 3);
  const family = families[activeFamilyIndex] ?? families[0]!;
  const withinFamily = (selected % 3) + 1;
  const vipMilestone = selected >= 8;
  const isSignedIn = Boolean(session?.authenticated);

  return (
    <main data-i18n-ignore dir="ltr" className="mx-auto w-full max-w-[1280px] min-w-0 pb-14 text-[#16242C] sm:pb-20">
      {/* The masthead is a crafted club identity, not an account-balance claim. */}
      <section aria-labelledby="vip-hero-title" className="relative isolate overflow-hidden rounded-[24px] bg-[#08131B] text-white shadow-[0_24px_70px_rgba(4,16,22,.18)] sm:rounded-[32px]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_83%_45%,rgba(0,212,122,.19),transparent_48%),radial-gradient(ellipse_at_5%_95%,rgba(8,127,245,.13),transparent_50%),linear-gradient(125deg,#0A111C_10%,#10242A_100%)]" />
        <div className="pointer-events-none absolute -right-[125px] -top-[180px] h-[490px] w-[490px] rounded-full border border-[#76F7CC]/10 sm:h-[630px] sm:w-[630px]" />
        <div className="pointer-events-none absolute -right-[75px] -top-[115px] h-[370px] w-[370px] rounded-full border border-[#76F7CC]/10 sm:h-[510px] sm:w-[510px]" />
        <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7BF6C4]/60 to-transparent" />
        <div className="relative grid min-h-[460px] grid-cols-1 items-center gap-0 lg:grid-cols-[1.07fr_.93fr]">
          <div className="relative z-10 px-5 pb-8 pt-9 sm:px-9 sm:pb-12 sm:pt-14 lg:px-14 lg:py-16">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#69E9BD]/25 bg-[#00D47A]/10 px-3 py-2">
              <Crown size={15} className="text-[#47ECA9]" aria-hidden="true" />
              <span className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#AEF8DE]">BETVIMA  /  {copy('PRIVATE CLUB', 'باشگاه اختصاصی')}</span>
            </div>
            <h1 id="vip-hero-title" dir="auto" className="max-w-[660px] text-[clamp(36px,6vw,73px)] font-black leading-[1.12] tracking-[-.055em] text-white">
              {copy('Every level.', 'هر سطح،')}
              <span className="block bg-gradient-to-r from-[#9EF8C8] via-[#41DEA2] to-[#D8FFE8] bg-clip-text text-transparent">
                {copy('A new horizon.', 'یک افق تازه.')}
              </span>
            </h1>
            <p dir="auto" className="mt-5 max-w-[510px] text-sm leading-7 text-[#AFC3C9] sm:text-[16px] sm:leading-8">
              {copy(
                'Discover a refined membership journey: twelve levels, four distinctive collections and a world of privileges to explore.',
                'مسیر عضویت متفاوت را تجربه کنید؛ دوازده سطح، چهار مجموعه اختصاصی و دنیایی از امتیازها برای کشف کردن.'
              )}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href="#vip-levels" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[13px] bg-[#00D47A] px-5 text-sm font-black text-[#062719] shadow-[0_7px_24px_rgba(0,212,122,.2)] transition hover:-translate-y-0.5 hover:bg-[#3BE8A4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#62FAC0] motion-reduce:transition-none">
                {copy('Explore the levels', 'مشاهده سطوح')} <ArrowRight size={17} aria-hidden="true" />
              </a>
              <a href="#vip-benefits" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[13px] border border-white/20 bg-white/[.06] px-5 text-sm font-bold text-[#F3FFF9] transition hover:border-[#00D47A]/50 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                {copy('Discover benefits', 'آشنایی با مزایا')} <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-7 gap-y-4 border-t border-white/10 pt-6">
              <div><div className="text-2xl font-black tabular-nums text-white">12</div><div dir="auto" className="mt-1 text-[11px] text-[#A9BEC6]">{copy('Membership levels', 'سطح عضویت')}</div></div>
              <div><div className="text-2xl font-black tabular-nums text-white">04</div><div dir="auto" className="mt-1 text-[11px] text-[#A9BEC6]">{copy('Signature collections', 'مجموعه اختصاصی')}</div></div>
              <div><div className="text-2xl font-black tabular-nums text-[#69E9B1]">{copy('Gold 3', 'طلایی ۳')}</div><div dir="auto" className="mt-1 text-[11px] text-[#A9BEC6]">{copy('VIP milestone', 'نقطه ورود VIP')}</div></div>
            </div>
          </div>
          <div className="relative flex min-h-[240px] items-end justify-center overflow-hidden px-4 lg:h-full lg:min-h-[420px]">
            <div className="pointer-events-none absolute bottom-0 left-1/2 h-[280px] w-[280px] -translate-x-1/2 rounded-full bg-[#00D47A]/20 blur-[65px] sm:h-[370px] sm:w-[370px]" />
            <div className="pointer-events-none absolute bottom-6 left-1/2 h-[230px] w-[230px] -translate-x-1/2 rounded-full border border-[#64EBAE]/25 sm:bottom-16 sm:h-[360px] sm:w-[360px]" />
            <div className="pointer-events-none absolute bottom-12 left-1/2 h-[165px] w-[165px] -translate-x-1/2 rounded-full border border-[#64EBAE]/15 sm:bottom-24 sm:h-[260px] sm:w-[260px]" />
            <img src="/brand/loyalty/vip-club-fg.png" alt="" className="pointer-events-none relative z-10 mx-auto h-[235px] max-w-full object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,.5)] sm:h-[315px] lg:h-[395px]" />
            <div className="absolute bottom-5 left-5 z-20 rounded-[16px] border border-[#8DE8B3]/25 bg-[#0B1C24]/90 px-4 py-3 shadow-xl backdrop-blur-md sm:bottom-11 sm:left-8">
              <div className="flex items-center gap-2"><Sparkles size={15} className="text-[#7AF5B8]" /><span className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#B6EBD6]">{copy('THE INNER CIRCLE', 'حلقه ویژه')}</span></div>
              <div dir="auto" className="mt-1 text-xs font-bold text-white">{copy('Your next chapter awaits', 'فصل تازه شما در راه است')}</div>
            </div>
          </div>
        </div>
      </section>

      <nav aria-label={copy('VIP page sections', 'بخش‌های باشگاه VIP')} className="mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-[#E2E8EB] bg-white p-2 shadow-sm sm:gap-3">
        {[
          ['#vip-levels', copy('Levels', 'سطوح'), Medal],
          ['#vip-benefits', copy('Privileges', 'امتیازها'), Gem],
          ['#vip-journey', copy('How it works', 'نحوه عملکرد'), TrendingUp],
          ['#vip-faq', copy('Questions', 'پرسش‌ها'), CircleHelp],
        ].map(([href, title, Icon]) => {
          const SvgIcon = Icon as typeof Medal;
          return (
            <a key={href as string} href={href as string} className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-bold text-[#3E5260] transition hover:bg-[#E9F9F1] hover:text-[#096E4A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00A968] sm:px-5 sm:text-sm">
              <SvgIcon size={16} aria-hidden="true" /> {title as string}
            </a>
          );
        })}
      </nav>

      <section aria-label={copy('Membership overview', 'نمای کلی عضویت')} className="mt-5 grid gap-3 lg:grid-cols-[1.25fr_.75fr]">
        <div className="relative overflow-hidden rounded-[23px] border border-[#DDE9E6] bg-[linear-gradient(110deg,#FFFFFF,#F1FAF7)] p-5 sm:p-7">
          <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[#BFF3DB]/35 blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#DDF9EC] text-[#087E52]"><ShieldCheck size={23} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[.14em] text-[#568073]">{copy('YOUR MEMBERSHIP', 'عضویت شما')}</p>
              <h2 dir="auto" className="mt-1 text-xl font-black text-[#0B2620] sm:text-2xl">
                {sessionLoading ? copy('Checking session…', 'در حال بررسی حساب…') : isSignedIn ? copy('Your account is connected', 'حساب شما متصل است') : copy('Your journey starts here', 'مسیر شما از اینجا شروع می‌شود')}
              </h2>
              <p dir="auto" className="mt-2 max-w-[600px] text-xs leading-6 text-[#526D68] sm:text-sm">
                {copy(
                  'Personal VIP rank, turnover and progress are not available from verified account data yet. The explorer below shows program reference levels only.',
                  'سطح شخصی VIP، گردش مالی و پیشرفت حساب هنوز از داده‌های تأییدشده در دسترس نیست. بخش سطوح در ادامه فقط اطلاعات مرجع برنامه را نشان می‌دهد.'
                )}
              </p>
            </div>
          </div>
          <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#CFE7DD] pt-4">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-[#37665A]"><LockKeyhole size={14} /> {copy('No estimated balance or progress', 'بدون نمایش موجودی یا پیشرفت تخمینی')}</span>
            <Link href={isSignedIn ? '/account/profile' : '/auth/login'} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0A3229] px-4 text-xs font-extrabold text-white transition hover:bg-[#09694B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00B86B]">
              {isSignedIn ? copy('My profile', 'پروفایل من') : copy('Sign in', 'ورود به حساب')} <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-[23px] bg-[#112B32] p-6 text-white sm:p-7">
          <div className="absolute -right-6 -top-10 h-40 w-40 rounded-full bg-[#00D47A]/15 blur-3xl" />
          <Kicker>{copy('MEMBER SUPPORT', 'پشتیبانی اعضا')}</Kicker>
          <h2 dir="auto" className="relative mt-3 text-[22px] font-black leading-8">{copy('The details matter.', 'جزئیات اهمیت دارند.')}</h2>
          <p dir="auto" className="relative mt-2 text-sm leading-6 text-[#ADC4C9]">{copy('Ask about qualifying turnover, eligibility and your current privileges.', 'درباره گردش مالی واجد شرایط، وضعیت عضویت و مزایای خود سؤال کنید.')}</p>
          <Link href="/support" className="relative mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#6EF7B8] underline-offset-4 hover:underline">{copy('Contact support', 'ارتباط با پشتیبانی')} <ArrowUpRight size={16} /></Link>
        </div>
      </section>

      <section id="vip-levels" aria-labelledby="vip-levels-title" className="scroll-mt-28 pt-12 sm:pt-16">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <Kicker>{copy('THE MEMBERSHIP LADDER', 'مسیر ارتقای عضویت')}</Kicker>
            <h2 id="vip-levels-title" dir="auto" className="mt-3 text-[clamp(26px,4vw,38px)] font-black tracking-[-.04em] text-[#0D222C]">{copy('Choose your next destination.', 'مقصد بعدی را کشف کنید.')}</h2>
            <p dir="auto" className="mt-2 max-w-[700px] text-sm leading-7 text-[#61717B]">{copy('Explore each level and its reference threshold. Choose a collection, then select any milestone.', 'هر سطح و آستانه مرجع آن را بررسی کنید. ابتدا مجموعه موردنظر و سپس یکی از سطوح را انتخاب کنید.')}</p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#D8E5E2] bg-[#F7FBFA] px-3 py-2 text-xs font-extrabold text-[#456C61]"><BadgeCheck size={15} /> {copy('12 published milestones', '۱۲ سطح اعلام‌شده')}</div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" role="group" aria-label={copy('Membership collection', 'انتخاب مجموعه عضویت')}>
          {families.map((item, index) => {
            const active = activeFamilyIndex === index;
            return (
              <button key={item.id} type="button" aria-pressed={active} onClick={() => setSelected(index * 3)}
                className={'group relative min-w-0 overflow-hidden rounded-[18px] border p-3 text-left transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00AD70] motion-reduce:transition-none sm:p-4 ' + (active ? item.border + ' bg-[#10242A] shadow-[0_12px_28px_rgba(0,0,0,.15)]' : 'border-[#E0E8EB] bg-white hover:-translate-y-1 hover:shadow-lg')}>
                <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full opacity-60 blur-xl" style={{ background: item.metal + '28' }} />
                <div className="relative flex items-center gap-2 sm:gap-3">
                  <img src={'/brand/loyalty/' + item.id + '.png'} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover sm:h-16 sm:w-16" />
                  <span className="min-w-0"><span dir="auto" className={'block truncate text-sm font-black sm:text-base ' + (active ? 'text-white' : 'text-[#1F3039]')}>{copy(item.en, item.fa)}</span><span className={'mt-1 block text-[10px] font-bold ' + (active ? 'text-[#A7C8C2]' : 'text-[#86939B]')}>{copy('3 levels', '۳ سطح')}</span></span>
                </div>
                <span className="absolute right-3 top-3 h-2 w-2 rounded-full" style={{ background: active ? '#00D47A' : '#D7E4E0' }} />
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.06fr)_minmax(0,.94fr)]">
          <div className={'relative overflow-hidden rounded-[25px] bg-gradient-to-br p-5 text-white sm:p-8 ' + family.wash}>
            <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full opacity-20 blur-[80px]" style={{ backgroundColor: family.metal }} />
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div><Kicker>{copy('SELECTED LEVEL', 'سطح انتخاب‌شده')}</Kicker><h3 dir="auto" className="mt-3 text-[clamp(27px,4vw,43px)] font-black tracking-[-.04em]">{copy(family.en, family.fa)} <span dir="ltr">{withinFamily.toString().padStart(2, '0')}</span></h3></div>
              <div className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-extrabold text-white"> {String(selected + 1).padStart(2, '0')} / 12</div>
            </div>
            <div className="relative mx-auto my-1 flex h-[178px] max-w-[380px] items-center justify-center sm:h-[210px]">
              <div className="absolute h-40 w-40 rounded-full border border-white/10 sm:h-48 sm:w-48" />
              <div className="absolute h-28 w-28 rounded-full blur-3xl" style={{ background: family.metal + '40' }} />
              <img src={'/brand/loyalty/' + family.id + '.png'} alt="" className="relative h-[172px] w-[230px] rounded-[28px] object-cover drop-shadow-[0_15px_25px_rgba(0,0,0,.55)] sm:h-[205px] sm:w-[290px]" />
            </div>
            <div className="relative z-10 grid grid-cols-2 gap-3 rounded-[18px] border border-white/15 bg-black/20 p-4 backdrop-blur-sm">
              <div><p dir="auto" className="text-[11px] font-bold text-[#D1DADD]">{copy('Reference turnover', 'گردش مالی مرجع')}</p><p dir="ltr" className="mt-1.5 text-[clamp(17px,3vw,26px)] font-black tabular-nums" style={{ color: family.metal }}>{money(milestones[selected] ?? 0)}</p></div>
              <div className="border-l border-white/15 pl-4"><p dir="auto" className="text-[11px] font-bold text-[#D1DADD]">{copy('Club milestone', 'نقطه ورود باشگاه')}</p><p dir="auto" className="mt-1.5 text-sm font-black sm:text-base">{vipMilestone ? copy('VIP territory', 'سطوح ویژه VIP') : copy('Gold 3 ahead', 'مقصد: طلایی ۳')}</p></div>
            </div>
            <p dir="auto" className="relative z-10 mt-3 text-[11px] leading-5 text-[#C1D0D3]">{copy('These are program reference levels, not a verified personal rank or balance.', 'این سطوح فقط مرجع برنامه هستند و نشان‌دهنده سطح یا موجودی تأییدشده حساب شما نیستند.')}</p>
          </div>

          <div className="flex min-w-0 flex-col rounded-[25px] border border-[#DCE6E9] bg-white p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div><div className="text-[11px] font-black uppercase tracking-[.17em] text-[#26825D]">{copy('LEVEL SELECTOR', 'انتخاب سطح')}</div><h3 dir="auto" className="mt-1.5 text-xl font-black text-[#162A32]">{copy(family.en + ' collection', 'مجموعه ' + family.fa)}</h3></div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#E9F9F0] text-[#078F60]"><Medal size={22} /></div>
            </div>
            <div role="group" aria-label={copy('Select level', 'انتخاب سطح')} className="mt-6 space-y-3">
              {[0, 1, 2].map((step) => {
                const index = activeFamilyIndex * 3 + step;
                const active = selected === index;
                return <button type="button" key={index} onClick={() => setSelected(index)} aria-pressed={active}
                  className={'flex w-full items-center justify-between gap-2 rounded-[17px] border p-3.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00B86B] sm:p-4 ' + (active ? 'border-[#15BD7E] bg-[#ECFBF4] shadow-[0_5px_15px_rgba(3,115,79,.06)]' : 'border-[#E7ECEF] bg-[#F8FAFA] hover:border-[#B0D9C5] hover:bg-white')}>
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={'grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-black ' + (active ? 'bg-[#063D30] text-[#8CFFD0]' : 'bg-white text-[#526770]')}>{String(step + 1).padStart(2, '0')}</span>
                    <span className="min-w-0"><span dir="auto" className="block text-sm font-extrabold text-[#1A333B]">{copy(family.en, family.fa)} {step + 1}</span><span dir="ltr" className="mt-1 block text-xs font-bold tabular-nums text-[#72858A]">{money(milestones[index] ?? 0)}</span></span>
                  </span>
                  {active ? <BadgeCheck size={20} className="shrink-0 text-[#088C5C]" /> : <ChevronRight size={18} className="shrink-0 text-[#8A9BA0]" />}
                </button>;
              })}
            </div>
            <div className="mt-auto pt-6">
              <div className="mb-3 flex items-center justify-between text-xs font-bold text-[#58706E]"><span>{copy('Explore the ladder', 'مرور مسیر عضویت')}</span><span dir="ltr" className="tabular-nums">{selected + 1} / 12</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-[#E7F1EC]" role="progressbar" aria-label={copy('Explorer position, not personal progress', 'موقعیت در نمایشگر سطوح، نه پیشرفت شخصی')} aria-valuenow={selected + 1} aria-valuemin={1} aria-valuemax={12}><div className="h-full rounded-full bg-gradient-to-r from-[#00A965] to-[#62E7BA] transition-[width] motion-reduce:transition-none" style={{ width: (selected + 1) / 12 * 100 + '%' }} /></div>
              <button type="button" disabled={selected === 11} onClick={() => setSelected((value) => Math.min(11, value + 1))} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#122B32] px-4 text-sm font-bold text-white transition hover:bg-[#165440] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00B86B] disabled:cursor-not-allowed disabled:bg-[#E6ECEB] disabled:text-[#82918D]">{selected === 11 ? copy('Highest listed level', 'آخرین سطح اعلام‌شده') : copy('Explore next level', 'مشاهده سطح بعدی')} <ArrowRight size={16} /></button>
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-[18px] border border-[#DDE8E5] bg-[#F2F8F5] px-4 py-3 text-xs leading-6 text-[#4D675F]" dir="auto">
          <ShieldCheck size={16} className="mr-2 inline-block align-middle text-[#159A68]" aria-hidden="true" />
          {copy('Turnover thresholds are taken from the existing program display. Eligibility, active benefits and calculation rules must be confirmed with support.', 'آستانه‌های گردش مالی بر اساس اطلاعات فعلی برنامه نمایش داده شده‌اند. شرایط احراز، مزایای فعال و نحوه محاسبه باید از پشتیبانی تأیید شوند.')}
        </div>
      </section>

      <section id="vip-benefits" aria-labelledby="vip-benefits-title" className="scroll-mt-28 pt-12 sm:pt-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div><Kicker>{copy('SIGNATURE BENEFITS', 'مزایای ممتاز')}</Kicker><h2 id="vip-benefits-title" dir="auto" className="mt-3 text-[clamp(26px,4vw,38px)] font-black tracking-[-.04em] text-[#122931]">{copy('More than a membership.', 'فراتر از یک عضویت.')}</h2><p dir="auto" className="mt-2 max-w-[690px] text-sm leading-7 text-[#647781]">{copy('A curated look at the privileges described in the loyalty program. Availability is subject to eligibility and terms.', 'نگاهی به امتیازهای معرفی‌شده در برنامه وفاداری؛ فعال‌شدن هر مزیت به احراز شرایط و قوانین آن بستگی دارد.')}</p></div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#DCE6E2] bg-white px-3 py-2 text-xs font-extrabold text-[#567368]"><Sparkles size={15} /> {copy('Program highlights', 'ویژگی‌های برنامه')}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <article key={benefit.en} className="group relative min-w-0 overflow-hidden rounded-[22px] border border-[#E2E8EC] bg-white p-5 transition duration-200 hover:-translate-y-1 hover:border-[#AADFC8] hover:shadow-[0_20px_36px_rgba(15,49,45,.08)] motion-reduce:transition-none sm:p-6">
                <span className="pointer-events-none absolute right-4 top-3 text-5xl font-black text-[#F0F5F3]">{String(index + 1).padStart(2, '0')}</span>
                <div className="relative grid h-12 w-12 place-items-center rounded-[15px] border border-[#C5EAD9] bg-[#EAFBF3] text-[#087B51]"><Icon size={24} strokeWidth={1.8} /></div>
                <h3 dir="auto" className="relative mt-5 text-lg font-black text-[#142B33]">{copy(benefit.en, benefit.fa)}</h3>
                <p dir="auto" className="relative mt-2 min-h-[65px] text-sm leading-6 text-[#63757D]">{copy(benefit.descEn, benefit.descFa)}</p>
                <div className="relative mt-5 flex items-center gap-2 border-t border-[#EAF0EE] pt-4 text-xs font-extrabold text-[#148456]"><ShieldCheck size={14} /> {copy('Eligibility applies', 'مشروط به احراز شرایط')}</div>
              </article>
            );
          })}
        </div>
        <div className="mt-3 grid gap-3 rounded-[22px] border border-[#243E42] bg-[#10272E] p-5 text-white sm:grid-cols-3 sm:p-6">
          {[
            { icon: UsersRound, en: 'Private tournaments', fa: 'تورنمنت‌های اختصاصی' },
            { icon: Award, en: 'Personalised offers', fa: 'پیشنهادهای شخصی‌سازی‌شده' },
            { icon: Plane, en: 'Special experiences', fa: 'تجربه‌های ویژه' },
          ].map(({ icon: Icon, en, fa }) => <div key={en} className="flex items-center gap-3 border-white/10 py-2 sm:border-r sm:last:border-0"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#7DF3B6]"><Icon size={19} /></span><span dir="auto" className="text-sm font-bold">{copy(en, fa)}</span></div>)}
        </div>
      </section>

      <section id="vip-journey" aria-labelledby="vip-journey-title" className="scroll-mt-28 pt-12 sm:pt-16">
        <div className="relative overflow-hidden rounded-[27px] bg-[#0B1B24] p-5 text-white sm:p-9">
          <div className="pointer-events-none absolute -right-12 -top-32 h-80 w-80 rounded-full bg-[#00D47A]/10 blur-[80px]" />
          <Kicker>{copy('HOW THE JOURNEY WORKS', 'مسیر عضویت چگونه است')}</Kicker>
          <h2 id="vip-journey-title" dir="auto" className="relative mt-3 max-w-[710px] text-[clamp(26px,4vw,38px)] font-black leading-tight">{copy('A clear path. Exceptional possibilities.', 'مسیری روشن، فرصت‌هایی متفاوت.')}</h2>
          <div className="relative mt-8 grid gap-3 md:grid-cols-3">
            {[
              { icon: Star, num: '01', en: 'Create your account', fa: 'حساب خود را بسازید', descEn: 'Registration is the starting point of the published Bronze-to-Platinum program.', descFa: 'ثبت‌نام نقطه آغاز مسیر اعلام‌شده از برنزی تا پلاتینی است.' },
              { icon: TrendingUp, num: '02', en: 'Explore the levels', fa: 'سطوح را بررسی کنید', descEn: 'Review twelve reference milestones and confirm qualifying activity with support.', descFa: 'دوازده سطح مرجع را ببینید و شرایط فعالیت واجد شرایط را از پشتیبانی بپرسید.' },
              { icon: Crown, num: '03', en: 'Unlock your VIP path', fa: 'وارد مسیر ویژه شوید', descEn: 'Gold 3 is the listed VIP milestone; actual privileges require confirmed eligibility.', descFa: 'طلایی ۳ سطح مرجع ورود به باشگاه VIP است؛ مزایای واقعی نیازمند تأیید شرایط هستند.' },
            ].map(({ icon: Icon, num, en, fa, descEn, descFa }) => <div key={num} className="relative rounded-[19px] border border-white/10 bg-white/[.055] p-5 sm:p-6"><span className="absolute right-5 top-4 text-4xl font-black text-white/[.08]">{num}</span><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#00D47A]/15 text-[#57F0AE]"><Icon size={23} /></div><h3 dir="auto" className="mt-6 text-lg font-black">{copy(en, fa)}</h3><p dir="auto" className="mt-2 text-sm leading-6 text-[#ADC0C8]">{copy(descEn, descFa)}</p></div>)}
          </div>
        </div>
      </section>

      <section id="vip-faq" aria-labelledby="vip-faq-title" className="scroll-mt-28 pt-12 sm:pt-16">
        <div className="grid gap-7 lg:grid-cols-[.85fr_1.15fr] lg:gap-10">
          <div className="lg:pt-2">
            <Kicker>{copy('GOOD TO KNOW', 'دانستنی‌های مهم')}</Kicker>
            <h2 id="vip-faq-title" dir="auto" className="mt-3 text-[clamp(26px,4vw,38px)] font-black tracking-[-.04em] text-[#102831]">{copy('Your questions, answered.', 'پاسخ پرسش‌های شما.')}</h2>
            <p dir="auto" className="mt-3 max-w-[430px] text-sm leading-7 text-[#657781]">{copy('Everything about the level explorer, eligibility and available support in one place.', 'راهنمای انتخاب سطح، شرایط عضویت و راه‌های دریافت پشتیبانی، همه در یک بخش.')}</p>
            <Link href="/support" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#CDE8DB] bg-[#EAF9F1] px-4 text-sm font-extrabold text-[#096D4A] transition hover:bg-[#D6F6E5]"><Headphones size={17} /> {copy('Ask our support team', 'سؤال از تیم پشتیبانی')} <ArrowUpRight size={16} /></Link>
          </div>
          <div className="overflow-hidden rounded-[21px] border border-[#DDE7E9] bg-white shadow-[0_10px_38px_rgba(16,38,46,.04)]">
            {questions.map((item, index) => {
              const expanded = openFaq === index;
              return <div key={item.en} className="border-b border-[#E9EEF0] last:border-0">
                <h3>
                  <button type="button" aria-expanded={expanded} aria-controls={'vip-answer-' + index} onClick={() => setOpenFaq(expanded ? null : index)} className="flex min-h-[73px] w-full items-center justify-between gap-4 px-4 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#00B86B] sm:px-6">
                    <span dir="auto" className="text-[13px] font-black text-[#1C333B] sm:text-[15px]">{copy(item.en, item.fa)}</span>
                    <span className={'grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors ' + (expanded ? 'bg-[#0C6145] text-white' : 'bg-[#F0F5F3] text-[#60737A]')}><ChevronDown size={18} className={'transition-transform motion-reduce:transition-none ' + (expanded ? 'rotate-180' : '')} /></span>
                  </button>
                </h3>
                {expanded && <div id={'vip-answer-' + index} dir="auto" className="px-4 pb-5 text-sm leading-7 text-[#667981] sm:px-6">{copy(item.answerEn, item.answerFa)}</div>}
              </div>;
            })}
          </div>
        </div>
      </section>

      <section className="relative mt-12 overflow-hidden rounded-[25px] bg-[linear-gradient(115deg,#092C27,#0D252F_85%)] px-5 py-8 text-white sm:mt-16 sm:px-10 sm:py-11">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-[#00D47A]/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div><div className="mb-3 inline-flex items-center gap-2 text-xs font-extrabold tracking-wide text-[#76F3BC]"><Ticket size={17} /> {copy('BETVIMA VIP CLUB', 'باشگاه VIP بت‌ویما')}</div><h2 dir="auto" className="max-w-[650px] text-[clamp(24px,3vw,35px)] font-black leading-tight">{copy('Make your next chapter count.', 'فصل بعدی را متفاوت بسازید.')}</h2><p dir="auto" className="mt-2 max-w-[550px] text-sm leading-6 text-[#BDCFD0]">{copy('Explore the program at your own pace. Stay informed about eligibility and play responsibly.', 'با آگاهی از شرایط عضویت، مسیر سطوح را بررسی کنید و همواره مسئولانه بازی کنید.')}</p></div>
          <Link href={isSignedIn ? '/account/profile' : '/auth/register'} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#00D47A] px-6 text-sm font-black text-[#06251B] transition hover:bg-[#4EF0B2]">{isSignedIn ? copy('Go to my account', 'رفتن به حساب من') : copy('Create an account', 'ایجاد حساب')} <ArrowRight size={17} /></Link>
        </div>
      </section>
    </main>
  );
}
