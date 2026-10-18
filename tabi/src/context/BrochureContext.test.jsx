import { act, renderHook } from '@testing-library/react';
import { BUILTINS as BROCHURES, isOutline } from '../data/catalog.js';
import { BROCHURES as FULL } from '../data/brochures.js';
import { BrochureProvider, sanitizeIds, sanitizeUserBrochures, useBrochures } from './BrochureContext.jsx';

const wrapper = ({ children }) => <BrochureProvider>{children}</BrochureProvider>;
const stored = (key) => JSON.parse(window.localStorage.getItem(`tabi:${key}`));
const draft = (overrides = {}) => ({
  title: 'Slow Weekend in Kinosaki',
  slug: '',
  pages: [{ id: 'p1', type: 'cover', title: 'Kinosaki' }],
  ...overrides,
});

function setup() {
  return renderHook(() => useBrochures(), { wrapper });
}

describe('BrochureContext', () => {
  it('starts with the built-in library and nothing of the visitor’s own', () => {
    const { result } = setup();
    expect(result.current.builtins).toBe(BROCHURES);
    expect(result.current.brochures).toHaveLength(BROCHURES.length);
    expect(result.current.userBrochures).toEqual([]);
    expect(result.current.favoriteIds).toEqual([]);
    expect(result.current.recentIds).toEqual([]);
    expect(result.current.getBySlug('kyoto-thousand-gates')?.title).toBeTruthy();
    expect(result.current.getBySlug('nope')).toBeNull();
    expect(result.current.getById(BROCHURES[0].id)).toBe(BROCHURES[0]);
  });

  it('holds the built-ins as outlines of the full brochures, in the same order', () => {
    const { result } = setup();
    expect(result.current.builtins.map((b) => b.slug)).toEqual(FULL.map((b) => b.slug));
    result.current.builtins.forEach((b, i) => {
      expect(isOutline(b)).toBe(true);
      expect(b.title).toBe(FULL[i].title);
      expect(b.pages.map((p) => p.id)).toEqual(FULL[i].pages.map((p) => p.id));
    });
  });

  it('throws a helpful error outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useBrochures())).toThrow(/BrochureProvider/);
    spy.mockRestore();
  });

  describe('saveBrochure', () => {
    it('creates a user brochure with an id, slug, source and reading time, and persists it', () => {
      const { result } = setup();
      let saved;
      act(() => {
        saved = result.current.saveBrochure(draft());
      });
      expect(saved.id).toMatch(/^b_/);
      expect(saved.slug).toBe('slow-weekend-in-kinosaki');
      expect(saved.source).toBe('user');
      expect(saved.readMinutes).toBeGreaterThanOrEqual(1);
      expect(Number.isNaN(Date.parse(saved.updatedAt))).toBe(false);

      expect(result.current.userBrochures).toHaveLength(1);
      expect(result.current.brochures[0]).toEqual(saved); // user brochures come first
      expect(result.current.getBySlug(saved.slug)).toEqual(saved);
      expect(stored('brochures')).toEqual([saved]);
    });

    it('never reuses a slug, including a built-in one', () => {
      const { result } = setup();
      let a;
      let b;
      act(() => {
        a = result.current.saveBrochure(draft({ title: 'Kyoto', slug: 'kyoto-thousand-gates' }));
      });
      act(() => {
        b = result.current.saveBrochure(draft({ title: 'Kyoto', slug: 'kyoto-thousand-gates' }));
      });
      expect(a.slug).toBe('kyoto-thousand-gates-2');
      expect(b.slug).toBe('kyoto-thousand-gates-3');
    });

    it('updates an existing user brochure in place, keeping its id and slug', () => {
      const { result } = setup();
      let first;
      act(() => {
        first = result.current.saveBrochure(draft());
      });
      let second;
      act(() => {
        second = result.current.saveBrochure({ ...first, title: 'A Slower Weekend' });
      });
      expect(second.id).toBe(first.id);
      expect(second.slug).toBe(first.slug);
      expect(result.current.userBrochures).toHaveLength(1);
      expect(result.current.getById(first.id).title).toBe('A Slower Weekend');
    });

    it('gives a remixed built-in a fresh id instead of shadowing the original', () => {
      const { result } = setup();
      const original = BROCHURES[0];
      let saved;
      act(() => {
        saved = result.current.saveBrochure({ ...original });
      });
      expect(saved.id).not.toBe(original.id);
      expect(saved.slug).not.toBe(original.slug);
      expect(result.current.getById(original.id)).toBe(original);
    });

    it('falls back to "untitled" when a draft has neither slug nor title', () => {
      const { result } = setup();
      let saved;
      act(() => {
        saved = result.current.saveBrochure({ pages: [] });
      });
      expect(saved.slug).toBe('untitled');
    });
  });

  describe('when storage refuses the write (full quota)', () => {
    const failBrochureWrites = () => {
      const original = Storage.prototype.setItem;
      return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(key, value) {
        if (key === 'tabi:brochures') throw new DOMException('Quota exceeded', 'QuotaExceededError');
        return original.call(this, key, value);
      });
    };

    it('saveBrochure returns null and changes nothing (regression: it claimed success)', () => {
      const { result } = setup();
      const spy = failBrochureWrites();
      let saved;
      act(() => {
        saved = result.current.saveBrochure(draft());
      });
      spy.mockRestore();
      expect(saved).toBeNull();
      expect(result.current.userBrochures).toEqual([]);
      expect(window.localStorage.getItem('tabi:brochures')).toBeNull();
    });

    it('deleteBrochure returns false and keeps the brochure, its favourite and its history', () => {
      const { result } = setup();
      let saved;
      act(() => {
        saved = result.current.saveBrochure(draft());
      });
      act(() => {
        result.current.toggleFavorite(saved.id);
        result.current.markViewed(saved.id);
      });
      const spy = failBrochureWrites();
      let deleted;
      act(() => {
        deleted = result.current.deleteBrochure(saved.id);
      });
      spy.mockRestore();
      expect(deleted).toBe(false);
      expect(result.current.getById(saved.id)).toEqual(saved);
      expect(result.current.favoriteIds).toEqual([saved.id]);
      expect(result.current.recentIds).toEqual([saved.id]);
      expect(stored('brochures')).toEqual([saved]);
    });
  });

  it('keeps back-to-back saves in the same tick distinct and both persisted', () => {
    const { result } = setup();
    let a;
    let b;
    act(() => {
      a = result.current.saveBrochure(draft());
      b = result.current.saveBrochure(draft());
    });
    expect(a.slug).toBe('slow-weekend-in-kinosaki');
    expect(b.slug).toBe('slow-weekend-in-kinosaki-2');
    expect(result.current.userBrochures.map((x) => x.id)).toEqual([b.id, a.id]);
    expect(stored('brochures').map((x) => x.id)).toEqual([b.id, a.id]);
  });

  it('deleteBrochure removes the brochure and forgets it in favourites and history', () => {
    const { result } = setup();
    let saved;
    act(() => {
      saved = result.current.saveBrochure(draft());
    });
    act(() => {
      result.current.toggleFavorite(saved.id);
      result.current.markViewed(saved.id);
      result.current.markViewed(BROCHURES[0].id);
    });
    let deleted;
    act(() => {
      deleted = result.current.deleteBrochure(saved.id);
    });

    expect(deleted).toBe(true);
    expect(result.current.userBrochures).toEqual([]);
    expect(result.current.favoriteIds).toEqual([]);
    expect(result.current.recentIds).toEqual([BROCHURES[0].id]);
    expect(stored('brochures')).toEqual([]);
    expect(stored('favorites')).toEqual([]);
    expect(stored('recent')).toEqual([BROCHURES[0].id]);
  });

  it('toggleFavorite adds newest first, removes on the second call and persists', () => {
    const { result } = setup();
    const [a, b] = BROCHURES;
    act(() => result.current.toggleFavorite(a.id));
    act(() => result.current.toggleFavorite(b.id));
    expect(result.current.favoriteIds).toEqual([b.id, a.id]);
    expect(result.current.isFavorite(a.id)).toBe(true);
    act(() => result.current.toggleFavorite(a.id));
    expect(result.current.isFavorite(a.id)).toBe(false);
    expect(stored('favorites')).toEqual([b.id]);
  });

  it('markViewed keeps a de-duplicated, most-recent-first history of eight', () => {
    const { result } = setup();
    const ids = BROCHURES.slice(0, 10).map((b) => b.id);
    ids.forEach((id) => act(() => result.current.markViewed(id)));
    expect(result.current.recentIds).toEqual(ids.slice(2).reverse());
    act(() => result.current.markViewed(ids[5]));
    expect(result.current.recentIds[0]).toBe(ids[5]);
    expect(result.current.recentIds.filter((id) => id === ids[5])).toHaveLength(1);
    expect(result.current.recentIds).toHaveLength(8);
    expect(stored('recent')).toEqual(result.current.recentIds);
  });

  it('survives corrupt storage', () => {
    window.localStorage.setItem('tabi:brochures', '{"not":"a list"}');
    window.localStorage.setItem('tabi:favorites', 'oops not json');
    window.localStorage.setItem('tabi:recent', JSON.stringify([1, null, 'x', 'x']));
    const { result } = setup();
    expect(result.current.userBrochures).toEqual([]);
    expect(result.current.favoriteIds).toEqual([]);
    expect(result.current.recentIds).toEqual(['x']);
    expect(result.current.isFavorite('x')).toBe(false);
  });

  it('sanitises brochures read from storage before anything renders them', () => {
    const bad = { id: 'b_null', slug: 'nullpage', source: 'user', title: 'Null', seasons: ['constructor'], pages: [null, { id: 'x', type: 'intro' }] };
    window.localStorage.setItem('tabi:brochures', JSON.stringify([bad]));
    const { result } = setup();
    const [loaded] = result.current.userBrochures;
    expect(loaded.pages).toEqual([{ id: 'x', type: 'intro' }]);
    expect(loaded.seasons).toEqual([]);
  });

  it('picks up changes made in another tab', () => {
    const { result } = setup();
    const other = { id: 'b_other', slug: 'from-another-tab', title: 'Elsewhere', pages: [{ id: 'p1', type: 'cover' }], source: 'user' };
    window.localStorage.setItem('tabi:brochures', JSON.stringify([other]));
    window.localStorage.setItem('tabi:favorites', JSON.stringify(['b_other']));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'tabi:brochures', storageArea: window.localStorage }));
      window.dispatchEvent(new StorageEvent('storage', { key: 'tabi:favorites', storageArea: window.localStorage }));
    });
    expect(result.current.getBySlug('from-another-tab')).toEqual(other);
    expect(result.current.isFavorite('b_other')).toBe(true);
  });
});

