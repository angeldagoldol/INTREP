import { describe, expect, it } from 'vitest';
import { contrast } from '../art/color.js';
import {
  circledNumeral,
  fitSize,
  folio,
  formatEdition,
  formatLatLng,
  kanjiNumeral,
  list,
  pageHeading,
  pageLabel,
  paragraphs,
  placeLayout,
  text,
  themeVars,
  toNumber,
  verseLines,
  verseSize,
} from './pageUtils.js';

const brochure = { title: 'Kyoto: A Thousand Gates', titleJp: '京都' };

describe('field helpers', () => {
  it('reads text safely', () => {
    expect(text('  hi  ')).toBe('hi');
    expect(text(12)).toBe('12');
    expect(text(null)).toBe('');
    expect(text({})).toBe('');
    expect(text(Number.NaN)).toBe('');
  });

  it('keeps only usable list items, up to a limit', () => {
    expect(list(undefined)).toEqual([]);
    expect(list([null, { a: 1 }, '', 'x', 3], 5)).toEqual([{ a: 1 }, 'x']);
    expect(list([{}, {}, {}], 2)).toHaveLength(2);
  });

  it('splits paragraphs on blank lines', () => {
    expect(paragraphs('One.\n\nTwo.\n  \nThree.')).toEqual(['One.', 'Two.', 'Three.']);
    expect(paragraphs(undefined)).toEqual([]);
  });

  it('coerces numbers', () => {
    expect(toNumber(5)).toBe(5);
    expect(toNumber('1,074')).toBe(1074);
    expect(toNumber('')).toBeNull();
    expect(toNumber('many')).toBeNull();
    expect(toNumber(Infinity)).toBeNull();
  });
});

describe('labels and numerals', () => {
  it('formats folios and Japanese numerals', () => {
    expect(folio(4, 11)).toBe('04 / 11');
    expect(folio(3, 1)).toBe('03 / 03');
    expect(kanjiNumeral(4)).toBe('四');
    expect(kanjiNumeral(12)).toBe('12');
    expect(circledNumeral(1)).toBe('①');
    expect(circledNumeral(21)).toBe('(21)');
  });

  it('finds a heading for every page type', () => {
    expect(pageHeading({ type: 'cover' }, brochure)).toBe('Kyoto: A Thousand Gates');
    expect(pageHeading({ type: 'intro', heading: 'Welcome' }, brochure)).toBe('Welcome');
    expect(pageHeading({ type: 'agenda' }, brochure)).toBe('Schedule');
    expect(pageHeading({ type: 'quote', author: 'Matsuo Bashō' }, brochure)).toBe('Quote from Matsuo Bashō');
    expect(pageHeading({ type: 'quote' }, brochure)).toBe('Quote');
    expect(pageHeading({ type: 'place', name: 'Kiyomizu-dera' }, brochure)).toBe('Kiyomizu-dera');
    expect(pageHeading({ type: 'place' }, brochure)).toBe('Place');
    expect(pageHeading({ type: 'gallery', heading: 'A closer look' }, brochure)).toBe('A closer look');
    expect(pageHeading({ type: 'back' }, brochure)).toBe('Back cover');
    expect(pageHeading({ type: 'mystery' }, brochure)).toBe('Untitled page');
    expect(pageHeading(null, null)).toBe('Untitled page');
  });

  it('builds the page article label', () => {
    expect(pageLabel({ type: 'stats', heading: 'By the numbers' }, brochure, 3, 11)).toBe('Page 4 of 11: By the numbers');
  });

  it('formats the edition date', () => {
    expect(formatEdition('2026-09-18T09:00:00.000Z')).toBe('September 2026');
    expect(formatEdition('nope')).toBe('');
    expect(formatEdition(undefined)).toBe('');
  });
});

describe('fitSize', () => {
  it('keeps short text at full size and shrinks long text down to the floor', () => {
    expect(fitSize('Short', { max: 10, min: 4, ideal: 20 })).toBe(10);
    const medium = fitSize('x'.repeat(80), { max: 10, min: 4, ideal: 20 });
    expect(medium).toBeCloseTo(5, 5);
    expect(fitSize('x'.repeat(5000), { max: 10, min: 4, ideal: 20 })).toBe(4);
    expect(fitSize(undefined, { max: 10, min: 4, ideal: 20 })).toBe(10);
  });
});

