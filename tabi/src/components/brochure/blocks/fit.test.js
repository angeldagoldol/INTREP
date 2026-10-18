import { describe, expect, it } from 'vitest';
import { FIT_MIN, fitElement, fitRegions, overflows, regionMin } from './fit.js';

/** A fake region whose content height is `content * --fit` inside a `box`-high frame. */
function region(content, box = 100, { width = 200, attrs = {} } = {}) {
  const el = document.createElement('div');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  const fit = () => Number(el.style.getPropertyValue('--fit') || 1);
  Object.defineProperties(el, {
    clientHeight: { get: () => box },
    clientWidth: { get: () => width },
    scrollHeight: { get: () => Math.max(box, Math.ceil(content * fit())), configurable: true },
    scrollWidth: { get: () => width, configurable: true },
  });
  return el;
}

describe('fitElement', () => {
  it('leaves fitting text alone', () => {
    const el = region(80);
    expect(fitElement(el)).toBe(1);
    expect(el.style.getPropertyValue('--fit')).toBe('');
    expect(overflows(el)).toBe(false);
  });

  it('shrinks overflowing text to the largest scale that fits', () => {
    const el = region(125);
    const fit = fitElement(el);
    // A pixel of slack: 0.808 × 125 rounds up to 101.
    expect(fit).toBeGreaterThan(0.79);
    expect(fit).toBeLessThanOrEqual(0.81);
    expect(overflows(el)).toBe(false);
    expect(el.style.getPropertyValue('--fit')).toBe(String(fit));
  });

  it('stops at the floor and flags what still overflows', () => {
    const el = region(400);
    expect(fitElement(el)).toBe(FIT_MIN);
    expect(el.hasAttribute('data-overflow')).toBe(true);
    // Shorter copy later (an edit in the Studio) clears the flag and the scale.
    Object.defineProperty(el, 'scrollHeight', { get: () => 90 });
    expect(fitElement(el)).toBe(1);
    expect(el.hasAttribute('data-overflow')).toBe(false);
  });

  it('measures height only unless asked for both axes', () => {
    const wide = region(80, 100, { width: 200 });
    Object.defineProperty(wide, 'scrollWidth', { get: () => 260 });
    expect(overflows(wide)).toBe(false);
    expect(overflows(wide, 'both')).toBe(true);
    expect(fitElement(wide)).toBe(1);
  });

  it('catches a sub-pixel overflow from the last child’s edge', () => {
    const el = region(100, 100);
    const child = document.createElement('p');
    el.append(child);
    el.getBoundingClientRect = () => ({ top: 0, bottom: 100, height: 100, left: 0, right: 200, width: 200 });
    child.getBoundingClientRect = () => ({ top: 0, bottom: 100.8, height: 100.8, left: 0, right: 200, width: 200 });
    expect(overflows(el)).toBe(true);
    child.getBoundingClientRect = () => ({ top: 0, bottom: 100.3, height: 100.3, left: 0, right: 200, width: 200 });
    expect(overflows(el)).toBe(false);
  });

  it('skips elements without a box', () => {
    const el = region(500, 0, { width: 0 });
    expect(fitElement(el)).toBeNull();
    expect(fitElement(null)).toBeNull();
  });

  it('fits every marked region with its own floor', () => {
    const root = document.createElement('div');
    const a = region(150, 100, { attrs: { 'data-fit': '' } });
    const b = region(300, 100, { attrs: { 'data-fit': '', 'data-fit-min': '0.8' } });
    root.append(a, b, region(500));
    const [fa, fb] = fitRegions(root);
    expect(fa).toBeGreaterThan(0.66);
    expect(fa).toBeLessThan(0.67);
    expect(fb).toBe(0.8);
    expect(fitRegions(null)).toEqual([]);
    expect(regionMin(b)).toBe(0.8);
    expect(regionMin(region(1, 1, { attrs: { 'data-fit-min': '7' } }))).toBe(FIT_MIN);
  });
});
