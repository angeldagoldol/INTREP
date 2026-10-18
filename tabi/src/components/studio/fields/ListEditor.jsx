import { useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button, IconButton } from '../../ui/index.js';
import { ease } from '../../../lib/motion.js';
import { circledNumeral } from '../../brochure/blocks/pageUtils.js';
import styles from './ListEditor.module.css';

/**
 * Editor for a list of page items (highlights, stops, phrases…): numbered
 * cards with move up / move down / remove, an add button that respects the
 * schema's limits, focus that follows the item you moved or added, and
 * spoken confirmations for screen readers.
 *   <ListEditor title="Highlights" noun="highlight" items={items} limit={{ min: 2, max: 6 }}
 *     onAdd={add} onRemove={remove} onMove={move} itemTitle={(it) => it.title} renderItem={(it, i) => …} />
 * `variant="rows"` sets short items (a label and a value) as ruled lines, like
 * a ledger: numeral, fields, actions on one row, with `columns` (e.g.
 * ['Label', 'Value']) as a quiet header. Its fields should name themselves
 * (hidden labels that include the row number). `hideHead` keeps the title for
 * screen readers only, when the panel around the list already names it.
 */
export function ListEditor({ title, noun, items, limit, onAdd, onRemove, onMove, itemTitle, renderItem, aside, variant = 'cards', columns, hideHead = false }) {
  const id = useId();
  const rootRef = useRef(null);
  const [message, setMessage] = useState('');
  const [flash, setFlash] = useState(null);
  // Rows are keyed by position, so only a row that was just added plays the
  // entrance; one restored by undo or shifted by a move/remove just appears.
  const [added, setAdded] = useState(null);
  const list = Array.isArray(items) ? items : [];
  const canAdd = list.length < limit.max;
  const canRemove = list.length > limit.min;
  const range = Number.isFinite(limit.max) ? `${limit.min}–${limit.max} ${noun}s` : '';

  const focusLater = (selector) =>
    requestAnimationFrame(() => rootRef.current?.querySelector(selector)?.focus({ preventScroll: false }));

  const move = (from, to) => {
    onMove(from, to);
    setAdded(null);
    setFlash((last) => ({ index: to, key: (last?.key ?? 0) + 1 }));
    setMessage(`Moved ${noun} to position ${to + 1} of ${list.length}`);
    const direction = to < from ? 'up' : 'down';
    const edge = to === 0 || to === list.length - 1;
    focusLater(`[data-item="${to}"] [data-action="${edge ? (direction === 'up' ? 'down' : 'up') : direction}"]`);
  };

  const remove = (index) => {
    onRemove(index);
    setAdded(null);
    setMessage(`Removed ${noun} ${index + 1}`);
    focusLater(`[data-item="${Math.max(0, index - 1)}"] [data-action="remove"]`);
  };

  const add = () => {
    onAdd();
    setAdded(list.length);
    setMessage(`Added ${noun} ${list.length + 1}`);
    focusLater(`[data-item="${list.length}"] :is(input:not([type="color"]), textarea)`);
  };

  const actions = (index) => (
    <>
      <IconButton
        label={`Move ${noun} ${index + 1} up`}
        icon={<ArrowUp />}
        size="sm"
        tooltipSide="top"
        data-action="up"
        disabled={index === 0}
        onClick={() => move(index, index - 1)}
      />
      <IconButton
        label={`Move ${noun} ${index + 1} down`}
        icon={<ArrowDown />}
        size="sm"
        tooltipSide="top"
        data-action="down"
        disabled={index === list.length - 1}
        onClick={() => move(index, index + 1)}
      />
      <IconButton
        label={canRemove ? `Remove ${noun} ${index + 1}` : `Keep at least ${limit.min} ${noun}s`}
        icon={<Trash2 />}
        size="sm"
        tooltipSide="left"
        data-action="remove"
        disabled={!canRemove}
        onClick={() => remove(index)}
      />
    </>
  );

  return (
    <section className={styles.list} ref={rootRef} aria-labelledby={`${id}-title`}>
      <header className={hideHead ? 'sr-only' : styles.head}>
        <h3 id={`${id}-title`} className={styles.title}>
          {title}
        </h3>
        <span className={styles.count}>
          {list.length}
          {Number.isFinite(limit.max) && <span className={styles.max}> / {limit.max}</span>}
        </span>
      </header>

      {variant === 'rows' && columns && list.length > 0 && (
        <div className={styles.columns} aria-hidden="true">
          {columns.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>
      )}
      <ol className={styles.items} data-variant={variant}>
        {list.map((item, index) => (
          <motion.li
            key={index}
            className={variant === 'rows' ? styles.row : styles.item}
            data-item={index}
            initial={index === added ? { opacity: 0, y: -8 } : false}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: ease.out } }}
            onAnimationComplete={() => index === added && setAdded(null)}
          >
            {flash?.index === index && <span key={flash.key} className={styles.flash} aria-hidden="true" />}
            {variant === 'rows' ? (
              <>
                <span className={styles.numeral} aria-hidden="true">
                  {circledNumeral(index + 1)}
                </span>
                <div className={styles.rowBody}>{renderItem(item, index)}</div>
                <span className={styles.actions}>{actions(index)}</span>
              </>
            ) : (
              <>
                <div className={styles.itemHead}>
                  <span className={styles.numeral} aria-hidden="true">
                    {circledNumeral(index + 1)}
                  </span>
                  <span className={styles.itemTitle}>
                    <span className="sr-only">{`${noun} ${index + 1}: `}</span>
                    {String(itemTitle?.(item, index) ?? '').trim() || `Untitled ${noun}`}
                  </span>
                  <span className={styles.actions}>{actions(index)}</span>
                </div>
                <div className={styles.itemBody}>{renderItem(item, index)}</div>
              </>
            )}
          </motion.li>
        ))}
      </ol>

      <div className={styles.foot}>
        <Button variant="secondary" size="sm" iconLeft={<Plus />} onClick={add} disabled={!canAdd}>
          {`Add ${noun}`}
        </Button>
        <span className={styles.range}>{canAdd ? range : `That’s the maximum — ${limit.max} ${noun}s`}</span>
        {aside}
      </div>
      <p className="sr-only" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