describe('themeVars', () => {
  it('maps the theme to CSS variables with readable derived inks', () => {
    const vars = themeVars({ paper: '#f4eee2', ink: '#22140f', accent: '#f2a7b8', accent2: '#1d4f7a', muted: '#c8bfb4', typeface: 'mono' });
    expect(vars['--b-paper']).toBe('#f4eee2');
    expect(vars['--b-font']).toBe('var(--font-mono)');
    expect(contrast(vars['--b-accent-text'], '#f4eee2')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(vars['--b-muted-text'], '#f4eee2')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(vars['--b-on-accent'], '#f2a7b8')).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps accent text readable on the tinted --b-soft panel too (regression: Osaka price)', () => {
    // Osaka: the paper-tuned accent text reads 4.35:1 on the 12% accent tint.
    const vars = themeVars({ paper: '#fbefd9', ink: '#22160f', accent: '#c93a22', accent2: '#e9a21a', muted: '#6b5442', typeface: 'sans' });
    expect(contrast(vars['--b-accent-text'], vars['--b-soft'])).toBeLessThan(4.5);
    expect(contrast(vars['--b-accent-on-soft'], vars['--b-soft'])).toBeGreaterThanOrEqual(4.5);
    // A theme that already passes keeps its own accent.
    const deep = themeVars({ paper: '#ffffff', ink: '#000000', accent: '#7a1a10' });
    expect(deep['--b-accent-on-soft']).toBe('#7a1a10');
  });

  it('falls back to the default theme for missing input', () => {
    expect(themeVars(undefined)['--b-font']).toBe('var(--font-display)');
  });
});

describe('formatLatLng', () => {
  it('prints hemispheres with four decimals, or nothing', () => {
    expect(formatLatLng(34.9949, 135.785)).toBe('34.9949° N · 135.7850° E');
    expect(formatLatLng(-33.8568, -151.2153)).toBe('33.8568° S · 151.2153° W');
    expect(formatLatLng(91, 10)).toBe('');
    expect(formatLatLng(-33.8568, 151.2153)).toBe('33.8568° S · 151.2153° E');
    expect(formatLatLng('x', 1)).toBe('');
    expect(formatLatLng(undefined, undefined)).toBe('');
  });
});

describe('verse helpers', () => {
  it('splits Japanese verse at spaces and translations at slashes', () => {
    expect(verseLines('浅草の夜のにぎはひに　まぎれ入り　まぎれ出で来しさびしき心', { japanese: true })).toEqual(['浅草の夜のにぎはひに', 'まぎれ入り', 'まぎれ出で来しさびしき心']);
    expect(verseLines('京にても京なつかしやほととぎす', { japanese: true })).toEqual(['京にても京なつかしやほととぎす']);
    expect(verseLines('Here in Kyoto, / still I yearn for Kyoto — / a cuckoo calls.')).toEqual(['Here in Kyoto,', 'still I yearn for Kyoto —', 'a cuckoo calls.']);
    expect(verseLines('Kyoto and/or Nara')).toEqual(['Kyoto and/or Nara']);
    expect(verseLines(undefined)).toEqual([]);
  });

  it('sizes a column so the longest line fits, wrapping very long lines', () => {
    expect(verseSize(['古池や蛙飛び込む水の音'])).toBe(7.2);
    const haiku = verseSize(['京にても京なつかしやほととぎす']);
    expect(haiku * 15 * 1.1).toBeLessThanOrEqual(92.01);
    const inscription = verseSize(['琉球国は南海の勝地にして……舟楫を以て万国の津梁と為し、異産至宝は十方刹に充満せり']);
    expect(inscription).toBeGreaterThan(5);
    expect(verseSize([], { min: 3 })).toBe(7.2);
    expect(verseSize(['あ'.repeat(200)])).toBe(3.4);
    // A stepped second line counts its indent.
    expect(verseSize(['あ'.repeat(10), 'い'.repeat(10)], { height: 60, perChar: 1, offset: 2 })).toBe(5);
  });
});

describe('placeLayout (the place page, photo first)', () => {
  const facts = [
    { label: 'Hours', value: 'Grounds open 24 hours' },
    { label: 'Admission', value: 'Free' },
    { label: 'Getting there', value: 'JR Inari Station, 5 min from Kyoto' },
  ];

  it('gives a short story a towering photograph and a long one a smaller (never tiny) one', () => {
    const short = placeLayout({ name: 'Tōdai-ji', copy: ['The Great Buddha Hall.'], facts: facts.slice(0, 1) });
    const long = placeLayout({ name: 'Fushimi Inari Taisha', copy: ['x '.repeat(400), 'y '.repeat(200)], facts, website: 'https://inari.jp/' });
    expect(short.media).toBe(80);
    expect(long.media).toBeLessThan(short.media);
    expect(long.media).toBeGreaterThanOrEqual(52);
    // Bigger than the old 52cqw plate for a typical page.
    expect(placeLayout({ name: 'Fushimi Inari Taisha', copy: ['z'.repeat(460)], facts, website: 'https://inari.jp/' }).media).toBeGreaterThan(60);
  });

  it('balances the columns: long facts get a wider column, a long story a narrower one (32–48%)', () => {
    expect(placeLayout({ copy: ['a'.repeat(900)], facts: facts.slice(0, 1) }).aside).toBe(0.32);
    expect(placeLayout({ copy: ['a'.repeat(50)], facts: [{ label: 'Getting there', value: 'b'.repeat(400) }] }).aside).toBeGreaterThanOrEqual(0.44);
  });

  it('copes with nothing at all', () => {
    expect(placeLayout()).toEqual({ aside: 0.38, media: 80 });
    expect(placeLayout({ name: null, copy: [], facts: [null, {}] })).toMatchObject({ media: expect.any(Number) });
  });
});
