import { lazy, Suspense, useId, useMemo, useRef, useState } from 'react';
import { ImagePlus, Images, X } from 'lucide-react';
import { Button } from '../../ui/index.js';
import { Photo } from '../../photo/Photo.jsx';
import { PhotoCredit } from '../../photo/PhotoCredit.jsx';
import { CoverArt } from '../../brochure/index.js';
import { usePhotoRecord } from '../../photo/photoContext.js';
import { photoStatus, suggestPhotos } from '../photoLibrary.js';
import { usePhotoLibrary } from './usePhotoLibrary.js';
import styles from './PhotoField.module.css';

// The picker (library grid, upload, downscale) loads the first time a photo field opens it.
const PhotoPicker = lazy(() => import('./PhotoPicker.jsx').then((m) => ({ default: m.PhotoPicker })));

/**
 * A photo slot in a page form: a proof of the current picture (or the art
 * that stands in), what it is and whether it is downloaded, its credit, and
 * buttons to choose another or take it off. "Choose" opens the PhotoPicker
 * (library + your own uploads); a field that is empty suggests library
 * photos of the place it is about.
 *
 *   <PhotoField label="Cover photo" value={id} brochure={doc} hints={['Fushimi Inari Taisha']}
 *     preferred="portrait" photos={{ place, upload, update, remove }} art={{ style, seed }} />
 *
 * - `photos.place(id)`             put a photo id ('' = none) in this slot
 * - `photos.upload(key, photo)`    store a new upload and put it in this slot (one undo step)
 * - `photos.update(key, path, v)`  edit an upload's alt text / credit
 * - `photos.remove(key)`           delete an upload everywhere
 * - `art`                          the fallback art ({ style, seed }) the page draws without a photo
 * - `compact`                      a smaller row for list items (gallery plates, highlights)
 */
export function PhotoField({ label = 'Photo', value, brochure, hints = [], preferred = 'landscape', photos, art, hint, compact = false, optional = false }) {
  const id = useId();
  const buttonRef = useRef(null);
  const [open, setOpen] = useState(false);
  // Mounted from the first opening on, so the drawer can also animate out.
  const [opened, setOpened] = useState(false);
  if (open && !opened) setOpened(true);
  const library = usePhotoLibrary();
  const current = typeof value === 'string' ? value.trim() : '';
  // Bundled, uploaded, or live from Wikimedia Commons once resolved.
  const record = usePhotoRecord(current, brochure);
  const status = photoStatus(current, record);
  const hintKey = hints.filter(Boolean).join('|');
  const suggestions = useMemo(
    () => (current ? [] : suggestPhotos(library, { hints: hintKey.split('|'), preferred, limit: 3 })),
    [library, current, hintKey, preferred],
  );
  const theme = brochure?.theme;
  const fallback = <CoverArt style={art?.style ?? brochure?.cover?.art} seed={art?.seed ?? brochure?.cover?.seed} theme={theme} />;
  const title = record ? record.caption || record.alt || (record.user ? 'Your photo' : current) : optional ? 'No photo — optional' : 'No photo yet';
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus({ preventScroll: true }));
  };

  return (
    <div className={styles.field} data-compact={compact || undefined} data-kind={status.kind} data-orientation={preferred}>
      <div className={styles.head}>
        <span id={`${id}-label`} className={styles.label}>
          {label}
        </span>
        <span lang="ja" className={styles.jp} aria-hidden="true">
          写真
        </span>
      </div>
      <div className={styles.card} role="group" aria-labelledby={`${id}-label`} aria-describedby={`${id}-status`}>
        <button
          type="button"
          className={styles.proof}
          onClick={() => setOpen(true)}
          // A larger target for the pointer only; the Choose/Change button is the one for keys and screen readers.
          aria-hidden="true"
          tabIndex={-1}
        >
          {current ? <Photo photo={record} brochure={brochure} alt="" sizes="160px" fallback={fallback} className={styles.fill} /> : <span className={styles.blank} aria-hidden="true" />}
          {!current && (
            <span className={styles.blankMark} lang="ja" aria-hidden="true">
              写
            </span>
          )}
        </button>
        <div className={styles.text}>
          <p className={styles.title}>{title}</p>
          <p id={`${id}-status`} className={styles.status}>
            <span className={styles.dot} aria-hidden="true" />
            <span>
              <strong>{status.label}</strong>
              {status.kind !== 'ready' && status.kind !== 'empty' ? ` — ${status.detail}` : record?.place ? ` · ${record.place}` : ''}
              {status.kind === 'empty' && hint ? ` ${hint}` : ''}
            </span>
          </p>
          {record?.available && <PhotoCredit credit={record.credit} className={styles.credit} />}
          <div className={styles.actions}>
            <Button ref={buttonRef} size="sm" variant={current ? 'secondary' : 'primary'} iconLeft={current ? <Images /> : <ImagePlus />} onClick={() => setOpen(true)} aria-haspopup="dialog">
              {current ? 'Change' : 'Choose photo'}
            </Button>
            {current && (
              <Button size="sm" variant="ghost" iconLeft={<X />} onClick={() => photos.place('')} aria-label={`Remove ${label.toLowerCase()}`}>
                Remove
              </Button>
            )}
          </div>
          {suggestions.length > 0 && !compact && (
            <button type="button" className={styles.suggest} onClick={() => setOpen(true)}>
              {`${suggestions.length} library ${suggestions.length === 1 ? 'photo matches' : 'photos match'} “${hints.find(Boolean)}”`}
            </button>
          )}
        </div>
      </div>
      <Suspense fallback={null}>
        {opened && (
          <PhotoPicker
            open={open}
            onClose={close}
            value={current}
            brochure={brochure}
            label={label}
            hints={hints.filter(Boolean)}
            preferred={preferred}
            onPick={(photoId) => photos.place(photoId)}
            onAdd={(key, photo) => photos.upload(key, photo)}
            onUpdatePhoto={photos.update}
            onRemovePhoto={photos.remove}
          />
        )}
      </Suspense>
    </div>
  );
}
