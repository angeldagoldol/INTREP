import { motion } from 'framer-motion';
import { ease } from '../../../lib/motion.js';
import { usePage } from './pageContext.js';

const MOTION = {
  div: motion.div,
  p: motion.p,
  h2: motion.h2,
  h3: motion.h3,
  li: motion.li,
  span: motion.span,
  figure: motion.figure,
  figcaption: motion.figcaption,
  blockquote: motion.blockquote,
  header: motion.header,
  footer: motion.footer,
  dl: motion.dl,
};

/** Entrance variants; the page root staggers them when it becomes active. */
const VARIANTS = {
  rise: {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: ease.out } },
  },
  fade: {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.9, ease: ease.out } },
  },
  wipe: {
    hidden: { scaleX: 0 },
    show: { scaleX: 1, transition: { duration: 1.1, ease: ease.inOut } },
  },
  zoom: {
    hidden: { opacity: 0, scale: 1.08 },
    show: { opacity: 1, scale: 1, transition: { duration: 1.4, ease: ease.out } },
  },
  stamp: {
    hidden: { opacity: 0, scale: 1.5, rotate: -14 },
    show: { opacity: 1, scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 320, damping: 18, delay: 0.35 } },
  },
};

/**
 * A page element that takes part in the page's entrance choreography.
 * Renders a plain element when the page is static (thumbnails, back faces).
 *   <Reveal as="h2" variant="rise" className={…}>Heading</Reveal>
 * as: div | p | h2 | h3 | li | span | figure | figcaption | blockquote | header | footer | dl
 * variant: rise | fade | wipe | zoom | stamp
 */
export function Reveal({ as = 'div', variant = 'rise', children, ...rest }) {
  const { isStatic } = usePage();
  if (isStatic) {
    const Tag = as;
    return <Tag {...rest}>{children}</Tag>;
  }
  const Motion = MOTION[as] ?? motion.div;
  return (
    <Motion variants={VARIANTS[variant] ?? VARIANTS.rise} {...rest}>
      {children}
    </Motion>
  );
}
