import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CornerDownLeft, Search, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useBrochures } from '../../context/BrochureContext.jsx';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll.js';
import { backdrop, ease, spring } from '../../lib/motion.js';
import { cn } from '../../lib/cn.js';
import { CoverArt } from '../brochure/CoverArt.jsx';
import { Photo } from '../photo/Photo.jsx';
import { Icon, Kbd } from '../ui/index.js';
import { highlight } from './search.js';
import { createPaletteIndex, queryPalette } from './paletteItems.js';
import styles from './PalettePanel.module.css';

const SUGGESTIONS = ['Kyoto', 'Onsen', 'Autumn', 'Hokkaidō', 'Ramen', '京都'];
const JAPANESE = /[\u3040-\u30ff\u3400-\u9fff]/;

const point = (cx, cy, radius, degrees) => {
  const a = (degrees * Math.PI) / 180;
  return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
};
const toPath = (points) => points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L');

/**
 * 円相 ensō, drawn as one filled brush stroke rather than a stroked arc (an
 * even ring with a gap is what a loading spinner looks like): the brush lands
 * heavy at about one o'clock, runs clockwise and thins out as the ink dries,
 * stopping just short of where it began. A few dry hairs trail off the tail.
 */
function brushEnso({ cx = 32, cy = 32, r = 23, start = -58, sweep = 334, steps = 56 } = {}) {
  const outer = [];
  const inner = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const width = 0.9 + 5.6 * (1 - t) ** 0.75 * Math.min(1, t * 9);
    const wobble = Math.sin(t * 11) * 0.45;
    outer.push(point(cx, cy, r + wobble + width / 2, start + sweep * t));
    inner.push(point(cx, cy, r + wobble - width / 2, start + sweep * t));
  }
  const body = `M${toPath([...outer, ...inner.reverse()])} Z`;
  const hairs = [-1.7, 0.4, 1.9].map((offset, k) => {
    const from = start + sweep * (0.74 + k * 0.03);
    const to = start + sweep * (0.95 - k * 0.04);
    const arc = Array.from({ length: 9 }, (_, j) => point(cx, cy, r + offset, from + ((to - from) * j) / 8));
    return `M${toPath(arc)}`;
  });
  return { body, hairs };
}

const ENSO = brushEnso();

const panel = {
  hidden: { opacity: 0, scale: 0.96, y: -12 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring.snappy },
  exit: { opacity: 0, scale: 0.98, y: -6, transition: { duration: 0.16, ease: ease.in } },
};

/** Text with matched characters wrapped in <mark>. */
function Highlight({ text, ranges, lang }) {
  return (
    <span lang={lang}>
      {highlight(text, ranges).map((segment, i) =>
        segment.match ? (
          <mark key={i} className={styles.mark}>
            {segment.text}
          </mark>
        ) : (
          segment.text
        ),
      )}
    </span>
  );
}

/**
 * Mini cover for brochures and a picture for places — the photograph when it
 * is downloaded, the brochure's cover art until then — and an icon tile for
 * everything else.
 */
function RowVisual({ item }) {
  if (item.kind === 'brochure' || item.kind === 'place') {
    const b = item.brochure;
    const art = <CoverArt style={b.cover?.art ?? 'hinomaru'} seed={b.cover?.seed ?? 1} theme={b.theme} className={styles.swatchArt} />;
    const photo = item.kind === 'place' ? item.photo : typeof b.cover?.photo === 'string' ? b.cover.photo : '';
    return (
      <span className={cn(styles.swatch, item.kind === 'place' && styles.swatchPlace)} aria-hidden="true">
        {photo ? <Photo id={photo} brochure={b} alt="" sizes="96px" credit="none" fallback={art} className={styles.swatchArt} /> : art}
      </span>
    );
  }
  return (
    <span className={cn(styles.iconTile, item.kind === 'action' && styles.iconAction)} aria-hidden="true">
      <Icon name={item.icon} size={17} />
    </span>
  );
}

function Row({ item, id, active, onRun, onHover }) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      className={styles.row}
      data-kind={item.kind}
      data-active={active || undefined}
      onClick={() => onRun(item)}
      onPointerMove={() => !active && onHover(item.index)}
    >
      {active && <motion.span layoutId="palette-active" className={styles.activeBg} transition={spring.snappy} />}
      <RowVisual item={item} />
      <span className={styles.text}>
        <span className={styles.title}>
          <Highlight text={item.title} ranges={item.matches?.title} />
          {item.titleJp && (
            <span className={styles.titleJp}>
              <Highlight text={item.titleJp} ranges={item.matches?.titleJp} lang="ja" />
            </span>
          )}
        </span>
        <span className={styles.meta}>{item.meta}</span>
      </span>
      <span className={styles.enter} aria-hidden="true">
        <CornerDownLeft size={14} />
      </span>
    </div>
  );
}

function EmptyState({ query, onPick, onBrowse }) {
  return (
    <div className={styles.empty}>
      <svg className={styles.emptyEnso} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path d={ENSO.body} fill="currentColor" />
        {ENSO.hairs.map((d) => (
          <path key={d} d={d} className={styles.emptyHair} />
        ))}
        <text x="32" y="33" lang="ja" className={styles.emptyMu} textAnchor="middle" dominantBaseline="central">
          無
        </text>
      </svg>
      <p className={styles.emptyTitle}>
        Nothing found for <q>{query}</q>
      </p>
      <p className={styles.emptyHint}>Try a place, a season or a craving:</p>
      <div className={styles.suggestions}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className={styles.suggestion}
            onClick={() => onPick(s)}
            lang={JAPANESE.test(s) ? 'ja' : undefined}
          >
            {s}
          </button>
        ))}
      </div>
      <button type="button" className={styles.browse} onClick={onBrowse}>
        Browse the whole library →
      </button>
    </div>
  );
}

