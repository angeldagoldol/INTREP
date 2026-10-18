import { describe, expect, it } from 'vitest';
import { geometryIndex, gridIndex, isEditableTarget, nextIndex, nextTabbable, tabbablesIn, tabPanelProps, wantsStudioUndo } from './a11y.js';
import { humanizeIcon, searchIcons } from './iconSearch.js';
import { DRAFT_KEY, clearDraft, contentSignature, editDraftKey, readDraft, writeDraft } from './draftStore.js';
import { LIST_LIMITS, listLimit, newListItem, randomSeed } from './pageLimits.js';
import { createStudioState } from './studioReducer.js';
import {
  BLANK,
  buildSpreads,
  charCount,
  draftShows,
  isPageFace,
  normalizeTag,
  numberFromDraft,
  relativeSaved,
  spreadOf,
  spreadPages,
} from './studioFormat.js';
import { buildBook } from '../viewer/spreads.js';

describe('pageLimits', () => {
  it('resolves limits from the last key of a path', () => {
    expect(listLimit('features', ['items'])).toEqual({ min: 2, max: 6 });
    expect(listLimit('pricing', ['plans', 1, 'features'])).toEqual(LIST_LIMITS.pricing.features);
    expect(listLimit('intro', ['items'])).toEqual({ min: 0, max: Infinity });
  });

  it('creates blank items for every list', () => {
    expect(newListItem('features', ['items'])).toHaveProperty('icon');
    expect(newListItem('gallery', ['items'], () => 0).seed).toBe(1);
    expect(newListItem('pricing', ['plans', 0, 'features'])).toBe('Another inclusion');
    expect(newListItem('phrases', ['items']).jp).toMatch(/よろしく/);
    expect(newListItem('quote', ['x'])).toEqual({});
  });

  it('starts fact rows empty, offering the next usual label', () => {
    expect(newListItem('place', ['facts'])).toEqual({ label: 'Hours', value: '' });
    const page = { facts: [{ label: 'Hours' }, { label: 'admission' }] };
    expect(newListItem('place', ['facts'], Math.random, page)).toEqual({ label: 'Getting there', value: '' });
    const full = { facts: ['Hours', 'Admission', 'Getting there', 'Time needed', 'Best time'].map((label) => ({ label })) };
    expect(newListItem('place', ['facts'], Math.random, full).label).toBe('Good to know');
    expect(newListItem('contact', ['details'])).toEqual({ icon: 'Globe', label: 'Official site', value: '', url: '' });
    expect(listLimit('place', ['facts'])).toEqual({ min: 1, max: 5 });
    expect(LIST_LIMITS).not.toHaveProperty('map');
  });

  it('draws seeds in range', () => {
    expect(randomSeed(() => 0)).toBe(1);
    expect(randomSeed(() => 0.99999)).toBeLessThan(10000);
  });
});

