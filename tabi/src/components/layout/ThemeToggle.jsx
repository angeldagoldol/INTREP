import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext.jsx';
import { IconButton } from '../ui/index.js';
import { spring } from '../../lib/motion.js';

const RAYS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * Math.PI) / 4;
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  return { x1: 12 + c * 7.6, y1: 12 + s * 7.6, x2: 12 + c * 10, y2: 12 + s * 10 };
});

/**
 * Sun ⇄ moon morph: a shadow disc slides over the sun to carve a crescent
 * while the rays rotate away.
 */
function SunMoon({ dark }) {
  const reduce = useReducedMotion();
  const maskId = `sun-moon-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const transition = reduce ? { duration: 0 } : spring.gentle;

  return (
    <motion.svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      initial={false}
      animate={dark ? 'moon' : 'sun'}
      aria-hidden="true"
      focusable="false"
    >
      <mask id={maskId}>
        <rect width="24" height="24" fill="white" />
        <motion.circle
          r="8"
          fill="black"
          variants={{ sun: { cx: 28, cy: -2 }, moon: { cx: 16.5, cy: 7.5 } }}
          transition={transition}
        />
      </mask>
      <motion.circle
        cx="12"
        cy="12"
        fill="currentColor"
        mask={`url(#${maskId})`}
        variants={{ sun: { r: 4.6 }, moon: { r: 8.4 } }}
        transition={transition}
      />
      <motion.g
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        variants={{ sun: { rotate: 0, scale: 1, opacity: 1 }, moon: { rotate: -60, scale: 0.4, opacity: 0 } }}
        transition={transition}
      >
        {RAYS.map((ray, i) => (
          <line key={i} {...ray} />
        ))}
      </motion.g>
    </motion.svg>
  );
}

/**
 * Light (washi paper) / dark (sumi ink) switch. Uses aria-pressed, so the
 * accessible name stays "Dark mode" in both states.
 * Props: className, variant (IconButton variant), tooltipSide.
 */
export function ThemeToggle({ className, variant = 'outline', tooltipSide = 'bottom' }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <IconButton
      label="Dark mode"
      aria-pressed={dark}
      onClick={toggle}
      variant={variant}
      tooltipSide={tooltipSide}
      className={className}
      icon={<SunMoon dark={dark} />}
    />
  );
}
