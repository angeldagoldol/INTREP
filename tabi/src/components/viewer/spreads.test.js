import { describe, expect, it } from 'vitest';
import {
  BLANK,
  bookletFaces,
  buildBook,
  clampPage,
  contentWindow,
  pageAtPosition,
  positionOfPage,
  spreadAnnouncement,
  spreadLabel,
  spreadName,
  stackDepth,
} from './spreads.js';

describe('bookletFaces', () => {
  it('keeps even counts as they are', () => {
    expect(bookletFaces(4)).toEqual([0, 1, 2, 3]);
  });

  it('adds a blank endpaper before the back cover for odd counts', () => {
    expect(bookletFaces(5)).toEqual([0, 1, 2, 3, BLANK, 4]);
  });

  it('pairs a lone cover with a blank inside cover', () => {
    expect(bookletFaces(1)).toEqual([0, BLANK]);
  });

  it('handles empty and junk counts', () => {
    expect(bookletFaces(0)).toEqual([]);
    expect(bookletFaces(undefined)).toEqual([]);
  });
});

describe('buildBook (double)', () => {
  it('puts the cover alone on the right and the back cover alone on the left (11 pages)', () => {
    const book = buildBook(11, 'double');
    expect(book.leaves).toHaveLength(6);
    expect(book.spreads.map((s) => [s.left, s.right])).toEqual([
      [null, 0],
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
      [9, BLANK],
      [10, null],
    ]);
    expect(book.spreads[5].pages).toEqual([9]);
  });

  it('pairs an even count without a blank (10 pages)', () => {
    const book = buildBook(10, 'double');
    expect(book.spreads.map((s) => [s.left, s.right])).toEqual([
      [null, 0],
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
      [9, null],
    ]);
  });

  it('describes an empty book with one empty spread', () => {
    const book = buildBook(0, 'double');
    expect(book.leaves).toEqual([]);
    expect(book.spreads).toEqual([{ index: 0, left: null, right: null, pages: [] }]);
  });
});

describe('buildBook (single)', () => {
  it('turns every page but the last', () => {
    const book = buildBook(3, 'single');
    expect(book.leaves).toEqual([
      { front: 0, back: null },
      { front: 1, back: null },
      { front: 2, back: null },
    ]);
    expect(book.spreads.map((s) => s.pages)).toEqual([[0], [1], [2]]);
  });
});

describe('page ↔ position', () => {
  const book = buildBook(11, 'double');

  it('finds the spread showing a page', () => {
    expect(positionOfPage(book, 0)).toBe(0);
    expect(positionOfPage(book, 3)).toBe(2);
    expect(positionOfPage(book, 4)).toBe(2);
    expect(positionOfPage(book, 9)).toBe(5);
    expect(positionOfPage(book, 10)).toBe(6);
  });

  it('clamps out-of-range and junk pages', () => {
    expect(positionOfPage(book, 99)).toBe(6);
    expect(positionOfPage(book, -4)).toBe(0);
    expect(positionOfPage(book, 'abc')).toBe(0);
    expect(clampPage('5', 11)).toBe(5);
    expect(clampPage(3, 0)).toBe(0);
  });

  it('remembers a spread by its first real page', () => {
    expect(pageAtPosition(book, 0)).toBe(0);
    expect(pageAtPosition(book, 2)).toBe(3);
    expect(pageAtPosition(book, 5)).toBe(9);
    expect(pageAtPosition(book, 40)).toBe(10);
  });
});

describe('stackDepth', () => {
  it('counts leaves on each side of the spine', () => {
    const book = buildBook(11, 'double');
    expect(stackDepth(book, 0)).toEqual({ left: 0, right: 6 });
    expect(stackDepth(book, 2)).toEqual({ left: 2, right: 4 });
    expect(stackDepth(book, 6)).toEqual({ left: 6, right: 0 });
  });

  it('has no left stack in single mode', () => {
    const book = buildBook(5, 'single');
    expect(stackDepth(book, 1)).toEqual({ left: 0, right: 3 });
  });
});

describe('labels', () => {
  const book = buildBook(11, 'double');

  it('formats spread labels', () => {
    expect(spreadLabel(book.spreads[0])).toBe('01');
    expect(spreadLabel(book.spreads[2])).toBe('04–05');
    expect(spreadLabel(book.spreads[5])).toBe('10');
    expect(spreadLabel({ pages: [] })).toBe('—');
  });

  it('names spreads for controls', () => {
    expect(spreadName(book.spreads[2])).toBe('Pages 4–5');
    expect(spreadName(book.spreads[6])).toBe('Page 11');
  });

  it('announces spreads for screen readers', () => {
    expect(spreadAnnouncement(book.spreads[2], 11)).toBe('Pages 4 and 5 of 11');
    expect(spreadAnnouncement(book.spreads[0], 11)).toBe('Page 1 of 11');
  });
});

describe('contentWindow', () => {
  it('covers the visible leaves and one turn either way', () => {
    expect(contentWindow(buildBook(11, 'double'), 3)).toEqual({ from: 1, to: 4 });
    expect(contentWindow(buildBook(11, 'single'), 3)).toEqual({ from: 2, to: 4 });
  });
});
