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
  it('renders self-hosted scene with local torch, pillars and sky gradients', () => {
    const scene = asset('scene.svg');
    expect(scene).toContain('id="templeColumn"');
    expect(scene).toContain('id="fire"');
    expect(scene).toContain('id="water"');
    expect(scene).not.toMatch(/<script|<foreignObject|javascript:|(?:href|xlink:href)\s*=\s*['\"]https?:/i);
  });
});
