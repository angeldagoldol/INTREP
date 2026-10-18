import { describe, expect, it } from 'vitest';
import { photoIdsIn } from '../../data/photos/registry.js';
import { creditGroups, creditTotals, licenceSummary } from './credits.js';

const credit = (author, license, licenseUrl = '') => ({ title: 'File', author, authorUrl: '', license, licenseUrl, sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg' });
const PHOTOS = {
  'home-a': { id: 'home-a', caption: 'Fuji', place: 'Hakone', available: true, user: false, attributionRequired: true, credit: credit('Ann', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/') },
  'home-b': { id: 'home-b', caption: 'Torii', place: '', available: false, user: false, credit: credit('', '') },
  'k-1': { id: 'k-1', caption: 'Gate', available: true, user: false, credit: credit('Ben', 'CC0') },
  'k-2': { id: 'k-2', caption: 'Stage', available: false, user: false, credit: credit('', '') },
  'user:up': { id: 'user:up', caption: '', available: true, user: true, credit: credit('Me', 'CC BY-SA 4.0') },
};
const getPhoto = (id) => PHOTOS[id] ?? null;
const resolvePhoto = (id) => PHOTOS[id] ?? null;
const creditsFor = (b) =>
  photoIdsIn(b)
    .map((id) => PHOTOS[id])
    .filter((p) => p?.available)
    .map((p) => ({ id: p.id, caption: p.caption, ...p.credit, user: p.user }));

const kyoto = {
  id: 'b_k',
  slug: 'kyoto',
  title: 'Kyoto',
  titleJp: '京都',
  factsChecked: 'October 2026',
  sources: [{ label: 'A', url: 'https://a.jp/' }, { label: 'B', url: 'javascript:x' }],
  cover: { photo: 'k-1' },
  pages: [{ id: 'p1', photo: 'k-2' }, { id: 'p2', photo: 'missing' }],
};
const mine = { id: 'u1', slug: 'mine', title: 'Mine', source: 'user', cover: { photo: 'user:up' }, pages: [] };
const bare = { id: 'u2', slug: 'bare', title: 'Bare', source: 'user', pages: [] };

const groups = creditGroups({
  homeIds: ['home-a', 'home-b', 'home-a', 'nope'],
  builtins: [kyoto, null],
  userBrochures: [mine, bare],
  getPhoto,
  resolvePhoto,
  creditsFor,
  photoIdsIn,
});

describe('creditGroups', () => {
  it('starts with the Home page, credits once each, and counts what is still to come', () => {
    const [home] = groups;
    expect(home).toMatchObject({ id: 'home', kind: 'home', title: 'Home page' });
    expect(home.credits.map((c) => [c.id, c.author])).toEqual([['home-a', 'Ann']]);
    expect(home.pending.map((p) => p.id)).toEqual(['home-b']);
  });

  it('adds each built-in with its credits, pending photos, facts date and safe sources', () => {
    const k = groups.find((g) => g.id === 'b_k');
    expect(k).toMatchObject({ kind: 'builtin', slug: 'kyoto', titleJp: '京都', factsChecked: 'October 2026' });
    expect(k.credits.map((c) => c.id)).toEqual(['k-1']);
    expect(k.pending.map((p) => p.id)).toEqual(['k-2']);
    expect(k.sources.map((s) => s.url)).toEqual(['https://a.jp/']);
    expect(k.brochure).toBe(kyoto);
  });

  it('lists the visitor’s brochures only when they have something to credit', () => {
    const users = groups.filter((g) => g.kind === 'user');
    expect(users.map((g) => g.id)).toEqual(['u1']);
    expect(users[0].credits[0]).toMatchObject({ author: 'Me', user: true });
  });
});

describe('creditTotals / licenceSummary', () => {
  it('adds everything up', () => {
    expect(creditTotals(groups)).toEqual({ credited: 3, pending: 2, listed: 5, sources: 1, brochures: 1 });
  });

  it('counts a photograph listed in two groups once (Home shows some brochure photos)', () => {
    const twice = [...groups, { ...groups[1], id: 'b_other', kind: 'builtin', sources: [] }];
    expect(creditTotals(twice)).toMatchObject({ credited: 3, pending: 2, brochures: 2 });
    expect(licenceSummary(twice)).toEqual(licenceSummary(groups));
    // Two brochures' own uploads are different photographs, even under the same key.
    const uploads = groups.filter((g) => g.kind === 'user');
    expect(creditTotals([...uploads, ...uploads.map((g) => ({ ...g, id: `${g.id}-copy` }))]).credited).toBe(2);
  });

  it('summarises licences, most used first, with a deed link where known', () => {
    expect(licenceSummary(groups)).toEqual([
      { license: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/', count: 2 },
      { license: 'CC0', url: '', count: 1 },
    ]);
    expect(licenceSummary([])).toEqual([]);
  });
});
