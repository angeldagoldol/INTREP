/**
 * The Studio's document state: a brochure draft, the selected page and an
 * undo/redo history. Pure — ids and timestamps arrive on the actions (see the
 * creators at the bottom), so every transition is deterministic and testable.
 *
 * History entries are { doc, selectedId } snapshots, so undo also brings the
 * editor back to the page where the change happened. Rapid typing into one
 * field (actions flagged `typing`) coalesces into a single undo step.
 */
import { spanOf } from '../../data/photoSpreads.js';
import { fixSpreadPlacement, moveSpread } from '../../data/photoSpreadEdits.js';
import { PAGE_TYPES } from '../../data/schema.js';
import { listLimit } from './pageLimits.js';

export const HISTORY_LIMIT = 50;
/** Typing pauses longer than this start a new undo step. */
export const COALESCE_MS = 1000;

const DOC_FIELDS = new Set([
  'title',
  'titleJp',
  'subtitle',
  'organization',
  'summary',
  'category',
  'region',
  'seasons',
  'format',
  'tags',
  'factsChecked',
]);
/** Brochure fields edited by path (updateDoc): the real place it is about, and its sources. */
const DOC_PATH_ROOTS = new Set(['location', 'sources']);
/** Brochure-level lists edited with addDocItem / removeDocItem / moveDocItem. */
export const DOC_LIST_LIMITS = { sources: { min: 0, max: 12 } };
/** Keys of brochure.userPhotos (pages refer to them as "user:<key>"). */
const PHOTO_KEY = /^[A-Za-z0-9_-]{1,40}$/;
/** Fields of an upload the editor may change (src, size and key are fixed). */
const USER_PHOTO_FIELDS = new Set(['alt', 'caption', 'focus', 'credit']);
const THEME_FIELDS = new Set(['paper', 'ink', 'accent', 'accent2', 'muted', 'typeface']);
const LOCKED_PAGE_KEYS = new Set(['id', 'type', 'span']);
/** Fields the two halves of a photo spread share: setting one on either half sets both. */
const SPREAD_SHARED_KEYS = new Set(['photo', 'captionPlacement', 'creditPlacement']);

/** Fresh state for a document; history starts empty. */
export function createStudioState(doc, selectedId) {
  const pages = doc?.pages ?? [];
  const selected = pages.some((p) => p.id === selectedId) ? selectedId : (pages[0]?.id ?? null);
  return { doc, selectedId: selected, past: [], future: [], last: null };
}

/* --- Immutable path helpers --------------------------------------------- */

export function getIn(target, path) {
  return path.reduce((node, key) => (node == null ? undefined : node[key]), target);
}

/** Set `value` at `path`, copying only the containers along the way. */
export function setIn(target, path, value) {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  const copy = Array.isArray(target) ? [...target] : { ...(target ?? {}) };
  copy[head] = setIn(target?.[head], rest, value);
  return copy;
}

function moveIndex(list, from, to) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/* --- Commit with history ------------------------------------------------- */

function commit(state, doc, { selectedId = state.selectedId, key = null, at = 0 } = {}) {
  if (doc === state.doc) return selectedId === state.selectedId ? state : { ...state, selectedId };
  const coalesce = key !== null && state.last?.key === key && at - state.last.at <= COALESCE_MS;
  const past = coalesce
    ? state.past
    : [...state.past, { doc: state.doc, selectedId: state.selectedId }].slice(-HISTORY_LIMIT);
  return { doc, selectedId, past, future: [], last: key === null ? null : { key, at } };
}

function withPages(state, pages) {
  return { ...state.doc, pages };
}

function pageIndex(state, id) {
  return state.doc.pages.findIndex((p) => p.id === id);
}

/** Index of the other half of the photo spread page `index` is half of — beside it, whichever side it is bound on — or -1. */
function adjacentHalf(pages, index) {
  const span = spanOf(pages[index]);
  if (span === 'left') return spanOf(pages[index + 1]) === 'right' ? index + 1 : -1;
  if (span === 'right') return spanOf(pages[index - 1]) === 'left' ? index - 1 : -1;
  return -1;
}

