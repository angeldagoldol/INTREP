import { describe, expect, it } from 'vitest';
import { BLANK, buildBook } from '../components/viewer/spreads.js';
import { bookletFace, facingPair, isPairedSpread, sideOfPage, spanOf, spreadPartner } from './photoSpreads.js';
import { createPhotoSpread, fixSpreadPlacement, moveSpread, pageInsertIndex, spreadInsertIndex, spreadIssues, spreadPairAt } from './photoSpreadEdits.js';

const page = (id, type = 'intro', extra = {}) => ({ id, type, ...extra });
const left = (id, photo = 'kyoto-spread') => page(id, 'photo', { span: 'left', photo });
const right = (id, photo = 'kyoto-spread') => page(id, 'photo', { span: 'right', photo });
const ids = (pages) => pages.map((p) => p.id);

describe('booklet binding', () => {
  it('agrees with the flipbook (viewer/spreads.js) for every page count', () => {
    for (let count = 1; count <= 40; count += 1) {
      const { spreads } = buildBook(count, 'double');
      const facing = new Set(spreads.filter((s) => s.left !== null && s.left !== BLANK && s.right !== null && s.right !== BLANK).map((s) => s.left));
      for (let i = 0; i < count; i += 1) {
        expect(facingPair(i, count), `${count} pages, page index ${i}`).toBe(facing.has(i));
        const spread = spreads.find((s) => s.pages.includes(i));
        expect(sideOfPage(i, count), `${count} pages, page index ${i}`).toBe(spread.left === i ? 'left' : 'right');
      }
    }
  });

  it('moves only the back cover of an odd-length booklet past the endpaper', () => {
    expect(bookletFace(4, 5)).toBe(5);
    expect(bookletFace(3, 5)).toBe(3);
    expect(bookletFace(5, 6)).toBe(5);
    expect(bookletFace(0, 1)).toBe(0);
  });
});

describe('spreadPartner / spreadIssues', () => {
  it('pairs a left half at an odd index with the right half after it', () => {
    const pages = [page('c', 'cover'), left('l'), right('r'), page('b', 'back')];
    expect(spreadPartner(pages, 1)).toBe(2);
    expect(spreadPartner(pages, 2)).toBe(1);
    expect(isPairedSpread(pages, 0)).toBe(false);
    expect(spreadIssues(pages)).toEqual([]);
  });

  it('flags a spread starting on a right-hand page', () => {
    const pages = [page('c', 'cover'), page('i'), left('l'), right('r'), page('x'), page('b', 'back')];
    expect(isPairedSpread(pages, 2)).toBe(false);
    expect(spreadIssues(pages)).toEqual([expect.objectContaining({ code: 'side', index: 2, ids: ['l', 'r'] })]);
  });

  it('flags a right half that lands on the back-cover slot of an odd booklet', () => {
    const pages = [page('c', 'cover'), left('l'), right('r')];
    expect(isPairedSpread(pages, 1)).toBe(false);
    expect(spreadIssues(pages)[0]).toMatchObject({ code: 'side', index: 1 });
    expect(spreadIssues(pages)[0].message).toMatch(/back-cover/);
  });

  it('flags halves without their other half, and halves with different photos', () => {
    expect(spreadIssues([page('c', 'cover'), left('l'), page('i'), page('b', 'back')])).toEqual([expect.objectContaining({ code: 'alone', ids: ['l'] })]);
    expect(spreadIssues([page('c', 'cover'), page('i'), right('r'), page('b', 'back')])).toEqual([expect.objectContaining({ code: 'alone', ids: ['r'] })]);
    const mixed = [page('c', 'cover'), left('l', 'a'), right('r', 'b'), page('b', 'back')];
    expect(spreadIssues(mixed)).toEqual([expect.objectContaining({ code: 'photo' })]);
    expect(isPairedSpread(mixed, 1)).toBe(false);
  });

  it('ignores photo pages without a span and junk', () => {
    expect(spanOf(page('p', 'photo', { span: 'middle' }))).toBe(null);
    expect(spanOf(page('p', 'intro', { span: 'left' }))).toBe(null);
    expect(spreadIssues([null, 7, page('p', 'photo')])).toEqual([]);
    expect(spreadIssues(undefined)).toEqual([]);
  });
});

