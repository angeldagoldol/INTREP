import { useId, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Icon, ICON_NAMES } from '../../ui/index.js';
import { gridIndex } from '../a11y.js';
import { humanizeIcon, searchIcons } from '../iconSearch.js';
import { Popover } from '../Popover.jsx';
import styles from './IconPicker.module.css';

const COLUMNS = 6;

/**
 * Icon button that opens a searchable grid of every icon in the registry.
 * Search understands travel words ("temple", "ramen", "onsen"); arrow keys
 * move through the grid, Enter picks, Escape closes.
 *   <IconPicker value="Landmark" onChange={setIcon} label="Highlight icon" />
 */
export function IconPicker({ value, onChange, label = 'Icon' }) {
  const id = useId();
  const anchorRef = useRef(null);
  const searchRef = useRef(null);
  const gridRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchIcons(ICON_NAMES, query), [query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const pick = (name) => {
    onChange(name);
    close();
  };

  const focusCell = (index) => {
    setActive(index);
    gridRef.current?.querySelectorAll('button')[index]?.focus();
  };

  const onGridKeyDown = (event) => {
    const next = gridIndex(event.key, active, results.length, COLUMNS);
    if (next === -1) return;
    event.preventDefault();
    if (event.key === 'ArrowUp' && active < COLUMNS) searchRef.current?.focus();
    else focusCell(next);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${humanizeIcon(value ?? 'none')}. Change`}
        onClick={() => {
          if (open) close();
          else {
            setActive(Math.max(0, ICON_NAMES.indexOf(value)));
            setOpen(true);
          }
        }}
      >
        <Icon name={value} size={20} />
      </button>
      <Popover open={open} onClose={close} anchorRef={anchorRef} label={`Choose ${label.toLowerCase()}`} initialFocusRef={searchRef} className={styles.panel}>
        <div className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            className={styles.input}
            placeholder="Search — try temple, ramen, onsen"
            value={query}
            aria-controls={`${id}-grid`}
            aria-label="Search icons"
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && results.length) {
                event.preventDefault();
                focusCell(0);
              } else if (event.key === 'Enter' && results.length) {
                event.preventDefault();
                pick(results[0]);
              }
            }}
          />
        </div>
        {results.length > 0 ? (
          <div
            ref={gridRef}
            id={`${id}-grid`}
            role="listbox"
            aria-label="Icons"
            className={styles.grid}
            style={{ '--columns': COLUMNS }}
            onKeyDown={onGridKeyDown}
          >
            {results.map((name, index) => (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={name === value}
                aria-label={humanizeIcon(name)}
                title={humanizeIcon(name)}
                tabIndex={index === Math.min(active, results.length - 1) ? 0 : -1}
                className={styles.cell}
                onClick={() => pick(name)}
                onFocus={() => setActive(index)}
              >
                <Icon name={name} size={20} />
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>
            No icon matches “{query}”. Try a simpler word, like <em>food</em> or <em>train</em>.
          </p>
        )}
        <p className={styles.count} aria-live="polite">
          {results.length} {results.length === 1 ? 'icon' : 'icons'}
        </p>
      </Popover>
    </>
  );
}