/** `pages` with a shared spread field (photo, placements) copied from page `index` to its other half. */
function syncSpread(pages, index, key) {
  const other = adjacentHalf(pages, index);
  if (other === -1 || !SPREAD_SHARED_KEYS.has(key) || Object.is(pages[other][key], pages[index][key])) return pages;
  const next = [...pages];
  next[other] = { ...pages[other], [key]: pages[index][key] };
  return next;
}

/** Where a new page goes: after the selection, but never after a closing back cover. */
function insertionIndex(pages, selectedId) {
  const selected = pages.findIndex((p) => p.id === selectedId);
  let index = selected === -1 ? pages.length : selected + 1;
  if (index === pages.length && pages[pages.length - 1]?.type === 'back') index -= 1;
  return Math.max(0, index);
}

function updatePageAt(state, id, updater) {
  const index = pageIndex(state, id);
  if (index === -1) return null;
  const page = state.doc.pages[index];
  const nextPage = updater(page);
  if (!nextPage || nextPage === page) return null;
  const pages = [...state.doc.pages];
  pages[index] = nextPage;
  return withPages(state, pages);
}

function docListLimit(path) {
  return DOC_LIST_LIMITS[path?.[0]] ?? null;
}

/**
 * Put photo `id` where `target` says:
 *   { kind: 'cover', pageId? }  brochure.cover.photo (cards, cover and back page); a cover
 *                               page's own `photo` is removed, so one value drives them all
 *   { kind: 'page', id, path }  a page field ending in 'photo' (['photo'], ['items', 2, 'photo'])
 * Returns the same doc when nothing changes or the target is invalid.
 */
function placePhotoIn(doc, target, id) {
  const value = typeof id === 'string' ? id.trim() : '';
  if (target?.kind === 'cover') {
    let next = doc;
    if ((doc.cover?.photo ?? '') !== value) next = { ...doc, cover: { ...doc.cover, photo: value } };
    const index = target.pageId ? doc.pages.findIndex((p) => p.id === target.pageId && p.type === 'cover') : -1;
    if (index !== -1 && 'photo' in doc.pages[index]) {
      const { photo: _own, ...page } = doc.pages[index];
      const pages = [...doc.pages];
      pages[index] = page;
      next = { ...next, pages };
    }
    return next;
  }
  if (target?.kind === 'page') {
    const path = target.path ?? [];
    if (path.length === 0 || path.at(-1) !== 'photo' || LOCKED_PAGE_KEYS.has(path[0])) return doc;
    const index = doc.pages.findIndex((p) => p.id === target.id);
    if (index === -1) return doc;
    const page = doc.pages[index];
    if (path.length > 1 && getIn(page, path.slice(0, -1)) == null) return doc;
    if (Object.is(getIn(page, path), value)) return doc;
    const pages = [...doc.pages];
    pages[index] = setIn(page, path, value);
    // A spread is one picture: its other half shows the same photo.
    return { ...doc, pages: path.length === 1 ? syncSpread(pages, index, 'photo') : pages };
  }
  return doc;
}

/** Where the editor should land after a photo change: the page it was placed on. */
function photoSelection(state, target) {
  if (target?.kind === 'page') return target.id;
  if (target?.kind === 'cover' && target.pageId) return target.pageId;
  return state.selectedId;
}

/** `doc` with every use of photo `id` (cover, pages, items) cleared. */
function clearPhotoUses(doc, id) {
  let next = doc;
  if (doc.cover?.photo === id) next = { ...next, cover: { ...doc.cover, photo: '' } };
  let pagesChanged = false;
  const pages = doc.pages.map((page) => {
    let out = page;
    if (page.photo === id) out = { ...out, photo: '' };
    if (Array.isArray(page.items) && page.items.some((item) => item?.photo === id)) {
      out = { ...out, items: page.items.map((item) => (item?.photo === id ? { ...item, photo: '' } : item)) };
    }
    if (out !== page) pagesChanged = true;
    return out;
  });
  return pagesChanged ? { ...next, pages } : next;
}

/* --- Reducer -------------------------------------------------------------- */

