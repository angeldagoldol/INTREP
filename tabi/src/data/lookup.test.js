import { describe, expect, it } from 'vitest';
import { byId, dict, hasKey } from './lookup.js';
import { CATEGORY_MAP, getCategory } from './categories.js';
import { REGION_MAP, getRegion } from './regions.js';
import { ART_LABELS, PAGE_TYPES, PAGE_TYPE_IDS } from './schema.js';
import { SEASON_MAP } from './seasons.js';

const PROTO_KEYS = ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'];

describe('lookup tables', () => {
  it('builds prototype-free tables that still enumerate and spread', () => {
    const table = byId([{ id: 'a' }, { id: 'b' }]);
    expect(Object.getPrototypeOf(table)).toBeNull();
    expect(Object.keys(table)).toEqual(['a', 'b']);
    expect({ ...dict({ x: 1 }) }).toEqual({ x: 1 });
    expect('a' in table).toBe(true);
  });

  it('hasKey only accepts own string keys', () => {
    const table = dict({ spring: 1 });
    expect(hasKey(table, 'spring')).toBe(true);
    expect(hasKey(table, ['spring'])).toBe(false);
    expect(hasKey(table, 'constructor')).toBe(false);
  });

  it.each(PROTO_KEYS)('finds nothing for "%s" in any id table (regression)', (key) => {
    for (const table of [CATEGORY_MAP, REGION_MAP, SEASON_MAP, PAGE_TYPES, ART_LABELS]) expect(table[key]).toBeUndefined();
    expect(getCategory(key).label).toBe(key);
    expect(getRegion(key).label).toBe(key);
  });

  it('keeps the page-type list intact', () => {
    expect(PAGE_TYPE_IDS).toEqual(['cover', 'intro', 'features', 'gallery', 'stats', 'agenda', 'place', 'pricing', 'phrases', 'quote', 'contact', 'photo', 'back']);
  });
});