describe('insertion', () => {
  const book = [page('c', 'cover'), page('i'), page('p'), page('q'), page('b', 'back')];

  it('puts a new spread on the next left-hand page, before the back cover', () => {
    for (let from = 0; from <= book.length; from += 1) {
      const at = spreadInsertIndex(book, from);
      const next = [...book];
      next.splice(at, 0, ...createPhotoSpread().map((fields, k) => ({ id: `n${k}`, type: 'photo', ...fields })));
      expect(spreadIssues(next), `from ${from}`).toEqual([]);
      expect(next.at(-1).id).toBe('b');
      expect(next[0].id).toBe('c');
    }
    expect(spreadInsertIndex(book, 2)).toBe(3);
    expect(spreadInsertIndex(book, 1)).toBe(1);
  });

  it('never splits an existing spread, and keeps it lined up', () => {
    const pages = [page('c', 'cover'), left('l'), right('r'), page('b', 'back')];
    const at = spreadInsertIndex(pages, 2);
    expect(at).not.toBe(2);
    const next = [...pages];
    next.splice(at, 0, left('l2', 'x'), right('r2', 'x'));
    expect(spreadIssues(next)).toEqual([]);
  });

  it('works in a booklet with only a cover and a back', () => {
    expect(spreadInsertIndex([page('c', 'cover'), page('b', 'back')], 1)).toBe(1);
    expect(spreadInsertIndex([page('c', 'cover'), page('i'), page('b', 'back')], 2)).toBe(1);
  });

  it('puts a single page after a spread rather than between its halves', () => {
    const pages = [page('c', 'cover'), left('l'), right('r'), page('b', 'back')];
    expect(pageInsertIndex(pages, 2)).toBe(3);
    expect(pageInsertIndex(pages, 1)).toBe(1);
    expect(pageInsertIndex(pages, 3)).toBe(3);
  });
});

describe('fixSpreadPlacement', () => {
  it('returns the same array when nothing is wrong', () => {
    const pages = [page('c', 'cover'), left('l'), right('r'), page('b', 'back')];
    expect(fixSpreadPlacement(pages)).toBe(pages);
  });

  it('moves a misplaced pair by one page, keeping cover first and back last', () => {
    const pages = [page('c', 'cover'), page('i'), left('l'), right('r'), page('x'), page('b', 'back')];
    const fixed = fixSpreadPlacement(pages);
    expect(ids(fixed)).toEqual(['c', 'i', 'x', 'l', 'r', 'b']);
    expect(spreadIssues(fixed)).toEqual([]);
  });

  it('borrows the page before when only the back cover follows', () => {
    const fixed = fixSpreadPlacement([page('c', 'cover'), page('i'), left('l'), right('r'), page('b', 'back')]);
    expect(ids(fixed)).toEqual(['c', 'l', 'r', 'i', 'b']);
    expect(spreadIssues(fixed)).toEqual([]);
  });

  it('turns a lone half into a full-page photo and gives a pair one photo', () => {
    const fixed = fixSpreadPlacement([page('c', 'cover'), left('l', 'a'), right('r', 'b'), page('i'), right('z'), page('b', 'back')]);
    expect(fixed[2].photo).toBe('a');
    expect(fixed.find((p) => p.id === 'z')).not.toHaveProperty('span');
    expect(spreadIssues(fixed)).toEqual([]);
  });

  it('lines up several spreads after a page was added in front of them', () => {
    const pages = [page('c', 'cover'), page('new'), left('l1', 'a'), right('r1', 'a'), page('m'), left('l2', 'b'), right('r2', 'b'), page('n'), page('b', 'back')];
    const fixed = fixSpreadPlacement(pages);
    expect(spreadIssues(fixed)).toEqual([]);
    expect(fixed).toHaveLength(pages.length);
    expect(new Set(ids(fixed))).toEqual(new Set(ids(pages)));
  });
});

