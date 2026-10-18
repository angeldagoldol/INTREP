import { useId } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { cn } from '../../lib/cn.js';
import { spring } from '../../lib/motion.js';
import styles from './AppearanceSwitch.module.css';

const OPTIONS = [
  { value: 'light', label: 'Washi', hint: 'Light', Icon: Sun },
  { value: 'dark', label: 'Sumi', hint: 'Dark', Icon: Moon },
  { value: 'system', label: 'Auto', hint: 'Match system', Icon: Monitor },
];

/**
 * Three-way appearance control: washi (light), sumi (dark) or auto (follow
 * the operating system). The navbar's sun/moon button only flips between
 * light and dark; this is the way back to "auto". A native radio group, so
 * arrow keys move between options. Props: className.
 */
export function AppearanceSwitch({ className }) {
  const { preference, setPreference } = useTheme();
  const name = useId();
  const legendId = `${name}-legend`;

  return (
    <fieldset className={cn(styles.switch, className)} aria-labelledby={legendId}>
      <legend id={legendId} className={styles.legend}>
        Appearance
        <span lang="ja" className={styles.legendJp} aria-hidden="true">
          表示
        </span>
      </legend>
      <div className={styles.track}>
        {OPTIONS.map(({ value, label, hint, Icon }) => {
          const checked = preference === value;
          return (
            <label key={value} className={styles.option} data-checked={checked || undefined} title={hint}>
              <input
                type="radio"
                name={name}
                value={value}
                checked={checked}
                onChange={() => setPreference(value)}
                className={styles.input}
                aria-label={`${label} (${hint.toLowerCase()})`}
              />
              {checked && <motion.span layoutId={`${name}-thumb`} className={styles.thumb} transition={spring.snappy} />}
              <Icon className={styles.icon} aria-hidden="true" />
              <span className={styles.label} aria-hidden="true">
                {label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
