import { useState } from 'react';
import { Check, PenLine, Stamp } from 'lucide-react';
import { Button, Modal } from '../ui/index.js';
import { TextField } from './fields/TextField.jsx';
import { canAutoFix } from './publishCheck.js';
import styles from './PublishDialog.module.css';

const FIX_NOTES = {
  title: 'We’ll use the cover headline',
  pages: 'We’ll add introduction pages',
  cover: 'We’ll move or add a cover',
  back: 'We’ll move or add a back cover',
  spreads: 'We’ll line up the spread so its halves face each other',
};

/**
 * Shown when a draft is not ready to publish: lists each problem, says how
 * it will be fixed, asks for a title when there is nothing to borrow, and
 * fixes everything in one go.
 *   <PublishDialog open issues={issues} onClose={…} onFix={(title) => …} />
 */
export function PublishDialog({ open, issues, mode = 'new', onClose, onFix }) {
  const [title, setTitle] = useState('');
  const needsTitle = issues.some((issue) => issue.id === 'title' && !issue.fixable);
  const ready = canAutoFix(issues, title);
  const verb = mode === 'edit' ? 'save' : 'publish';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={`Nearly ready to ${verb}`}
      description="A brochure needs a title, at least three pages, a cover first and a back cover last — and photo spreads on facing pages."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep editing
          </Button>
          <Button variant="accent" iconLeft={<Stamp />} disabled={!ready} onClick={() => onFix(title)}>
            {`Fix & ${verb}`}
          </Button>
        </>
      }
    >
      <ul className={styles.issues}>
        {issues.map((issue) => {
          const auto = issue.fixable;
          return (
            <li key={issue.id} className={styles.issue} data-auto={auto || undefined}>
              <span className={styles.icon} aria-hidden="true">
                {auto ? <Check size={14} strokeWidth={2.5} /> : <PenLine size={14} />}
              </span>
              <span className={styles.text}>
                <span className={styles.message}>{issue.message}</span>
                <span className={styles.fix}>{auto ? FIX_NOTES[issue.id] : 'Needs you — type a title below'}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {needsTitle && (
        <div className={styles.title}>
          <TextField label="Brochure title" required value={title} onChange={setTitle} max={80} placeholder="e.g. Nara: Deer, Temples & Tea" />
        </div>
      )}
    </Modal>
  );
}
