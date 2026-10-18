import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, contrast, ensureContrast, isDark, isHex, luminance, mix, normalizeTheme, parseHex, readableOn, toHex } from './color.js';

describe('colour helpers', () => {
  it('parses short and long hex, rejects everything else', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('#1d4f7a')).toEqual({ r: 29, g: 79, b: 122 });
    expect(parseHex('red')).toBeNull();
    expect(parseHex(undefined)).toBeNull();
    expect(isHex(' #ABCDEF ')).toBe(true);
    expect(toHex({ r: 300, g: -4, b: 15.6 })).toBe('#ff0010');
  });

  it('mixes linearly and clamps t', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#000000', '#ffffff', 2)).toBe('#ffffff');
    expect(mix('nope', '#123456', 0.3)).toBe('#123456');
  });

  it('measures WCAG luminance and contrast', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBe(1);
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(isDark('#13141c')).toBe(true);
    expect(isDark('#f4eee2')).toBe(false);
    expect(readableOn('#d23a22', ['#ffffff', '#16140f'])).toBe('#ffffff');
  });

  it('nudges a colour toward the ink until it is readable', () => {
    const fixed = ensureContrast('#f2a7b8', '#fffdf8', 4.5, '#16140f');
    expect(contrast(fixed, '#fffdf8')).toBeGreaterThanOrEqual(4.5);
    expect(ensureContrast('#16140f', '#fffdf8', 4.5, '#000000')).toBe('#16140f');
  });

  it('normalises partial or broken themes', () => {
    expect(normalizeTheme(null)).toEqual(DEFAULT_THEME);
    const theme = normalizeTheme({ paper: '#101010', accent: 'hotpink', typeface: 'comic' });
    expect(theme.accent).toBe(DEFAULT_THEME.accent);
    expect(theme.typeface).toBe('serif');
    // A dark paper with the default dark ink gets a light ink instead.
    expect(contrast(theme.ink, theme.paper)).toBeGreaterThanOrEqual(4.5);
  });
});