describe('draftStore', () => {
  const doc = { id: 'b_1', title: 'Draft', pages: [{ id: 'p', type: 'cover' }] };

  it('writes, reads and clears a draft', () => {
    expect(readDraft(DRAFT_KEY)).toBeNull();
    expect(writeDraft(DRAFT_KEY, { doc, selectedId: 'p' }, 123)).toBe(true);
    expect(readDraft(DRAFT_KEY)).toEqual({ doc, selectedId: 'p', savedAt: 123 });
    clearDraft(DRAFT_KEY);
    expect(readDraft(DRAFT_KEY)).toBeNull();
  });

  it('rejects malformed drafts', () => {
    window.localStorage.setItem('tabi:studio-draft', JSON.stringify({ doc: { id: 1 } }));
    expect(readDraft(DRAFT_KEY)).toBeNull();
    window.localStorage.setItem('tabi:studio-draft', '{broken');
    expect(readDraft(DRAFT_KEY)).toBeNull();
  });

  it('skips unreadable pages so the editor never meets a null page (regression)', () => {
    window.localStorage.setItem('tabi:studio-draft', JSON.stringify({ doc: { id: 'b_n', title: 7, pages: [null, { id: 'x', type: 'intro' }] }, selectedId: 'x' }));
    expect(readDraft(DRAFT_KEY).doc).toEqual({ id: 'b_n', title: '', pages: [{ id: 'x', type: 'intro' }] });
    window.localStorage.setItem('tabi:studio-draft', JSON.stringify({ doc: { id: 'b_n', pages: [null, { type: 'constructor', id: 'y' }] } }));
    expect(readDraft(DRAFT_KEY)).toBeNull();
  });

  it('drops an old draft’s map pages (a retired type) and keeps everything else (migration)', () => {
    const old = {
      id: 'b_old',
      title: 'Kyoto days',
      pages: [
        { id: 'c', type: 'cover', title: 'Kyoto days' },
        { id: 'm', type: 'map', heading: 'Where it all is', places: [{ name: 'Kyoto Station', lat: 34.9858, lng: 135.7588 }] },
        { id: 'pl', type: 'place', name: 'Kiyomizu-dera', lat: 34.9949, lng: 135.785 },
        { id: 'b', type: 'back' },
      ],
    };
    window.localStorage.setItem('tabi:studio-draft', JSON.stringify({ doc: old, selectedId: 'm', savedAt: 5 }));
    const draft = readDraft(DRAFT_KEY);
    expect(draft.doc.pages.map((p) => p.id)).toEqual(['c', 'pl', 'b']);
    expect(draft.doc.pages[1]).toEqual(old.pages[2]);
    // The selection pointed at the map page; the editor then opens on the first page.
    expect(createStudioState(draft.doc, draft.selectedId).selectedId).toBe('c');
    window.localStorage.setItem('tabi:studio-draft', JSON.stringify({ doc: { id: 'b_m', pages: [{ id: 'm', type: 'map' }] } }));
    expect(readDraft(DRAFT_KEY)).toBeNull();
    clearDraft(DRAFT_KEY);
  });

  it('keeps safe uploads and drops unsafe ones on the way back from storage', () => {
    const good = { src: 'data:image/jpeg;base64,QUJD', alt: 'x', width: 4, height: 3, credit: { author: 'Your photo', license: '' } };
    const stored = { ...doc, userPhotos: { a: good } };
    writeDraft(DRAFT_KEY, { doc: stored, selectedId: 'p' }, 1);
    expect(readDraft(DRAFT_KEY).doc).toEqual(stored);
    writeDraft(DRAFT_KEY, { doc: { ...doc, userPhotos: { a: good, b: { ...good, src: 'https://x.example/a.jpg' } } }, selectedId: 'p' }, 1);
    expect(readDraft(DRAFT_KEY).doc.userPhotos).toEqual({ a: good });
    writeDraft(DRAFT_KEY, { doc: { ...doc, userPhotos: { b: { src: 'javascript:x' } } }, selectedId: 'p' }, 1);
    expect(readDraft(DRAFT_KEY).doc).not.toHaveProperty('userPhotos');
    clearDraft(DRAFT_KEY);
  });

  it('keys edit drafts per brochure', () => {
    expect(editDraftKey('b_9')).toBe('studio-edit:b_9');
  });

  it('ignores bookkeeping fields in content signatures', () => {
    const a = { ...doc, updatedAt: '2026-01-01', readMinutes: 3, slug: 'a', source: 'user' };
    const b = { ...doc, updatedAt: '2026-02-02', readMinutes: 5, slug: 'b', source: 'builtin' };
    expect(contentSignature(a)).toBe(contentSignature(b));
    expect(contentSignature({ ...a, title: 'Other' })).not.toBe(contentSignature(a));
    expect(contentSignature(null)).toBe('');
  });

  it('notices changed uploads without carrying their data', () => {
    const photo = (src) => ({ src, alt: 'x', width: 4, height: 3, credit: { author: 'Your photo', license: '' } });
    const big = `data:image/jpeg;base64,${'A'.repeat(200_000)}B`;
    const a = { ...doc, userPhotos: { p1: photo(big) } };
    const signature = contentSignature(a);
    expect(signature.length).toBeLessThan(1000);
    expect(contentSignature({ ...doc, userPhotos: { p1: photo(big) } })).toBe(signature);
    expect(contentSignature({ ...doc, userPhotos: { p1: photo(`${big.slice(0, -1)}C`) } })).not.toBe(signature);
    expect(contentSignature({ ...doc, userPhotos: { p1: { ...photo(big), alt: 'changed' } } })).not.toBe(signature);
    expect(contentSignature(doc)).not.toBe(signature);
  });
});

describe('geometryIndex', () => {
  // Two groups: a row of three, a row of one, then (second grid) a row of two.
  const rects = [
    { top: 0, left: 0, width: 100, height: 80 },
    { top: 0, left: 110, width: 100, height: 80 },
    { top: 0, left: 220, width: 100, height: 80 },
    { top: 90, left: 0, width: 100, height: 80 },
    { top: 240, left: 0, width: 150, height: 80 },
    { top: 240, left: 160, width: 150, height: 80 },
  ];

  it('steps along the reading order with Left/Right, Home and End', () => {
    expect(geometryIndex('ArrowRight', rects, 2)).toBe(3);
    expect(geometryIndex('ArrowLeft', rects, 0)).toBe(0);
    expect(geometryIndex('ArrowRight', rects, 5)).toBe(5);
    expect(geometryIndex('Home', rects, 4)).toBe(0);
    expect(geometryIndex('End', rects, 1)).toBe(5);
  });

  it('moves to the nearest item in the next or previous row, across groups', () => {
    expect(geometryIndex('ArrowDown', rects, 2)).toBe(3);
    expect(geometryIndex('ArrowDown', rects, 3)).toBe(4);
    expect(geometryIndex('ArrowUp', rects, 5)).toBe(3);
    expect(geometryIndex('ArrowUp', rects, 3)).toBe(0);
    expect(geometryIndex('ArrowUp', rects, 1)).toBe(1);
    expect(geometryIndex('ArrowDown', rects, 5)).toBe(5);
  });

  it('ignores other keys and empty lists', () => {
    expect(geometryIndex('Enter', rects, 0)).toBe(-1);
    expect(geometryIndex('ArrowDown', [], 0)).toBe(-1);
  });
});