describe('storage sanitizers', () => {
  it('keeps only brochure-shaped records with at least one readable page', () => {
    const ok = { id: 'b_1', slug: 'ok', pages: [{ id: 'p', type: 'cover' }] };
    const page = [{ id: 'p', type: 'cover' }];
    const junk = [null, { id: 1, slug: 's', pages: page }, { id: 'b_2', slug: 'x' }, { id: 'b_3', slug: 'empty', pages: [] }, 'junk'];
    expect(sanitizeUserBrochures([ok, ...junk])).toEqual([ok]);
    expect(sanitizeUserBrochures('nope')).toEqual([]);
  });

  it('returns valid records unchanged, key order included', () => {
    const [kyoto] = BROCHURES;
    const record = { ...kyoto, id: 'b_mine', slug: 'mine', source: 'user' };
    const [clean] = sanitizeUserBrochures([record]);
    expect(JSON.stringify(clean)).toBe(JSON.stringify(record));
  });

  it('normalises records that would crash the Library, Viewer or Studio (regression)', () => {
    const [clean] = sanitizeUserBrochures([
      {
        id: 'b_bad',
        slug: 'bad',
        title: { en: 'x' },
        seasons: ['constructor', 'winter', 'toString'],
        category: '__proto__',
        pages: [null, { id: 'x', type: 'intro' }, { id: 'y', type: 'constructor' }, { type: 'back' }],
      },
    ]);
    expect(clean.title).toBe('');
    expect(clean.seasons).toEqual(['winter']);
    expect(clean.category).toBe('heritage');
    expect(clean.pages).toEqual([{ id: 'x', type: 'intro' }]);
  });

  it('keeps unique, non-empty string ids', () => {
    expect(sanitizeIds(['a', 'a', '', 3, null, 'b'])).toEqual(['a', 'b']);
    expect(sanitizeIds({})).toEqual([]);
  });
});
