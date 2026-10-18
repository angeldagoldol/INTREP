import { useContext, useState } from 'react';
import { motion, PresenceContext, useReducedMotion } from 'framer-motion';
import { Hanko } from '../ui/index.js';
import { ease } from '../../lib/motion.js';
import styles from './RouteTransition.module.css';

const COVER = 0.24; // old page → covered
const REVEAL = 0.3; // covered → new page
const STAGGER = 0.04;

/**
 * One curtain layer. Exit sweeps it up from below to cover the old page;
 * the next page mounts covered and the layer keeps travelling up and away,
 * so the wipe reads as one continuous upward stroke. `depth` 0 is the
 * vermilion underlayer, 1 the sumi layer that carries the seal.
 */
function curtainLayer(depth) {
  return {
    initial: { y: '0%' },
    enter: { y: '-100%', transition: { duration: REVEAL, ease: ease.inOut, delay: (1 - depth) * STAGGER } },
    exit: { y: ['100%', '0%'], transition: { duration: COVER, ease: ease.inOut, delay: depth * STAGGER } },
  };
}

const LAYERS = [curtainLayer(0), curtainLayer(1)];

// Content only fades: a transform here would become the containing block for
// any position:fixed UI inside the page (toolbars, docks) and make it jump.
const content = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: REVEAL, ease: ease.out, delay: STAGGER } },
};

const contentReduced = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.2, ease: ease.out } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: ease.in } },
};

/**
 * Animated wrapper for one route. Mount it keyed by route inside
 * <AnimatePresence mode="wait">: a vermilion + sumi curtain wipes over the
 * old page, the 旅 seal flashes past, and the new page fades in underneath
 * (~620ms in total). Under reduced motion it is a plain cross-fade.
 */
export function RoutePage({ children }) {
  const reduce = useReducedMotion();
  // The curtain layers are promoted (will-change) only while they wipe; once
  // parked off-screen they would hold two viewport-sized layers for nothing.
  // The first route renders without a wipe (AnimatePresence initial={false}).
  const presence = useContext(PresenceContext);
  const [parked, setParked] = useState(presence?.initial === false);
  return (
    <motion.div
      className={styles.page}
      initial="initial"
      animate="enter"
      exit="exit"
      onAnimationStart={(definition) => definition === 'exit' && setParked(false)}
      onAnimationComplete={(definition) => definition === 'enter' && setParked(true)}
    >
      {!reduce && (
        <div className={styles.curtain} data-parked={parked || undefined} aria-hidden="true">
          <motion.div className={styles.shu} variants={LAYERS[0]} />
          <motion.div className={styles.sumi} variants={LAYERS[1]}>
            <Hanko text="旅" size={68} />
          </motion.div>
        </div>
      )}
      <motion.div className={styles.content} variants={reduce ? contentReduced : content}>
        {children}
      </motion.div>
    </motion.div>
  );
}
