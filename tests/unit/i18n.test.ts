import { describe, expect, it } from 'vitest';
import { translate } from '@/lib/i18n/dictionaries';

describe('public service notices', () => {
  it('translates the unavailable odds-feed detail in both supported locales', () => {
    expect(translate('en', 'page.oddsUnavailableDetail')).not.toBe('page.oddsUnavailableDetail');
    expect(translate('fa', 'page.oddsUnavailableDetail')).not.toBe('page.oddsUnavailableDetail');
  });
});
