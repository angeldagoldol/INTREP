import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Tilt, VerticalText } from '../../../components/ui/index.js';
import { CoverArt } from '../../../components/brochure/index.js';
import { Photo } from '../../../components/photo/Photo.jsx';
import { getCategory } from '../../../data/categories.js';
import { getRegion } from '../../../data/regions.js';
import { SEASON_MAP } from '../../../data/seasons.js';
import { ease } from '../../../lib/motion.js';
import { kanjiNumeral } from '../../../components/brochure/blocks/pageUtils.js';
import styles from './TemplateCard.module.css';

const reveal = {
  hidden: { opacity: 0, y: 40 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.9, ease: ease.out, delay: i * 0.08 } }),
};

/**
 * A template as a printed proof: its cover photograph (the live cover art in
 * the template's palette until the photo is downloaded), its Japanese title
 * set vertically, and what it contains. The whole card is one button
 * (stretched from the heading).
 *   <TemplateCard template={t} index={0} onChoose={(t) => …} />
 */
export function TemplateCard({ template, index, onChoose }) {
  const b = template.brochure;
  const category = getCategory(b.category);
  const region = getRegion(b.region);
  const swatches = [b.theme.paper, b.theme.ink, b.theme.accent, b.theme.accent2];

  return (
    <motion.li className={styles.item} variants={reveal} custom={index}>
      <Tilt className={styles.tilt} max={5}>
        <article className={styles.card}>
          <div className={styles.art} style={{ background: b.theme.paper }}>
            <Photo
              id={b.cover.photo}
              alt=""
              sizes="(min-width: 1100px) 300px, (min-width: 700px) 45vw, 90vw"
              className={styles.svg}
              fallback={<CoverArt style={b.cover.art} seed={b.cover.seed} theme={b.theme} animated />}
            />
            <span className={styles.no} style={{ color: b.theme.ink, background: b.theme.paper }} aria-hidden="true">
              {kanjiNumeral(index + 1)}
            </span>
            <VerticalText className={styles.jpTitle} style={{ color: b.theme.ink, borderColor: b.theme.ink, background: b.theme.paper }}>
              {b.titleJp}
            </VerticalText>
          </div>
          <div className={styles.body}>
            <p className={styles.meta}>
              <span className={styles.dot} style={{ background: category.color }} aria-hidden="true" />
              <span className={styles.metaText}>
                {category.label} · {region.label.split(' & ')[0]}
              </span>
            </p>
            <h3 className={styles.name}>
              <button type="button" className={styles.choose} onClick={() => onChoose(template)}>
                {template.name}
              </button>
              <span lang="ja" className={styles.jp}>
                {template.jp}
              </span>
            </h3>
            <p className={styles.blurb}>{template.blurb}</p>
            <div className={styles.foot}>
              <span className={styles.swatches} aria-hidden="true">
                {swatches.map((c) => (
                  <span key={c} style={{ background: c }} />
                ))}
              </span>
              <span className={styles.facts}>
                {b.pages.length} pages
                <span lang="ja" aria-hidden="true">
                  {' '}
                  · {b.seasons.map((s) => SEASON_MAP[s]?.jp).join('')}
                </span>
                <span className="sr-only">, best in {b.seasons.map((s) => SEASON_MAP[s]?.label).join(', ')}</span>
              </span>
              <ArrowUpRight className={styles.arrow} size={18} aria-hidden="true" />
            </div>
          </div>
        </article>
      </Tilt>
    </motion.li>
  );
}
