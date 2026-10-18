import { useId, useState } from 'react';
import { isHex } from '../../brochure/art/color.js';
import styles from './ColorField.module.css';

/** "#abc" → "#aabbcc" so the native colour input always accepts the value. */
function toLongHex(value) {
  if (!isHex(value)) return '#000000';
  const hex = value.trim().toLowerCase();
  return hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
}

/**
 * One theme colour: a round swatch that opens the system colour picker plus
 * a hex field for exact values. `onChange(hex, { typing })` — dragging the
 * picker or typing reports `typing: true` so the edits coalesce for undo.
 */
export function ColorField({ label, jp, value, onChange }) {
  const id = useId();
  const [draft, setDraft] = useState(null);
  const shown = draft ?? value ?? '';
  const invalid = draft !== null && !isHex(draft.startsWith('#') ? draft : `#${draft}`);

  return (
    <div className={styles.row}>
      <span className={styles.swatch} style={{ '--swatch': toLongHex(value) }}>
        <input
          id={`${id}-picker`}
          type="color"
          className={styles.picker}
          value={toLongHex(value)}
          onChange={(event) => onChange(event.target.value, { typing: true })}
          aria-label={`${label} colour picker`}
        />
      </span>
      <label htmlFor={`${id}-hex`} className={styles.label}>
        <span>{label}</span>
        {jp && (
          <span lang="ja" className={styles.jp}>
            {jp}
          </span>
        )}
      </label>
      <input
        id={`${id}-hex`}
        className={styles.hex}
        value={shown}
        maxLength={7}
        spellCheck={false}
        autoComplete="off"
        // A half-typed hex lives only here, so ⌘Z edits it rather than the document.
        data-native-undo=""
        aria-invalid={invalid || undefined}
        onFocus={() => setDraft(value ?? '')}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          const next = event.target.value.trim();
          setDraft(next);
          const hex = next.startsWith('#') ? next : `#${next}`;
          if (isHex(hex) && (hex.length === 7 || hex.length === 4)) onChange(hex.toLowerCase(), { typing: true });
        }}
      />
    </div>
  );
}