export function studioReducer(state, action) {
  const at = action.at ?? 0;
  switch (action.type) {
    case 'load':
      return createStudioState(action.doc, action.selectedId);

    case 'select':
      return state.doc.pages.some((p) => p.id === action.id) ? { ...state, selectedId: action.id, last: null } : state;

    case 'setField': {
      if (!DOC_FIELDS.has(action.field) || Object.is(state.doc[action.field], action.value)) return state;
      const key = action.typing ? `field:${action.field}` : null;
      return commit(state, { ...state.doc, [action.field]: action.value }, { key, at });
    }

    case 'setTheme': {
      if (!THEME_FIELDS.has(action.field) || state.doc.theme?.[action.field] === action.value) return state;
      const key = action.typing ? `theme:${action.field}` : null;
      return commit(state, { ...state.doc, theme: { ...state.doc.theme, [action.field]: action.value } }, { key, at });
    }

    case 'applyPalette': {
      const theme = { ...state.doc.theme, ...action.theme };
      const same = Object.keys(theme).every((k) => theme[k] === state.doc.theme?.[k]);
      return same ? state : commit(state, { ...state.doc, theme }, { at });
    }

    case 'setCover': {
      const cover = { ...state.doc.cover };
      if (action.art !== undefined) cover.art = action.art;
      if (action.seed !== undefined) cover.seed = action.seed;
      if (cover.art === state.doc.cover?.art && cover.seed === state.doc.cover?.seed) return state;
      return commit(state, { ...state.doc, cover }, { at });
    }

    case 'addPage': {
      if (!action.page?.id || !PAGE_TYPES[action.page.type]) return state;
      if (pageIndex(state, action.page.id) !== -1) return state;
      const pages = [...state.doc.pages];
      const index = Number.isInteger(action.index)
        ? clamp(action.index, 0, pages.length)
        : insertionIndex(pages, state.selectedId);
      pages.splice(index, 0, action.page);
      return commit(state, withPages(state, pages), { selectedId: action.page.id, at });
    }

    case 'addPages': {
      // Several pages as one step (the two halves of a photo spread).
      const added = Array.isArray(action.pages) ? action.pages : [];
      const ids = new Set(added.map((p) => p?.id));
      if (!added.length || ids.size !== added.length || added.some((p) => !p?.id || !PAGE_TYPES[p.type] || pageIndex(state, p.id) !== -1)) return state;
      const pages = [...state.doc.pages];
      const index = Number.isInteger(action.index) ? clamp(action.index, 0, pages.length) : insertionIndex(pages, state.selectedId);
      pages.splice(index, 0, ...added);
      return commit(state, withPages(state, pages), { selectedId: added[0].id, at });
    }

    case 'moveSpread': {
      const pages = moveSpread(state.doc.pages, pageIndex(state, action.id), action.dir);
      return pages === state.doc.pages ? state : commit(state, withPages(state, pages), { at });
    }

    case 'fixSpreads': {
      const pages = fixSpreadPlacement(state.doc.pages);
      return pages === state.doc.pages ? state : commit(state, withPages(state, pages), { at });
    }

    case 'duplicatePage': {
      const index = pageIndex(state, action.id);
      if (index === -1 || !action.newId || pageIndex(state, action.newId) !== -1) return state;
      const { span: _span, ...original } = state.doc.pages[index];
      // A copy of half a spread is a full-page photo of the same picture (a lone half has no other half).
      const copy = { ...structuredClone(original), id: action.newId };
      const pages = [...state.doc.pages];
      pages.splice(index + 1, 0, copy);
      return commit(state, withPages(state, pages), { selectedId: copy.id, at });
    }

    case 'removePage': {
      const index = pageIndex(state, action.id);
      if (index === -1 || state.doc.pages.length <= 1) return state;
      const pages = state.doc.pages.filter((p) => p.id !== action.id);
      const selectedId =
        state.selectedId === action.id ? pages[Math.min(index, pages.length - 1)].id : state.selectedId;
      return commit(state, withPages(state, pages), { selectedId, at });
    }

    case 'movePage': {
      const from = pageIndex(state, action.id);
      if (from === -1) return state;
      const to = clamp(action.to, 0, state.doc.pages.length - 1);
      if (to === from) return state;
      return commit(state, withPages(state, moveIndex(state.doc.pages, from, to)), { at });
    }

    case 'reorderPages': {
      const { pages } = state.doc;
      const ids = action.ids ?? [];
      const byId = new Map(pages.map((p) => [p.id, p]));
      const valid = ids.length === pages.length && new Set(ids).size === ids.length && ids.every((id) => byId.has(id));
      if (!valid || ids.every((id, i) => pages[i].id === id)) return state;
      return commit(state, withPages(state, ids.map((id) => byId.get(id))), { at });
    }

    case 'updatePage': {
      const path = action.path ?? [];
      if (path.length === 0 || LOCKED_PAGE_KEYS.has(path[0])) return state;
      const updated = updatePageAt(state, action.id, (page) =>
        Object.is(getIn(page, path), action.value) ? page : setIn(page, path, action.value),
      );
      if (!updated) return state;
      const doc = path.length === 1 ? { ...updated, pages: syncSpread(updated.pages, pageIndex(state, action.id), path[0]) } : updated;
      const key = action.typing ? `page:${action.id}:${path.join('.')}` : null;
      return commit(state, doc, { selectedId: action.id, key, at });
    }

    case 'mergePage': {
      const path = action.path ?? [];
      const patch = action.patch && typeof action.patch === 'object' && !Array.isArray(action.patch) ? action.patch : null;
      if (!patch || LOCKED_PAGE_KEYS.has(path[0]) || (path.length === 0 && Object.keys(patch).some((k) => LOCKED_PAGE_KEYS.has(k)))) return state;
      const doc = updatePageAt(state, action.id, (page) => {
        const target = path.length ? getIn(page, path) : page;
        if (!target || typeof target !== 'object' || Array.isArray(target)) return page;
        if (Object.entries(patch).every(([k, v]) => Object.is(target[k], v))) return page;
        return path.length ? setIn(page, path, { ...target, ...patch }) : { ...page, ...patch };
      });
      if (!doc) return state;
      const key = action.typing ? `page:${action.id}:${path.join('.')}:{${Object.keys(patch).sort().join(',')}}` : null;
      return commit(state, doc, { selectedId: action.id, key, at });
    }

    case 'addItem': {
      const doc = updatePageAt(state, action.id, (page) => {
        const list = getIn(page, action.path);
        const items = Array.isArray(list) ? list : [];
        if (items.length >= listLimit(page.type, action.path).max) return page;
        const index = Number.isInteger(action.index) ? clamp(action.index, 0, items.length) : items.length;
        const next = [...items];
        next.splice(index, 0, action.item);
        return setIn(page, action.path, next);
      });
      return doc ? commit(state, doc, { selectedId: action.id, at }) : state;
    }

    case 'removeItem': {
      const doc = updatePageAt(state, action.id, (page) => {
        const list = getIn(page, action.path);
        if (!Array.isArray(list) || action.index < 0 || action.index >= list.length) return page;
        if (list.length <= listLimit(page.type, action.path).min) return page;
        return setIn(page, action.path, list.filter((_, i) => i !== action.index));
      });
      return doc ? commit(state, doc, { selectedId: action.id, at }) : state;
    }

    case 'moveItem': {
      const doc = updatePageAt(state, action.id, (page) => {
        const list = getIn(page, action.path);
        if (!Array.isArray(list) || action.from < 0 || action.from >= list.length) return page;
        const to = clamp(action.to, 0, list.length - 1);
        return to === action.from ? page : setIn(page, action.path, moveIndex(list, action.from, to));
      });
      return doc ? commit(state, doc, { selectedId: action.id, at }) : state;
    }

    case 'updateDoc': {
      const path = action.path ?? [];
      if (!DOC_PATH_ROOTS.has(path[0])) return state;
      if (path.length === 1 && action.value == null) {
        if (!(path[0] in state.doc)) return state;
        const { [path[0]]: _removed, ...doc } = state.doc;
        return commit(state, doc, { at });
      }
      // List entries are edited in place; adding them is addDocItem's job.
      if (docListLimit(path) && (path.length < 3 || getIn(state.doc, path.slice(0, 2)) == null)) return state;
      if (Object.is(getIn(state.doc, path), action.value)) return state;
      const key = action.typing ? `doc:${path.join('.')}` : null;
      return commit(state, setIn(state.doc, path, action.value), { key, at });
    }

    case 'addDocItem': {
      const limit = docListLimit(action.path);
      if (!limit || action.path.length !== 1) return state;
      const list = Array.isArray(state.doc[action.path[0]]) ? state.doc[action.path[0]] : [];
      if (list.length >= limit.max) return state;
      const index = Number.isInteger(action.index) ? clamp(action.index, 0, list.length) : list.length;
      const next = [...list];
      next.splice(index, 0, action.item);
      return commit(state, { ...state.doc, [action.path[0]]: next }, { at });
    }

    case 'removeDocItem': {
      const limit = docListLimit(action.path);
      const list = limit ? state.doc[action.path[0]] : null;
      if (!Array.isArray(list) || action.index < 0 || action.index >= list.length || list.length <= limit.min) return state;
      return commit(state, { ...state.doc, [action.path[0]]: list.filter((_, i) => i !== action.index) }, { at });
    }

    case 'moveDocItem': {
      const list = docListLimit(action.path) ? state.doc[action.path[0]] : null;
      if (!Array.isArray(list) || action.from < 0 || action.from >= list.length) return state;
      const to = clamp(action.to, 0, list.length - 1);
      if (to === action.from) return state;
      return commit(state, { ...state.doc, [action.path[0]]: moveIndex(list, action.from, to) }, { at });
    }

    case 'placePhoto': {
      const doc = placePhotoIn(state.doc, action.target, action.id);
      return doc === state.doc ? state : commit(state, doc, { selectedId: photoSelection(state, action.target), at });
    }

    case 'addUserPhoto': {
      const { key, photo } = action;
      const existing = state.doc.userPhotos;
      if (typeof key !== 'string' || !PHOTO_KEY.test(key) || !photo || typeof photo.src !== 'string') return state;
      if (existing && Object.hasOwn(existing, key)) return state;
      const withPhoto = { ...state.doc, userPhotos: { ...(existing ?? {}), [key]: photo } };
      // One step: the upload and where it was placed undo together.
      const doc = action.target ? placePhotoIn(withPhoto, action.target, `user:${key}`) : withPhoto;
      return commit(state, doc, { selectedId: photoSelection(state, action.target), at });
    }

    case 'updateUserPhoto': {
      const path = action.path ?? [];
      const photos = state.doc.userPhotos;
      if (!photos || !Object.hasOwn(photos, action.key) || !USER_PHOTO_FIELDS.has(path[0])) return state;
      const entry = photos[action.key];
      if (Object.is(getIn(entry, path), action.value)) return state;
      const userPhotos = { ...photos, [action.key]: setIn(entry, path, action.value) };
      const key = action.typing ? `photo:${action.key}:${path.join('.')}` : null;
      return commit(state, { ...state.doc, userPhotos }, { key, at });
    }

    case 'removeUserPhoto': {
      const photos = state.doc.userPhotos;
      if (!photos || !Object.hasOwn(photos, action.key)) return state;
      const { [action.key]: _removed, ...rest } = photos;
      const cleared = clearPhotoUses(state.doc, `user:${action.key}`);
      const { userPhotos: _old, ...doc } = cleared;
      return commit(state, Object.keys(rest).length ? { ...doc, userPhotos: rest } : doc, { at });
    }

    case 'replaceDoc': {
      if (!action.doc || !Array.isArray(action.doc.pages)) return state;
      const { pages } = action.doc;
      const keep = pages.some((p) => p.id === (action.selectedId ?? state.selectedId));
      const selectedId = keep ? (action.selectedId ?? state.selectedId) : (pages[0]?.id ?? null);
      return commit(state, action.doc, { selectedId, at });
    }

    case 'undo': {
      if (state.past.length === 0) return state;
      const entry = state.past[state.past.length - 1];
      return {
        doc: entry.doc,
        selectedId: entry.selectedId,
        past: state.past.slice(0, -1),
        future: [{ doc: state.doc, selectedId: state.selectedId }, ...state.future].slice(0, HISTORY_LIMIT),
        last: null,
      };
    }

    case 'redo': {
      if (state.future.length === 0) return state;
      const [entry, ...future] = state.future;
      return {
        doc: entry.doc,
        selectedId: entry.selectedId,
        past: [...state.past, { doc: state.doc, selectedId: state.selectedId }].slice(-HISTORY_LIMIT),
        future,
        last: null,
      };
    }

    default:
      return state;
  }
}

