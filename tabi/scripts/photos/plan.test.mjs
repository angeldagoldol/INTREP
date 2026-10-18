// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildRecord, mergeQueryResponses, parseImageInfoResponse, searchResults } from './lib.mjs';
import {
  PUBLISH_EVERY,
  claimFile,
  excludedFor,
  fileOwners,
  isCached,
  isPriority,
  missedChosenFile,
  planBatches,
  planFetch,
  progressBar,
  recentlyFailed,
  recoverJournal,
  searchChoices,
  searchQuery,
  shouldReport,
  slotSignature,
  slotTitles,
  slotsOf,
  usableCandidates,
} from './plan.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const manifests = fixture('plan-manifests.json');
const slots = slotsOf(manifests);
const slot = (id) => slots.find((s) => s.photo.id === id);

/** A generated record as fetch.mjs writes it (widths on disk unless `exists` says otherwise). */
const record = (id, file, extra = {}) => ({
  ...buildRecord({
    id,
    file,
    width: 1600,
    height: 1067,
    widths: [480, 960, 1600],
    lqip: 'data:image/webp;base64,AAAA',
    color: '#334455',
    credit: { title: 'T', author: 'A', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/X' },
    fetchedAt: '2026-10-18T00:00:00.000Z',
    ...extra,
  }),
});
const allOnDisk = () => true;

/** imageinfo results for titles: { title: [width, height, licence] | 'missing' } → Map(title → parsed result). */
function imageinfo(spec) {
  const pages = Object.entries(spec).map(([title, value]) =>
    value === 'missing'
      ? { title, missing: true }
      : {
          title,
          imageinfo: [
            {
              width: value[0],
              height: value[1],
              size: value[0] * value[1],
              mime: 'image/jpeg',
              url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${encodeURIComponent(title.slice(5).replace(/ /g, '_'))}`,
              thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/x.jpg/1920px-x.jpg`,
              descriptionurl: 'https://commons.wikimedia.org/wiki/X',
              extmetadata: { LicenseShortName: { value: value[2] }, Artist: { value: 'Someone' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' } },
            },
          ],
        },
  );
  return parseImageInfoResponse({ query: { pages } }, Object.keys(spec));
}

describe('slots', () => {
  it('lists every manifest slot once, in manifest order (the first listing of an id wins, as in the registry)', () => {
    expect(slots.map((s) => s.photo.id)).toEqual([
      'home-hero',
      'home-region',
      'kyoto-cover',
      'kyoto-temple',
      'kyoto-search-only',
      'kyoto-chosen',
      'kyoto-gallery-1',
      'nostalgic-street',
      'osaka-takoyaki',
      'osaka-market',
      'osaka-night',
    ]);
    expect(slot('home-hero')).toMatchObject({ manifest: 'home', brochure: 'home' });
    expect(slot('home-hero').photo.candidates).toEqual(['File:Hero first.jpg', 'File:Hero second.jpg']);
  });

  it('tries the chosen file first, then the candidates — the same order as the browser', () => {
    expect(slotTitles(slot('kyoto-chosen').photo)).toEqual(['File:Chosen pick.jpg', 'File:Backup pick.jpg']);
    expect(slotTitles(slot('kyoto-search-only').photo)).toEqual([]);
    expect(searchQuery(slot('kyoto-search-only').photo)).toBe('Kiyomizu-dera');
    expect(searchQuery({ query: '  ' })).toBe('');
  });

  it('signs a slot by what it may show', () => {
    const photo = slot('kyoto-temple').photo;
    expect(slotSignature(photo)).toBe(slotSignature({ ...photo, alt: 'other words' }));
    expect(slotSignature(photo)).not.toBe(slotSignature({ ...photo, query: 'Kiyomizu-dera stage' }));
    expect(slotSignature(photo)).not.toBe(slotSignature({ ...photo, candidates: ['File:New.jpg'] }));
  });
});

describe('isCached — what is already on this computer', () => {
  it('needs a record whose every width is on disk', () => {
    const s = slot('home-hero');
    expect(isCached(s, record('home-hero', 'File:Hero second.jpg'), { exists: allOnDisk })).toBe(true);
    expect(isCached(s, record('home-hero', 'File:Hero second.jpg'), { exists: (name) => name !== 'home-hero-1600.webp' })).toBe(false);
    expect(isCached(s, { ...record('home-hero', 'File:Hero first.jpg'), widths: [] }, { exists: allOnDisk })).toBe(false);
    expect(isCached(s, undefined, { exists: allOnDisk })).toBe(false);
    expect(isCached(s, record('home-hero', 'File:Hero first.jpg'), { exists: allOnDisk, force: true })).toBe(false);
  });

  it('keeps candidates and local imports, and drops a picture the slot no longer lists', () => {
    const s = slot('home-hero');
    expect(isCached(s, record('home-hero', 'local:hero.jpg'), { exists: allOnDisk })).toBe(true);
    expect(isCached(s, record('home-hero', 'File:Somebody else.jpg'), { exists: allOnDisk })).toBe(false);
  });

  it('with a chosen file, only that file counts', () => {
    const s = slot('kyoto-chosen');
    expect(isCached(s, record('kyoto-chosen', 'File:Chosen pick.jpg'), { exists: allOnDisk })).toBe(true);
    expect(isCached(s, record('kyoto-chosen', 'File:Backup pick.jpg'), { exists: allOnDisk })).toBe(false);
    expect(isCached(s, record('kyoto-chosen', 'File:Found.jpg', { via: 'search', query: 'Gion' }), { exists: allOnDisk })).toBe(false);
    expect(missedChosenFile(s.photo, 'File:Backup pick.jpg')).toBe(true);
    expect(missedChosenFile(s.photo, 'File:Chosen_pick.jpg')).toBe(false);
    expect(missedChosenFile(slot('home-hero').photo, 'File:Anything.jpg')).toBe(false);
  });

  it('keeps a search find while the slot is searched with the same words', () => {
    const s = slot('kyoto-search-only');
    const found = record('kyoto-search-only', 'File:Kiyomizu-dera landscape.jpg', { via: 'search', query: 'Kiyomizu-dera' });
    expect(found).toMatchObject({ via: 'search', query: 'Kiyomizu-dera' });
    expect(isCached(s, found, { exists: allOnDisk })).toBe(true);
    expect(isCached({ ...s, photo: { ...s.photo, query: 'Kiyomizu-dera stage' } }, found, { exists: allOnDisk })).toBe(false);
    // A record without via: 'search' is not a search find.
    expect(isCached(s, record('kyoto-search-only', 'File:Kiyomizu-dera landscape.jpg'), { exists: allOnDisk })).toBe(false);
  });
});

describe('planFetch — which slots to download, in which batches', () => {
  it('downloads only what is missing; a second run with everything on disk has nothing to do', () => {
    const generated = { 'home-hero': record('home-hero', 'File:Hero first.jpg'), 'osaka-night': record('osaka-night', 'File:Osaka night.jpg') };
    const plan = planFetch(slots, generated, { exists: allOnDisk });
    expect(plan.cached).toEqual(['home-hero', 'osaka-night']);
    expect(plan.todo).toHaveLength(slots.length - 2);
    expect(plan.batches.flat()).toEqual(plan.todo);

    const everything = Object.fromEntries(slots.map((s) => [s.photo.id, record(s.photo.id, slotTitles(s.photo)[0] ?? 'local:x.jpg')]));
    const again = planFetch(slots, everything, { exists: allOnDisk });
    expect(again.todo).toEqual([]);
    expect(again.cached).toHaveLength(slots.length);
  });

  it('resumes after an interruption: files missing on disk are downloaded again', () => {
    const generated = { 'home-hero': record('home-hero', 'File:Hero first.jpg') };
    const plan = planFetch(slots, generated, { exists: (name) => !name.startsWith('home-hero-') });
    expect(plan.todo.map((s) => s.photo.id)).toContain('home-hero');
  });

  it('narrows to --only (a manifest, a brochure or a photo id)', () => {
    expect(planFetch(slots, {}, { only: ['osaka-kuidaore'] }).todo.map((s) => s.photo.id)).toEqual(['osaka-takoyaki', 'osaka-market', 'osaka-night']);
    expect(planFetch(slots, {}, { only: ['kyoto-temple'] }).todo.map((s) => s.photo.id)).toEqual(['kyoto-temple']);
  });

  it('lets the automatic download skip slots that found nothing recently (until the slot changes or a day passes)', () => {
    const now = Date.parse('2026-10-18T12:00:00Z');
    const failures = { 'osaka-takoyaki': { at: now - 60_000, sig: slotSignature(slot('osaka-takoyaki').photo), reason: 'nothing usable' } };
    const auto = planFetch(slots, {}, { failures, honourFailures: true, now });
    expect(auto.waiting).toEqual(['osaka-takoyaki']);
    expect(auto.todo.map((s) => s.photo.id)).not.toContain('osaka-takoyaki');
    // `npm run photos:fetch` always tries again.
    expect(planFetch(slots, {}, { failures, now }).todo.map((s) => s.photo.id)).toContain('osaka-takoyaki');
    expect(recentlyFailed(failures['osaka-takoyaki'], slot('osaka-takoyaki'), { now: now + 25 * 3600_000 })).toBe(false);
    expect(recentlyFailed(failures['osaka-takoyaki'], { photo: { ...slot('osaka-takoyaki').photo, query: 'Takoyaki stall' } }, { now })).toBe(false);
    expect(recentlyFailed(undefined, slot('osaka-takoyaki'), { now })).toBe(false);
  });

  it('puts the Home page, its Nostalgic Japan mosaic and the covers first, then the rest in near-equal batches', () => {
    expect(isPriority(slot('home-region'))).toBe(true);
    expect(isPriority(slot('nostalgic-street'))).toBe(true);
    expect(isPriority(slot('kyoto-cover'))).toBe(true);
    expect(isPriority(slot('osaka-night'))).toBe(false);

    const batches = planBatches(slots, { size: 3 });
    expect(batches[0].map((s) => s.photo.id)).toEqual(['home-hero', 'home-region', 'kyoto-cover', 'nostalgic-street']);
    expect(batches.slice(1).map((b) => b.length)).toEqual([2, 3, 2]);
    expect(batches.flat()).toHaveLength(slots.length);
    expect(planBatches([], { size: 3 })).toEqual([]);
    expect(planBatches([slot('osaka-night')])).toEqual([[slot('osaka-night')]]);
  });

  it('publishes the registry a few times for the real manifests, not once per photo', () => {
    // 213 slots: about 53 first, then the remaining 160 in three parts.
    const fake = Array.from({ length: 213 }, (_, i) => ({ manifest: i < 41 ? 'home' : 'kyoto', brochure: null, photo: { id: `p-${i}`, use: i >= 41 && i < 53 ? 'cover' : 'any' } }));
    const batches = planBatches(fake);
    expect(batches.map((b) => b.length)).toEqual([53, 53, 54, 53]);
    expect(Math.max(...batches.slice(1).map((b) => b.length))).toBeLessThanOrEqual(PUBLISH_EVERY);
  });
});

describe('choosing a picture', () => {
  it('takes the researched pictures that pass, in the slot’s order, with reasons for the rest', () => {
    const info = imageinfo({
      'File:Chosen pick.jpg': [1200, 800, 'CC BY-SA 4.0'],
      'File:Backup pick.jpg': [4000, 3000, 'CC BY-SA 4.0'],
    });
    const { usable, tried } = usableCandidates(slot('kyoto-chosen').photo, info);
    expect(usable.map((u) => u.title)).toEqual(['File:Backup pick.jpg']);
    expect(usable[0].verdict.credit).toMatchObject({ license: 'CC BY-SA 4.0', author: 'Someone' });
    expect(tried).toEqual([expect.stringMatching(/^File:Chosen pick\.jpg: too small/)]);

    const none = usableCandidates(slot('home-hero').photo, imageinfo({ 'File:Hero first.jpg': 'missing', 'File:Hero second.jpg': [3000, 4000, 'CC BY-NC 2.0'] }));
    expect(none.usable).toEqual([]);
    expect(none.tried).toEqual([expect.stringMatching(/no such file/), expect.stringMatching(/NonCommercial/)]);
    expect(usableCandidates(slot('osaka-takoyaki').photo, new Map())).toEqual({ usable: [], tried: [] });
  });

  const search = fixture('search-v2.json');
  const merged = mergeQueryResponses([search]);
  const results = searchResults(merged, parseImageInfoResponse(merged));

  it('falls back to a Commons search, choosing by shape for the slot’s use (the browser’s rule)', () => {
    const owners = fileOwners([], {});
    const pick = (use) => searchChoices(results, { photo: { id: 'x', use } }, owners).map((c) => c.title);
    // cover/full: portrait-ish; wide/spread: 1.4–2.4 : 1, the largest first; any: the largest.
    expect(pick('cover')[0]).toBe('File:Kiyomizu-dera portrait.jpg');
    expect(pick('full')[0]).toBe('File:Kiyomizu-dera portrait.jpg');
    expect(pick('wide').slice(0, 2)).toEqual(['File:Kiyomizu-dera big landscape.jpg', 'File:Kiyomizu-dera landscape.jpg']);
    expect(pick('spread')[0]).toBe('File:Kiyomizu-dera big landscape.jpg');
    expect(pick('any')[0]).toBe('File:Kiyomizu-dera panorama strip.jpg');
    // Non-free and too-small results never qualify.
    expect(pick('any')).not.toContain('File:Kiyomizu-dera noncommercial.jpg');
    expect(pick('any')).not.toContain('File:Kiyomizu-dera small.jpg');
    const [first] = searchChoices(results, { photo: { id: 'x', use: 'cover' } }, owners);
    expect(first.result.info.thumburl).toMatch(/\/1920px-/);
    expect(first.verdict.credit).toMatchObject({ license: 'CC BY-SA 4.0', author: 'Example Photographer' });
  });

  it('never reuses a picture another slot shows or lists', () => {
    const generated = { 'osaka-market': record('osaka-market', 'File:Kiyomizu-dera landscape.jpg') };
    const owners = fileOwners(slots, generated);
    // kyoto-temple lists "big landscape" as its candidate; osaka-market already shows "landscape".
    const choices = searchChoices(results, slot('kyoto-search-only'), owners).map((c) => c.title);
    expect(choices).not.toContain('File:Kiyomizu-dera big landscape.jpg');
    expect(choices).not.toContain('File:Kiyomizu-dera landscape.jpg');
    expect(choices[0]).toBe('File:Kiyomizu-dera panorama strip.jpg');
    // …but a slot may still have its own candidate.
    expect(searchChoices(results, slot('kyoto-temple'), owners)[0].title).toBe('File:Kiyomizu-dera big landscape.jpg');

    // A pick made during the run is off limits to the next slot.
    claimFile(owners, 'File:Kiyomizu-dera panorama strip.jpg', 'kyoto-search-only');
    expect(excludedFor(owners, 'osaka-takoyaki').has('File:Kiyomizu-dera panorama strip.jpg')).toBe(true);
    expect(excludedFor(owners, 'kyoto-search-only').has('File:Kiyomizu-dera panorama strip.jpg')).toBe(false);
    // What is left is the wrong shape for a wide slot, but still a real photograph of the place: better than art.
    expect(searchChoices(results, slot('osaka-takoyaki'), owners).map((c) => c.title)).toEqual(['File:Kiyomizu-dera portrait.jpg']);
  });
});

describe('resuming an interrupted run', () => {
  it('keeps journaled photos that still fit their slot and are on disk', () => {
    const journal = {
      'home-hero': record('home-hero', 'File:Hero first.jpg'),
      'osaka-market': record('osaka-market', 'File:Market.jpg'),
      'kyoto-cover': record('kyoto-cover', 'File:No longer listed.jpg'),
      'gone-slot': record('gone-slot', 'File:Whatever.jpg'),
    };
    const { records, dropped } = recoverJournal(journal, slots, { exists: (name) => !name.startsWith('osaka-market-') });
    expect(Object.keys(records)).toEqual(['home-hero']);
    expect(dropped).toBe(3);
    expect(recoverJournal(null, slots, { exists: allOnDisk })).toEqual({ records: {}, dropped: 0 });
  });
});

describe('progress', () => {
  it('reports every ~10%, at the end, and after a quiet spell', () => {
    expect(shouldReport({ done: 21, total: 213, lastDone: 0 })).toBe(true);
    expect(shouldReport({ done: 20, total: 213, lastDone: 0 })).toBe(false);
    expect(shouldReport({ done: 25, total: 213, lastDone: 21, sinceMs: 25_000 })).toBe(true);
    expect(shouldReport({ done: 3, total: 3, lastDone: 2 })).toBe(true);
    expect(shouldReport({ done: 2, total: 3, lastDone: 2, sinceMs: 60_000 })).toBe(false);
    expect(shouldReport({ done: 5, total: 20, lastDone: 0 })).toBe(true);
  });

  it('draws a bar the terminal can show', () => {
    expect(progressBar(0, 213, 10)).toBe('[░░░░░░░░░░] 0/213');
    expect(progressBar(107, 213, 10)).toBe('[█████░░░░░] 107/213');
    expect(progressBar(213, 213, 10)).toBe('[██████████] 213/213');
    expect(progressBar(0, 0, 4)).toBe('[████] 0/0');
  });
});