describe('createPhotoSpread', () => {
  it('makes a left half and a captioned right half with the same photo', () => {
    const [a, b] = createPhotoSpread({ photo: 'x' });
    expect(a).toMatchObject({ span: 'left', photo: 'x' });
    expect(b).toMatchObject({ span: 'right', photo: 'x' });
    expect(b.caption).toBeTruthy();
  });
});

describe('moving spreads and reuniting halves', () => {
  it('moves both halves a spread at a time, inside the cover and back cover', () => {
    const pages = [page('c', 'cover'), page('a'), page('b'), left('l'), right('r'), page('d'), page('e'), page('k', 'back')];
    const up = moveSpread(pages, 3, -1);
    expect(ids(up)).toEqual(['c', 'l', 'r', 'a', 'b', 'd', 'e', 'k']);
    expect(moveSpread(up, 1, -1)).toBe(up);
    const down = moveSpread(pages, 4, 1);
    expect(ids(down)).toEqual(['c', 'a', 'b', 'd', 'e', 'l', 'r', 'k']);
    expect(moveSpread(down, 5, 1)).toBe(down);
    expect(spreadIssues(up)).toEqual([]);
    expect(spreadIssues(down)).toEqual([]);
    expect(moveSpread(pages, 1, 1)).toBe(pages);
    expect(spreadPairAt(pages, 4)).toEqual([3, 4]);
    expect(spreadPairAt(pages, 2)).toBe(null);
  });

  it('puts halves pulled apart back together instead of dropping the spread', () => {
    // The left half was moved up one page, past the place page.
    const pages = [page('c', 'cover'), page('i'), left('l'), page('p'), right('r'), page('x'), page('b', 'back')];
    const fixed = fixSpreadPlacement(pages);
    expect(spreadIssues(fixed)).toEqual([]);
    expect(fixed.filter((p) => p.span)).toHaveLength(2);
    expect(ids(fixed)).toEqual(['c', 'i', 'p', 'l', 'r', 'x', 'b']);
  });

  it('never moves a lined-up spread onto the back-cover slot of a booklet without a back page', () => {
    // 7 pages, no back cover: the last page (index 6) is bound alone on the left.
    const pages = [page('c', 'cover'), left('l'), right('r'), page('a'), page('b'), page('d'), page('e')];
    const once = moveSpread(pages, 1, 1);
    expect(ids(once)).toEqual(['c', 'a', 'b', 'l', 'r', 'd', 'e']);
    expect(moveSpread(once, 3, 1)).toBe(once);
    expect(spreadIssues(once)).toEqual([]);
  });

  it('lines up a spread stuck on the back-cover slot, which one-page shifts cannot fix', () => {
    const pages = [page('c', 'cover'), page('a'), page('b'), page('d'), page('e'), left('l'), right('r')];
    expect(spreadIssues(pages).map((i) => i.code)).toEqual(['side']);
    const fixed = fixSpreadPlacement(pages);
    expect(spreadIssues(fixed)).toEqual([]);
    expect(fixed.filter((p) => p.span)).toHaveLength(2);
    expect(new Set(ids(fixed))).toEqual(new Set(ids(pages)));
    expect(fixed[0].id).toBe('c');
  });

  it('splits a spread into two full-page photos only when there is nowhere it can face', () => {
    // A cover and a spread: three pages, so the right half is always the back-cover slot.
    const fixed = fixSpreadPlacement([page('c', 'cover'), left('l'), right('r')]);
    expect(ids(fixed)).toEqual(['c', 'l', 'r']);
    expect(fixed.some((p) => p.span)).toBe(false);
    expect(spreadIssues(fixed)).toEqual([]);
  });
});
