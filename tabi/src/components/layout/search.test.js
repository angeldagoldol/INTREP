import { describe, expect, it } from 'vitest';
import { createSearchIndex, fold, foldQuery, highlight, matchText, mergeRanges, search } from './search.js';

const slice = (text, ranges) => ranges.map(([a, b]) => text.slice(a, b));

describe('fold', () => {
  it('strips Latin diacritics and lowercases', () => {
    expect(fold('Tōhoku')).toBe('tohoku');
    expect(fold('Kyūshū & Okinawa')).toBe('kyushu & okinawa');
  });

  it('folds full-width Latin and katakana', () => {
    expect(fold('ＫＹＯＴＯ')).toBe('kyoto');
    expect(fold('キョウト')).toBe('きょうと');
    expect(fold('ガイド')).toBe('がいど');
  });

  it('leaves kanji alone and tolerates nullish input', () => {
    expect(fold('京都')).toBe('京都');
    expect(fold(undefined)).toBe('');
    expect(foldQuery('  Kyoto   Tea ')).toBe('kyoto tea');
  });
});

describe('matchText', () => {
  it('matches without diacritics and maps highlights to the original text', () => {
    const text = 'Tōhoku';
    const m = matchText(text, 'tohoku');
    expect(m.score).toBeGreaterThanOrEqual(100);
    expect(slice(text, m.ranges)).toEqual(['Tōhoku']);
  });

  it('ranks exact > prefix > word prefix > substring > fuzzy', () => {
    const exact = matchText('Kyoto', 'kyoto').score;
    const prefix = matchText('Kyoto Gardens', 'kyoto').score;
    const wordPrefix = matchText('Old Kyoto', 'kyoto').score;
    const substring = matchText('Tokyoto', 'kyoto').score;
    const fuzzy = matchText('Kyoto', 'kyto').score;
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(wordPrefix);
    expect(wordPrefix).toBeGreaterThan(substring);
    expect(substring).toBeGreaterThan(fuzzy);
  });

  it('prefers a word-start occurrence over an earlier mid-word one', () => {
    const text = 'Sakaba Aki';
    const m = matchText(text, 'aki');
    expect(m.ranges).toEqual([[7, 10]]);
  });

  it('fuzzy-matches initials and typos, highlighting word starts', () => {
    const text = 'Fushimi Inari Taisha';
    const m = matchText(text, 'fit');
    expect(slice(text, m.ranges)).toEqual(['F', 'I', 'T']);
    expect(matchText('Kyoto', 'kyto')).not.toBeNull();
  });

  it('rejects scattered noise', () => {
    expect(matchText('Tokyo After Dark', 'tea')).toBeNull();
    expect(matchText('Kyoto', 'xyz')).toBeNull();
  });

  it('can disable fuzzy matching per field', () => {
    expect(matchText('Kyoto', 'kyto', { fuzzy: false })).toBeNull();
  });

  it('matches kanji and kana across scripts', () => {
    expect(matchText('京都', '京都').score).toBeGreaterThanOrEqual(100);
    expect(slice('スタジオ', matchText('スタジオ', 'すたじお').ranges)).toEqual(['スタジオ']);
  });
});

describe('search', () => {
  const items = [
    { id: 'tokyo', title: 'Tokyo After Dark', jp: '東京', tags: ['ramen', 'neon'], summary: 'Late-night ramen and tiny bars.' },
    { id: 'kyoto', title: 'Kyoto: A Thousand Gates', jp: '京都', tags: ['temples', 'tea ceremony'], summary: 'Torii, tea and temples.' },
    { id: 'north', title: 'Tōhoku Onsen Trail', jp: '東北', tags: ['onsen'], summary: 'Quiet mountain baths.' },
  ];
  const index = createSearchIndex(items, (item) => [
    { key: 'title', text: item.title },
    { key: 'jp', text: item.jp },
    { key: 'tags', text: item.tags.join(' · '), weight: 0.7 },
    { key: 'summary', text: item.summary, weight: 0.3, fuzzy: false },
  ]);
  const ids = (query) => search(index, query).map((r) => r.item.id);

  it('returns everything in original order for an empty query', () => {
    expect(ids('')).toEqual(['tokyo', 'kyoto', 'north']);
    expect(search(index, '   ')[0].score).toBe(0);
  });

  it('ranks title hits above tag and summary hits', () => {
    const results = ids('tea');
    expect(results[0]).toBe('kyoto');
  });

  it('finds diacritic-free and Japanese queries', () => {
    expect(ids('tohoku')).toEqual(['north']);
    expect(ids('東')).toEqual(['tokyo', 'north']);
  });

  it('requires every word of a multi-word query, in any field', () => {
    expect(ids('kyoto tea')).toEqual(['kyoto']);
    expect(ids('ceremony kyoto')).toEqual(['kyoto']);
    expect(ids('kyoto ramen')).toEqual([]);
  });

  it('reports highlight ranges per field', () => {
    const [top] = search(index, 'kyoto tea');
    expect(slice(items[1].title, top.matches.title)).toEqual(['Kyoto']);
    expect(top.matches.tags).toBeDefined();
  });

  it('honours the limit', () => {
    expect(search(index, '', { limit: 2 })).toHaveLength(2);
  });
});

describe('highlight', () => {
  it('splits text into matched and unmatched segments', () => {
    expect(highlight('Kyoto', [[0, 2]])).toEqual([
      { text: 'Ky', match: true },
      { text: 'oto', match: false },
    ]);
  });

  it('merges overlapping ranges and ignores out-of-bounds ones', () => {
    expect(mergeRanges([[3, 5], [0, 2], [1, 4]])).toEqual([[0, 5]]);
    expect(highlight('abc', [[1, 9]])).toEqual([
      { text: 'a', match: false },
      { text: 'bc', match: true },
    ]);
    expect(highlight('', [])).toEqual([]);
  });
});
