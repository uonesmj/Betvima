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
