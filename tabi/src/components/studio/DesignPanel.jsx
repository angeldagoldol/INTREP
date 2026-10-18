import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '../ui/index.js';
import { spring } from '../../lib/motion.js';
import { contrast, ensureContrast, isDark } from '../brochure/art/color.js';
import { nextIndex } from './a11y.js';
import { ArtPicker } from './fields/ArtPicker.jsx';
import { ColorField } from './fields/ColorField.jsx';
import { DiceButton } from './fields/DiceButton.jsx';
import { Note } from './Note.jsx';
import { PALETTES, matchPalette } from './palettes.js';
import { PanelSection } from './PanelSection.jsx';
import { SegmentedControl } from './SegmentedControl.jsx';
import { studioActions as A } from './studioReducer.js';
import styles from './Panels.module.css';

const COLOURS = [
  { key: 'paper', label: 'Paper', jp: '紙' },
  { key: 'ink', label: 'Ink', jp: '墨' },
  { key: 'accent', label: 'Accent', jp: '差し色' },
  { key: 'accent2', label: 'Second accent', jp: '添え色' },
  { key: 'muted', label: 'Muted text', jp: '淡色' },
];

const TYPEFACES = [
  { value: 'serif', label: 'Serif', sub: '明朝', lang: 'ja', style: { fontFamily: 'var(--font-display)', fontSize: '1.05rem' } },
  { value: 'sans', label: 'Sans', sub: 'ゴシック', lang: 'ja', style: { fontFamily: 'var(--font-sans)', fontSize: '1rem' } },
  { value: 'mono', label: 'Mono', sub: '等幅', lang: 'ja', style: { fontFamily: 'var(--font-mono)', fontSize: '0.95rem' } },
];

function PaletteGrid({ theme, onPick }) {
  const refs = useRef([]);
  const active = matchPalette(theme);
  const current = PALETTES.findIndex((p) => p.id === active?.id);

  const onKeyDown = (event) => {
    const next = nextIndex(event.key, Math.max(0, current), PALETTES.length);
    if (next === -1) return;
    event.preventDefault();
    onPick(PALETTES[next]);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Colour palette" className={styles.palettes} onKeyDown={onKeyDown}>
      {PALETTES.map((palette, index) => {
        const checked = palette.id === active?.id;
        const { paper, ink, accent, accent2, muted } = palette.theme;
        return (
          <button
            key={palette.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (current === -1 && index === 0) ? 0 : -1}
            className={styles.palette}
            style={{ '--p-paper': paper, '--p-ink': ink }}
            onClick={() => onPick(palette)}
            title={palette.note}
          >
            <span className={styles.chips} aria-hidden="true">
              {[paper, ink, accent, accent2, muted].map((colour, i) => (
                <span key={i} style={{ background: colour }} />
              ))}
            </span>
            <span lang="ja" className={styles.paletteJp}>
              {palette.jp}
            </span>
            <span className={styles.paletteName}>{palette.name}</span>
            {checked && (
              <motion.span className={styles.paletteCheck} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.bouncy}>
                <Check size={12} strokeWidth={3} aria-hidden="true" />
              </motion.span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Look and feel: palette presets, custom colours with a contrast check,
 * heading typeface and the generative cover artwork (with a seed shuffle).
 *   <DesignPanel brochure={doc} dispatch={dispatch} />
 */
export function DesignPanel({ brochure, dispatch }) {
  const theme = brochure.theme ?? {};
  const active = matchPalette(theme);
  const ratio = contrast(theme.ink, theme.paper);
  const lowContrast = ratio < 4.5;

  const fixContrast = () => {
    const toward = isDark(theme.paper) ? '#ffffff' : '#000000';
    dispatch(A.setTheme('ink', ensureContrast(theme.ink, theme.paper, 7, toward)));
  };

  return (
    <div className={styles.panel}>
      <PanelSection title="Palette" jp="配色" note={active ? active.name : 'Custom mix'}>
        <PaletteGrid theme={theme} onPick={(palette) => dispatch(A.applyPalette(palette.theme))} />
        <p className={styles.caption} aria-live="polite">
          {active ? active.note : 'Your own colours — pick a palette to start again from a classic pairing.'}
        </p>
      </PanelSection>

      <PanelSection title="Colours" jp="色">
        <div className={styles.colours}>
          {COLOURS.map((c) => (
            <ColorField
              key={c.key}
              label={c.label}
              jp={c.jp}
              value={theme[c.key]}
              onChange={(value, { typing }) => dispatch(A.setTheme(c.key, value, typing))}
            />
          ))}
        </div>
        <div className={styles.contrast} data-low={lowContrast || undefined} aria-live="polite">
          <span className={styles.sample} style={{ background: theme.paper, color: theme.ink }} aria-hidden="true">
            Aa
          </span>
          <span className={styles.ratio}>
            Ink on paper <strong>{ratio.toFixed(1)} : 1</strong>
          </span>
          <span className={styles.grade}>{ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'Too low'}</span>
        </div>
        {lowContrast && (
          <Note
            tone="warning"
            action={
              <Button size="sm" variant="secondary" onClick={fixContrast}>
                Fix contrast
              </Button>
            }
          >
            Body text needs at least 4.5 : 1 to be easy to read. Darken the ink or lighten the paper.
          </Note>
        )}
      </PanelSection>

      <PanelSection title="Typeface" jp="書体">
        <SegmentedControl label="Heading typeface" value={theme.typeface ?? 'serif'} onChange={(v) => dispatch(A.setTheme('typeface', v))} options={TYPEFACES} size="lg" />
      </PanelSection>

      <PanelSection title="Cover art" jp="表紙の絵" note={`Seed ${String(brochure.cover?.seed ?? 1).padStart(4, '0')}`}>
        <ArtPicker value={brochure.cover?.art} seed={brochure.cover?.seed} theme={theme} onChange={(art) => dispatch(A.setCover({ art }))} />
        <div className={styles.seedRow}>
          <p className={styles.seedHint}>Same motif, new composition — every seed draws a different picture.</p>
          <DiceButton showLabel label="Shuffle" onRoll={(seed) => dispatch(A.setCover({ seed }))} />
        </div>
      </PanelSection>
    </div>
  );
}
