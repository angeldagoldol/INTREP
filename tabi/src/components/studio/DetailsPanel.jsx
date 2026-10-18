import { CalendarCheck, X } from 'lucide-react';
import { CATEGORIES } from '../../data/categories.js';
import { REGIONS } from '../../data/regions.js';
import { FORMATS } from '../../data/schema.js';
import { Button, Field, Select } from '../ui/index.js';
import { monthYear, urlCheck } from './fieldChecks.js';
import { CoordsField } from './fields/CoordsField.jsx';
import { ListEditor } from './fields/ListEditor.jsx';
import { SeasonPicker } from './fields/SeasonPicker.jsx';
import { TextField } from './fields/TextField.jsx';
import { TokenInput } from './fields/TokenInput.jsx';
import { UrlField } from './fields/UrlField.jsx';
import { PanelSection } from './PanelSection.jsx';
import { SegmentedControl } from './SegmentedControl.jsx';
import { DOC_LIST_LIMITS, studioActions as A } from './studioReducer.js';
import styles from './Panels.module.css';

const FORMAT_JP = { booklet: '冊子', bifold: '二つ折り', trifold: '三つ折り' };
const FORMAT_OPTIONS = FORMATS.map((f) => ({ value: f.id, label: f.label, sub: FORMAT_JP[f.id], lang: 'ja' }));

/**
 * The real place the brochure is about: its names, prefecture and
 * coordinates (printed on the cover beside the Japanese title, and found by
 * search).
 */
function LocationSection({ location, dispatch }) {
  const loc = location && typeof location === 'object' ? location : {};
  const set = (field) => (value) => dispatch(A.updateDoc(['location', field], value, true));
  return (
    <PanelSection title="Place" jp="場所" note={loc.name ? undefined : 'Optional'}>
      <div className={styles.pair}>
        <TextField label="Main place" value={loc.name} onChange={set('name')} max={60} placeholder="Fushimi Inari Taisha" />
        <TextField label="In Japanese" lang="ja" value={loc.nameJp} onChange={set('nameJp')} max={20} placeholder="伏見稲荷大社" />
      </div>
      <TextField label="Prefecture" value={loc.prefecture} onChange={set('prefecture')} max={24} placeholder="Kyoto" />
      <CoordsField label="Coordinates" lat={loc.lat} lng={loc.lng} onChange={(coords, typing) => dispatch(A.updateDoc(['location'], { ...loc, ...coords }, typing))} />
      {location && (
        <Button size="sm" variant="ghost" iconLeft={<X />} onClick={() => dispatch(A.updateDoc(['location'], null))} className={styles.quiet}>
          Clear the place
        </Button>
      )}
    </PanelSection>
  );
}

/** Where the facts come from: official sites first. Each is a label and an https link. */
function SourcesSection({ sources, dispatch }) {
  const list = Array.isArray(sources) ? sources : [];
  const broken = list.filter((s) => ['invalid', 'http', 'bare'].includes(urlCheck(s?.url).state)).length;
  return (
    <PanelSection title="Sources" jp="出典" note={list.length ? `${list.length} listed` : 'None yet'}>
      <p className={styles.help}>
        Official sites first — the temple, museum or city tourism office — then guides you checked. The back page counts them beside the date you checked.
        A source is kept once it has its link.
      </p>
      <ListEditor
        title="Sources"
        hideHead
        noun="source"
        items={list}
        limit={DOC_LIST_LIMITS.sources}
        onAdd={() => dispatch(A.addDocItem(['sources'], { label: '', url: '' }))}
        onRemove={(index) => dispatch(A.removeDocItem(['sources'], index))}
        onMove={(from, to) => dispatch(A.moveDocItem(['sources'], from, to))}
        itemTitle={(item) => item?.label || urlCheck(item?.url).host}
        renderItem={(item, index) => (
          <>
            <TextField
              label="What it is"
              value={item?.label}
              onChange={(value) => dispatch(A.updateDoc(['sources', index, 'label'], value, true))}
              max={80}
              placeholder="Kiyomizu-dera official site"
            />
            <UrlField label="Link" compact value={item?.url} onChange={(value, typing) => dispatch(A.updateDoc(['sources', index, 'url'], value, typing))} />
          </>
        )}
        aside={broken > 0 ? <span className={styles.warnText}>{`${broken} ${broken === 1 ? 'link needs' : 'links need'} fixing`}</span> : null}
      />
    </PanelSection>
  );
}

/**
 * Brochure-level details: titles, publisher, summary, where and when, the
 * real place and the sources its facts come from, format and tags.
 * Everything shows up on library cards, the cover, the back page and search.
 *   <DetailsPanel brochure={doc} dispatch={dispatch} />
 */
export function DetailsPanel({ brochure, dispatch, now = new Date() }) {
  const set = (field, typing = false) => (value) => dispatch(A.setField(field, value, typing));
  const thisMonth = monthYear(now);

  return (
    <div className={styles.panel}>
      <PanelSection title="Names" jp="題名">
        <TextField label="Title" required value={brochure.title} onChange={set('title', true)} max={80} placeholder="Untitled brochure" />
        <TextField
          label="Japanese title"
          lang="ja"
          value={brochure.titleJp}
          onChange={set('titleJp', true)}
          max={8}
          hint="Set in vertical type on cards — e.g. 京都, 温泉"
        />
        <TextField label="Subtitle" multiline rows={2} value={brochure.subtitle} onChange={set('subtitle', true)} max={140} />
        <TextField label="Publisher" value={brochure.organization} onChange={set('organization', true)} max={60} hint="Your name or studio — shown on cards and the cover" />
        <TextField
          label="Summary"
          multiline
          rows={4}
          value={brochure.summary}
          onChange={set('summary', true)}
          max={240}
          hint="Shown on cards and in search"
        />
      </PanelSection>

      <PanelSection title="Where & when" jp="場所と季節">
        <Field label="Category">
          <Select value={brochure.category ?? ''} onChange={(e) => set('category')(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{`${c.label} · ${c.jp}`}</option>
            ))}
          </Select>
        </Field>
        <Field label="Region">
          <Select value={brochure.region ?? ''} onChange={(e) => set('region')(e.target.value)}>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>{`${r.label} · ${r.jp}`}</option>
            ))}
          </Select>
        </Field>
        <SeasonPicker value={brochure.seasons} onChange={set('seasons')} />
      </PanelSection>

      <LocationSection location={brochure.location} dispatch={dispatch} />

      <PanelSection title="Facts checked" jp="確認" note={brochure.factsChecked || undefined}>
        <div className={styles.checked}>
          <TextField
            label="Checked in"
            value={brochure.factsChecked}
            onChange={set('factsChecked', true)}
            max={40}
            quietCount
            placeholder={thisMonth}
            hint="When you last checked prices and opening hours — printed on the cover and back page"
          />
          <Button size="sm" variant="secondary" iconLeft={<CalendarCheck />} onClick={() => set('factsChecked')(thisMonth)} disabled={brochure.factsChecked === thisMonth}>
            {brochure.factsChecked === thisMonth ? 'Checked this month' : `Mark ${thisMonth}`}
          </Button>
        </div>
      </PanelSection>

      <SourcesSection sources={brochure.sources} dispatch={dispatch} />

      <PanelSection title="Format & tags" jp="判型">
        <SegmentedControl label="Format" hideLabel={false} value={brochure.format ?? 'booklet'} onChange={set('format')} options={FORMAT_OPTIONS} size="lg" />
        <TokenInput label="Tags" value={brochure.tags} onChange={set('tags')} max={12} />
      </PanelSection>
    </div>
  );
}