/* --- Action creators -------------------------------------------------------
 * The UI dispatches these through a wrapper that stamps `at: Date.now()`.  */

export const studioActions = {
  load: (doc, selectedId) => ({ type: 'load', doc, selectedId }),
  select: (id) => ({ type: 'select', id }),
  setField: (field, value, typing = false) => ({ type: 'setField', field, value, typing }),
  setTheme: (field, value, typing = false) => ({ type: 'setTheme', field, value, typing }),
  applyPalette: (theme) => ({ type: 'applyPalette', theme }),
  setCover: (cover) => ({ type: 'setCover', ...cover }),
  addPage: (page, index) => ({ type: 'addPage', page, index }),
  /** Several new pages in one undo step, inserted together at `index` (the halves of a photo spread). */
  addPages: (pages, index) => ({ type: 'addPages', pages, index }),
  /** Move the photo spread page `id` belongs to — both halves — one spread earlier (-1) or later (+1). */
  moveSpread: (id, dir) => ({ type: 'moveSpread', id, dir }),
  /** Line up every double-page photo spread (data/photoSpreads.js fixSpreadPlacement). */
  fixSpreads: () => ({ type: 'fixSpreads' }),
  duplicatePage: (id, newId) => ({ type: 'duplicatePage', id, newId }),
  removePage: (id) => ({ type: 'removePage', id }),
  movePage: (id, to) => ({ type: 'movePage', id, to }),
  reorderPages: (ids) => ({ type: 'reorderPages', ids }),
  updatePage: (id, path, value, typing = false) => ({ type: 'updatePage', id, path, value, typing }),
  /** Several fields of one page (or of the object at `path` in it) at once: { lat, lng }. */
  mergePage: (id, path, patch, typing = false) => ({ type: 'mergePage', id, path, patch, typing }),
  addItem: (id, path, item, index) => ({ type: 'addItem', id, path, item, index }),
  removeItem: (id, path, index) => ({ type: 'removeItem', id, path, index }),
  moveItem: (id, path, from, to) => ({ type: 'moveItem', id, path, from, to }),
  replaceDoc: (doc, selectedId) => ({ type: 'replaceDoc', doc, selectedId }),
  /** Brochure-level fields by path: ['location', 'lat'], ['sources', 0, 'url']; ['location'] + null removes it. */
  updateDoc: (path, value, typing = false) => ({ type: 'updateDoc', path, value, typing }),
  addDocItem: (path, item, index) => ({ type: 'addDocItem', path, item, index }),
  removeDocItem: (path, index) => ({ type: 'removeDocItem', path, index }),
  moveDocItem: (path, from, to) => ({ type: 'moveDocItem', path, from, to }),
  /** Put a photo id (registry or "user:<key>", '' for none) on the cover or a page field. */
  placePhoto: (target, id) => ({ type: 'placePhoto', target, id }),
  /** Store an upload in brochure.userPhotos (and place it at `target`) as one undo step. */
  addUserPhoto: (key, photo, target) => ({ type: 'addUserPhoto', key, photo, target }),
  updateUserPhoto: (key, path, value, typing = false) => ({ type: 'updateUserPhoto', key, path, value, typing }),
  /** Delete an upload and clear every field that showed it. */
  removeUserPhoto: (key) => ({ type: 'removeUserPhoto', key }),
  undo: () => ({ type: 'undo' }),
  redo: () => ({ type: 'redo' }),
};
