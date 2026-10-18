import { useId } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, RotateCw } from 'lucide-react';
import { Button, Hanko } from '../ui/index.js';
import { cn } from '../../lib/cn.js';
import { spring } from '../../lib/motion.js';
import { isChunkLoadError } from './chunkError.js';
import { Logo } from './Logo.jsx';
import styles from './RouteError.module.css';

// The tear runs from the binding edge (left) down to the fore-edge.
const TEAR = [
  [18, 90], [30, 97], [39, 92], [51, 100], [62, 95], [74, 103],
  [85, 98], [97, 107], [108, 102], [121, 111], [132, 106], [142, 114],
];
const tearPath = TEAR.map(([x, y]) => `${x} ${y}`).join(' L');
const TOP = `M18 10 H142 V114 L${[...TEAR].reverse().map(([x, y]) => `${x} ${y}`).join(' L')} Z`;
const BOTTOM = `M${tearPath} V190 H18 Z`;

/** A sheet of washi torn across, the lower half drooping away from the tear. */
function TornSheet() {
  return (
    <svg className={styles.sheet} viewBox="0 0 172 222" aria-hidden="true" focusable="false">
      <g>
        <path className={styles.half} d={TOP} />
        <path className={styles.fibre} d={`M${tearPath}`} />
        <line className={cn(styles.rule, styles.ruleAccent)} x1="34" y1="26" x2="74" y2="26" />
        <line className={styles.rule} x1="34" y1="44" x2="126" y2="44" />
        <line className={styles.rule} x1="34" y1="56" x2="118" y2="56" />
        <line className={styles.rule} x1="34" y1="68" x2="124" y2="68" />
        <line className={styles.rule} x1="34" y1="80" x2="96" y2="80" />
      </g>
      <motion.g
        style={{ transformBox: 'view-box', transformOrigin: '18px 90px' }}
        initial={{ rotate: 0, y: 0 }}
        animate={{ rotate: 7, y: 12 }}
        transition={{ ...spring.gentle, delay: 0.35 }}
      >
        <path className={styles.half} d={BOTTOM} />
        <path className={styles.fibre} d={`M${tearPath}`} />
        <line className={styles.rule} x1="34" y1="132" x2="122" y2="132" />
        <line className={styles.rule} x1="34" y1="144" x2="126" y2="144" />
        <line className={styles.rule} x1="34" y1="156" x2="104" y2="156" />
        <text className={styles.folio} x="126" y="180" textAnchor="end">
          07
        </text>
      </motion.g>
    </svg>
  );
}

/**
 * What a route shows when it fails to render or its code cannot be
 * downloaded: a torn sheet with a 破 seal, what happened, and two ways on.
 * Props: error; onReload; standalone (the whole shell failed, so it brings
 * its own masthead with the logo instead of relying on the navbar).
 */
export function RouteError({ error, onReload, standalone = false }) {
  const titleId = useId();
  const { pathname } = useLocation();
  const chunk = isChunkLoadError(error);
  const onLibrary = pathname === '/brochures';
  const message = String(error?.message ?? '').trim();
  // Standalone, the shell (and its <main>) is gone: this is the main content.
  const Root = standalone ? 'main' : 'section';

  return (
    <Root className={styles.page} data-standalone={standalone || undefined} aria-labelledby={titleId}>
      {standalone && (
        <div className={cn('container', styles.mast)}>
          <Logo />
        </div>
      )}
      <div className={cn('container', styles.grid)}>
        <div className={styles.art}>
          <TornSheet />
          <Hanko text={chunk ? '未着' : '破'} size={chunk ? 54 : 50} className={styles.seal} />
        </div>

        <div className={styles.copy}>
          <p className="eyebrow">
            {chunk ? 'Not delivered' : 'Error'} ·{' '}
            <span lang="ja">{chunk ? '届きませんでした' : '頁が破れました'}</span>
          </p>
          <h1 id={titleId} className={styles.title}>
            {chunk ? (
              <>
                This page didn’t <em className="serif-italic">arrive</em>
              </>
            ) : (
              <>
                This page <em className="serif-italic">tore</em>
              </>
            )}
          </h1>
          <p className={styles.lede}>
            {chunk
              ? 'Part of Tabi couldn’t be downloaded. You may be offline, or Tabi was updated while this tab was open — reloading fetches the latest pages.'
              : 'Something on this page failed to draw. Your favourites, drafts and published brochures are safe in this browser; reloading usually mends it.'}
          </p>
          <div className={styles.actions}>
            <Button onClick={onReload} iconLeft={<RotateCw />}>
              Reload
            </Button>
            <Button to={onLibrary ? '/' : '/brochures'} variant="secondary" iconLeft={<ArrowLeft />}>
              {onLibrary ? 'Back to Home' : 'Back to the library'}
            </Button>
          </div>
          {message && (
            <details className={styles.details}>
              <summary>Technical details</summary>
              <code className={styles.code}>{message}</code>
            </details>
          )}
        </div>
      </div>
    </Root>
  );
}
