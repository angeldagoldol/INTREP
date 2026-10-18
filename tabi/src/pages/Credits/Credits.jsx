import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Counter, RevealText } from '../../components/ui/index.js';
import { LivePhotosToggle } from '../../components/photo/LivePhotosToggle.jsx';
import { MastheadPlate } from '../../components/photo/MastheadPlate.jsx';
import { useLivePhotos } from '../../components/photo/useLivePhotos.js';
import { useBrochures } from '../../context/BrochureContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { listPhotos, photoIdsIn } from '../../data/photos/index.js';
import { pad } from '../../lib/format.js';
import { ease, fadeUp, stagger } from '../../lib/motion.js';
import { homePhotoIds } from '../Home/homeContent.js';
import { creditGroups, creditTotals, licenceSummary } from './credits.js';
import { ALSO } from './creditsContent.js';
import { CreditsSection } from './CreditsSection.jsx';
import { FactsTable } from './FactsTable.jsx';
import { PhotoGroups } from './PhotoGroups.jsx';
import { TypeSpecimens } from './TypeSpecimens.jsx';
import styles from './Credits.module.css';

/** The masthead's photograph, in order of preference: a nostalgic street from the Nostalgic Japan brochure. */
const PLATE_PHOTOS = ['nostalgic-higashi-chaya', 'nostalgic-kakunodate', 'nostalgic-ginzan'];

/** Every photograph the Home page shows (hero, Nostalgic Japan, seasons, regions). */
const HOME_PHOTO_IDS = homePhotoIds(listPhotos());

const SECTIONS = [
  { id: 'credits-photos', title: 'Photographs', jp: '写真' },
  { id: 'credits-facts', title: 'Facts & sources', jp: '出典' },
  { id: 'credits-type', title: 'Typefaces', jp: '書体' },
  { id: 'credits-also', title: 'Also', jp: '他' },
];

const rule = {
  hidden: { scaleX: 0 },
  show: { scaleX: 1, transition: { duration: 1.2, ease: ease.out, delay: 0.3 } },
};

/**
 * #/credits — 奥付 (okuzuke), the colophon of the whole site: every
 * photograph's credit grouped by where it appears (Home, each brochure, the
 * visitor's own uploads) with licence links, how the facts are checked
 * (with the standard and each brochure's research log), the typefaces
 * (Google Fonts, OFL) and the rest. A contents list jumps to each section (hash routing: no #anchors).
 */
