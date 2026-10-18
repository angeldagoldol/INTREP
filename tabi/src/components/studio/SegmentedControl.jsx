import { useId, useRef } from 'react';
import { motion } from 'framer-motion';
import { spring } from '../../lib/motion.js';
import { cn } from '../../lib/cn.js';
import { nextIndex } from './a11y.js';
import styles from './SegmentedControl.module.css';

/**
 * Radio group drawn as a segmented switch with a sliding ink thumb.
 *   <SegmentedControl label="Format" value={format} onChange={setFormat}
 *     options={[{ value: 'booklet', label: 'Booklet', sub: '冊子' }]} />
 * Options may carry `sub` (small second line, e.g. Japanese), `icon`, `style`
 * (for previews such as typefaces) and `lang` for the sub label.
 */
export function SegmentedControl({ label, value, onChange, options, size = 'md', className, hideLabel = true }) {
  const id = useId();
  const refs = useRef([]);
  const current = Math.max(0, options.findIndex((o) => o.value === value));

  const onKeyDown = (event) => {
    const next = nextIndex(event.key, current, options.length);
    if (next === -1) return;
    event.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className={cn(styles.root, className)}>
      <span id={`${id}-label`} className={hideLabel ? 'sr-only' : styles.label}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className={styles.track}
        data-size={size}
        style={{ '--count': options.length }}
        onKeyDown={onKeyDown}
      >
        {options.map((option, index) => {
          const checked = index === current;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              className={styles.option}
              onClick={() => onChange(option.value)}
              title={option.title}
            >
              {checked && <motion.span layoutId={`${id}-thumb`} className={styles.thumb} transition={spring.snappy} />}
              <span className={styles.text} style={option.style}>
                {option.icon && <span className={styles.icon}>{option.icon}</span>}
                <span>{option.label}</span>
              </span>
              {option.sub && (
                <span className={styles.sub} lang={option.lang}>
                  {option.sub}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
