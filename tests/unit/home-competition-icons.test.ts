import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { HOME_COMPETITIONS, competitionSprite } from '@/lib/home-competitions';

describe('Home original competition carousel', () => {
  it('keeps all 16 original emblems with the user-approved five first', () => {
    expect(HOME_COMPETITIONS).toHaveLength(16);
    expect(HOME_COMPETITIONS.map(x => x.label).slice(0, 5)).toEqual([
      'WNBA', 'UFC Fight Night', 'WTA Wuhan', 'Markets', 'NBA Pre-season',
    ]);
    expect(new Set(HOME_COMPETITIONS.map(x => x.label)).size).toBe(16);
  });
  it('maps each original emblem to a bounded atlas row and does not invent a league URL', () => {
    for (let i = 0; i < HOME_COMPETITIONS.length; i++) {
      expect(competitionSprite(i).image).toBe(`/brand/league-shortcuts/row-${Math.floor(i / 4)}.webp`);
      expect(competitionSprite(i).offsetX).toBe(-((i % 4) * 112 + 16));
      expect(HOME_COMPETITIONS[i].sportHref).toMatch(/^\/(sports\/[a-z-]+|topbets|live)$/);
    }
    expect(() => competitionSprite(16)).toThrow();
    expect(() => competitionSprite(-1)).toThrow();
    expect(() => competitionSprite(1.5)).toThrow();
  });
  it('renders carousel only on Home and keeps the original Live sport filter', () => {
    const nav = readFileSync('src/components/home/reference-sports-nav.tsx', 'utf8');
    const page = readFileSync('src/components/layout/page-shell.tsx', 'utf8');
    expect(nav).toContain("showSportsCarousel && pathname === '/'");
    expect(nav).toContain("showSportsCarousel && pathname !== '/'");
    expect(nav).toContain('data-testid="featured-competition-carousel"');
    expect(page).toContain("showSportsCarousel={pathname === '/' || pathname === '/live'}");
  });
});
