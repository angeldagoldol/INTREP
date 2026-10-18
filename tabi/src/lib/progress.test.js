import { describe, expect, it } from 'vitest';
import { MAX_ENTRIES, progressOf, readProgress, resumePath, saveProgress } from './progress.js';

const brochure = (id, pages = 11) => ({ id, pages: Array.from({ length: pages }, (_, i) => ({ id: `p${i}` })) });

describe('reading progress', () => {
  it('remembers the page per brochure and forgets the cover', () => {
    expect(saveProgress('b_osaka', 3)).toBe(true);
    expect(readProgress()).toEqual({ b_osaka: 3 });
    expect(progressOf(brochure('b_osaka'))).toBe(3);
    saveProgress('b_osaka', 0);
    expect(readProgress()).toEqual({});
    expect(progressOf(brochure('b_osaka'))).toBe(0);
  });

  it('clamps a stale page to the brochure and ignores unknown brochures', () => {
    saveProgress('b_short', 9);
    expect(progressOf(brochure('b_short', 4))).toBe(3);
    expect(progressOf(brochure('b_other'))).toBe(0);
    expect(progressOf(brochure('b_short', 0))).toBe(0);
    expect(progressOf(null)).toBe(0);
  });

  it('drops malformed stored values and refuses bad ids', () => {
    window.localStorage.setItem('tabi:progress', JSON.stringify({ a: 2, b: -1, c: 1.5, d: '4', e: null }));
    expect(readProgress()).toEqual({ a: 2 });
    window.localStorage.setItem('tabi:progress', JSON.stringify([1, 2]));
    expect(readProgress()).toEqual({});
    expect(saveProgress('', 3)).toBe(false);
    expect(saveProgress(undefined, 3)).toBe(false);
  });

  it('treats prototype-named ids as plain data', () => {
    saveProgress('__proto__', 2);
    saveProgress('constructor', 5);
    expect(Object.getPrototypeOf(readProgress())).toBe(Object.prototype);
    expect(progressOf(brochure('__proto__'))).toBe(2);
    expect(progressOf(brochure('constructor'))).toBe(5);
    expect(progressOf(brochure('toString'))).toBe(0);
  });

  it('builds the resume link, omitting the cover', () => {
    expect(resumePath({ slug: 'osaka-kuidaore' }, 3)).toBe('/brochures/osaka-kuidaore?p=3');
    expect(resumePath({ slug: 'osaka-kuidaore' }, 0)).toBe('/brochures/osaka-kuidaore');
    expect(resumePath({ slug: '京都の秋' }, 2)).toBe(`/brochures/${encodeURIComponent('京都の秋')}?p=2`);
  });

  it('keeps only the most recently read brochures', () => {
    for (let i = 0; i < MAX_ENTRIES + 5; i += 1) saveProgress(`b_${i}`, 2);
    saveProgress('b_3', 4); // reading an old one again makes it the newest
    const ids = Object.keys(readProgress());
    expect(ids).toHaveLength(MAX_ENTRIES);
    expect(ids.at(-1)).toBe('b_3');
    expect(ids).not.toContain('b_0');
  });
});
