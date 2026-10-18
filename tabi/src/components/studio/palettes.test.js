import { describe, expect, it } from 'vitest';
import { contrast, isHex } from '../brochure/art/color.js';
import { PALETTES, PALETTE_MAP, matchPalette } from './palettes.js';

describe('palettes', () => {
  it('has unique ids and Japanese names', () => {
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
    for (const p of PALETTES) expect(p.jp).toMatch(/[぀-ヿ一-龯]/);
  });

  it.each(PALETTES.map((p) => [p.name, p]))('%s uses valid hex colours with AA ink on paper', (_, p) => {
    for (const key of ['paper', 'ink', 'accent', 'accent2', 'muted']) expect(isHex(p.theme[key])).toBe(true);
    expect(contrast(p.theme.ink, p.theme.paper)).toBeGreaterThanOrEqual(4.5);
  });

  it('matches a theme to its palette regardless of case or typeface', () => {
    const theme = { ...PALETTE_MAP.sakura.theme, paper: PALETTE_MAP.sakura.theme.paper.toUpperCase(), typeface: 'mono' };
    expect(matchPalette(theme)?.id).toBe('sakura');
    expect(matchPalette({ ...theme, ink: '#000000' })).toBeNull();
    expect(matchPalette(undefined)).toBeNull();
  });
});
