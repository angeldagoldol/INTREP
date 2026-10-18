import { createElement, useEffect, useId, useMemo, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/cn.js';
import { ART_HEIGHT, ART_WIDTH, buildScene } from './art/scene.js';
import styles from './CoverArt.module.css';

/** Descriptor tree → React elements. Animated nodes get a wrapper <g> so CSS
 *  transforms never fight the node's own `transform` attribute. Text nodes
 *  carry their string in `children`. */
function renderNodes(nodes) {
  return nodes.map((node, index) => {
    const { anim, vars, ...props } = node.a;
    props.key = anim ? 'n' : index;
    const element = node.c ? createElement(node.t, props, renderNodes(node.c)) : createElement(node.t, props);
    if (!anim) return element;
    return (
      <g key={index} className={styles[anim]} style={vars}>
        {element}
      </g>
    );
  });
}

/**
 * Generative artwork from traditional Japanese motifs (seigaiha, asanoha,
 * hinomaru, fuji, sakura, torii, shippo, enso, kumo, ichimatsu).
 *
 *   <CoverArt style="seigaiha" seed={7} theme={brochure.theme} animated title="Waves at dawn" />
 *
 * - `style`  one of ART_STYLES (data/schema.js); unknown values fall back to hinomaru.
 * - `seed`   same style + seed + theme always draws the same picture.
 * - `theme`  brochure theme; only its colours are used, so every palette works.
 * - `animated` gentle idle motion; paused off-screen and off under reduced motion.
 * - `title`  makes the art an image with that accessible name; otherwise decorative.
 * Fills its box (300×424 board, `slice`): crop it with any aspect ratio.
 */
export function CoverArt({ style = 'hinomaru', seed = 1, theme, className, animated = false, title }) {
  const uid = `art${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const moving = animated && !reduceMotion;

  const { paper, ink, accent, accent2, muted } = theme ?? {};
  const scene = useMemo(
    () => buildScene(style, seed, { paper, ink, accent, accent2, muted }, uid),
    [style, seed, paper, ink, accent, accent2, muted, uid],
  );
  const content = useMemo(
    () => (
      <>
        {scene.defs.length > 0 && <defs>{renderNodes(scene.defs)}</defs>}
        {renderNodes(scene.layers)}
      </>
    ),
    [scene],
  );

  // Pause idle motion while the artwork is off-screen.
  useEffect(() => {
    const svg = ref.current;
    if (!moving || !svg || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      svg.toggleAttribute('data-paused', !entry.isIntersecting);
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [moving]);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${ART_WIDTH} ${ART_HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      className={cn(styles.art, moving && styles.animated, className)}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-art={scene.style}
      data-seed={seed}
    >
      {content}
    </svg>
  );
}
