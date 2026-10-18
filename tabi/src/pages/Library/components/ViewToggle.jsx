import { useId } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, List } from 'lucide-react';
import { IconButton } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { spring } from '../../../lib/motion.js';
import styles from './ViewToggle.module.css';

const VIEWS = [
  { id: 'grid', label: 'Grid view', Icon: LayoutGrid },
  { id: 'list', label: 'List view', Icon: List },
];

/** Grid / list segmented switch; the ink thumb slides between the two. */
export function ViewToggle({ value, onChange, className }) {
  const thumb = useId();
  return (
    <div role="group" aria-label="View" className={cn(styles.toggle, className)}>
      {VIEWS.map(({ id, label, Icon }) => {
        const pressed = value === id;
        return (
          <IconButton
            key={id}
            label={label}
            aria-pressed={pressed}
            tooltipSide="bottom"
            className={styles.option}
            onClick={() => onChange(id)}
            icon={
              <>
                {pressed && <motion.span layoutId={`view-${thumb}`} className={styles.thumb} transition={spring.snappy} />}
                <Icon className={styles.icon} />
              </>
            }
          />
        );
      })}
    </div>
  );
}
