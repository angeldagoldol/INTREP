import { describe, expect, it, vi } from 'vitest';
import { CHUNK_RELOAD_KEY, CHUNK_RELOAD_WINDOW, isChunkLoadError, reloadForChunk, shouldAutoReload } from './chunkError.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

const CHROME = new TypeError('Failed to fetch dynamically imported module: http://x/assets/Studio-ab12.js');

describe('isChunkLoadError', () => {
  it('recognises failed dynamic imports in every engine and Vite CSS preloads', () => {
    expect(isChunkLoadError(CHROME)).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: x.js'))).toBe(true);
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/Library-1.css'))).toBe(true);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(true);
  });

  it('ignores ordinary render errors', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false);
    expect(isChunkLoadError(new Error('Failed to fetch'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('shouldAutoReload', () => {
  const now = 1_000_000;

  it('reloads a chunk error once while online', () => {
    expect(shouldAutoReload(CHROME, { storage: memoryStorage(), now, online: true })).toBe(true);
  });

  it('does not reload again within the window, but does after it', () => {
    const storage = memoryStorage({ [CHUNK_RELOAD_KEY]: String(now - 1000) });
    expect(shouldAutoReload(CHROME, { storage, now, online: true })).toBe(false);
    expect(shouldAutoReload(CHROME, { storage, now: now + CHUNK_RELOAD_WINDOW, online: true })).toBe(true);
  });

  it('never reloads offline, without storage, or for other errors', () => {
    expect(shouldAutoReload(CHROME, { storage: memoryStorage(), now, online: false })).toBe(false);
    expect(shouldAutoReload(CHROME, { storage: null, now, online: true })).toBe(false);
    expect(shouldAutoReload(new Error('boom'), { storage: memoryStorage(), now, online: true })).toBe(false);
    const broken = { getItem: () => { throw new Error('denied'); } };
    expect(shouldAutoReload(CHROME, { storage: broken, now, online: true })).toBe(false);
  });
});

describe('reloadForChunk', () => {
  it('stamps the time, then reloads', () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    expect(reloadForChunk({ storage, now: 42, reload })).toBe(true);
    expect(storage.getItem(CHUNK_RELOAD_KEY)).toBe('42');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload when the stamp cannot be written (no loop)', () => {
    const reload = vi.fn();
    const storage = { setItem: () => { throw new Error('quota'); } };
    expect(reloadForChunk({ storage, now: 42, reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
