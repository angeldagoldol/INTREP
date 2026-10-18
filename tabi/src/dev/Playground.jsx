import { useEffect, useMemo, useState } from 'react';
import { BrochurePage } from '../components/brochure/BrochurePage.jsx';
import { CoverArt } from '../components/brochure/CoverArt.jsx';
import { Photo } from '../components/photo/Photo.jsx';
import { Button, Chip, Field, Select, Switch } from '../components/ui/index.js';
import { BROCHURES } from '../data/brochures.js';
import { ART_LABELS, ART_STYLES, PAGE_TYPE_IDS } from '../data/schema.js';
import { auditAll } from './audit.js';
import styles from './Playground.module.css';

const SECTIONS = [
  { id: 'art', label: 'Art styles' },
  { id: 'reader', label: 'Reader size' },
  { id: 'pages', label: 'Thumbnails' },
  { id: 'audit', label: 'Audit' },
  { id: 'large', label: 'Large brochure' },
  { id: 'empty', label: 'Empty pages' },
  { id: 'photo', label: 'Photo states' },
  { id: 'real', label: 'Place, gallery & quote pages' },
];

/** Real places for the place, gallery and quote pages (coordinates WGS84, 4 decimals). */
const REAL_PAGES = [
  {
    id: 'demo-place',
    type: 'place',
    kicker: 'Spotlight',
    name: 'Kiyomizu-dera',
    nameJp: '清水寺',
    photo: 'kyoto-kiyomizu-dera',
    body: 'A Buddhist temple on the slopes of Mount Otowa, founded in 778. Its main hall stands on a wooden stage held up by tall pillars, built without nails.\n\nCome at opening time for the view over the city before the crowds.',
    facts: [
      { label: 'Hours', value: 'Usually from 6:00; closing varies by season' },
      { label: 'Getting there', value: 'Bus to Gojōzaka or Kiyomizu-michi, then a 10-minute walk uphill' },
      { label: 'Time needed', value: '1–1.5 hours' },
    ],
    lat: 34.9949,
    lng: 135.785,
    website: 'https://www.kiyomizudera.or.jp/en/',
  },
  {
    id: 'demo-gallery-3',
    type: 'gallery',
    heading: 'A closer look',
    items: [
      { photo: 'kyoto-senbon-torii', art: 'torii', seed: 11, caption: 'Senbon Torii at Fushimi Inari Taisha' },
      { photo: 'kyoto-kiyomizu-dera', art: 'enso', seed: 23, caption: 'The stage of Kiyomizu-dera' },
      { art: 'sakura', seed: 37, caption: 'No photo yet: the art stands in' },
    ],
  },
  {
    id: 'demo-gallery-4',
    type: 'gallery',
    heading: 'Four plates',
    items: [
      { photo: 'kyoto-senbon-torii', art: 'torii', seed: 11, caption: 'Senbon Torii at Fushimi Inari Taisha' },
      { photo: 'kyoto-kiyomizu-dera', art: 'enso', seed: 23, caption: 'The stage of Kiyomizu-dera' },
      { art: 'sakura', seed: 37, caption: 'Petals on the river' },
      { art: 'kumo', seed: 41, caption: 'Clouds over the hills' },
    ],
  },
  {
    id: 'demo-quote',
    type: 'quote',
    quoteJp: '古池や蛙飛び込む水の音',
    quote: 'The old pond — a frog jumps in, the sound of water.',
    author: 'Matsuo Bashō',
    role: '1686 · Translation: Tabi Guides',
  },
];

/**
 * A test card drawn on a canvas at runtime (never a real photograph, never
 * written to public/photos), wrapped as a photo record so <Photo> can be
 * tried before any real photo is downloaded.
 */
