import { memo, useRef } from 'react';
import { Photo } from '../../photo/Photo.jsx';
import { useLivePhotos } from '../../photo/useLivePhotos.js';
import { CoverArt } from '../../brochure/index.js';
import { idSeed } from '../photoLibrary.js';
import { DEFAULT_CREDIT, formatBytes } from '../photoUpload.js';
import { useNearViewport } from './usePhotoLibrary.js';
import styles from './PhotoPicker.module.css';

const ORIENTATION = { portrait: 'Portrait', landscape: 'Landscape', any: '' };

/**
 * One photo in the picker: the picture (or, until it is downloaded, the art
 * that will stand in for it, in its brochure's colours), its caption, place
 * and state. A roving-focus option: the picker moves focus with the arrow
 * keys, Enter or a double click uses the photo.
 *   <PhotoTile entry={entry} selected tabIndex={0} onSelect={…} onUse={…} brochure={doc} theme={…} />
 * `entry` is a library entry (photoLibrary.buildLibrary) or an upload
 * ({ id: 'user:<key>', photo: record, caption, place, available, user: true }).
 */
export const PhotoTile = memo(function PhotoTile({ entry, selected, current, tabIndex, onSelect, onUse, brochure, theme, art }) {
  const ref = useRef(null);
  const near = useNearViewport(ref);
  // Library entries are built once; a photo not bundled can turn live (Commons) while the picker is open.
  const live = useLivePhotos(near && !entry.user && !entry.available ? [entry.id] : []);
  const photo = entry.user || entry.available ? entry.photo : (live.getPhoto(entry.id) ?? entry.photo);
  const available = Boolean(entry.available || photo?.available);
  const source = entry.brochure;
  const fallback = near ? (
    <CoverArt style={source?.cover?.art ?? art?.style ?? 'hinomaru'} seed={idSeed(entry.id)} theme={source?.theme ?? theme} />
  ) : (
    <span className={styles.hold} style={{ background: (source?.theme ?? theme)?.paper }} />
  );
  const credit = photo?.credit;
  const orientation = ORIENTATION[entry.orientation] ?? '';
  const meta = (entry.user ? [orientation, entry.bytes ? formatBytes(entry.bytes) : ''] : [entry.place, orientation]).filter(Boolean).join(' · ');
  // An upload credited only as "Your photo" says nothing a reader needs; anything more is shown.
  const author = credit?.author === DEFAULT_CREDIT && !credit?.license && entry.user ? '' : credit?.author;
  const license = credit?.license;

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={selected}
      tabIndex={tabIndex}
      className={styles.tile}
      data-photo-id={entry.id}
      data-pending={!available || undefined}
      data-current={current || undefined}
      onClick={() => onSelect(entry.id)}
      onDoubleClick={() => onUse(entry.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onUse(entry.id);
        }
      }}
    >
      <span className={styles.frame} data-orientation={entry.orientation}>
        {near ? <Photo photo={photo} brochure={brochure} alt="" sizes="(min-width: 900px) 220px, 45vw" fallback={fallback} className={styles.fill} /> : fallback}
        {!available && <span className={styles.pending}>{entry.user ? 'Can’t be shown' : 'Not downloaded'}</span>}
        {current && (
          <span className={styles.inUse} lang="ja" aria-hidden="true">
            使用中
          </span>
        )}
        <span className={styles.check} aria-hidden="true" />
      </span>
      <span className={styles.tileText}>
        <span className={styles.caption}>{entry.caption || entry.alt || 'Untitled photo'}</span>
        {meta && <span className={styles.meta}>{meta}</span>}
        {available && (author || license) && (
          <span className={styles.tileCredit}>
            {author}
            {author && license ? ' · ' : ''}
            {/* A licence never breaks across lines ("CC BY-SA 4.0"). */}
            {license && <span className={styles.nowrap}>{license}</span>}
          </span>
        )}
        <span className="sr-only">
          {available ? '' : entry.user ? ', can’t be shown' : ', not downloaded yet — the cover art shows until it is'}
          {current ? ', on this page now' : ''}
        </span>
      </span>
    </button>
  );
});
