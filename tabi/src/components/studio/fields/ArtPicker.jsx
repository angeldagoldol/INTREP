import { memo, useId, useRef } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { ART_LABELS, ART_STYLES } from '../../../data/schema.js';
import { spring } from '../../../lib/motion.js';
import { CoverArt } from '../../brochure/index.js';
import { gridIndex } from '../a11y.js';
import styles from './ArtPicker.module.css';

const COLUMNS = 5;

const Swatch = memo(function Swatch({ style, seed, theme }) {
  return <CoverArt style={style} seed={seed} theme={theme} className={styles.art} />;
});

/**
 * Radio grid of all ten cover-art motifs, each drawn live with the
 * brochure's own colours and seed, labelled in English and Japanese.
 *   <ArtPicker value="seigaiha" seed={7} theme={theme} onChange={setArt} />
 */
export function ArtPicker({ value, seed, theme, onChange, label = 'Cover artwork' }) {
  const id = useId();
  const refs = useRef([]);
  const current = Math.max(0, ART_STYLES.indexOf(value));

  const onKeyDown = (event) => {
    const next = gridIndex(event.key, current, ART_STYLES.length, COLUMNS);
    if (next === -1) return;
    event.preventDefault();
    onChange(ART_STYLES[next]);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={styles.grid} onKeyDown={onKeyDown} id={id}>
      {ART_STYLES.map((style, index) => {
        const checked = index === current;
        const meta = ART_LABELS[style];
        return (
          <button
            key={style}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={`${meta.label} (${meta.jp})`}
            tabIndex={checked ? 0 : -1}
            className={styles.option}
            onClick={() => onChange(style)}
          >
            <span className={styles.frame}>
              <Swatch style={style} seed={seed} theme={theme} />
              {checked && (
                <motion.span className={styles.check} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.bouncy}>
                  <Check size={12} strokeWidth={3} aria-hidden="true" />
                </motion.span>
              )}
            </span>
            <span lang="ja" className={styles.jp} aria-hidden="true">
              {meta.jp}
            </span>
          </button>
        );
      })}
    </div>
  );
}
