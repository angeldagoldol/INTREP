import { Suspense } from 'react';
import { act, render, screen } from '@testing-library/react';
import { BROCHURES } from './brochures.js';
import { BUILTINS, isOutline, loadBrochure, peekBrochure, preloadBrochure } from './catalog.js';
import { useFullBrochure } from '../hooks/useFullBrochure.js';

describe('catalog', () => {
  it('holds every built-in as an outline: all top-level fields, pages without their text', () => {
    expect(BUILTINS.map((b) => b.id)).toEqual(BROCHURES.map((b) => b.id));
    BUILTINS.forEach((outline, i) => {
      const full = BROCHURES[i];
      expect(isOutline(outline)).toBe(true);
      expect(isOutline(full)).toBe(false);
      expect(outline.cover).toEqual(full.cover);
      expect(outline.sources).toEqual(full.sources);
      expect(outline.pages).toHaveLength(full.pages.length);
      expect(outline.pages.some((p) => 'body' in p || 'facts' in p)).toBe(false);
    });
  });

  it('loads the full brochure once, and hands back anything else as it is', async () => {
    const outline = BUILTINS.find((b) => b.slug === 'japan-alps');
    const full = BROCHURES.find((b) => b.slug === 'japan-alps');
    const first = loadBrochure(outline);
    expect(loadBrochure(outline)).toBe(first);
    expect(await first).toEqual(full);
    expect(peekBrochure(outline)).toBe(await first);

    const mine = { id: 'b_mine', slug: 'mine', pages: [{ id: 'p', type: 'cover' }], outline: 'japan-alps' };
    expect(isOutline(mine)).toBe(false); // a stored brochure is never mistaken for an outline
    expect(peekBrochure(mine)).toBe(mine);
    await expect(loadBrochure(mine)).resolves.toBe(mine);
    await expect(loadBrochure(null)).resolves.toBeNull();
    expect(() => preloadBrochure(undefined)).not.toThrow();
  });

  it('useFullBrochure suspends until the pages are in, then renders them', async () => {
    const outline = BUILTINS.find((b) => b.slug === 'okinawa-coral-islands');
    function Pages() {
      const full = useFullBrochure(outline);
      return <p>{full.pages.find((p) => typeof p.body === 'string')?.body.slice(0, 20)}</p>;
    }
    await act(async () => {
      render(
        <Suspense fallback={<p>Loading</p>}>
          <Pages />
        </Suspense>,
      );
    });
    const full = BROCHURES.find((b) => b.slug === 'okinawa-coral-islands');
    expect(await screen.findByText(full.pages.find((p) => typeof p.body === 'string').body.slice(0, 20))).toBeInTheDocument();
  });
});
