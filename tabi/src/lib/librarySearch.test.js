import { afterEach, describe, expect, it, vi } from 'vitest';
import { lastLibrarySearch, libraryPath, rememberLibrarySearch, resetLibrarySearchMemory } from './librarySearch.js';

afterEach(() => {
  resetLibrarySearchMemory();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('librarySearch', () => {
  it('points at the plain library until a view is remembered', () => {
    expect(lastLibrarySearch()).toBe('');
    expect(libraryPath()).toBe('/brochures');
  });

  it('returns to the last filtered view', () => {
    rememberLibrarySearch('?season=winter&sort=az&view=list');
    expect(libraryPath()).toBe('/brochures?season=winter&sort=az&view=list');
    rememberLibrarySearch('category=food');
    expect(lastLibrarySearch()).toBe('?category=food');
  });

  it('forgets the filters once the library is unfiltered again', () => {
    rememberLibrarySearch('?q=kyoto');
    rememberLibrarySearch('');
    expect(libraryPath()).toBe('/brochures');
  });

  it('survives a reload of the tab through sessionStorage', () => {
    rememberLibrarySearch('?region=kansai');
    resetLibrarySearchMemory();
    expect(lastLibrarySearch()).toBe('?region=kansai');
  });

  it('ignores junk and unavailable storage', () => {
    window.sessionStorage.setItem('tabi:library-search', '?q=x#/studio');
    expect(lastLibrarySearch()).toBe('');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => rememberLibrarySearch('?fav=1')).not.toThrow();
    expect(libraryPath()).toBe('/brochures?fav=1');
  });
});
