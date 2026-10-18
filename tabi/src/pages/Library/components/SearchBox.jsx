import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { IconButton, Kbd } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import styles from './SearchBox.module.css';

const DEBOUNCE_MS = 150;

/**
 * Library search field. Keeps its own draft while typing and commits it to
 * the URL after a short pause (or on Enter), so results update without a
 * history entry per keystroke.
 * - `value`    the committed query (from the URL)
 * - `onCommit` called with the new query
 * - `inputRef` focus target for the "/" shortcut
 * Esc clears the field, or leaves it when already empty.
 */
export function SearchBox({ value, onCommit, inputRef, className }) {
  const [draft, setDraft] = useState(value);
  const [committed, setCommitted] = useState(value);

  // The URL changed from elsewhere (Clear all, a suggestion, Back): adopt it,
  // unless it only differs from what's being typed by surrounding spaces.
  if (value !== committed) {
    setCommitted(value);
    if (value.trim() !== draft.trim()) setDraft(value);
  }

  useEffect(() => {
    if (draft.trim() === value.trim()) return undefined;
    const timer = setTimeout(() => onCommit(draft), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onCommit]);

  const clear = () => {
    setDraft('');
    onCommit('');
    inputRef?.current?.focus();
  };

  return (
    <form
      role="search"
      className={cn(styles.search, className)}
      onSubmit={(event) => {
        event.preventDefault();
        onCommit(draft);
      }}
    >
      <Search className={styles.icon} aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        className={styles.input}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          if (draft) clear();
          else event.currentTarget.blur();
        }}
        placeholder="Search Kyoto, onsen, 祭…"
        aria-label="Search brochures"
        aria-keyshortcuts="/"
        autoComplete="off"
        spellCheck="false"
        enterKeyHint="search"
      />
      {draft ? (
        <IconButton label="Clear search" icon={<X />} size="sm" tooltip={false} className={styles.clear} onClick={clear} />
      ) : (
        <span className={styles.hint} aria-hidden="true">
          <Kbd>/</Kbd>
        </span>
      )}
    </form>
  );
}
