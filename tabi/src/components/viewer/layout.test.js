import { describe, expect, it } from 'vitest';
import { bookOffset, clampPan, computeBookLayout, PAGE_RATIO, READABLE_PAGE_WIDTH, stepZoom, ZOOM_LEVELS } from './layout.js';

describe('computeBookLayout', () => {
  it('shows a spread on a desktop stage, limited by height', () => {
    const layout = computeBookLayout({ width: 1440, height: 640, padX: 88, padY: 20 });
    expect(layout.mode).toBe('double');
    expect(layout.pageWidth).toBe(Math.floor(600 / PAGE_RATIO));
    expect(layout.bookWidth).toBe(layout.pageWidth * 2);
    expect(layout.pageHeight).toBeLessThanOrEqual(600);
  });

  it('is limited by width on a landscape tablet', () => {
    const layout = computeBookLayout({ width: 1000, height: 560, padX: 72, padY: 36 });
    expect(layout.mode).toBe('double');
    expect(layout.pageWidth).toBe(345);
  });

  it('prefers one big page on a portrait tablet', () => {
    const layout = computeBookLayout({ width: 820, height: 915, padX: 72, padY: 36 });
    expect(layout.mode).toBe('single');
    expect(layout.pageWidth).toBe(596);
  });

  it('falls back to one page on a phone', () => {
    const layout = computeBookLayout({ width: 390, height: 600, padX: 16, padY: 12 });
    expect(layout.mode).toBe('single');
    expect(layout.pageWidth).toBe(358);
    expect(layout.bookWidth).toBe(358);
  });

  it('never returns negative sizes', () => {
    const layout = computeBookLayout({ width: 0, height: 0, padX: 20, padY: 20 });
    expect(layout.pageWidth).toBe(0);
    expect(layout.pageHeight).toBe(0);
    expect(computeBookLayout({ width: 0, height: 0, readableWidth: 300 }).pageWidth).toBe(0);
  });

  it('fits without overflowing when the page is readable', () => {
    const layout = computeBookLayout({ width: 1440, height: 734, padX: 96, padY: 20, readableWidth: READABLE_PAGE_WIDTH });
    expect(layout.mode).toBe('double');
    expect(layout.pageWidth).toBe(490);
    expect(layout.overflows).toBe(false);
  });

  describe('readable floor (short stages, browser zoom)', () => {
    it('keeps a spread at the floor width when two such pages fit across', () => {
      // 1024×600 window: the fitted spread would have 277px pages.
      const layout = computeBookLayout({ width: 1024, height: 432, padX: 96, padY: 20, readableWidth: 300 });
      expect(layout.mode).toBe('double');
      expect(layout.pageWidth).toBe(300);
      expect(layout.pageHeight).toBe(Math.round(300 * PAGE_RATIO));
      // 424px still fits the 432px stage once the padding gives way: nothing to scroll.
      expect(layout.overflows).toBe(false);
    });

    it('overflows only past the whole stage height', () => {
      const layout = computeBookLayout({ width: 1024, height: 400, padX: 96, padY: 20, readableWidth: 300 });
      expect(layout.mode).toBe('double');
      expect(layout.pageWidth).toBe(300);
      expect(layout.overflows).toBe(true);
    });

    it('falls back to one readable page when a readable spread would not fit', () => {
      // 1440×900 at 200% browser zoom: a 720×450 viewport.
      const fitted = computeBookLayout({ width: 720, height: 356, padX: 72, padY: 20 });
      expect(fitted.mode).toBe('double');
      expect(fitted.pageWidth).toBeLessThan(230);
      const layout = computeBookLayout({ width: 720, height: 356, padX: 72, padY: 20, readableWidth: 300 });
      expect(layout.mode).toBe('single');
      expect(layout.pageWidth).toBe(300);
      expect(layout.bookWidth).toBe(300);
      expect(layout.overflows).toBe(true);
    });

    it('prefers the largest single page that fits over the floor', () => {
      const layout = computeBookLayout({ width: 724, height: 606, padX: 72, padY: 20, readableWidth: 300 });
      expect(layout.mode).toBe('single');
      expect(layout.pageWidth).toBe(Math.floor(566 / PAGE_RATIO));
      expect(layout.overflows).toBe(false);
    });

    it('never makes a page wider than the stage', () => {
      const layout = computeBookLayout({ width: 320, height: 300, padX: 14, padY: 14, readableWidth: 300 });
      expect(layout.mode).toBe('single');
      expect(layout.pageWidth).toBe(292);
      expect(layout.overflows).toBe(true);
    });

    it('leaves width-limited phone pages alone', () => {
      const layout = computeBookLayout({ width: 390, height: 600, padX: 14, padY: 14, readableWidth: 300 });
      expect(layout.pageWidth).toBe(362);
      expect(layout.overflows).toBe(false);
    });
  });
});

describe('bookOffset', () => {
  it('centres the closed covers', () => {
    expect(bookOffset({ mode: 'double', position: 0, leafCount: 6, pageWidth: 400 })).toBe(-200);
    expect(bookOffset({ mode: 'double', position: 6, leafCount: 6, pageWidth: 400 })).toBe(200);
    expect(bookOffset({ mode: 'double', position: 3, leafCount: 6, pageWidth: 400 })).toBe(0);
  });

  it('never shifts a single page', () => {
    expect(bookOffset({ mode: 'single', position: 0, leafCount: 6, pageWidth: 400 })).toBe(0);
  });
});

describe('stepZoom', () => {
  it('walks the zoom levels and stops at the ends', () => {
    expect(stepZoom(1, 1)).toBe(1.5);
    expect(stepZoom(1.5, 1)).toBe(2);
    expect(stepZoom(2, 1)).toBe(3);
    expect(stepZoom(3, 1)).toBe(4);
    expect(stepZoom(4, 1)).toBe(4);
    expect(stepZoom(3, -1)).toBe(2);
    expect(stepZoom(1.5, -1)).toBe(1);
    expect(stepZoom(1, -1)).toBe(1);
  });

  it('can enlarge the fitted page to at least 200%', () => {
    expect(ZOOM_LEVELS.at(-1)).toBeGreaterThanOrEqual(2);
    expect(ZOOM_LEVELS[0]).toBe(1);
  });
});

describe('clampPan', () => {
  const base = { bookWidth: 800, bookHeight: 560, stageWidth: 1000, stageHeight: 600, margin: 0 };

  it('stays centred at 1×', () => {
    expect(clampPan({ ...base, x: 100, y: -50, zoom: 1 })).toEqual({ x: 0, y: 0 });
  });

  it('limits panning to the overflow', () => {
    expect(clampPan({ ...base, x: 900, y: -900, zoom: 2 })).toEqual({ x: 300, y: -260 });
    expect(clampPan({ ...base, x: 10, y: 10, zoom: 2 })).toEqual({ x: 10, y: 10 });
  });
});
