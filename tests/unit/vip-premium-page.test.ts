import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const route = readFileSync('src/app/loyalty-program/page.tsx', 'utf8');
const client = readFileSync('src/components/loyalty/loyalty-program-client.tsx', 'utf8');

describe('VIP weekly cashback copy', () => {
  it('retains the VIP page, existing shell and bilingual design', () => {
    expect(route).toContain('LoyaltyProgramClient');
    expect(route).toContain('titleKey="menu.vipClub"');
    expect(client).toContain('data-i18n-ignore dir="ltr"');
    expect(client).toContain("locale === 'fa' ? fa : en");
  });

  it('lists all five weekly deposit thresholds with their exact cashback percentages', () => {
    const tiers = [
      ['bronze', 2000, 3],
      ['silver', 4000, 5],
      ['gold', 6000, 6],
      ['platinum', 9000, 8],
      ['diamond', 15000, 11],
    ] as const;
    for (const [id, weeklyDeposit, rate] of tiers) {
      expect(client).toContain("id: '" + id + "'");
      expect(client).toContain('weeklyDeposit: ' + weeklyDeposit + ', rate: ' + rate);
    }
    expect(client).toContain('families.map((plan, index)');
    expect(client).toContain('money(family.weeklyDeposit)');
    expect(client).not.toContain('milestones[');
  });

  it('makes it clear that weekly losses—not deposited funds—determine actual cashback', () => {
    expect(client).toContain('eligible settled weekly losses');
    expect(client).toContain('not from deposited funds');
    expect(client).toContain('Monday');
    expect(client).toContain('1,000');
    expect(client).toContain('family.rate * 10');
  });

  it('does not claim real account credit, progress or verified balance', () => {
    expect(client).toContain('session?.authenticated');
    expect(client).toContain('sessionLoading');
    expect(client).toContain('no balance or credit is implied');
    expect(client).toContain('Real payouts require');
    expect(client).not.toContain('apiRequest(');
  });

  it('does not change payment, betting, bonus or settlement paths', () => {
    expect(client).not.toContain('method:');
    expect(client).not.toContain('/api/v1/bets');
    expect(client).not.toContain('/api/v1/wallet');
    expect(client).not.toContain('/api/v1/bonuses');
    expect(client).toContain('aria-pressed={active}');
    expect(client).toContain('aria-expanded={expanded}');
  });
});
