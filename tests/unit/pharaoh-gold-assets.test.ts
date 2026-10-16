import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const asset = (file: string) => readFileSync(join(process.cwd(), 'public/casino/pharaoh-gold', file), 'utf8');

describe('Pharaoh Gold cinematic artwork safety', () => {
  it('ships a complete original local symbol atlas for all nine game symbols', () => {
    const atlas = asset('symbols.svg');
    for (const id of ['ankh', 'scarab', 'lotus', 'eye', 'queen', 'anubis', 'pharaoh', 'wild', 'scatter']) {
      expect(atlas).toContain('id="' + id + '"');
    }
    expect(atlas).toContain('viewBox="0 0 100 100"');
    expect(atlas).not.toMatch(/<script|<foreignObject|javascript:|(?:href|xlink:href)\s*=\s*['\"]https?:/i);
  });
  it('includes local art-backed frame, controls, badges and fully linked asset references', () => {
    const assets = ['royal-frame.svg', 'spin-medallion.svg', 'control-plate.svg',
      'royal-button.svg', 'big-win-badge.svg', 'free-spins-badge.svg'];
    for (const name of assets) {
      const xml = asset(name);
      expect(xml).toContain('<svg');
      expect(xml).toContain('</svg>');
      expect(xml).not.toMatch(/<script|<foreignObject|javascript:|(?:href|xlink:href)\s*=\s*['"]https?:/i);
    }
    const css = readFileSync(join(process.cwd(), 'src/components/casino/pharaoh-gold.module.css'), 'utf8');
    const ui = readFileSync(join(process.cwd(), 'src/components/casino/pharaoh-gold-slot.tsx'), 'utf8');
    for (const name of assets.slice(0,4)) expect(css).toContain(name);
    for (const name of assets.slice(4)) expect(ui).toContain(name);
    expect(css).toContain('prefers-reduced-motion:reduce');
  });
  it('renders self-hosted scene with local torch, pillars and sky gradients', () => {
    const scene = asset('scene.svg');
    expect(scene).toContain('id="templeColumn"');
    expect(scene).toContain('id="fire"');
    expect(scene).toContain('id="water"');
    expect(scene).not.toMatch(/<script|<foreignObject|javascript:|(?:href|xlink:href)\s*=\s*['\"]https?:/i);
  });
});