describe('studioFormat', () => {
  const t0 = new Date('2026-10-01T12:00:00Z').getTime();

  it('describes save times', () => {
    expect(relativeSaved(0, t0)).toBe('');
    expect(relativeSaved(t0 - 10_000, t0)).toBe('just now');
    expect(relativeSaved(t0 - 60_000, t0)).toBe('1 min ago');
    expect(relativeSaved(t0 - 25 * 60_000, t0)).toBe('25 min ago');
    expect(relativeSaved(t0 - 3 * 3_600_000, t0)).toMatch(/^at \d{2}:\d{2}$/);
    expect(relativeSaved(t0 - 5 * 86_400_000, t0)).toBe('on Sep 26');
  });

  it('groups pages into booklet spreads, by side', () => {
    expect(buildSpreads(0)).toEqual([]);
    expect(buildSpreads(1)).toEqual([[null, 0]]);
    expect(buildSpreads(2)).toEqual([[null, 0], [1, null]]);
    expect(buildSpreads(6)).toEqual([[null, 0], [1, 2], [3, 4], [5, null]]);
  });

  it('puts an endpaper before the back cover of an odd book, as the reader does (regression)', () => {
    expect(buildSpreads(5)).toEqual([[null, 0], [1, 2], [3, BLANK], [4, null]]);
    // The Studio proof and the published flipbook pair every page the same way.
    for (const count of [1, 2, 5, 9, 11, 12]) {
      const reader = buildBook(count, 'double').spreads.filter((s) => s.pages.length).map((s) => [s.left, s.right]);
      expect(buildSpreads(count)).toEqual(reader);
    }
    const eleven = buildSpreads(11);
    expect(eleven.at(-2)).toEqual([9, BLANK]);
    expect(eleven.at(-1)).toEqual([10, null]);
  });

  it('finds the spread holding a page', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => spreadOf(i, 6))).toEqual([0, 1, 1, 2, 2, 3]);
    expect([0, 1, 2, 3, 4].map((i) => spreadOf(i, 5))).toEqual([0, 1, 1, 2, 3]);
    expect(spreadOf(99, 5)).toBe(3);
    expect(spreadOf(3, 0)).toBe(0);
  });

  it('lists the real pages on a spread', () => {
    expect(spreadPages([null, 0])).toEqual([0]);
    expect(spreadPages([3, BLANK])).toEqual([3]);
    expect(spreadPages([1, 2])).toEqual([1, 2]);
    expect(spreadPages(undefined)).toEqual([]);
    expect([0, 4, BLANK, null, undefined, 1.5].map(isPageFace)).toEqual([true, true, false, false, false, false]);
  });

  it('keeps half-typed numbers as drafts (regression: 0.05 typed as 5)', () => {
    expect(numberFromDraft('0.05')).toBe(0.05);
    expect(numberFromDraft('0.0')).toBe(0);
    expect(numberFromDraft(' 12 ')).toBe(12);
    expect(numberFromDraft('')).toBe('');
    expect(numberFromDraft('', { badInput: true })).toBeUndefined();
    expect(numberFromDraft('abc')).toBeUndefined();
    expect(numberFromDraft('99999999999999999999')).toBe(1e12);
    expect(numberFromDraft('-99999999999999999999')).toBe(-1e12);
    // The draft "0.0" already shows 0, so it isn't replaced by "0" mid-typing.
    expect(draftShows('0.0', 0)).toBe(true);
    expect(draftShows('1.', 1)).toBe(true);
    expect(draftShows('0.05', 5)).toBe(false);
    expect(draftShows('', '')).toBe(true);
    expect(draftShows('', 3)).toBe(false);
    expect(draftShows('3', '')).toBe(false);
  });

  it('counts characters, including Japanese', () => {
    expect(charCount('京都の秋', 10)).toEqual({ count: 4, over: false, near: false });
    expect(charCount('x'.repeat(9), 10)).toMatchObject({ near: true, over: false });
    expect(charCount('x'.repeat(11), 10).over).toBe(true);
  });

  it('normalises tags', () => {
    expect(normalizeTag('  #Hot   Springs ')).toBe('hot springs');
    expect(normalizeTag('x'.repeat(40))).toHaveLength(32);
  });
});

