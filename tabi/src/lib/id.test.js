import { createId, slugify, uniqueSlug } from './id.js';

describe('createId', () => {
  it('prefixes short random ids', () => {
    const id = createId('pg');
    expect(id).toMatch(/^pg_[a-z0-9]{10}$/);
    expect(createId()).toMatch(/^id_/);
  });

  it('does not repeat itself', () => {
    const ids = new Set(Array.from({ length: 500 }, () => createId('b')));
    expect(ids.size).toBe(500);
  });
});

describe('slugify', () => {
  it('folds accents and punctuation into hyphens', () => {
    expect(slugify('Hello, Wörld!')).toBe('hello-world');
    expect(slugify('Tōhoku Summer Festivals')).toBe('tohoku-summer-festivals');
    expect(slugify('  --Kyoto & Nara--  ')).toBe('kyoto-nara');
  });

  it('keeps Japanese and other scripts (regression: 京都の秋 used to become "")', () => {
    expect(slugify('京都の秋')).toBe('京都の秋');
    expect(slugify('京都 · 秋の旅！')).toBe('京都-秋の旅');
    expect(slugify('ガイド')).toBe('ガイド'); // voicing marks survive the accent fold
    expect(slugify('ｶﾞｲﾄﾞ')).toBe('ガイド'); // half-width katakana → full width
    expect(slugify('ＫＹＯＴＯ　２０２６')).toBe('kyoto-2026');
    expect(slugify('Tōkyō 東京')).toBe('tokyo-東京');
  });

  it('drops emoji and punctuation and caps the length without splitting characters', () => {
    expect(slugify('🗻 !!')).toBe('');
    expect(slugify(null)).toBe('');
    expect(slugify('a'.repeat(100))).toHaveLength(64);
    const kanji = slugify('𠮷'.repeat(70)); // outside the BMP: two UTF-16 units each
    expect(Array.from(kanji)).toHaveLength(64);
    expect(() => encodeURIComponent(kanji)).not.toThrow();
    expect(slugify(`${'a'.repeat(63)} b`)).toBe('a'.repeat(63));
  });
});

describe('uniqueSlug', () => {
  it('returns the slug when free and appends -2, -3… when taken', () => {
    expect(uniqueSlug('Kyoto', [])).toBe('kyoto');
    expect(uniqueSlug('Kyoto', ['kyoto'])).toBe('kyoto-2');
    expect(uniqueSlug('Kyoto', new Set(['kyoto', 'kyoto-2']))).toBe('kyoto-3');
  });

  it('keeps Japanese titles and falls back to "untitled" only when nothing is spellable', () => {
    expect(uniqueSlug('京都の秋', [])).toBe('京都の秋');
    expect(uniqueSlug('京都の秋', ['京都の秋'])).toBe('京都の秋-2');
    expect(uniqueSlug('🍵', [])).toBe('untitled');
    expect(uniqueSlug('', ['untitled'])).toBe('untitled-2');
  });
});
