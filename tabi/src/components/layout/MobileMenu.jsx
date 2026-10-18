import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Button, VerticalText } from '../ui/index.js';
import { ease } from '../../lib/motion.js';
import { pad } from '../../lib/format.js';
import { NAV_ITEMS } from './navItems.js';
import { japanNow } from './japanTime.js';
import { ThemeToggle } from './ThemeToggle.jsx';
import styles from './MobileMenu.module.css';

// The sheet opens as an ink circle spreading from the menu button.
const sheet = {
  hidden: { '--menu-r': '0vmax' },
  show: { '--menu-r': '150vmax', transition: { duration: 0.75, ease: ease.inOut } },
  exit: { '--menu-r': '0vmax', transition: { duration: 0.45, ease: ease.inOut } },
};

const sheetReduced = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const rise = {
  hidden: { y: '110%' },
  show: (i) => ({ y: '0%', transition: { duration: 0.8, ease: ease.out, delay: 0.18 + i * 0.07 } }),
  exit: { y: '-30%', opacity: 0, transition: { duration: 0.2, ease: ease.in } },
};

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  show: (delay) => ({ opacity: 1, y: 0, transition: { duration: 0.7, ease: ease.out, delay } }),
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/**
 * Full-screen phone menu: huge serif links with index numbers and Japanese
 * sublabels, the theme switch, a "now in Japan" note and a vertical 旅.
 * Rendered inside <Navbar>, which owns open state, focus trap and scroll lock.
 * Props: id (for aria-controls), firstLinkRef (receives initial focus).
 */
export function MobileMenu({ id, firstLinkRef }) {
  const reduce = useReducedMotion();
  const [now] = useState(() => japanNow());

  return (
    <motion.div
      id={id}
      className={styles.menu}
      variants={reduce ? sheetReduced : sheet}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <div className={styles.inner}>
        <nav aria-label="Main">
          <ol className={styles.list}>
            {NAV_ITEMS.map((item, i) => (
              <li key={item.to} className={styles.item}>
                <NavLink ref={i === 0 ? firstLinkRef : undefined} to={item.to} end={item.end} className={styles.link}>
                  <span className={styles.mask}>
                    <motion.span className={styles.row} variants={rise} custom={i}>
                      <span className={styles.index} aria-hidden="true">
                        {pad(i + 1)}
                      </span>
                      <span className={styles.label}>{item.label}</span>
                      <span lang="ja" className={styles.jp} aria-hidden="true">
                        {item.jp}
                      </span>
                    </motion.span>
                  </span>
                </NavLink>
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.middle}>
          <motion.div className={styles.notes} variants={fadeIn} custom={0.42}>
            <p className={styles.now}>
              <span className={styles.nowLabel}>Now in Japan</span>
              <span className={styles.season}>
                <span lang="ja" className={styles.seasonJp}>
                  {now.season.jp}
                </span>{' '}
                {now.season.label}
              </span>
              <span className={styles.note}>{now.note}</span>
            </p>
            <div className={styles.appearance}>
              <span>Appearance</span>
              <ThemeToggle tooltipSide="top" />
            </div>
          </motion.div>
          <motion.div className={styles.kanji} variants={fadeIn} custom={0.3} aria-hidden="true">
            <VerticalText className={styles.kanjiMain}>旅</VerticalText>
            <VerticalText className={styles.kanjiRuby}>たび</VerticalText>
          </motion.div>
        </div>

        <motion.div variants={fadeIn} custom={0.5}>
          <Button variant="accent" size="lg" block to="/studio" iconRight={<ArrowUpRight />}>
            Create a brochure
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
