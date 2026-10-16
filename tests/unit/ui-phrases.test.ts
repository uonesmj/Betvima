import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_LOCALE, DICTIONARIES } from '@/lib/i18n/dictionaries';
import { translateSportName, translateVisibleText, translateBettingSelection } from '@/lib/i18n/ui-phrases';

describe('Persian display localization with English canonical layout', () => {
  it('defaults to English while preserving the original English dictionary', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(DICTIONARIES.en['nav.home']).toBe('Home');
  });
  it('translates visible sports markets without modifying odds or payment tokens', () => {
    expect(translateVisibleText('Full Time Result')).toBe('نتیجه پایان بازی');
    expect(translateVisibleText('Over 2.5')).toBe('بالای 2.5');
    expect(translateVisibleText('5 markets')).toBe('5 بازار');
    expect(translateVisibleText('20.53')).toBe('20.53');
    expect(translateVisibleText('Withdraw USDT')).toBe('برداشت USDT');
  });
  it('translates common teams and transliterates provider names only in sports context', () => {
    expect(translateSportName('Manchester United')).toBe('منچستر یونایتد');
    expect(translateVisibleText('Manchester United')).toBe('منچستر یونایتد');
    expect(translateVisibleText('Brighton')).toBe('برایتون');
    expect(translateVisibleText('St. Pauli', false)).toBe('St. Pauli');
    expect(translateVisibleText('St. Pauli', true)).not.toBe('St. Pauli');
  });
  it('preserves spacing in inline labels and avoids touching bilingual input', () => {
    expect(translateVisibleText('  View all  ')).toBe('  مشاهده همه  ');
    expect(translateVisibleText('زنده LIVE')).toBe('زنده LIVE');
    expect(translateVisibleText('BetVimaSupport@gmail.com')).toBe('BetVimaSupport@gmail.com');
  });
});


describe('end-to-end translation vocabulary checks', () => {
  it('covers important newly localized sections', () => {
    expect(translateVisibleText('Primary referral link')).toBe('لینک معرفی اصلی');
    expect(translateVisibleText('Live match center')).toBe('مرکز مسابقه زنده');
    expect(translateVisibleText('No active bonuses')).toBe('بونوس فعالی وجود ندارد');
    expect(translateVisibleText('Responsible gaming')).toBe('بازی مسئولانه');
  });
  it('covers provider team/league names with meaningful Persian spellings', () => {
    expect(translateSportName('Celta Vigo')).toBe('سلتاویگو');
    expect(translateSportName('Manchester City')).toBe('منچستر سیتی');
    expect(translateSportName('UEFA Europa Conference League')).toBe('لیگ کنفرانس اروپا');
    expect(translateVisibleText('Brighton and Hove Albion', true)).toBe('برایتون اند هوو آلبیون');
  });
  it('never changes English usernames, URLs, wallet tokens or numeric odds', () => {
    expect(translateVisibleText('support@example.com')).toBe('support@example.com');
    expect(translateVisibleText('https://betvima.com')).toBe('https://betvima.com');
    expect(translateVisibleText('USD 11.25')).toBe('USD 11.25');
    expect(translateVisibleText('1.95')).toBe('1.95');
  });
});

describe('consistent English-first user and administrator copy', () => {
  it('translates financial explanations only as visible text', () => {
    expect(translateVisibleText('Minimum withdrawal equivalent')).toBe('معادل حداقل برداشت');
    expect(translateVisibleText('Estimated deposit amount (toman)')).toBe('مبلغ تقریبی واریز (تومان)');
    expect(translateVisibleText('50 USD')).toBe('50 USD');
  });
  it('covers help, admin and legal wording', () => {
    expect(translateVisibleText('Help Topics')).toBe('موضوعات راهنما');
    expect(translateVisibleText('Open liabilities')).toBe('تعهدات باز');
    expect(translateVisibleText('Decision')).toBe('تصمیم');
    expect(translateVisibleText('View metrics JSON')).toBe('مشاهده JSON شاخص‌ها');
  });
});

