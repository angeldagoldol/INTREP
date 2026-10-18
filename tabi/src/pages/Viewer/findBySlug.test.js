import { describe, expect, it } from 'vitest';
import { BROCHURES } from '../../data/brochures.js';
import { findBySlug } from './findBySlug.js';

describe('findBySlug', () => {
  it('finds a brochure by its slug', () => {
    expect(findBySlug(BROCHURES, 'kyoto-thousand-gates')?.slug).toBe('kyoto-thousand-gates');
  });

  it('ignores letter case in typed or shared links', () => {
    expect(findBySlug(BROCHURES, 'KYOTO-THOUSAND-GATES')?.slug).toBe('kyoto-thousand-gates');
    expect(findBySlug(BROCHURES, 'Tokyo-After-Dark')?.slug).toBe('tokyo-after-dark');
  });

  it('matches non-Latin slugs in either Unicode form', () => {
    const list = [{ id: 'u1', slug: 'café-京都' }];
    expect(findBySlug(list, 'café-京都')).toBe(list[0]);
  });

  it('prefers the exact match', () => {
    const list = [
      { id: 'a', slug: 'Mixed' },
      { id: 'b', slug: 'mixed' },
    ];
    expect(findBySlug(list, 'mixed').id).toBe('b');
  });

  it('returns null for unknown or empty slugs and bad input', () => {
    expect(findBySlug(BROCHURES, 'nope')).toBeNull();
    expect(findBySlug(BROCHURES, '')).toBeNull();
    expect(findBySlug(null, 'kyoto-thousand-gates')).toBeNull();
    expect(findBySlug([null, { slug: 7 }, { slug: '' }], '7')).toBeNull();
  });
});
