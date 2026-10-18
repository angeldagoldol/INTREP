import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { ArrowUpRight, Search } from 'lucide-react';
import { Button, Kbd, Magnetic } from '../ui/index.js';
import { modKeyLabel } from '../../hooks/useHotkey.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll.js';
import { ease, spring } from '../../lib/motion.js';
import { cn } from '../../lib/cn.js';
import { usePalette } from './palette.js';
import { NAV_ITEMS } from './navItems.js';
import { setNavHidden } from './navState.js';
import { Logo } from './Logo.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { ScrollProgress } from './ScrollProgress.jsx';
import { MenuToggle } from './MenuToggle.jsx';
import { MobileMenu } from './MobileMenu.jsx';
import styles from './Navbar.module.css';

const SCROLLED_AT = 24; // px before the bar turns into frosted washi
const REVEAL_ZONE = 120; // never tuck the bar away this close to the top
const DIRECTION_SLOP = 6; // ignore tiny scroll jitters

/** Desktop nav link: label rolls on hover, an ink pill glides to the active route. */
function NavItem({ to, label, jp, end }) {
  return (
    <NavLink to={to} end={end} className={styles.link}>
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="navbar-active" className={styles.pill} transition={spring.snappy} />}
          <span className={styles.roll} data-text={label}>
            <span>{label}</span>
          </span>
          <span lang="ja" className={styles.jp} aria-hidden="true">
            {jp}
          </span>
        </>
      )}
    </NavLink>
  );
}

/** Opens the command palette; a full search pill on wide screens, an icon below. */
function SearchButton({ onClick }) {
  const mac = modKeyLabel === '⌘';
  return (
    <button
      type="button"
      className={styles.search}
      onClick={onClick}
      aria-haspopup="dialog"
      aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}
    >
      <Search className={styles.searchIcon} aria-hidden="true" />
      <span className={styles.searchLabel}>Search</span>
      <span className={styles.keys} aria-hidden="true">
        <Kbd>{modKeyLabel}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}

/**
 * Tool routes (the reader and the Studio editor) sit under full-bleed tool
 * bars, so the navbar drops its centred container and shares their edges.
 */
function isToolRoute({ pathname, search }, immersive) {
  if (immersive || pathname.startsWith('/studio/')) return true;
  return pathname === '/studio' && new URLSearchParams(search).has('draft');
}

/**
 * Sticky site header. Transparent at the top, frosted washi once scrolled,
 * tucks away while scrolling down and returns on the way up (never while the
 * mobile menu or palette is open, and never in immersive mode). On tool
 * routes it spans the full width, and the Studio CTA is hidden anywhere in
 * the Studio.
 * Props: immersive — compact, always-visible bar for the brochure viewer.
 */
export function Navbar({ immersive = false }) {
  const location = useLocation();
  const onStudio = location.pathname === '/studio' || location.pathname.startsWith('/studio/');
  const tool = isToolRoute(location, immersive);
  const palette = usePalette();
  const mobile = useMediaQuery('(max-width: 859.98px)');
  const headerRef = useRef(null);
  const firstLinkRef = useRef(null);
  const menuId = useId();

  // The menu belongs to the location it was opened on, so any navigation closes it.
  const [menuAt, setMenuAt] = useState(null);
  const menuOpen = mobile && menuAt === location.key;

  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > SCROLLED_AT);
  const [tucked, setTucked] = useState(false);

  useMotionValueEvent(scrollY, 'change', (y) => {
    const previous = scrollY.getPrevious() ?? y;
    setScrolled(y > SCROLLED_AT);
    if (y < REVEAL_ZONE) setTucked(false);
    else if (y > previous + DIRECTION_SLOP) setTucked(true);
    else if (y < previous - DIRECTION_SLOP) setTucked(false);
  });

  const hidden = tucked && !menuOpen && !palette.isOpen && !immersive;

  // Publish for sticky page toolbars that take the bar's place while it hides.
  useEffect(() => setNavHidden(hidden), [hidden]);
  useEffect(() => () => setNavHidden(false), []);

  useLockBodyScroll(menuOpen);
  useFocusTrap(headerRef, menuOpen, firstLinkRef);

  return (
    <header
      ref={headerRef}
      className={styles.header}
      data-scrolled={scrolled || immersive || undefined}
      data-menu-open={menuOpen || undefined}
      data-immersive={immersive || undefined}
      data-tool={tool || undefined}
      data-print="hide"
      onFocus={() => setTucked(false)}
      onKeyDown={(event) => {
        if (menuOpen && event.key === 'Escape') {
          event.stopPropagation();
          setMenuAt(null);
        }
      }}
    >
      <motion.div
        className={styles.bar}
        initial={false}
        animate={{ y: hidden ? '-110%' : '0%' }}
        transition={hidden ? { duration: 0.4, ease: ease.inOut } : { duration: 0.55, ease: ease.out }}
      >
        <div className={cn('container', styles.inner)}>
          <Logo className={styles.logo} />

          <nav aria-label="Main" className={styles.nav}>
            <ul className={styles.navList}>
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavItem {...item} />
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.actions}>
            <SearchButton onClick={palette.open} />
            <ThemeToggle className={styles.theme} />
            {!immersive && !onStudio && (
              <span className={styles.cta}>
                <Magnetic strength={0.25}>
                  <Button variant="accent" size="sm" to="/studio" iconRight={<ArrowUpRight />}>
                    Create a brochure
                  </Button>
                </Magnetic>
              </span>
            )}
            <MenuToggle
              className={styles.menuToggle}
              open={menuOpen}
              controls={menuOpen ? menuId : undefined}
              onClick={() => setMenuAt(menuOpen ? null : location.key)}
            />
          </div>
        </div>
        <ScrollProgress className={styles.progress} />
      </motion.div>

      <AnimatePresence>{menuOpen && <MobileMenu id={menuId} firstLinkRef={firstLinkRef} />}</AnimatePresence>
    </header>
  );
}
