import { motion } from 'framer-motion';
import { Counter, VerticalText } from '../../../components/ui/index.js';
import { pad } from '../../../lib/format.js';
import { fadeUp, stagger, viewportOnce } from '../../../lib/motion.js';
import { FACTS, SECTIONS } from '../homeContent.js';
import { SectionHead } from './SectionHead.jsx';
import styles from './Numbers.module.css';

/**
 * 07 数字 — Japan in numbers: big counters on a sumi-ink band, set in a
 * hairline grid with vertical Japanese labels and a source note under each.
 * `data-theme="dark"` scopes the ink tokens, so it is a dark band in both themes.
 */
export function Numbers() {
  return (
    <section className={styles.section} data-theme="dark">
      <div className="container">
        <SectionHead
          section={SECTIONS.numbers}
          title={['Japan, by the ', { text: 'numbers', className: 'serif-italic' }]}
          intro="A long, narrow, volcanic archipelago — and one of the fastest railways on Earth."
        />

        <motion.ul className={styles.grid} variants={stagger(0.1)} initial="hidden" whileInView="show" viewport={viewportOnce}>
          {FACTS.map((fact, i) => (
            <motion.li key={fact.id} className={styles.cell} variants={fadeUp}>
              <span className={styles.index} aria-hidden="true">
                No. {pad(i + 1)}
              </span>
              <VerticalText className={styles.jp}>{fact.jp}</VerticalText>
              <p className={styles.value}>
                <Counter value={fact.value} duration={fact.value > 1000 ? 2.4 : 1.8} />
                {fact.unit && <span className={styles.unit}> {fact.unit}</span>}
              </p>
              <p className={styles.label}>{fact.label}</p>
              <p className={styles.note}>{fact.note}</p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
