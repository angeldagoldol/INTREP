import { describe, expect, it } from 'vitest';
import { factsStatus, featurePhoto, pendingNote, photoStatus } from './aboutFacts.js';

const record = (id, fields = {}) => ({ id, available: true, user: false, use: 'any', width: 1600, height: 1067, ...fields });
const REGISTRY = {
  cover: record('cover', { use: 'cover', width: 1067, height: 1600 }),
  tall: record('tall', { width: 1067, height: 1600 }),
  land: record('land'),
  wide: record('wide', { use: 'wide' }),
  later: record('later', { available: false }),
  'user:gone': record('user:gone', { available: false, user: true }),
};
const resolve = (id) => REGISTRY[id] ?? null;
const brochure = {
  cover: { photo: 'cover' },
  pages: [
    { id: 'p1', type: 'cover', photo: 'cover' },
    { id: 'p2', type: 'intro', photo: 'tall' },
    { id: 'p3', type: 'place', photo: 'land' },
    { id: 'p4', type: 'gallery', items: [{ photo: 'wide' }, { photo: 'later' }, { photo: 'unknown' }, { photo: 'user:gone' }] },
  ],
};

describe('factsStatus', () => {
  it('credits Tabi Guides for a checked built-in', () => {
    const status = factsStatus({ source: 'builtin', factsChecked: 'October 2026' }, 8);
    expect(status).toMatchObject({ checked: true, label: 'Facts checked October 2026', by: 'Tabi Guides' });
    expect(status.note).toMatch(/against 8 sources, official sites first/);
  });

  it('says honestly when a built-in is waiting for its check', () => {
    expect(factsStatus({ source: 'builtin' }, 0)).toMatchObject({ checked: false, label: 'Facts awaiting check' });
    expect(factsStatus({ source: 'builtin', factsChecked: '  ' })).toMatchObject({ checked: false });
  });

  it('never presents a Studio brochure’s own date as Tabi’s check', () => {
    const own = factsStatus({ source: 'user', factsChecked: 'May 2026' }, 2);
    expect(own.checked).toBe(false);
    expect(own.label).toBe('Facts checked May 2026, says the author');
    expect(own.note).toMatch(/has not reviewed/);
    expect(factsStatus({ source: 'user' }).label).toBe('Facts awaiting check');
  });

  it('copes with nothing at all', () => {
    expect(factsStatus(undefined).checked).toBe(false);
  });
});

describe('photoStatus', () => {
  it('splits known photos into downloaded and still to come (not broken uploads)', () => {
    const { photos, available, pending } = photoStatus(brochure, resolve);
    expect(photos.map((p) => p.id)).toEqual(['cover', 'tall', 'land', 'wide', 'later', 'user:gone']);
    expect(available.map((p) => p.id)).toEqual(['cover', 'tall', 'land', 'wide']);
    expect(pending.map((p) => p.id)).toEqual(['later']);
  });
});

describe('featurePhoto', () => {
  it('prefers a wide landscape photo other than the cover', () => {
    expect(featurePhoto(brochure, resolve).id).toBe('wide');
  });

  it('falls back to any landscape photo, and to none', () => {
    const noWide = { ...brochure, pages: brochure.pages.slice(0, 3) };
    expect(featurePhoto(noWide, resolve).id).toBe('land');
    expect(featurePhoto({ cover: { photo: 'cover' }, pages: [{ photo: 'tall' }] }, resolve)).toBeNull();
    expect(featurePhoto({}, resolve)).toBeNull();
  });
});

describe('pendingNote', () => {
  it('explains photographs that are not downloaded yet', () => {
    expect(pendingNote(0)).toBe('');
    expect(pendingNote(9)).toMatch(/^9 photographs from Wikimedia Commons are listed .* each will be credited here\.$/);
    expect(pendingNote(1)).toMatch(/^1 photograph from Wikimedia Commons is listed .* it will be credited here\.$/);
    expect(pendingNote(3, 5)).toBe('3 more photographs are listed but not downloaded yet; their pages show generated art for now.');
  });
});