describe('unchanged layout and non-translatable language controls', () => {
  it('holds LTR layout while switching just the displayed language', () => {
    const providers = readFileSync('src/components/layout/providers.tsx', 'utf8');
    const layout = readFileSync('src/app/layout.tsx', 'utf8');
    expect(layout).toContain('<html lang="en" dir="ltr">');
    expect(providers).toContain("document.documentElement.dir = 'ltr'");
    expect(providers).toContain("dir: 'ltr'");
  });

  it('keeps language options named in their native languages', () => {
    const footer = readFileSync('src/components/layout/page-shell.tsx', 'utf8');
    const selector = readFileSync('src/components/layout/language-selector.tsx', 'utf8');
    expect(footer).toContain('translate="no" lang="fa" dir="rtl"');
    expect(footer).toContain('translate="no" lang="en" dir="ltr"');
    expect(selector).toContain('<span translate="no">{LOCALE_META[item].nativeLabel}</span>');
  });

  it('translates CSS-generated mobile affiliate headings only in Persian mode', () => {
    const css = readFileSync('src/app/globals.css', 'utf8');
    expect(css).toContain('.affiliate-referrals-v2 .nova-table td:nth-child(1)::before { content: "User"; }');
    expect(css).toContain('html[lang="fa"] .affiliate-referrals-v2 .nova-table td:nth-child(1)::before { content: "کاربر" !important; }');
    expect(css).toContain('html[lang="fa"] .affiliate-shell .affiliate-referrals-v2 tbody td:nth-child(9)::before { content: "سهم ۷۰٪ شما" !important; }');
  });
});

describe('exhaustive display label regressions after Persian language selection', () => {
  it('localizes previously uncovered account, affiliate and sportsbook labels', () => {
    expect(translateVisibleText('Half loss')).toBe('نیم‌باخت');
    expect(translateVisibleText('Under review')).toBe('در حال بررسی');
    expect(translateVisibleText('View active and settled bets')).toBe('مشاهده شرط‌های باز و تسویه‌شده');
    expect(translateVisibleText('Accept new odds')).toBe('پذیرش ضرایب جدید');
    expect(translateVisibleText('Cancel this job?')).toBe('این وظیفه لغو شود؟');
    expect(translateVisibleText('Questions &amp; Answers')).toBe('پرسش‌ها و پاسخ‌ها');
  });
  it('localizes compound UI strings while keeping numeric values intact', () => {
    expect(translateVisibleText('Stake: $10')).toBe('مبلغ شرط: $10');
    expect(translateVisibleText('Balance (USD)')).toBe('موجودی (USD)');
    expect(translateVisibleText('Showing 3 of 25')).toBe('نمایش 3 از 25');
    expect(translateVisibleText('12 minutes ago')).toBe('12 دقیقه پیش');
    expect(translateVisibleText('Won / Lost')).toBe('برنده / بازنده');
  });
  it('transliterates Latin accented names without leaving stray Latin characters', () => {
    expect(translateSportName('Łódź')).not.toMatch(/[A-Za-zŁł]/);
    expect(translateSportName('Žalgiris')).not.toMatch(/[A-Za-zŽž]/);
    expect(translateSportName('Manchester United')).toBe('منچستر یونایتد');
  });
  it('leaves technical identifiers, addresses and odds unmodified', () => {
    expect(translateVisibleText('TRX')).toBe('TRX');
    expect(translateVisibleText('customer@example.com')).toBe('customer@example.com');
    expect(translateVisibleText('https://betvima.com')).toBe('https://betvima.com');
    expect(translateVisibleText('1.75')).toBe('1.75');
  });
});

describe('sport-specific outcomes and market-line translation', () => {
  it('keeps navigation Home distinct from the match host team', () => {
    expect(translateVisibleText('Home')).toBe('خانه');
    expect(translateBettingSelection('Home')).toBe('میزبان');
    expect(translateBettingSelection('Away')).toBe('میهمان');
    expect(translateBettingSelection('Draw')).toBe('مساوی');
  });
  it('translates quarter markets, handicaps, goal lines and special outcomes', () => {
    expect(translateVisibleText('Total Goals 2.5')).toBe('مجموع گل‌ها 2.5');
    expect(translateVisibleText('Asian Handicap -1.5')).toBe('هندیکپ آسیایی -1.5');
    expect(translateVisibleText('Q1 Moneyline')).toBe('کوارتر 1 برنده مسابقه');
    expect(translateVisibleText('Alternate Team Corners')).toBe('کرنرهای تیمی جایگزین');
    expect(translateVisibleText('Moneyline (Lay)')).toBe('برنده مسابقه (مخالف)');
  });
  it('covers page copy previously left untranslated', () => {
    expect(translateVisibleText('Exclusive Deposit Bonus')).toBe('بونوس اختصاصی واریز');
    expect(translateVisibleText('Passwords do not match.')).toBe('رمزهای عبور مطابقت ندارند.');
    expect(translateVisibleText('Try another team or league name.')).toBe('نام تیم یا لیگ دیگری را وارد کنید.');
  });
});


