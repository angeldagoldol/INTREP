import { useEffect, useId, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleAlert, HardDrive, ImagePlus, LoaderCircle } from 'lucide-react';
import { Button } from '../../ui/index.js';
import { ease } from '../../../lib/motion.js';
import { createId } from '../../../lib/id.js';
import {
  ACCEPTED_TYPES,
  DEFAULT_CREDIT,
  MAX_EDGE,
  STORAGE_QUOTA_ESTIMATE,
  USER_PHOTO_BUDGET,
  altFromFileName,
  budgetCheck,
  buildUserPhoto,
  checkImageFile,
  downscaleImage,
  estimateStorageUse,
  formatBytes,
  newUserPhotoKey,
  userPhotosSize,
} from '../photoUpload.js';
import { TextField } from './TextField.jsx';
import { UrlField } from './UrlField.jsx';
import styles from './PhotoPicker.module.css';

/** The credit form shared by a new upload and an existing one. */
export function PhotoDetailsForm({ values, onChange }) {
  return (
    <div className={styles.form} data-native-undo="">
      <TextField
        label="Describe the photo"
        required
        multiline
        rows={2}
        max={200}
        value={values.alt}
        onChange={(v) => onChange('alt', v)}
        hint="Alt text, for people who can’t see it — what is in the picture?"
        placeholder="e.g. Red torii gates climbing a wooded hillside"
      />
      <TextField label="Caption" max={120} value={values.caption} onChange={(v) => onChange('caption', v)} hint="Optional — names the place, season or moment" />
      <div className={styles.formRow}>
        <TextField label="Credit" max={80} value={values.author} onChange={(v) => onChange('author', v)} hint="Who took it" placeholder={DEFAULT_CREDIT} />
        <TextField label="Licence" max={40} value={values.license} onChange={(v) => onChange('license', v)} hint="Optional, e.g. CC BY 4.0" />
      </div>
      <UrlField
        label="Where it comes from"
        value={values.sourceUrl}
        onChange={(v) => onChange('sourceUrl', v)}
        hint="Optional — the page you found it on. Only use photos you took or may reuse."
      />
    </div>
  );
}

/** "This brochure’s photos 1.2 MB of 3 MB" and the browser's storage, with warnings near the limits. */
function StorageMeter({ used, storage }) {
  const share = Math.min(1, used / USER_PHOTO_BUDGET);
  const storageShare = storage == null ? null : Math.min(1, storage / STORAGE_QUOTA_ESTIMATE);
  const tight = storageShare !== null && storageShare > 0.8;
  return (
    <div className={styles.meter} data-tight={tight || share > 0.85 || undefined}>
      <div className={styles.meterHead}>
        <HardDrive size={14} aria-hidden="true" />
        <span>
          This brochure’s photos: <strong>{formatBytes(used)}</strong> of {formatBytes(USER_PHOTO_BUDGET)}
        </span>
      </div>
      <div
        className={styles.bar}
        role="meter"
        aria-label="Storage used by this brochure’s photos"
        aria-valuemin={0}
        aria-valuemax={USER_PHOTO_BUDGET}
        aria-valuenow={Math.round(used)}
        aria-valuetext={`${formatBytes(used)} of ${formatBytes(USER_PHOTO_BUDGET)}`}
      >
        <span style={{ transform: `scaleX(${share})` }} />
      </div>
      <p className={styles.meterNote}>
        {tight
          ? `Your browser’s storage is nearly full (about ${formatBytes(storage)} of roughly ${formatBytes(STORAGE_QUOTA_ESTIMATE)}). Saving may fail — remove photos you don’t use, or export a copy.`
          : `Photos are resized to ${MAX_EDGE} px and kept in this browser only. Export the brochure to keep a copy.`}
      </p>
    </div>
  );
}

const EMPTY_DETAILS = { alt: '', caption: '', author: '', license: '', sourceUrl: '' };

/**
 * "Upload your own photo": a drop zone (also file picker and paste), the
 * downscale to a ≤1600 px JPEG in a canvas, a short form for alt text and
 * credit, and the storage budget. `onAdd(key, photo)` stores the photo in
 * brochure.userPhotos (and the picker places it); `onPhase(phase)` hears
 * 'idle' | 'working' | 'ready' | 'over' | 'error'.
 *   <PhotoUpload brochure={doc} onAdd={…} active onPhase={…} />
 */
