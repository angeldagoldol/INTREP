import { useSyncExternalStore } from 'react';
import { livePhotosEnabled, setLivePhotosEnabled, subscribeLivePhotosSetting } from '../../data/photos/liveSetting.js';

/**
 * The visitor's "Load photos from Wikimedia Commons" setting (on by default,
 * remembered on this device, synced across tabs): `[enabled, setEnabled]`.
 * Safe for the app entry (the footer): it does not load the photo registry.
 */
export function useLivePhotosSetting() {
  const enabled = useSyncExternalStore(subscribeLivePhotosSetting, livePhotosEnabled, livePhotosEnabled);
  return [enabled, setLivePhotosEnabled];
}
