import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, Shuffle } from 'lucide-react';
import { useBrochures } from '../../context/BrochureContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { CoverArt } from '../../components/brochure/CoverArt.jsx';
import { Photo } from '../../components/photo/Photo.jsx';
import { Button, IconButton, VerticalText } from '../../components/ui/index.js';
import { getCategory } from '../../data/categories.js';
import { getRegion } from '../../data/regions.js';
import { ease, fadeUp, stagger } from '../../lib/motion.js';
import { cn } from '../../lib/cn.js';
import { ToriiIllustration } from './ToriiIllustration.jsx';
import styles from './NotFound.module.css';

/** Stable small hash, so each wrong URL suggests its own brochure. */
function hashString(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 33 + text.charCodeAt(i)) >>> 0;
  return hash;
}

function Suggestion({ brochure, onShuffle }) {
  const region = getRegion(brochure.region);
  const category = getCategory(brochure.category);
  return (
    <motion.aside className={styles.suggest} aria-labelledby="notfound-try" variants={fadeUp}>
      <div className={styles.suggestHead}>
        <h2 id="notfound-try" className={styles.suggestTitle}>
          Try this instead
          <span lang="ja" className={styles.suggestJp}>
            かわりに
          </span>
        </h2>
        {onShuffle && (
          <IconButton label="Suggest another" icon={<Shuffle />} size="sm" variant="outline" tooltipSide="left" onClick={onShuffle} />
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={brochure.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0, transition: { duration: 0.4, ease: ease.out } }}
          exit={{ opacity: 0, x: -16, transition: { duration: 0.18, ease: ease.in } }}
        >
          <Link to={`/brochures/${brochure.slug}`} className={styles.card}>
            <span className={styles.cover} aria-hidden="true">
              <Photo
                id={brochure.cover?.photo ?? ''}
                alt=""
                sizes="64px"
                className={styles.coverArt}
                fallback={<CoverArt style={brochure.cover?.art ?? 'torii'} seed={brochure.cover?.seed ?? 1} theme={brochure.theme} />}
              />
            </span>
            <span className={styles.cardText}>
              <span className={styles.cardMeta}>
                {region.label} · {category.label}
              </span>
              <span className={styles.cardTitle}>{brochure.title}</span>
              {brochure.subtitle && <span className={styles.cardSub}>{brochure.subtitle}</span>}
            </span>
            {brochure.titleJp && (
              <VerticalText className={styles.cardJp} aria-hidden="true">
                {brochure.titleJp}
              </VerticalText>
            )}
            <ArrowUpRight className={styles.cardArrow} size={18} aria-hidden="true" />
          </Link>
        </motion.div>
      </AnimatePresence>
    </motion.aside>
  );
}

/** 404 — 迷子 (maigo, "lost"): a torii in an ensō, a way home, and a detour worth taking. */
export default function NotFound() {
  useDocumentTitle('Lost (404)');
  const location = useLocation();
  const { builtins } = useBrochures();
  const [offset, setOffset] = useState(0);
  const suggestion = builtins.length ? builtins[(hashString(location.pathname) + offset) % builtins.length] : null;

  return (
    <section className={styles.page} aria-labelledby="notfound-title">
      <div className={cn('container', styles.grid)}>
        <div className={styles.artWrap}>
          <ToriiIllustration />
          <VerticalText className={styles.sideNote} aria-hidden="true">
            道に迷いました
          </VerticalText>
        </div>

        <motion.div className={styles.copy} variants={stagger(0.08, 0.15)} initial="hidden" animate="show">
          <motion.p className="eyebrow" variants={fadeUp}>
            Error 404 · Page not found
          </motion.p>
          <motion.h1 id="notfound-title" className={styles.title} variants={fadeUp}>
            <span lang="ja" className={styles.kanji}>
              迷子
            </span>
            <span className={styles.romaji}>
              <em className="serif-italic">maigo</em> — lost
            </span>
          </motion.h1>
          <motion.p className={styles.lede} variants={fadeUp}>
            You’ve wandered off the path, like a Nara deer following a rice cracker. It happens to the best of us — even
            the oldest towns in Japan have a few lanes no guidebook names.
          </motion.p>
          <motion.p className={styles.path} variants={fadeUp}>
            Nothing lives at <code className={styles.code}>{location.pathname}</code>
          </motion.p>
          <motion.div className={styles.actions} variants={fadeUp}>
            <Button to="/" size="lg" iconLeft={<ArrowLeft />}>
              Back to Home
            </Button>
            <Button to="/brochures" size="lg" variant="secondary">
              Browse brochures
            </Button>
          </motion.div>
          {suggestion && (
            <Suggestion brochure={suggestion} onShuffle={builtins.length > 1 ? () => setOffset((n) => n + 1) : undefined} />
          )}
        </motion.div>
      </div>
    </section>
  );
}
