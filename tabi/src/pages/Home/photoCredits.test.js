import { describe, expect, it } from 'vitest';
import { allAvailable, creditEntries } from './photoCredits.js';

const credit = (author, license = 'CC BY-SA 4.0', extra = {}) => ({
  title: `File of ${author}`,
  author,
  license,
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  sourceUrl: `https://commons.wikimedia.org/wiki/File:${author}.jpg`,
  ...extra,
});

const PHOTOS = {
  fuji: { available: true, caption: 'Mount Fuji from Lake Ashi', credit: credit('Ann') },
  torii: { available: false, caption: 'Senbon Torii', credit: credit('Ben') },
  shibuya: { available: true, caption: 'Shibuya at night', credit: credit('', '') },
  kansai: { available: true, caption: 'Tōdai-ji', credit: credit('Cho', 'CC0', { sourceUrl: 'javascript:alert(1)', licenseUrl: 'data:text/html,x' }) },
};
const getPhoto = (id) => PHOTOS[id] ?? null;

describe('creditEntries', () => {
  it('credits only photos on show, in the order given, with their labels', () => {
    const entries = creditEntries(
      [
        { id: 'kansai', label: 'Kansai' },
        { id: 'fuji', label: 'Mount Fuji' },
        { id: 'torii', label: 'Fushimi Inari' },
      ],
      getPhoto,
    );
    expect(entries.map((e) => [e.id, e.label, e.author, e.license])).toEqual([
      ['kansai', 'Kansai', 'Cho', 'CC0'],
      ['fuji', 'Mount Fuji', 'Ann', 'CC BY-SA 4.0'],
    ]);
  });

  it('falls back to the caption for a label and accepts bare ids', () => {
    expect(creditEntries(['fuji'], getPhoto)[0].label).toBe('Mount Fuji from Lake Ashi');
  });

  it('skips photos with neither author nor licence, and unknown ids', () => {
    expect(creditEntries(['shibuya', 'nope', null, 42], getPhoto)).toEqual([]);
    expect(creditEntries(undefined, getPhoto)).toEqual([]);
  });

  it('keeps only http(s) links', () => {
    const [entry] = creditEntries(['kansai'], getPhoto);
    expect(entry.sourceUrl).toBe('');
    expect(entry.licenseUrl).toBe('');
    expect(creditEntries(['fuji'], getPhoto)[0].sourceUrl).toBe('https://commons.wikimedia.org/wiki/File:Ann.jpg');
  });
});

describe('allAvailable', () => {
  it('is true only when every photo is downloaded', () => {
    expect(allAvailable(['fuji', 'kansai'], getPhoto)).toBe(true);
    expect(allAvailable(['fuji', 'torii'], getPhoto)).toBe(false);
    expect(allAvailable(['fuji', 'nope'], getPhoto)).toBe(false);
    expect(allAvailable([], getPhoto)).toBe(false);
  });
});