describe('a11y helpers', () => {
  it('moves through a list with wrapping', () => {
    expect(nextIndex('ArrowRight', 2, 3)).toBe(0);
    expect(nextIndex('ArrowUp', 0, 3)).toBe(2);
    expect(nextIndex('Home', 2, 3)).toBe(0);
    expect(nextIndex('End', 0, 3)).toBe(2);
    expect(nextIndex('a', 0, 3)).toBe(-1);
    expect(nextIndex('ArrowRight', 0, 0)).toBe(-1);
  });

  it('moves through a grid without wrapping', () => {
    expect(gridIndex('ArrowDown', 1, 10, 4)).toBe(5);
    expect(gridIndex('ArrowDown', 8, 10, 4)).toBe(8);
    expect(gridIndex('ArrowLeft', 0, 10, 4)).toBe(0);
    expect(gridIndex('End', 0, 10, 4)).toBe(9);
    expect(gridIndex('x', 0, 10, 4)).toBe(-1);
  });

  it('recognises text-editing targets', () => {
    const make = (tag, type) => Object.assign(document.createElement(tag), type ? { type } : {});
    expect(isEditableTarget(make('input', 'text'))).toBe(true);
    expect(isEditableTarget(make('input', 'search'))).toBe(true);
    expect(isEditableTarget(make('textarea'))).toBe(true);
    expect(isEditableTarget(make('input', 'color'))).toBe(false);
    expect(isEditableTarget(make('button'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it('sends ⌘Z to the Studio history only from the editor’s own fields', () => {
    const root = document.createElement('div');
    const title = Object.assign(document.createElement('input'), { type: 'text' });
    const draftBox = document.createElement('div');
    draftBox.setAttribute('data-native-undo', '');
    const hex = document.createElement('input');
    draftBox.append(hex);
    root.append(title, draftBox);
    const outside = document.createElement('input');
    document.body.append(root, outside);
    expect(wantsStudioUndo(title, root)).toBe(true);
    expect(wantsStudioUndo(hex, root)).toBe(false);
    expect(wantsStudioUndo(outside, root)).toBe(false);
    expect(wantsStudioUndo(document.createElement('button'), root)).toBe(true);
    expect(wantsStudioUndo(document.body, root)).toBe(true);
    expect(wantsStudioUndo(title, null)).toBe(false);
    root.remove();
    outside.remove();
  });

  it('finds Tab stops, skipping roving cells and anything excluded', () => {
    document.body.innerHTML = `
      <button id="trigger">Icon</button>
      <button id="off" disabled>Off</button>
      <input id="title" />
      <div inert><button id="inert">No</button></div>
      <div id="pop"><input id="search" /><button tabindex="0" id="cell0">a</button><button tabindex="-1" id="cell1">b</button></div>`;
    const ids = (els) => els.map((el) => el.id);
    expect(ids(tabbablesIn(document.getElementById('pop')))).toEqual(['search', 'cell0']);
    expect(nextTabbable(document.getElementById('trigger'), null)?.id).toBe('title');
    expect(nextTabbable(document.getElementById('title'), document.getElementById('pop'))).toBeNull();
    expect(nextTabbable(document.getElementById('title'), null)?.id).toBe('search');
    expect(tabbablesIn(null)).toEqual([]);
    document.body.innerHTML = '';
  });

  it('links tab panels to their tabs', () => {
    expect(tabPanelProps('s', 'pages')).toEqual({ role: 'tabpanel', id: 's-panel-pages', 'aria-labelledby': 's-tab-pages', tabIndex: 0 });
  });
});

describe('icon search', () => {
  const names = ['Landmark', 'Bath', 'TrainFront', 'TramFront', 'Soup', 'Flower2', 'Star'];

  it('humanises icon names', () => {
    expect(humanizeIcon('TrainFront')).toBe('train front');
    expect(humanizeIcon('Flower2')).toBe('flower 2');
  });

  it('finds icons by name and by travel keyword', () => {
    expect(searchIcons(names, '')).toEqual(names);
    expect(searchIcons(names, 'temple')).toEqual(['Landmark']);
    expect(searchIcons(names, 'onsen')).toEqual(['Bath']);
    expect(searchIcons(names, 'RAMEN')).toEqual(['Soup']);
    expect(searchIcons(names, 'sakura')).toEqual(['Flower2']);
    expect(searchIcons(names, 'zzz')).toEqual([]);
  });

  it('ranks name matches before keyword matches', () => {
    expect(searchIcons(names, 'tra')).toEqual(['TrainFront', 'TramFront']);
    expect(searchIcons(names, 'train front')[0]).toBe('TrainFront');
  });
});
