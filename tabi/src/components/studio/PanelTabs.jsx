import { useId, useRef } from 'react';
import { motion } from 'framer-motion';
import { spring } from '../../lib/motion.js';
import { cn } from '../../lib/cn.js';
import { nextIndex } from './a11y.js';
import styles from './PanelTabs.module.css';

/**
 * Accessible tab strip with an ink underline that slides between tabs.
 * Give each panel `tabPanelProps(idBase, value)` from a11y.js.
 *   <PanelTabs label="Editor" tabs={[{ value: 'details', label: 'Details', jp: '詳細' }]} value={tab} onChange={setTab} idBase={id} />
 */
export function PanelTabs({ label, tabs, value, onChange, idBase, className }) {
  const indicator = useId();
  const refs = useRef([]);
  const current = Math.max(0, tabs.findIndex((t) => t.value === value));

  const onKeyDown = (event) => {
    const next = nextIndex(event.key, current, tabs.length);
    if (next === -1 || event.key === 'ArrowUp' || event.key === 'ArrowDown') return;
    event.preventDefault();
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={cn(styles.tabs, className)} onKeyDown={onKeyDown}>
      {tabs.map((tab, index) => {
        const selected = index === current;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${tab.value}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${tab.value}`}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(tab.value)}
          >
            <span className={styles.label}>
              {tab.icon && <span className={styles.icon}>{tab.icon}</span>}
              {tab.label}
              {tab.badge != null && <span className={styles.badge}>{tab.badge}</span>}
            </span>
            {tab.jp && (
              <span lang="ja" className={styles.jp} aria-hidden="true">
                {tab.jp}
              </span>
            )}
            {selected && <motion.span layoutId={indicator} className={styles.indicator} transition={spring.snappy} />}
          </button>
        );
      })}
    </div>
  );
}