describe('Persian footer, bonus, VIP and affiliate completion', () => {
  it('replaces the legacy footer with the fixed native five-tab footer without mutating localization', () => {
    const footer = readFileSync('src/components/layout/page-shell.tsx', 'utf8');
    expect(footer).toContain('data-native-footer-parity');
    expect(footer).toContain('data-locale-stable');
    expect(footer).toContain('data-i18n-ignore');
    expect(footer).toContain('dir="ltr"');
    expect(footer).toContain('grid-cols-5');
    expect(footer).toContain("label('Menu', 'منو')");
    expect(footer).toContain("label('Home', 'خانه')");
    expect(footer).toContain("label('Casino', 'کازینو')");
    expect(footer).toContain("label('My Bets', 'شرط‌های من')");
    expect(footer).toContain("label('Sports', 'ورزش‌ها')");
    expect(footer).toContain('bg-[#101114]');
    expect(footer).toContain('text-[#087FF5]');
    expect(footer).toContain('<MobileTabBar onSupportOpen={onSupportOpen} />');
    expect(footer).not.toContain('Every match.');
    expect(footer).not.toContain('Featured clubs');
  });

  it('localizes full bonus statuses and FAQ wording', () => {
    expect(translateVisibleText('Deposit Bonus')).toBe('بونوس واریز');
    expect(translateVisibleText('Get a 100% bonus on every successful deposit. Each bonus is independent and remains valid for 24 hours.'))
      .toBe('با هر واریز موفق بونوس ۱۰۰ درصد دریافت کنید. هر بونوس مستقل است و ۲۴ ساعت اعتبار دارد.');
    expect(translateVisibleText('How do I use a bonus?')).toBe('چگونه از بونوس استفاده کنم؟');
    expect(translateVisibleText('The bonus is marked as Lost and no amount is credited to the Main Account.'))
      .toBe('وضعیت بونوس «بازنده» می‌شود و مبلغی به حساب اصلی افزوده نمی‌شود.');
  });

  it('translates VIP reward names, levels and full questions', () => {
    expect(translateVisibleText('Bronze 1')).toBe('برنزی ۱');
    expect(translateVisibleText('Platinum 3')).toBe('پلاتینی ۳');
    expect(translateVisibleText('Private tournaments')).toBe('تورنمنت‌های اختصاصی');
    expect(translateVisibleText('When do I become a VIP?')).toBe('چه زمانی عضو VIP می‌شوم؟');
    expect(translateVisibleText('VIP privileges begin at Gold 3 and continue to expand as you progress through higher levels.'))
      .toBe('امکانات VIP از سطح طلایی ۳ آغاز می‌شوند و در سطوح بالاتر گسترش می‌یابند.');
  });

  it('covers affiliate dashboard, ledger and security messages', () => {
    expect(translateVisibleText('Turn your network into')).toBe('شبکه ارتباطی خود را به');
    expect(translateVisibleText('real income')).toBe('درآمد واقعی تبدیل کنید');
    expect(translateVisibleText('How commission works')).toBe('نحوه محاسبه کمیسیون');
    expect(translateVisibleText('Unable to save wallet')).toBe('ذخیره کیف پول ممکن نشد');
    expect(translateVisibleText('Your current commission balance and next settlement window.'))
      .toBe('موجودی فعلی کمیسیون شما و زمان تسویه بعدی.');
    expect(translateVisibleText('USD')).toBe('USD');
    expect(translateVisibleText('1.65')).toBe('1.65');
  });
});
