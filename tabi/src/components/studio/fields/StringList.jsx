import { useId, useRef } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { IconButton } from '../../ui/index.js';
import styles from './StringList.module.css';

/**
 * Compact editor for a list of short strings (e.g. what a plan includes).
 * Enter in a row adds a new row below; Backspace in an empty row removes it.
 *   <StringList label="Included" items={features} limit={{ min: 1, max: 6 }} onChange={…} onAdd={…} onRemove={…} onMove={…} />
 */
export function StringList({ label, items, limit, onChange, onAdd, onRemove, onMove, placeholder = 'What is included' }) {
  const id = useId();
  const rootRef = useRef(null);
  const list = Array.isArray(items) ? items : [];
  const canAdd = list.length < limit.max;
  const canRemove = list.length > limit.min;

  const focusRow = (index) =>
    requestAnimationFrame(() => rootRef.current?.querySelectorAll('input')[index]?.focus());

  return (
    <div className={styles.root} ref={rootRef} role="group" aria-labelledby={`${id}-label`}>
      <div className={styles.head}>
        <span id={`${id}-label`} className={styles.label}>
          {label}
        </span>
        <span className={styles.count}>
          {list.length} / {limit.max}
        </span>
      </div>
      <ul className={styles.rows}>
        {list.map((value, index) => (
          <li key={index} className={styles.row}>
            <span className={styles.bullet} aria-hidden="true" />
            <input
              className={styles.input}
              value={typeof value === 'string' ? value : ''}
              placeholder={placeholder}
              aria-label={`${label} ${index + 1}`}
              onChange={(event) => onChange(index, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && canAdd) {
                  event.preventDefault();
                  onAdd(index + 1);
                  focusRow(index + 1);
                } else if (event.key === 'Backspace' && !event.currentTarget.value && canRemove) {
                  event.preventDefault();
                  onRemove(index);
                  focusRow(Math.max(0, index - 1));
                }
              }}
            />
            <IconButton label={`Move “${value}” up`} icon={<ArrowUp />} size="sm" tooltip={false} disabled={index === 0} onClick={() => onMove(index, index - 1)} />
            <IconButton
              label={`Move “${value}” down`}
              icon={<ArrowDown />}
              size="sm"
              tooltip={false}
              disabled={index === list.length - 1}
              onClick={() => onMove(index, index + 1)}
            />
            <IconButton label={`Remove “${value}”`} icon={<X />} size="sm" tooltip={false} disabled={!canRemove} onClick={() => onRemove(index)} />
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={styles.add}
        disabled={!canAdd}
        onClick={() => {
          onAdd(list.length);
          focusRow(list.length);
        }}
      >
        <Plus size={14} aria-hidden="true" />
        {canAdd ? 'Add a line' : `Up to ${limit.max} lines`}
      </button>
    </div>
  );
}
