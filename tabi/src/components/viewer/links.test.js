import { describe, expect, it } from 'vitest';
import { hostOf, officialLinks, sourceLinks } from './links.js';

const brochure = {
  sources: [
    { label: 'Fushimi Inari Taisha official site', url: 'https://inari.jp/en/' },
    { label: 'Same site again', url: 'https://INARI.jp/en' },
    { label: 'Sneaky', url: 'javascript:alert(1)' },
    { label: '', url: 'https://www.kyoto.travel/en/' },
    null,
  ],
  pages: [
    { id: 'p1', type: 'place', name: 'Kiyomizu-dera', website: 'https://www.kiyomizudera.or.jp/en/' },
    {
      id: 'p2',
      type: 'contact',
      cta: 'Open the official Kyoto guide',
      ctaUrl: 'https://kyoto.travel/en/',
      details: [
        { label: 'Tourist information', value: 'Kyoto Station Building, 2F' },
        { label: 'Official travel guide', value: 'kyoto.travel', url: 'https://kyoto.travel/en/' },
        { label: 'Buses & subway', value: 'Kyoto City Bus & Subway guide', url: 'https://www2.city.kyoto.lg.jp/kotsu/webguide/en/' },
        { label: 'Bad', value: 'x', url: 'data:text/html,hi' },
      ],
    },
  ],
};

describe('hostOf', () => {
  it('shows a host without www, and nothing for unsafe links', () => {
    expect(hostOf('https://www.inari.jp/en/')).toBe('inari.jp');
    expect(hostOf('javascript:alert(1)')).toBe('');
    expect(hostOf(42)).toBe('');
  });
});

describe('sourceLinks', () => {
  it('keeps safe sources once each, in order, with hosts', () => {
    expect(sourceLinks(brochure)).toEqual([
      { label: 'Fushimi Inari Taisha official site', url: 'https://inari.jp/en/', host: 'inari.jp' },
      { label: 'kyoto.travel', url: 'https://www.kyoto.travel/en/', host: 'kyoto.travel' },
    ]);
    expect(sourceLinks({ sources: [{ url: 'http://www.a.jp/x/' }, { url: 'https://a.jp/x' }] })).toHaveLength(1);
    expect(sourceLinks(brochure, 1)).toHaveLength(1);
    expect(sourceLinks({})).toEqual([]);
  });
});

describe('officialLinks', () => {
  it('puts the visitor information first, then official sites, then sources', () => {
    expect(officialLinks(brochure).map((l) => [l.label, l.host])).toEqual([
      ['Open the official Kyoto guide', 'kyoto.travel'],
      ['Kyoto City Bus & Subway guide', 'www2.city.kyoto.lg.jp'],
      ['Kiyomizu-dera — official site', 'kiyomizudera.or.jp'],
      ['Fushimi Inari Taisha official site', 'inari.jp'],
    ]);
  });

  it('stops at `max` and tolerates odd brochures', () => {
    expect(officialLinks(brochure, 2)).toHaveLength(2);
    expect(officialLinks({ pages: 'nope' })).toEqual([]);
    expect(officialLinks(null)).toEqual([]);
  });
});