export function PhotoUpload({ brochure, onAdd, active, onPhase }) {
  const id = useId();
  const [drag, setDrag] = useState(false);
  const [state, setLocalState] = useState({ phase: 'idle' });
  // The picker hides its own footer while a new photo is being described (this form has the actions).
  const setState = (next) => {
    setLocalState(next);
    onPhase?.(next.phase);
  };
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const used = userPhotosSize(brochure.userPhotos);
  const count = brochure.userPhotos ? Object.keys(brochure.userPhotos).length : 0;
  // The browser's storage, re-read whenever this brochure's photos change (a few keys: cheap).
  const storage = useMemo(() => (used >= 0 ? estimateStorageUse() : null), [used]);

  const take = async (file) => {
    const ok = checkImageFile(file);
    if (!ok.ok) {
      setState({ phase: 'error', message: ok.error });
      return;
    }
    setState({ phase: 'working', name: file.name });
    try {
      const image = await downscaleImage(file);
      const budget = budgetCheck({ used, adding: image.size, count });
      setDetails({ ...EMPTY_DETAILS, alt: altFromFileName(file.name) });
      setState({ phase: budget.ok ? 'ready' : 'over', image, name: file.name, budget, original: file.size });
    } catch (error) {
      setState({ phase: 'error', message: error?.message || 'That photo couldn’t be prepared.' });
    }
  };

  // Paste an image straight from the clipboard while this tab is open.
  useEffect(() => {
    if (!active) return undefined;
    const onPaste = (event) => {
      const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (!file || event.target?.closest?.('input, textarea')) return;
      event.preventDefault();
      take(file);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });

  const add = () => {
    if (state.phase !== 'ready' || !details.alt.trim()) return;
    const key = newUserPhotoKey(brochure.userPhotos, createId);
    onAdd(key, buildUserPhoto(state.image, details));
    setState({ phase: 'idle' });
    setDetails(EMPTY_DETAILS);
  };

  const reset = () => {
    setState({ phase: 'idle' });
    setDetails(EMPTY_DETAILS);
  };

  const preparing = state.phase === 'ready' || state.phase === 'over';

  return (
    <div className={styles.upload}>
      <AnimatePresence mode="wait" initial={false}>
        {preparing ? (
          <motion.div
            key="form"
            className={styles.prepare}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: ease.out } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            <figure className={styles.proof}>
              <img src={state.image.src} alt="" width={state.image.width} height={state.image.height} />
              <figcaption>
                <span>{state.name}</span>
                <span>
                  {state.image.width} × {state.image.height} · {formatBytes(state.image.size)} stored
                  {state.original ? ` (from ${formatBytes(state.original)})` : ''}
                </span>
              </figcaption>
            </figure>
            {state.phase === 'over' ? (
              <p className={styles.error} role="alert">
                <CircleAlert size={16} aria-hidden="true" />
                {state.budget.message}
              </p>
            ) : (
              <PhotoDetailsForm values={details} onChange={(field, value) => setDetails((d) => ({ ...d, [field]: value }))} />
            )}
            <div className={styles.prepareActions}>
              <Button variant="ghost" size="sm" onClick={reset}>
                {state.phase === 'over' ? 'Choose another photo' : 'Cancel'}
              </Button>
              {state.phase === 'ready' && (
                <Button variant="accent" size="sm" iconLeft={<ImagePlus />} onClick={add} disabled={!details.alt.trim()}>
                  Add to brochure
                </Button>
              )}
            </div>
            {state.phase === 'ready' && !details.alt.trim() && <p className={styles.formHint}>Describe the photo to add it.</p>}
          </motion.div>
        ) : (
          <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.3 } }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
            <label
              htmlFor={`${id}-file`}
              className={styles.drop}
              data-drag={drag || undefined}
              data-busy={state.phase === 'working' || undefined}
              onDragEnter={(event) => {
                event.preventDefault();
                setDrag(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setDrag(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDrag(false);
                const file = event.dataTransfer.files?.[0];
                if (file) take(file);
              }}
            >
              <span className={styles.dropMark} lang="ja" aria-hidden="true">
                写
              </span>
              {state.phase === 'working' ? (
                <span className={styles.dropTitle} role="status">
                  <LoaderCircle className={styles.spin} size={18} aria-hidden="true" />
                  Resizing {state.name}…
                </span>
              ) : (
                <>
                  <span className={styles.dropTitle}>
                    Drop a photo here, or <span className={styles.dropLink}>choose a file</span>
                  </span>
                  <span className={styles.dropSub}>JPEG, PNG, WebP or GIF · resized to {MAX_EDGE} px · you can also paste one</span>
                </>
              )}
              <input
                id={`${id}-file`}
                className="sr-only"
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                disabled={state.phase === 'working'}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) take(file);
                }}
              />
            </label>
            {state.phase === 'error' && (
              <p className={styles.error} role="alert">
                <CircleAlert size={16} aria-hidden="true" />
                {state.message}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <StorageMeter used={used + (state.phase === 'ready' ? state.image.size : 0)} storage={storage} />
    </div>
  );
}
