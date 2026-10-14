import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const route = readFileSync('src/app/loyalty-program/page.tsx', 'utf8');
const client = readFileSync('src/components/loyalty/loyalty-program-client.tsx', 'utf8');

describe('VIP premium loyalty page', () => {
  it('keeps the dedicated VIP route inside the shared site shell', () => {
    expect(route).toContain('LoyaltyProgramClient');
    expect(route).toContain('titleKey="menu.vipClub"');
    expect(route).not.toContain('page.bonuses');
  });

  it('retains the twelve published turnover thresholds and Gold 3 entry milestone', () => {
    expect(client).toContain('250000, 500000, 1000000, 2500000, 5000000, 10000000');
    expect(client).toContain('const vipMilestone = selected >= 8');
    expect(client).toContain("id: 'bronze'");
    expect(client).toContain("id: 'silver'");
    expect(client).toContain("id: 'gold'");
    expect(client).toContain("id: 'platinum'");
  });

  it('keeps guest and account states honest instead of inventing personalized progress', () => {
    expect(client).toContain('session?.authenticated');
    expect(client).toContain('sessionLoading');
    expect(client).toContain('not available from verified account data yet');
    expect(client).toContain('not personal progress');
    expect(client).not.toContain("fetch('/api/v1/wallet");
    expect(client).not.toContain('setInterval');
  });

  it('keeps every user-visible copy bilingual and prevents legacy DOM translation conflicts', () => {
    expect(client).toContain("locale === 'fa' ? fa : en");
    expect(client).toContain('data-i18n-ignore dir="ltr"');
    expect(client).toContain('aria-pressed={active}');
    expect(client).toContain('aria-expanded={expanded}');
    expect(client).toContain("href=\"/support\"");
  });

  it('does not add payment, settlement, or wagering mutations', () => {
    expect(client).not.toContain('method:');
    expect(client).not.toContain('apiRequest(');
    expect(client).not.toContain('/api/v1/bets');
    expect(client).not.toContain('/api/v1/wallet');
  });
});
