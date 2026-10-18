/**
 * Lookup tables keyed by ids that can arrive from user data (imported files,
 * localStorage, the URL). A plain object literal inherits `constructor`,
 * `toString`, `__proto__`… so `MAP[userValue]` would find a function for
 * those keys and every truthiness or `??` check on it would pass. These
 * tables have no prototype: only their own keys exist.
 */

/**
 * A prototype-free copy of `object`; `Object.keys`, spread and `in` work as usual.
 * Marked side-effect free so a table nobody reads is still tree-shaken: Rollup
 * otherwise keeps every `Object.assign` call (and the module around it, e.g.
 * the whole icon registry) in whichever chunk imports the module first.
 */
/* @__NO_SIDE_EFFECTS__ */
export function dict(object) {
  return Object.assign(Object.create(null), object);
}

/** `{ [item.id]: item }` for a list of records, without a prototype. */
/* @__NO_SIDE_EFFECTS__ */
export function byId(list) {
  return dict(Object.fromEntries(list.map((item) => [item.id, item])));
}

/** True when `key` is a string and one of the table's own keys. */
export function hasKey(table, key) {
  return typeof key === 'string' && Object.hasOwn(table, key);
}