export default function Credits() {
  useDocumentTitle('Credits & sources');
  const reduceMotion = useReducedMotion();
  const { builtins, userBrochures } = useBrochures();

  // Every photograph Tabi lists: those not bundled with the site are looked up on Wikimedia Commons
  // (cached on this device), and their credits join the tables as they arrive.
  const allIds = useMemo(() => [...HOME_PHOTO_IDS, ...builtins.flatMap((b) => photoIdsIn(b))], [builtins]);
  const live = useLivePhotos(allIds);
  const groups = useMemo(
    () =>
      creditGroups({
        homeIds: HOME_PHOTO_IDS,
        builtins,
        userBrochures,
        getPhoto: live.getPhoto,
        resolvePhoto: live.resolvePhoto,
        creditsFor: live.creditsFor,
        photoIdsIn,
      }),
    [builtins, userBrochures, live],
  );
  const totals = useMemo(() => creditTotals(groups), [groups]);
  const licences = useMemo(() => licenceSummary(groups), [groups]);
  const checked = builtins.filter((b) => typeof b.factsChecked === 'string' && b.factsChecked.trim()).length;

  const stats = [
    { value: totals.credited, unit: '枚', label: totals.credited === 1 ? 'Photograph credited' : 'Photographs credited' },
    { value: totals.pending, unit: '枚', label: live.loading > 0 ? 'Being looked up' : 'Still to come' },
    { value: checked, unit: '冊', label: 'Brochures checked' },
    { value: totals.sources, unit: '件', label: 'Sources cited' },
  ];

  const jump = (id) => {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    section.querySelector('h2')?.focus({ preventScroll: true });
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={`container ${styles.headerInner}`}>
          <motion.div className={styles.headerCopy} variants={stagger(0.1, 0.15)} initial="hidden" animate="show">
            <motion.p variants={fadeUp} className={`eyebrow ${styles.eyebrow}`}>
              <span>Credits &amp; sources</span>
              <span aria-hidden="true">·</span>
              <span lang="ja" className={styles.eyebrowJp}>
                奥付
              </span>
            </motion.p>
            <RevealText as="h1" immediate delay={0.1} className={styles.title} text={['Credits, ', { text: 'with thanks.', className: 'serif-italic' }]} />
            <motion.p variants={fadeUp} className={styles.standfirst}>
              Tabi’s brochures show real places. The photographs come from Wikimedia Commons under free licences and are credited to the people who took them; the facts are checked against official sources. This page lists them all.
            </motion.p>
            <motion.dl variants={fadeUp} className={styles.stats}>
              {stats.map((item) => (
                <div key={item.label} className={styles.stat}>
                  <dt className={styles.statLabel}>{item.label}</dt>
                  <dd className={styles.statValue}>
                    <Counter value={item.value} duration={1.2} />
                    <span lang="ja" className={styles.unit} aria-hidden="true">
                      {item.unit}
                    </span>
                  </dd>
                </div>
              ))}
            </motion.dl>
          </motion.div>

          <MastheadPlate ids={PLATE_PHOTOS} jp="奥付" seal="感謝" label="Okuzuke">
            <em>Okuzuke</em> — the colophon at the back of a Japanese book: who made it, who printed it, and when.
          </MastheadPlate>
        </div>

        <div className="container">
          <motion.span className={styles.rule} variants={rule} initial="hidden" animate="show" aria-hidden="true" />
          <nav className={styles.contents} aria-label="On this page">
            <ol>
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <button type="button" className={styles.contentsLink} onClick={() => jump(s.id)}>
                    <span className={styles.contentsNum} aria-hidden="true">
                      {pad(i + 1)}
                    </span>
                    {s.title}
                    <span lang="ja" className={styles.contentsJp} aria-hidden="true">
                      {s.jp}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </header>

      <CreditsSection
        id={SECTIONS[0].id}
        num={1}
        title={SECTIONS[0].title}
        jp={SECTIONS[0].jp}
        lede="Every photograph is a real picture of a real place from Wikimedia Commons, under a free licence: public domain, CC0, CC BY or CC BY-SA, credited where it appears with a link to its file page and its licence. Photographs bundled with the site are resized and re-encoded, never altered; the others are shown straight from Wikimedia’s servers, which your browser asks for them. Until a photograph is found, its page shows generated art in its place."
      >
        <div className={styles.livePanel}>
          <LivePhotosToggle />
          {live.enabled && live.loading > 0 && (
            <p className={styles.liveStatus} role="status">
              Looking up {live.loading} {live.loading === 1 ? 'photograph' : 'photographs'} on Wikimedia Commons…
            </p>
          )}
          {live.enabled && live.blocked && (
            <p className={styles.liveStatus} role="status">
              Wikimedia Commons can’t be reached from here right now, so generated art stands in for the photographs.
            </p>
          )}
        </div>
        {licences.length > 0 && (
          <ul className={styles.licences} aria-label="Licences in use">
            {licences.map((l) => (
              <li key={l.license}>
                {l.url ? (
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className={styles.licenceChip}>
                    {l.license} <span className={styles.licenceCount}>×{l.count}</span>
                    <ArrowUpRight aria-hidden="true" focusable="false" />
                    <span className="sr-only"> (licence deed, opens in a new tab)</span>
                  </a>
                ) : (
                  <span className={styles.licenceChip}>
                    {l.license} <span className={styles.licenceCount}>×{l.count}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {totals.credited === 0 && live.loading === 0 && (
          <p className={styles.notice}>
            <span lang="ja" className={styles.noticeMark} aria-hidden="true">
              未
            </span>
            None of the {totals.pending} photographs listed for Tabi is on show yet
            {live.enabled ? ' (they appear once your browser can reach Wikimedia Commons)' : ' (live photos from Wikimedia Commons are switched off)'}, so
            every picture you see is generated art. Each one will be credited here, with its author and licence, as it arrives.
          </p>
        )}
        <PhotoGroups groups={groups} />
      </CreditsSection>

      <CreditsSection
        id={SECTIONS[1].id}
        num={2}
        title={SECTIONS[1].title}
        jp={SECTIONS[1].jp}
        lede="Real places, real facts. Here is how they are checked, and where to read the working."
      >
        <FactsTable groups={groups} />
      </CreditsSection>

      <CreditsSection
        id={SECTIONS[2].id}
        num={3}
        title={SECTIONS[2].title}
        jp={SECTIONS[2].jp}
        lede="Five families, served by Google Fonts under the SIL Open Font License. Latin is set in Fraunces and Geist; Japanese falls back to Shippori Mincho and Zen Kaku Gothic New."
      >
        <TypeSpecimens />
      </CreditsSection>

      <CreditsSection
        id={SECTIONS[3].id}
        num={4}
        title={SECTIONS[3].title}
        jp={SECTIONS[3].jp}
        lede="The cover art and patterns (seigaiha, asanoha, shippō, ichimatsu, ensō…) are generated in code. The English translations of the haiku are our own, and each says so (“Translation: Tabi Guides”). Tabi is built with open-source software:"
      >
        <ul className={styles.also}>
          {ALSO.map((item) => (
            <li key={item.name} className={styles.alsoItem}>
              <span className={styles.alsoWhat}>{item.what}</span>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.alsoName}>
                {item.name}
                <ArrowUpRight aria-hidden="true" focusable="false" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <span className={styles.alsoLicence}>{item.licence}</span>
            </li>
          ))}
        </ul>
      </CreditsSection>
    </div>
  );
}
