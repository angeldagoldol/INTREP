import { useId } from 'react';
import { Switch } from '../ui/Switch.jsx';
import { cn } from '../../lib/cn.js';
import { useLivePhotosSetting } from './useLivePhotosSetting.js';
import styles from './LivePhotosToggle.module.css';

/**
 * "Load photos from Wikimedia Commons" — the visitor's switch for live photos
 * (on by default), with one line on what it means for privacy: their browser
 * fetches the pictures from Wikimedia's servers. Off, pages show the
 * generated art wherever no photo is bundled with the site.
 *
 *   <LivePhotosToggle />            // footer, Credits page
 * - `note`  false hides the explanatory line.
 */
export function LivePhotosToggle({ note = true, className }) {
  const [enabled, setEnabled] = useLivePhotosSetting();
  const noteId = useId();
  return (
    <div className={cn(styles.toggle, className)} role="group" aria-describedby={note ? noteId : undefined}>
      <Switch checked={enabled} onChange={setEnabled} label="Load photos from Wikimedia Commons" className={styles.switch} />
      {note && (
        <p id={noteId} className={styles.note}>
          {enabled
            ? 'Your browser fetches the photographs from Wikimedia’s servers (wikimedia.org), which see your IP address, as with any website. Turn it off to keep every request on this site.'
            : 'Off: nothing is requested from Wikimedia, and pages show generated art wherever no photograph comes with the site.'}
        </p>
      )}
    </div>
  );
}
