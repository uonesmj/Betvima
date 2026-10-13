import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, DICTIONARIES } from '@/lib/i18n/dictionaries';
import { translateSportName, translateVisibleText } from '@/lib/i18n/ui-phrases';

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
    expect(translateVisibleText('Withdraw USDT')).toBe('Withdraw USDT');
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
