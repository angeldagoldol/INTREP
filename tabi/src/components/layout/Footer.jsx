import { useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, ArrowUp } from 'lucide-react';
import { CATEGORIES } from '../../data/categories.js';
import { REGIONS } from '../../data/regions.js';
import { useBrochures } from '../../context/BrochureContext.jsx';
import { VerticalText } from '../ui/index.js';
import { LivePhotosToggle } from '../photo/LivePhotosToggle.jsx';
import { cn } from '../../lib/cn.js';
import { AppearanceSwitch } from './AppearanceSwitch.jsx';
import { NowInJapan } from './NowInJapan.jsx';
import styles from './Footer.module.css';

const YEAR = new Date().getFullYear();
const WORDMARK = [
  { char: 'T' },
  { char: 'a' },
  { char: 'b' },
  { char: 'i' },
  { char: '旅', lang: 'ja' },
];

function FooterColumn({ title, jp, links }) {
  const id = useId();
  return (
    <div className={styles.column}>
      <h2 id={id} className={styles.columnTitle}>
        {title}
        <span lang="ja" className={styles.columnJp}>
          {jp}
        </span>
      </h2>
      <ul className={styles.links} aria-labelledby={id}>
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className={styles.link}>
              <span className={styles.linkLabel}>{link.label}</span>
              {link.jp && (
                <span lang="ja" className={styles.linkJp}>
                  {link.jp}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One giant letter rising into place as the footer scrolls into view. */
function GiantLetter({ char, lang, index, progress, still }) {
  const y = useTransform(progress, [0, 1], [`${62 + index * 16}%`, '0%']);
  return (
    <motion.span lang={lang} className={cn(styles.giant, lang && styles.giantJp)} style={still ? undefined : { y }}>
      {char}
    </motion.span>
  );
}

function Wordmark() {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });
  return (
    <div ref={ref} className={styles.wordmark} aria-hidden="true">
      <div className={cn('container', styles.wordmarkInner)}>
        {WORDMARK.map((letter, i) => (
          <GiantLetter key={letter.char} {...letter} index={i} progress={scrollYProgress} still={reduce} />
        ))}
      </div>
    </div>
  );
}

/**
 * Editorial footer on a sumi-ink band (dark in both themes): statement and
 * proverb, where the content comes from (real places, checked facts,
 * credited photographs) with a link to the Credits page and the "Load
 * photos from Wikimedia Commons" switch, link columns into the library, a live "Now in Japan" strip, small
 * print, and a giant TABI 旅 wordmark that rises on scroll. Hidden on the
 * immersive viewer route by <AppShell>.
 */
export function Footer() {
  const reduce = useReducedMotion();
  const { builtins } = useBrochures();
  const remix = builtins[0];

  const studioLinks = [
    { to: '/studio', label: 'Design a brochure', jp: '作る' },
    remix && { to: `/studio?from=${remix.slug}`, label: `Remix ${remix.title.split(':')[0]}`, jp: 'アレンジ' },
    { to: '/brochures?fav=1', label: 'Your favourites', jp: 'お気に入り' },
    { to: '/brochures', label: 'All brochures', jp: '一覧' },
  ].filter(Boolean);

  const backToTop = () => {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    document.getElementById('main')?.focus({ preventScroll: true });
  };

  return (
    <footer className={styles.footer} data-theme="dark" data-print="hide">
      <div className={cn('container', styles.top)}>
        <section className={styles.about} aria-labelledby="footer-about">
          <h2 id="footer-about" className={styles.statement}>
            Japan, <em className="serif-italic">folded</em> into pages.
          </h2>
          <p className={styles.blurb}>
            <span lang="ja">旅</span> <em>tabi</em> means journey. Tabi is a small library of interactive brochures about
            real places in Japan — each one turns like paper and can be remixed in the Studio. Everything you make stays
            in your browser.
          </p>
          <div className={styles.letters}>
            <h3 className={styles.lettersTitle}>
              Real places, credited
              <span lang="ja" className={styles.columnJp}>
                出典
              </span>
            </h3>
            <p className={styles.lettersNote}>
              Facts are checked against official sources. Photographs of the places come from Wikimedia Commons under
              free licences, credited to the people who took them.
            </p>
            <Link to="/credits" className={styles.creditsLink}>
              Credits &amp; sources
              <span lang="ja" className={styles.creditsJp} aria-hidden="true">
                奥付
              </span>
              <ArrowRight aria-hidden="true" focusable="false" className={styles.creditsArrow} />
            </Link>
            <LivePhotosToggle className={styles.livePhotos} />
          </div>
        </section>

        <nav className={styles.columns} aria-label="Footer">
          <FooterColumn
            title="Explore"
            jp="探す"
            links={CATEGORIES.map((c) => ({ to: `/brochures?category=${c.id}`, label: c.label, jp: c.jp }))}
          />
          <FooterColumn
            title="Regions"
            jp="地方"
            links={REGIONS.map((r) => ({ to: `/brochures?region=${r.id}`, label: r.label, jp: r.jp }))}
          />
          <FooterColumn title="Studio" jp="制作" links={studioLinks} />
        </nav>

        <figure className={styles.proverb}>
          <VerticalText as="blockquote" className={styles.proverbJp}>
            旅は道連れ、世は情け
          </VerticalText>
          <figcaption className={styles.proverbEn}>
            <em>Tabi wa michizure, yo wa nasake</em> — on the road, a companion; in life, kindness.
          </figcaption>
        </figure>
      </div>

      <div className={cn('container', styles.nowWrap)}>
        <NowInJapan className={styles.now} />
      </div>

      <div className={cn('container', styles.bottom)}>
        <p className={styles.small}>
          © {YEAR} Tabi <span lang="ja">旅</span>. Brochures by Tabi Guides, this site’s own imprint. Photographs: Wikimedia
          Commons contributors · <Link to="/credits">Credits</Link>
        </p>
        <AppearanceSwitch className={styles.appearance} />
        <button type="button" className={styles.toTop} onClick={backToTop}>
          <span>Back to top</span>
          <span lang="ja" className={styles.toTopJp} aria-hidden="true">
            上へ
          </span>
          <span className={styles.toTopIcon} aria-hidden="true">
            <ArrowUp size={16} />
          </span>
        </button>
      </div>

      <Wordmark />
    </footer>
  );
}