function useTestCard() {
  const [record, setRecord] = useState(null);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1067;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const sky = ctx.createLinearGradient(0, 0, 0, 1067);
    sky.addColorStop(0, '#f2c9a0');
    sky.addColorStop(0.55, '#d96f4a');
    sky.addColorStop(1, '#3b2a33');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1600, 1067);
    ctx.fillStyle = '#f7e6c8';
    ctx.beginPath();
    ctx.arc(1120, 380, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a1d24';
    ctx.beginPath();
    ctx.moveTo(0, 1067);
    ctx.lineTo(0, 760);
    ctx.lineTo(420, 520);
    ctx.lineTo(760, 700);
    ctx.lineTo(1100, 560);
    ctx.lineTo(1600, 820);
    ctx.lineTo(1600, 1067);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 44px ui-monospace, monospace';
    ctx.fillText('TEST CARD · not a real photograph', 60, 100);
    const tiny = document.createElement('canvas');
    tiny.width = 24;
    tiny.height = 16;
    tiny.getContext('2d').drawImage(canvas, 0, 0, 24, 16);
    let url = '';
    canvas.toBlob((blob) => {
      if (!blob) return;
      url = URL.createObjectURL(blob);
      setRecord({
        id: 'test-card',
        alt: 'A test card: a sunset gradient behind a dark mountain ridge',
        caption: 'Test card',
        focus: '70% 40%',
        width: 1600,
        height: 1067,
        widths: [1600],
        lqip: tiny.toDataURL('image/png'),
        color: '#b65a44',
        credit: { author: 'Tabi test card', authorUrl: '', license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', sourceUrl: 'https://example.com/test-card' },
        attributionRequired: false,
        available: true,
        src: () => url,
        srcSet: `${url} 1600w`,
      });
    }, 'image/png');
    return () => url && URL.revokeObjectURL(url);
  }, []);
  return record;
}

const DEFAULT_SEEDS = [7, 23, 61];

/**
 * The same brochure on dark paper (a sumi-ink user palette): paper and ink
 * swapped for near-black and cream, accents kept — the page's themeVars then
 * nudge every accent to a readable contrast, as they do for Studio themes.
 */
function onDarkPaper(brochure) {
  const theme = brochure.theme ?? {};
  return { ...brochure, theme: { ...theme, paper: '#1a1714', ink: '#efe7d8', muted: '#b4a898' } };
}

/** Reader-size widths (px) to review at: a phone, a laptop page and a large one. */
const READER_WIDTHS = [340, 460, 640];
const CROPS = { native: '1 / 1.414', '3:4': '3 / 4', '1:1': '1 / 1' };

const params = new URLSearchParams(window.location.search);
const SEEDS = params.get('seeds')?.split(',').map(Number).filter(Number.isFinite) ?? DEFAULT_SEEDS;
const STYLES = ART_STYLES.includes(params.get('style')) ? [params.get('style')] : ART_STYLES;
const EMPTY_BROCHURE = { id: 'b_empty', slug: 'empty', pages: PAGE_TYPE_IDS.map((type) => ({ id: type, type })) };

/**
 * Dev-only workbench for the brochure kit: every art style × seed × theme,
 * every page of every brochure as thumbnails, one brochure at reading size,
 * and every page type with empty fields. Query params (section, style,
 * seeds, b, crop, animate, a, z) pin a view for screenshots.
 */
