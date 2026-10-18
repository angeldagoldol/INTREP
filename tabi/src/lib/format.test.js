import { estimateReadMinutes, formatDate, formatNumber, isEmail, pad, pluralize, sealChars } from './format.js';

describe('format', () => {
  it('formats dates and returns "" for invalid ones', () => {
    expect(formatDate('2026-10-17T12:00:00Z')).toBe('Oct 17, 2026');
    expect(formatDate(new Date(2026, 0, 2))).toBe('Jan 2, 2026');
    expect(formatDate('not a date')).toBe('');
    expect(formatDate(undefined)).toBe('');
  });

  it('formats numbers with grouping', () => {
    expect(formatNumber(14125)).toBe('14,125');
    expect(formatNumber(3.5)).toBe('3.5');
  });

  it('accepts plausible email addresses, trimmed, up to 254 characters', () => {
    expect(isEmail('mika@tabi.example')).toBe(true);
    expect(isEmail('  mika@tabi.example ')).toBe(true);
    expect(isEmail('mika@tabi')).toBe(false);
    expect(isEmail('mi ka@tabi.example')).toBe(false);
    expect(isEmail('@tabi.example')).toBe(false);
    expect(isEmail(undefined)).toBe(false);
    expect(isEmail(`${'a'.repeat(250)}@b.jp`)).toBe(false);
  });

  it('derives the same seal characters wherever a seal is drawn (regression: cover vs card)', () => {
    expect(sealChars('京都')).toBe('京都');
    expect(sealChars('広島・宮島')).toBe('広島');
    // The cover used to keep the space and stamp "東 ".
    expect(sealChars('東 京')).toBe('東京');
    expect(sealChars('北海道')).toBe('北海');
    expect(sealChars('𠮷野')).toBe('𠮷野');
    expect(sealChars('')).toBe('旅');
    expect(sealChars(' ・ ')).toBe('旅');
    expect(sealChars(null)).toBe('旅');
  });

    it('pluralizes with an optional irregular plural', () => {
    expect(pluralize(1, 'page')).toBe('1 page');
    expect(pluralize(0, 'page')).toBe('0 pages');
    expect(pluralize(3, 'ferry', 'ferries')).toBe('3 ferries');
  });

  it('zero-pads folios', () => {
    expect(pad(3)).toBe('03');
    expect(pad(12)).toBe('12');
    expect(pad(7, 3)).toBe('007');
  });

  it('estimates at least one minute of reading', () => {
    expect(estimateReadMinutes(undefined)).toBe(1);
    expect(estimateReadMinutes({ pages: [] })).toBe(1);
    const long = { pages: [{ body: Array.from({ length: 2200 }, () => 'word').join(' ') }] };
    expect(estimateReadMinutes(long)).toBe(10);
  });

  it('reads Japanese by the character, not by space-separated word (regression)', () => {
    // 2,500 kanji/kana with no spaces used to count as one "word" → 1 min.
    const jp = { pages: [{ id: 'pg_1', type: 'intro', body: '京都の秋は美しい。'.repeat(250).slice(0, 2500) }] };
    expect(estimateReadMinutes(jp)).toBe(5);
    const mixed = { pages: [{ heading: 'Kyoto', body: `${'word '.repeat(440)}${'あ'.repeat(1000)}` }] };
    expect(estimateReadMinutes(mixed)).toBe(4);
  });

  it('counts only the copy, not ids, types, icons or art names', () => {
    const page = (i) => ({ id: `pg_${i}`, type: 'features', items: [{ icon: 'Sparkles', art: 'fuji', seed: 3, title: 'One' }] });
    const doc = { pages: Array.from({ length: 300 }, (_, i) => page(i)) };
    expect(estimateReadMinutes(doc)).toBe(1);
  });
});