/**
 * The ⌘K / Ctrl K command palette panel: search brochures, the places in
 * them (place pages), library filters, pages (Credits too) and actions. ARIA combobox + listbox with aria-activedescendant;
 * ↑ ↓ Home End to move, Enter to open, Esc to close. Lazy-loaded by
 * <CommandPalette> so its search index, cover art and icon registry stay out
 * of the entry chunk. Props: onClose.
 */
export default function PalettePanel({ onClose }) {
  const navigate = useNavigate();
  const { theme, preference, toggle, setPreference } = useTheme();
  const { brochures, builtins, recentIds } = useBrochures();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const baseId = useId();
  const listId = `${baseId}-list`;

  useFocusTrap(panelRef, true, inputRef);
  useLockBodyScroll(true);

  const paletteIndex = useMemo(() => createPaletteIndex({ brochures, theme, preference }), [brochures, theme, preference]);
  const { groups, flat } = useMemo(() => queryPalette(paletteIndex, query, recentIds), [paletteIndex, query, recentIds]);
  const activeIndex = flat.length ? Math.min(active, flat.length - 1) : -1;
  const activeItem = flat[activeIndex];
  const optionId = (item) => `${baseId}-opt-${item.index}`;
  const activeId = activeItem ? optionId(activeItem) : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const run = (item) => {
    onClose();
    if (item.action === 'toggle-theme') toggle();
    else if (item.action === 'theme-system') setPreference('system');
    else if (item.action === 'random-brochure') {
      const pool = builtins.length ? builtins : brochures;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick) navigate(`/brochures/${pick.slug}`);
    } else if (item.to) navigate(item.to);
  };

  const updateQuery = (value) => {
    setQuery(value);
    setActive(0);
  };

  const onInputKeyDown = (event) => {
    if (!flat.length) return;
    const last = flat.length - 1;
    const moves = {
      ArrowDown: activeIndex >= last ? 0 : activeIndex + 1,
      ArrowUp: activeIndex <= 0 ? last : activeIndex - 1,
      Home: 0,
      End: last,
    };
    if (event.key in moves && !event.shiftKey) {
      event.preventDefault();
      setActive(moves[event.key]);
    } else if (event.key === 'Enter' && activeItem) {
      event.preventDefault();
      run(activeItem);
    }
  };

  const trimmed = query.trim();

  return (
    <div className={styles.root} data-print="hide">
      <motion.div
        className={styles.backdrop}
        variants={backdrop}
        initial="hidden"
        animate="show"
        exit="exit"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search Tabi"
        className={styles.panel}
        variants={panel}
        initial="hidden"
        animate="show"
        exit="exit"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <div className={styles.searchRow}>
          <Search className={styles.searchIcon} size={20} aria-hidden="true" />
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label="Search brochures, places, pages and actions"
            placeholder="Search Kyoto, onsen, 秋…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
          />
          {query && (
            <button type="button" className={styles.clear} onClick={() => updateQuery('')} aria-label="Clear search">
              <X size={15} aria-hidden="true" />
            </button>
          )}
          <button type="button" className={styles.esc} onClick={onClose} aria-label="Close search">
            <span className={styles.escKey}>Esc</span>
            <X className={styles.escIcon} size={18} aria-hidden="true" />
          </button>
        </div>

        <motion.div layoutScroll className={styles.results}>
          <div id={listId} role="listbox" aria-label="Results" className={styles.listbox}>
            {groups.map((group) => (
              <div key={group.id} role="group" aria-labelledby={`${baseId}-${group.id}`} className={styles.group}>
                <div id={`${baseId}-${group.id}`} className={styles.groupLabel}>
                  <span>{group.label}</span>
                  <span lang="ja" className={styles.groupJp} aria-hidden="true">
                    {group.jp}
                  </span>
                </div>
                {group.items.map((item) => (
                  <Row
                    key={item.id}
                    id={optionId(item)}
                    item={item}
                    active={item.index === activeIndex}
                    onRun={run}
                    onHover={setActive}
                  />
                ))}
              </div>
            ))}
          </div>
          {!flat.length && (
            <EmptyState
              query={trimmed}
              onPick={(s) => {
                updateQuery(s);
                inputRef.current?.focus();
              }}
              onBrowse={() => {
                onClose();
                navigate(`/brochures?q=${encodeURIComponent(trimmed)}`);
              }}
            />
          )}
        </motion.div>

        {/* A div: a <footer> portalled to <body> would be a second contentinfo landmark. */}
        <div className={styles.footer}>
          <span className={styles.hint}>
            <Kbd className={styles.kbd}>↑</Kbd>
            <Kbd className={styles.kbd}>↓</Kbd> Navigate
          </span>
          <span className={styles.hint}>
            <Kbd className={styles.kbd}>↵</Kbd> Open
          </span>
          <span className={styles.hint}>
            <Kbd className={styles.kbd}>Esc</Kbd> Close
          </span>
          <span className={styles.tagline} aria-hidden="true">
            Japan, folded into pages
          </span>
          <span className={styles.count} aria-live="polite" aria-atomic="true">
            {trimmed ? `${flat.length} ${flat.length === 1 ? 'result' : 'results'}` : ''}
          </span>
          <span lang="ja" className={styles.brand} aria-hidden="true">
            旅
          </span>
        </div>
      </motion.div>
    </div>
  );
}
