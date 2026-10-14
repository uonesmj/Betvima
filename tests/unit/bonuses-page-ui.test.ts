import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const route = readFileSync('src/app/bonuses/page.tsx', 'utf8');
const ui = readFileSync('src/components/bonuses/bonuses-client.tsx', 'utf8');

describe('Premium bonuses page regression', () => {
  it('mounts the live bonuses dashboard on the public bonuses route', () => {
    expect(route).toContain('BonusesClient');
    expect(route).toContain('PageShell');
  });
  it('handles API envelope and never shows fabricated account statistics to guests', () => {
    expect(ui).toContain("'data' in payload ? payload.data : payload");
    expect(ui).toContain('session?.authenticated');
    expect(ui).toContain('summaryLoaded && data');
    expect(ui).toContain("number: summaryLoaded");
  });
  it('keeps translated copy explicit without changing LTR page geometry', () => {
    expect(ui).toContain('data-i18n-ignore dir="ltr"');
    expect(ui).toContain("locale === 'fa' ? persian : english");
    expect(ui).toContain('aria-expanded={faqOpen === idx}');
    expect(ui).toContain('aria-pressed={historyFilter === value}');
  });
  it('uses actual grants, expiration, and records but leaves bonus rule calculation to the backend', () => {
    expect(ui).toContain("fetch('/api/v1/bonuses'");
    expect(ui).toContain('item.amountMinor');
    expect(ui).toContain('item.remainingAmountMinor');
    expect(ui).toContain('item.expiresAt');
    expect(ui).toContain('item.betId');
    expect(ui).toContain("href=\"/sports/football\"");
    expect(ui).not.toContain("fetch('/api/v1/bets'");
  });
});
