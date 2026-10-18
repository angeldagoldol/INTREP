import { useState } from 'react';
import { motion } from 'framer-motion';
import { Dice5 } from 'lucide-react';
import { cn } from '../../../lib/cn.js';
import { randomSeed } from '../pageLimits.js';
import styles from './DiceButton.module.css';

/**
 * Rolls a new random seed — the die tumbles a full turn on a spring.
 *   <DiceButton label="Shuffle artwork" onRoll={(seed) => setSeed(seed)} />
 */
export function DiceButton({ label = 'Shuffle', onRoll, showLabel = false, className }) {
  const [rolls, setRolls] = useState(0);
  return (
    <button
      type="button"
      className={cn(styles.dice, showLabel && styles.withLabel, className)}
      aria-label={showLabel ? undefined : label}
      onClick={() => {
        setRolls((n) => n + 1);
        onRoll(randomSeed());
      }}
    >
      <motion.span
        className={styles.die}
        animate={{ rotate: rolls * 360 }}
        transition={{ type: 'spring', stiffness: 160, damping: 14 }}
        aria-hidden="true"
      >
        <Dice5 size={18} strokeWidth={1.75} />
      </motion.span>
      {showLabel && <span>{label}</span>}
    </button>
  );
}
