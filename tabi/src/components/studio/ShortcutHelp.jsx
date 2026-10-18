import { useRef } from 'react';
import { Keyboard } from 'lucide-react';
import { IconButton, Kbd } from '../ui/index.js';
import { modKeyLabel } from '../../hooks/useHotkey.js';
import { Popover } from './Popover.jsx';
import styles from './ShortcutHelp.module.css';

const SHORTCUTS = [
  { label: 'Undo', keys: [[modKeyLabel, 'Z']] },
  { label: 'Redo', keys: [['⇧', modKeyLabel, 'Z'], ['Ctrl', 'Y']] },
  { label: 'Previous / next page', keys: [['['], [']']] },
  { label: 'Save draft now', keys: [[modKeyLabel, 'S']] },
  { label: 'Publish', keys: [[modKeyLabel, '↵']] },
  { label: 'Show shortcuts', keys: [['?']] },
  { label: 'Close menus & dialogs', keys: [['Esc']] },
];

/**
 * "Keyboard shortcuts" button with a popover listing every Studio shortcut.
 * Controlled, so the editor can also open it with the ? key.
 *   <ShortcutHelp open={open} onOpenChange={setOpen} />
 */
export function ShortcutHelp({ open, onOpenChange }) {
  const anchorRef = useRef(null);
  return (
    <>
      <IconButton
        ref={anchorRef}
        label="Keyboard shortcuts"
        icon={<Keyboard />}
        aria-expanded={open}
        aria-haspopup="dialog"
        active={open}
        onClick={() => onOpenChange(!open)}
      />
      <Popover open={open} onClose={() => onOpenChange(false)} anchorRef={anchorRef} placement="bottom-end" label="Keyboard shortcuts" className={styles.panel}>
        <p className={styles.head}>
          <span>Shortcuts</span>
          <span lang="ja">ショートカット</span>
        </p>
        <dl className={styles.list}>
          {SHORTCUTS.map((s) => (
            <div key={s.label} className={styles.row}>
              <dt>{s.label}</dt>
              <dd>
                {s.keys.map((combo, i) => (
                  <span key={i} className={styles.combo}>
                    {i > 0 && <span className={styles.or}>or</span>}
                    {combo.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <p className={styles.note}>Inside a text field, {modKeyLabel} Z undoes your typing as usual.</p>
      </Popover>
    </>
  );
}
