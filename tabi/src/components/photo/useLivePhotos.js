import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { creditsFor, getPhoto, isUserPhotoId, listPhotos, livePhotos, photoIdsIn, photosSnapshot, resolvePhoto, subscribePhotos } from '../../data/photos/index.js';

/** The ids the live resolver knows (manifest slots without a bundled photo), once each, as one string key. */
function liveKey(ids) {
  const seen = new Set();
  for (const raw of Array.isArray(ids) ? ids : [ids]) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (id && !isUserPhotoId(id) && livePhotos.has(id)) seen.add(id);
  }
  return [...seen].join('\n');
}

/** What a snapshot says, plus registry lookups whose identity changes with it (so memos that use them recompute). */
function view(snapshot) {
  const [flags, codes = ''] = snapshot.slice(snapshot.indexOf('|') + 1).split(':');
  let loading = 0;
  let ready = 0;
  let failed = 0;
  for (const code of codes) {
    if (code === 'l' || code === 'i') loading += 1;
    else if (code === 'r') ready += 1;
    else if (code === 'f') failed += 1;
  }
  return {
    getPhoto: (id) => getPhoto(id),
    resolvePhoto: (id, brochure) => resolvePhoto(id, brochure),
    creditsFor: (brochure) => creditsFor(brochure),
    listPhotos: () => listPhotos(),
    /** Slots still being looked up (or about to be), found, and found to have no usable photo. */
    loading,
    ready,
    failed,
    /** The visitor's "Load photos from Wikimedia Commons" setting. */
    enabled: flags[0] === '1',
    /** Commons could not be reached this session (offline, blocked): the art stays. */
    blocked: flags[1] === '1',
  };
}

/**
 * Live photos (data/photos/live.js) for these photo ids: asks for the ones
 * not bundled with the site — ids asked for in the same tick, from any
 * component, go to Commons together — and re-renders when any of them
 * resolves. Returns `{ getPhoto, resolvePhoto, creditsFor, listPhotos,
 * loading, ready, failed, enabled, blocked }`: use those lookups (or the
 * returned object as a memo dependency) so what you draw follows the photos.
 *
 *   const live = useLivePhotos(photoIdsIn(brochure));
 *   const credits = useMemo(() => live.creditsFor(brochure), [live, brochure]);
 *
 * User uploads ("user:<key>") and bundled photos never involve the network.
 */
export function useLivePhotos(ids) {
  const key = liveKey(ids);
  const snapshot = useSyncExternalStore(
    subscribePhotos,
    () => photosSnapshot(key),
    () => photosSnapshot(key),
  );
  useEffect(() => {
    if (key) livePhotos.request(key.split('\n'));
  }, [key]);
  return useMemo(() => view(snapshot), [snapshot]);
}

/**
 * Asks for live photos without re-rendering when they arrive: a page that
 * knows every photo it will show (a brochure, the Home page) calls it once,
 * so they go out as one batch even though only some slots are drawn yet.
 */
export function useRequestLivePhotos(ids) {
  const key = liveKey(ids);
  useEffect(() => {
    if (key) livePhotos.request(key.split('\n'));
  }, [key]);
}

/** creditsFor(brochure) that includes live photos as they resolve (back page, "About this brochure"). */
export function useLiveCredits(brochure) {
  const ids = useMemo(() => photoIdsIn(brochure), [brochure]);
  const live = useLivePhotos(ids);
  return useMemo(() => live.creditsFor(brochure), [live, brochure]);
}

/** Tell the resolver how a live image fared (three failures before any success stop live images for the session). */
export function reportLiveImage(record, ok) {
  if (!record?.live) return;
  if (ok) livePhotos.reportImageLoad(record.id);
  else livePhotos.reportImageError(record.id);
}
