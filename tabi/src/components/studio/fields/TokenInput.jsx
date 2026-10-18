import { useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { spring } from '../../../lib/motion.js';
import { normalizeTag } from '../studioFormat.js';
import styles from './TokenInput.module.css';

/**
 * Tag input: type and press Enter or comma to add, Backspace on an empty
 * field to remove the last tag, × to remove any. Pasting "a, b, c" adds all.
 *   <TokenInput label="Tags" value={tags} onChange={setTags} max={12} />
 */
export function TokenInput({ label, value, onChange, max = 12, placeholder = 'Add a tag…', hint }) {
  const id = useId();
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const tags = Array.isArray(value) ? value : [];
  const full = tags.length >= max;

  const add = (raw) => {
    const incoming = String(raw)
      .split(/[,、\n]/)
      .map(normalizeTag)
      .filter(Boolean);
    const next = [...tags];
    for (const tag of incoming) if (!next.includes(tag) && next.length < max) next.push(tag);
    if (next.length !== tags.length) {
      onChange(next);
      setAnnouncement(`Added ${next.slice(tags.length).join(', ')}`);
    } else if (incoming.length) {
      setAnnouncement(full ? `You can add up to ${max} tags` : `${incoming[0]} is already a tag`);
    }
    setText('');
  };

  const remove = (tag) => {
    onChange(tags.filter((t) => t !== tag));
    setAnnouncement(`Removed ${tag}`);
    inputRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if ((event.key === 'Enter' || event.key === ',') && text.trim()) {
      event.preventDefault();
      add(text);
    } else if (event.key === 'Backspace' && !text && tags.length) {
      event.preventDefault();
      remove(tags[tags.length - 1]);
    }
  };

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {/* Clicking the box's empty space focuses the input (a pointer convenience; the input is reachable by Tab). */}
      <div className={styles.box} onClick={(e) => e.target === e.currentTarget && inputRef.current?.focus()}>
        <ul className={styles.tokens} aria-label={`${label}: ${tags.length} of ${max}`}>
          <AnimatePresence initial={false}>
            {tags.map((tag) => (
              <motion.li
                key={tag}
                layout
                className={styles.token}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1, transition: spring.snappy }}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
              >
                <span className={styles.hash} aria-hidden="true">
                  #
                </span>
                {tag}
                <button type="button" className={styles.remove} onClick={() => remove(tag)} aria-label={`Remove tag ${tag}`}>
                  <X size={12} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <input
          ref={inputRef}
          id={id}
          className={styles.input}
          value={text}
          onChange={(event) => {
            const next = event.target.value;
            if (/[,、]/.test(next)) add(next);
            else setText(next);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => text.trim() && add(text)}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text');
            if (/[,、\n]/.test(pasted)) {
              event.preventDefault();
              add(pasted);
            }
          }}
          placeholder={full ? `${max} tags — the maximum` : placeholder}
          aria-describedby={`${id}-hint`}
          autoComplete="off"
          // While a tag is half-typed ⌘Z edits that text; on an empty field it undoes the last tag change.
          data-native-undo={text ? '' : undefined}
          enterKeyHint="done"
        />
      </div>
      <p id={`${id}-hint`} className={styles.hint}>
        {hint ?? 'Press Enter or comma to add · Backspace removes the last tag'}
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
