import { readStorage, removeStorage, writeStorage } from './storage.js';

describe('storage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('round-trips JSON under the tabi: prefix', () => {
    expect(writeStorage('prefs', { theme: 'dark', n: [1, 2] })).toBe(true);
    expect(window.localStorage.getItem('tabi:prefs')).toBe('{"theme":"dark","n":[1,2]}');
    expect(readStorage('prefs', null)).toEqual({ theme: 'dark', n: [1, 2] });
    removeStorage('prefs');
    expect(readStorage('prefs', 'fallback')).toBe('fallback');
  });

  it('returns the fallback for malformed JSON', () => {
    window.localStorage.setItem('tabi:broken', '{oops');
    expect(readStorage('broken', [])).toEqual([]);
  });

  it('degrades quietly when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(writeStorage('x', 1)).toBe(false);
    expect(readStorage('x', 'fallback')).toBe('fallback');
    expect(() => removeStorage('x')).not.toThrow();
  });
});