export function Playground() {
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [animated, setAnimated] = useState(params.get('animate') === '1');
  const [crop, setCrop] = useState(CROPS[params.get('crop')] ? params.get('crop') : 'native');
  const [slug, setSlug] = useState(params.get('b') ?? BROCHURES[0].slug);
  const [themeA, setThemeA] = useState(params.get('a') ?? BROCHURES[0].slug);
  const [themeB, setThemeB] = useState(params.get('z') ?? BROCHURES[1].slug);
  const [activePage, setActivePage] = useState(0);
  const [cta, setCta] = useState(0);
  const [paper, setPaper] = useState(params.get('paper') === 'dark' ? 'dark' : 'theme');
  const [readerSlug, setReaderSlug] = useState(params.get('rb') ?? 'all');
  const [readerWidth, setReaderWidth] = useState(READER_WIDTHS.includes(Number(params.get('w'))) ? Number(params.get('w')) : 460);
  const [report, setReport] = useState(null);
  const testCard = useTestCard();
  const shelf = useMemo(() => (paper === 'dark' ? BROCHURES.map(onDarkPaper) : BROCHURES), [paper]);
  const readerBrochures = readerSlug === 'all' ? shelf : shelf.filter((b) => b.slug === readerSlug);
  const userPhotoBrochure = useMemo(
    () => (testCard ? { userPhotos: { card: { src: testCard.src(), alt: 'A test card uploaded by a user', width: 1600, height: 1067, credit: { author: 'A Studio user', license: 'CC BY 4.0' } } } } : null),
    [testCard],
  );
  const kyotoTheme = (BROCHURES.find((x) => x.slug === 'kyoto-thousand-gates') ?? BROCHURES[0]).theme;
  const only = params.get('section');
  const brochure = BROCHURES.find((b) => b.slug === slug) ?? BROCHURES[0];
  const themes = [themeA, themeB].map((s) => BROCHURES.find((b) => b.slug === s) ?? BROCHURES[0]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  // window.__tabiAudit() for scripted checks; ?audit=1 runs it once fonts and photos settle.
  useEffect(() => {
    const run = () => {
      const issues = auditAll(document);
      setReport(issues);
      return issues;
    };
    window.__tabiAudit = run;
    if (params.get('audit') !== '1') return undefined;
    let timer = 0;
    document.fonts?.ready.then(() => {
      timer = window.setTimeout(run, 2500);
    });
    return () => window.clearTimeout(timer);
  }, []);

  const show = (id) => !only || only === id;
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <p className={styles.brand}>
          <span lang="ja">旅</span> Tabi kit
        </p>
        <nav className={styles.nav} aria-label="Sections">
          {SECTIONS.filter((s) => show(s.id)).map((s) => (
            <Chip key={s.id} onClick={() => jump(s.id)}>
              {s.label}
            </Chip>
          ))}
        </nav>
        <div className={styles.controls}>
          <Field label="Paper">
            <Select value={paper} onChange={(e) => setPaper(e.target.value)}>
              <option value="theme">Brochure theme</option>
              <option value="dark">Dark paper</option>
            </Select>
          </Field>
          <Switch checked={animated} onChange={setAnimated} label="Animate art" />
          <Switch checked={dark} onChange={setDark} label="Dark app" />
        </div>
      </header>

      {show('art') && (
        <section id="art" className={styles.section} aria-labelledby="art-title">
          <div className={styles.sectionHead}>
            <h2 id="art-title" className={styles.title}>Art styles · 3 seeds × 2 themes</h2>
            <div className={styles.filters}>
              <Field label="Theme A">
                <Select value={themeA} onChange={(e) => setThemeA(e.target.value)}>
                  {BROCHURES.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Theme B">
                <Select value={themeB} onChange={(e) => setThemeB(e.target.value)}>
                  {BROCHURES.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Crop">
                <Select value={crop} onChange={(e) => setCrop(e.target.value)}>
                  {Object.keys(CROPS).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
          <div className={styles.artRows}>
            {STYLES.map((style) => (
              <div key={style} className={styles.artRow}>
                <p className={styles.artName}>
                  {ART_LABELS[style].label} <span lang="ja">{ART_LABELS[style].jp}</span>
                </p>
                <div className={styles.artGrid}>
                  {themes.flatMap((b) =>
                    SEEDS.map((seed) => (
                      <figure key={`${b.slug}-${seed}`} className={styles.artTile}>
                        <div className={styles.artFrame} style={{ aspectRatio: CROPS[crop] }}>
                          <CoverArt style={style} seed={seed} theme={b.theme} animated={animated} title={`${style} ${seed}`} />
                        </div>
                        <figcaption>{`${seed} · ${b.titleJp}`}</figcaption>
                      </figure>
                    )),
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {show('reader') && (
        <section id="reader" className={styles.section} aria-labelledby="reader-title">
          <div className={styles.sectionHead}>
            <h2 id="reader-title" className={styles.title}>
              Every page at reader size
            </h2>
            <div className={styles.filters}>
              <Field label="Brochure">
                <Select value={readerSlug} onChange={(e) => setReaderSlug(e.target.value)}>
                  <option value="all">All brochures</option>
                  {BROCHURES.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Page width">
                <Select value={readerWidth} onChange={(e) => setReaderWidth(Number(e.target.value))}>
                  {READER_WIDTHS.map((w) => (
                    <option key={w} value={w}>{`${w}px`}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
          {readerBrochures.map((b) => (
            <div key={b.id} className={styles.strip}>
              <p className={styles.stripTitle}>
                {b.title} <span>{`${b.pages.length} pages · ${b.factsChecked ? `facts checked ${b.factsChecked}` : 'facts not checked'}`}</span>
              </p>
              <div className={styles.readerRow} style={{ '--page-w': `${readerWidth}px` }}>
                {b.pages.map((page, i) => (
                  <BrochurePage key={page.id} brochure={b} page={page} index={i} total={b.pages.length} className={styles.readerPage} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {show('audit') && (
        <section id="audit" className={styles.section} aria-labelledby="audit-title">
          <div className={styles.sectionHead}>
            <h2 id="audit-title" className={styles.title}>
              Layout audit
            </h2>
            <Button size="sm" variant="secondary" onClick={() => setReport(auditAll(document))}>
              Audit every page on screen
            </Button>
          </div>
          <div aria-live="polite">
            {report === null ? (
              <p className={styles.note}>Checks every page rendered above for clipped, cut-off or off-page text (add ?audit=1 to run on load).</p>
            ) : report.length === 0 ? (
              <p className={styles.note} data-audit="clean">
                No clipped text on any page.
              </p>
            ) : (
              <ol className={styles.audit} data-audit="issues">
                {report.map((issue, i) => (
                  <li key={i}>
                    <strong>{issue.kind}</strong> {issue.where} — “{issue.text}”
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}

      {show('pages') && (
        <section id="pages" className={styles.section} aria-labelledby="pages-title">
          <h2 id="pages-title" className={styles.title}>Every page of every brochure · thumbnails</h2>
          {shelf.map((b) => (
            <div key={b.id} className={styles.strip}>
              <p className={styles.stripTitle}>
                {b.title} <span>{`${b.pages.length} pages · ${b.cover.art}`}</span>
              </p>
              <div className={styles.thumbs}>
                {b.pages.map((page, i) => (
                  <BrochurePage key={page.id} brochure={b} page={page} index={i} total={b.pages.length} isStatic className={styles.thumb} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {show('large') && (
        <section id="large" className={styles.section} aria-labelledby="large-title">
          <div className={styles.sectionHead}>
            <h2 id="large-title" className={styles.title}>Reading size</h2>
            <div className={styles.filters}>
              <Field label="Brochure">
                <Select
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setActivePage(0);
                  }}
                >
                  {BROCHURES.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <p className={styles.note} aria-live="polite">
                {`Active page ${activePage + 1} · CTA clicks ${cta}`}
              </p>
            </div>
          </div>
          <div className={styles.large}>
            {brochure.pages.map((page, i) => (
              <div key={page.id} className={styles.largeItem}>
                <BrochurePage
                  brochure={brochure}
                  page={page}
                  index={i}
                  total={brochure.pages.length}
                  active={i === activePage}
                  onCta={() => setCta((n) => n + 1)}
                  className={styles.largePage}
                />
                <Button size="sm" variant={i === activePage ? 'accent' : 'secondary'} onClick={() => setActivePage(i)}>
                  {i === activePage ? `Page ${i + 1} is active` : `Activate page ${i + 1}`}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {show('photo') && (
        <section id="photo" className={styles.section} aria-labelledby="photo-title">
          <h2 id="photo-title" className={styles.title}>Photo states · runtime test card</h2>
          <div className={styles.photos}>
            {[
              ['Loaded · overlay credit', { photo: testCard, credit: 'overlay' }],
              ['Caption credit · rounded', { photo: testCard, credit: 'caption', rounded: true }],
              ['Contain', { photo: testCard, fit: 'contain' }],
              ['Ken Burns', { photo: testCard, kenBurns: true, credit: 'overlay' }],
              ['Unknown id → fallback art', { id: 'no-such-photo' }],
              ['Listed, not downloaded → fallback art', { id: 'kyoto-senbon-torii', credit: 'overlay' }],
              ['Uploaded (user:card) via brochure', { id: 'user:card', brochure: userPhotoBrochure, credit: 'caption' }],
              ['Upload with a hotlink → fallback art', { id: 'user:x', brochure: { userPhotos: { x: { src: 'https://example.com/x.jpg' } } } }],
            ].map(([label, props], i) => (
              <figure key={label} className={styles.photoTile}>
                <div className={styles.photoBox}>
                  <Photo sizes="320px" {...props} fallback={<CoverArt style="torii" seed={5 + i} theme={kyotoTheme} />} />
                </div>
                <figcaption>{label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {show('real') && (
        <section id="real" className={styles.section} aria-labelledby="real-title">
          <h2 id="real-title" className={styles.title}>Place, gallery and quote pages (photos not downloaded: art stands in)</h2>
          <div className={styles.large}>
            {REAL_PAGES.map((page, i) => (
              <div key={page.id} className={styles.largeItem}>
                <BrochurePage brochure={brochure} page={page} index={i + 3} total={14} active={i === activePage} className={styles.largePage} />
              </div>
            ))}
          </div>
        </section>
      )}

      {show('empty') && (
        <section id="empty" className={styles.section} aria-labelledby="empty-title">
          <h2 id="empty-title" className={styles.title}>Every page type with empty fields</h2>
          <div className={styles.thumbs}>
            {[...EMPTY_BROCHURE.pages, { id: 'mystery', type: 'mystery' }].map((page, i) => (
              <BrochurePage key={page.id} brochure={EMPTY_BROCHURE} page={page} index={i} total={EMPTY_BROCHURE.pages.length + 1} className={styles.emptyPage} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
