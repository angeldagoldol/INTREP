import { memo } from 'react';
import { Palette, Wand2 } from 'lucide-react';
import { spanOf, spreadPartner } from '../../data/photoSpreads.js';
import { spreadIssues } from '../../data/photoSpreadEdits.js';
import { ART_LABELS, ART_STYLES, CAPTION_PLACEMENTS, CREDIT_PLACEMENTS } from '../../data/schema.js';
import { Button, Field, Select, Switch } from '../ui/index.js';
import { CoverArt } from '../brochure/index.js';
import { Note } from './Note.jsx';
import { CoordsField } from './fields/CoordsField.jsx';
import { DiceButton } from './fields/DiceButton.jsx';
import { IconPicker } from './fields/IconPicker.jsx';
import { ListEditor } from './fields/ListEditor.jsx';
import { NumberField } from './fields/NumberField.jsx';
import { PhotoField } from './fields/PhotoField.jsx';
import { StringList } from './fields/StringList.jsx';
import { TextField } from './fields/TextField.jsx';
import { UrlField } from './fields/UrlField.jsx';
import { listLimit } from './pageLimits.js';
import { SegmentedControl } from './SegmentedControl.jsx';
import styles from './PageFields.module.css';

/* `api` (from PageEditor) binds every control to the selected page:
   get(path) · set(path, value, typing) · merge(path, patch, typing) · add(path, index) ·
   remove(path, index) · move(path, from, to) · photos(path) · coverPhotos() · fixSpreads() */

function Text({ api, path, ...props }) {
  return <TextField value={api.get(path)} onChange={(value) => api.set(path, value, true)} {...props} />;
}

function Url({ api, path, ...props }) {
  return <UrlField value={api.get(path)} onChange={(value, typing) => api.set(path, value, typing)} {...props} />;
}

function List({ api, path, pageType, renderItem, ...props }) {
  return (
    <ListEditor
      items={api.get(path)}
      limit={listLimit(pageType, path)}
      onAdd={() => api.add(path)}
      onRemove={(index) => api.remove(path, index)}
      onMove={(from, to) => api.move(path, from, to)}
      renderItem={(item, index) => renderItem(item, index, [...path, index])}
      {...props}
    />
  );
}

function Labelled({ label, children }) {
  return (
    <div className={styles.labelled}>
      <span className={styles.miniLabel} aria-hidden="true">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Words that describe what a photo slot shows, for the picker's suggestions. */
const hintsOf = (...values) => values.map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean);

const ArtThumb = memo(function ArtThumb({ art, seed, theme }) {
  return (
    <span className={styles.thumb} aria-hidden="true">
      <CoverArt style={art} seed={seed} theme={theme} />
    </span>
  );
});

function CoverFields({ api, page, brochure, onEditDesign, onCover }) {
  const art = ART_LABELS[brochure.cover?.art] ?? ART_LABELS.hinomaru;
  return (
    <>
      <PhotoField
        label="Cover photo"
        value={api.get(['photo']) || brochure.cover?.photo}
        brochure={brochure}
        hints={hintsOf(brochure.location?.name, page.title, brochure.title)}
        preferred="portrait"
        photos={api.coverPhotos()}
        hint="A tall picture with a clear subject works best."
      />
      <Text api={api} path={['eyebrow']} label="Eyebrow" max={48} hint="A small line above the title" />
      <Text api={api} path={['title']} label="Cover title" max={60} />
      <Text api={api} path={['titleJp']} label="Japanese title" lang="ja" max={8} hint="Set vertically — e.g. 京都" placeholder={brochure.titleJp || '旅'} />
      <Text api={api} path={['subtitle']} label="Subtitle" multiline rows={3} max={140} />
      <div className={styles.artCard}>
        <ArtThumb art={brochure.cover?.art} seed={brochure.cover?.seed} theme={brochure.theme} />
        <div className={styles.artMeta}>
          <span className={styles.miniLabel}>Cover artwork</span>
          <span className={styles.artName}>
            {art.label} <span lang="ja">{art.jp}</span>
          </span>
          <span className={styles.artHint}>Shows when there is no photo, and while one loads.</span>
          <div className={styles.artActions}>
            <Button variant="secondary" size="sm" iconLeft={<Palette />} onClick={onEditDesign}>
              Change artwork
            </Button>
            <DiceButton label="Shuffle artwork" onRoll={(seed) => onCover({ seed })} />
          </div>
        </div>
      </div>
    </>
  );
}

function IntroFields({ api, page, brochure }) {
  return (
    <>
      <Text api={api} path={['kicker']} label="Kicker" max={32} />
      <Text api={api} path={['heading']} label="Heading" max={70} />
      <PhotoField
        label="Photo"
        optional
        value={page.photo}
        brochure={brochure}
        hints={hintsOf(brochure.location?.name, page.heading, brochure.title)}
        photos={api.photos(['photo'])}
        hint="With a photo, the page sets it as a tall plate beside the story."
      />
      <Text api={api} path={['body']} label="Story" multiline rows={7} max={900} hint="A blank line starts a new paragraph" />
      <Text api={api} path={['pullQuote']} label="Pull quote" multiline rows={2} max={120} />
    </>
  );
}

function FeaturesFields({ api, page, brochure }) {
  return (
    <>
      <Text api={api} path={['kicker']} label="Kicker" max={32} />
      <Text api={api} path={['heading']} label="Heading" max={70} />
      <List
        api={api}
        path={['items']}
        pageType={page.type}
        title="Highlights"
        noun="highlight"
        itemTitle={(item) => item?.title}
        renderItem={(item, index, path) => (
          <>
            <div className={styles.row}>
              <Labelled label="Icon">
                <IconPicker value={item?.icon} onChange={(icon) => api.set([...path, 'icon'], icon, false)} label={`Icon for highlight ${index + 1}`} />
              </Labelled>
              <Text api={api} path={[...path, 'title']} label="Title" max={40} />
            </div>
            <Text api={api} path={[...path, 'text']} label="Text" multiline rows={2} max={160} />
            <PhotoField
              compact
              optional
              label="Photo"
              value={item?.photo}
              brochure={brochure}
              hints={hintsOf(item?.title)}
              photos={api.photos([...path, 'photo'])}
              art={{ style: brochure.cover?.art, seed: (Number(brochure.cover?.seed) || 1) + index * 5 }}
            />
          </>
        )}
      />
    </>
  );
}

function GalleryFields({ api, page, brochure }) {
  return (
    <>
      <Text api={api} path={['heading']} label="Heading" max={70} />
      <List
        api={api}
        path={['items']}
        pageType={page.type}
        title="Photos"
        noun="photo"
        itemTitle={(item) => item?.caption}
        renderItem={(item, index, path) => (
          <>
            <PhotoField
              compact
              label={`Photo ${index + 1}`}
              value={item?.photo}
              brochure={brochure}
              hints={hintsOf(item?.caption, brochure.location?.name)}
              photos={api.photos([...path, 'photo'])}
              art={{ style: item?.art, seed: item?.seed }}
            />
            <Text api={api} path={[...path, 'caption']} label="Caption" max={80} />
            <div className={styles.artRow}>
              <ArtThumb art={item?.art} seed={item?.seed} theme={brochure.theme} />
              <Field label="Stand-in art" hint="Until the photo shows">
                <Select value={ART_STYLES.includes(item?.art) ? item.art : 'hinomaru'} onChange={(e) => api.set([...path, 'art'], e.target.value, false)}>
                  {ART_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {`${ART_LABELS[style].label} · ${ART_LABELS[style].jp}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Labelled label="Shuffle">
                <DiceButton label={`Shuffle artwork ${index + 1}`} onRoll={(seed) => api.set([...path, 'seed'], seed, false)} />
              </Labelled>
            </div>
          </>
        )}
      />
    </>
  );
}

function PlaceFields({ api, page, brochure }) {
  return (
    <>
      <Text api={api} path={['kicker']} label="Kicker" max={40} hint="e.g. Temple · Higashiyama" />
      <div className={styles.nameRow}>
        <Text api={api} path={['name']} label="Place name" max={60} placeholder="Kiyomizu-dera" />
        <Text api={api} path={['nameJp']} label="In Japanese" lang="ja" max={16} placeholder="清水寺" hint="Set on a vertical slip" />
      </div>
      <PhotoField
        label="Photo"
        value={page.photo}
        brochure={brochure}
        hints={hintsOf(page.name, page.kicker)}
        photos={api.photos(['photo'])}
        art={{ style: brochure.cover?.art }}
        hint="A wide picture of the place itself."
      />
      <Text api={api} path={['body']} label="About the place" multiline rows={6} max={700} hint="What it is, why it matters, what to look for" />
      <List
        api={api}
        path={['facts']}
        pageType={page.type}
        title="Practical facts"
        noun="fact"
        itemTitle={(item) => [item?.label, item?.value].filter(Boolean).join(' · ')}
        variant="rows"
        aside={<span className={styles.listNote}>Check hours and prices on the official site</span>}
        renderItem={(item, index, path) => (
          // Set like the printed facts column: the label small above its value.
          <div className={styles.factRow}>
            <Text api={api} path={[...path, 'label']} label={`Fact ${index + 1}, label`} hideLabel quietCount max={24} placeholder="Label — e.g. Hours" className={styles.factLabel} />
            <Text api={api} path={[...path, 'value']} label={`Fact ${index + 1}, value`} hideLabel quietCount max={80} placeholder="e.g. 6:00–18:00" />
          </div>
        )}
      />
      <CoordsField label="Coordinates" lat={page.lat} lng={page.lng} onChange={(coords, typing) => api.merge([], coords, typing)} />
      <Url api={api} path={['website']} label="Official website" hint="The place’s own site, or the city’s tourism page" />
    </>
  );
}

function StatsFields({ api, page }) {
  return (
    <>
      <Text api={api} path={['heading']} label="Heading" max={70} />
      <Text api={api} path={['body']} label="Intro line" multiline rows={2} max={160} />
      <List
        api={api}
        path={['items']}
        pageType={page.type}
        title="Figures"
        noun="figure"
        itemTitle={(item) => `${item?.prefix ?? ''}${item?.value ?? ''}${item?.suffix ?? ''} ${item?.label ?? ''}`}
        renderItem={(item, index, path) => (
          <>
            <div className={styles.statRow}>
              <Text api={api} path={[...path, 'prefix']} label="Before" max={4} placeholder="~" />
              <NumberField label="Number" value={item?.value ?? ''} onChange={(value) => api.set([...path, 'value'], value, true)} />
              <Text api={api} path={[...path, 'suffix']} label="After" max={6} placeholder="%" />
            </div>
            <Text api={api} path={[...path, 'label']} label="Label" max={48} />
          </>
        )}
      />
    </>
  );
}

function AgendaFields({ api, page }) {
  return (
    <>
      <Text api={api} path={['heading']} label="Heading" max={70} />
      <List
        api={api}
        path={['items']}
        pageType={page.type}
        title="Stops"
        noun="stop"
        itemTitle={(item) => [item?.time, item?.title].filter(Boolean).join(' · ')}
        renderItem={(item, index, path) => (
          <>
            <div className={styles.timeRow}>
              <Text api={api} path={[...path, 'time']} label="When" max={12} placeholder="09:00" />
              <Text api={api} path={[...path, 'title']} label="What" max={48} />
            </div>
            <Text api={api} path={[...path, 'text']} label="Details" multiline rows={2} max={120} />
          </>
        )}
      />
    </>
  );
}

function PricingFields({ api, page }) {
  return (
    <>
      <Text api={api} path={['heading']} label="Heading" max={70} />
      <Text api={api} path={['note']} label="Small print" multiline rows={2} max={200} hint="Say when prices were checked" />
      <List
        api={api}
        path={['plans']}
        pageType={page.type}
        title="Price groups"
        noun="group"
        itemTitle={(item) => [item?.name, item?.price].filter(Boolean).join(' · ')}
        renderItem={(item, index, path) => {
          const featuresPath = [...path, 'features'];
          return (
            <>
              <Text api={api} path={[...path, 'name']} label="Name" max={32} />
              <div className={styles.priceRow}>
                <Text api={api} path={[...path, 'price']} label="Price" max={16} placeholder="¥500" />
                <Text api={api} path={[...path, 'period']} label="For" max={32} placeholder="adults" />
              </div>
              <StringList
                label="Lines"
                items={item?.features}
                limit={listLimit(page.type, featuresPath)}
                onChange={(i, value) => api.set([...featuresPath, i], value, true)}
                onAdd={(i) => api.add(featuresPath, i)}
                onRemove={(i) => api.remove(featuresPath, i)}
                onMove={(from, to) => api.move(featuresPath, from, to)}
              />
              <Switch checked={Boolean(item?.highlight)} onChange={(on) => api.set([...path, 'highlight'], on, false)} label="Tint this group" />
            </>
          );
        }}
      />
    </>
  );
}

function PhrasesFields({ api, page }) {
  return (
    <>
      <Text api={api} path={['heading']} label="Heading" max={70} />
      <List
        api={api}
        path={['items']}
        pageType={page.type}
        title="Phrases"
        noun="phrase"
        itemTitle={(item) => item?.romaji || item?.jp}
        renderItem={(item, index, path) => (
          <>
            <Text api={api} path={[...path, 'jp']} label="Japanese" lang="ja" max={40} placeholder="ありがとう" />
            <Text api={api} path={[...path, 'romaji']} label="Rōmaji" max={60} hint="Use macrons for long vowels: ā ī ū ē ō" />
            <Text api={api} path={[...path, 'meaning']} label="Meaning" max={80} />
          </>
        )}
      />
    </>
  );
}

function QuoteFields({ api }) {
  return (
    <>
      <Note>Quote real words — a haiku, a proverb, an inscription — and say who wrote them. Invented testimonials don’t belong here.</Note>
      <Text
        api={api}
        path={['quoteJp']}
        label="Original Japanese"
        lang="ja"
        multiline
        rows={3}
        max={120}
        placeholder="古池や　蛙飛びこむ　水の音"
        hint="Set vertically; a space starts a new column"
      />
      <Text api={api} path={['quote']} label="Translation" multiline rows={4} max={280} hint="“ / ” breaks a line, as in a haiku" placeholder="The old pond — / a frog jumps in, / the sound of water." />
      <Text api={api} path={['author']} label="Who wrote it" max={48} placeholder="Matsuo Bashō" />
      <Text api={api} path={['role']} label="Where, when and whose translation" max={80} placeholder="Edo, 1686 · Translation: your name" />
    </>
  );
}

function ContactFields({ api, page }) {
  return (
    <>
      <Text api={api} path={['heading']} label="Heading" max={70} placeholder="Visitor information" />
      <Text api={api} path={['body']} label="Message" multiline rows={3} max={240} />
      <Text api={api} path={['cta']} label="Call to action" max={40} placeholder="Open the official guide" />
      <Url api={api} path={['ctaUrl']} label="Where it goes" hint="Without a link, the call to action prints as plain text" />
      <List
        api={api}
        path={['details']}
        pageType={page.type}
        title="Details"
        noun="detail"
        itemTitle={(item) => [item?.label, item?.value].filter(Boolean).join(' · ')}
        renderItem={(item, index, path) => (
          <>
            <div className={styles.row}>
              <Labelled label="Icon">
                <IconPicker value={item?.icon} onChange={(icon) => api.set([...path, 'icon'], icon, false)} label={`Icon for detail ${index + 1}`} />
              </Labelled>
              <Text api={api} path={[...path, 'label']} label="Label" max={24} placeholder="Official site" />
            </div>
            <Text api={api} path={[...path, 'value']} label="Shown as" max={80} placeholder="kiyomizudera.or.jp" hint="Printed as written — no phone numbers" />
            <Url api={api} path={[...path, 'url']} label="Link (optional)" compact />
          </>
        )}
      />
    </>
  );
}

const CAPTION_OPTIONS = [
  { value: 'overlay', label: 'Over the photo', sub: '写真の上', lang: 'ja' },
  { value: 'below', label: 'Under it', sub: '写真の下', lang: 'ja' },
].filter((o) => CAPTION_PLACEMENTS.includes(o.value));
const CREDIT_OPTIONS = [
  { value: 'caption', label: 'With the caption', sub: '添え書き', lang: 'ja' },
  { value: 'edge', label: 'Up the edge', sub: '縦書き', lang: 'ja' },
].filter((o) => CREDIT_PLACEMENTS.includes(o.value));

/** Where a spread half stands: its pair, and what is wrong with its placement (data/photoSpreads.js). */
function spreadState(pages, index) {
  const list = Array.isArray(pages) ? pages : [];
  const page = list[index];
  const span = spanOf(page);
  if (!span) return null;
  const partner = spreadPartner(list, index);
  const issue = spreadIssues(list).find((i) => i.ids.includes(page.id));
  const left = span === 'left' ? index : index - 1;
  return { span, paired: partner !== -1, issue, pair: `pages ${left + 1}–${left + 2}` };
}

function PhotoFields({ api, page, brochure, index }) {
  const spread = spreadState(brochure.pages, index);
  return (
    <>
      {spread && !spread.issue && (
        <Note>
          {`The ${spread.span} half of a double-page spread on ${spread.pair}: one photograph across both pages. The photo and the caption’s layout are shared by both halves; each half prints its own caption, if it has one — usually only the right-hand half does.`}
        </Note>
      )}
      {spread?.issue && (
        <Note
          tone="warning"
          action={
            <Button size="sm" variant="secondary" iconLeft={<Wand2 />} onClick={api.fixSpreads}>
              Line up spreads
            </Button>
          }
        >
          {`${spread.issue.message} Until then it reads as a page of its own.`}
        </Note>
      )}
      <PhotoField
        label={spread ? 'Spread photo' : 'Photo'}
        value={page.photo}
        brochure={brochure}
        hints={hintsOf(page.name, page.caption, brochure.location?.name)}
        preferred={spread ? 'landscape' : 'portrait'}
        photos={api.photos(['photo'])}
        hint={spread ? 'A wide picture: it runs across both pages, meeting at the fold.' : 'A tall picture fills the page best.'}
      />
      <div className={styles.nameRow}>
        <Text api={api} path={['name']} label="Place" max={60} placeholder="Kiyomizu-dera" hint="Set in small capitals" />
        <Text api={api} path={['nameJp']} label="In Japanese" lang="ja" max={20} placeholder="清水寺" />
      </div>
      <Text
        api={api}
        path={['caption']}
        label="Caption"
        multiline
        rows={2}
        max={160}
        hint={spread ? 'One line on what the picture shows. Printed on this half of the spread.' : 'One line on what the picture shows — the place, the season, the hour.'}
      />
      <SegmentedControl
        label="Caption"
        hideLabel={false}
        size="sm"
        value={CAPTION_PLACEMENTS.includes(page.captionPlacement) ? page.captionPlacement : CAPTION_PLACEMENTS[0]}
        onChange={(value) => api.set(['captionPlacement'], value, false)}
        options={CAPTION_OPTIONS}
      />
      <SegmentedControl
        label="Photo credit"
        hideLabel={false}
        size="sm"
        value={CREDIT_PLACEMENTS.includes(page.creditPlacement) ? page.creditPlacement : CREDIT_PLACEMENTS[0]}
        onChange={(value) => api.set(['creditPlacement'], value, false)}
        options={CREDIT_OPTIONS}
      />
    </>
  );
}

function BackFields({ api }) {
  return (
    <>
      <Text api={api} path={['title']} label="Closing line" max={70} />
      <Text api={api} path={['body']} label="About you" multiline rows={3} max={240} />
      <Text api={api} path={['tagline']} label="Tagline or web address" max={60} />
    </>
  );
}

const EDITORS = {
  cover: CoverFields,
  intro: IntroFields,
  features: FeaturesFields,
  gallery: GalleryFields,
  place: PlaceFields,
  stats: StatsFields,
  agenda: AgendaFields,
  pricing: PricingFields,
  phrases: PhrasesFields,
  quote: QuoteFields,
  contact: ContactFields,
  photo: PhotoFields,
  back: BackFields,
};

/**
 * The form for one page, generated from its type.
 *   <PageFields page={page} index={2} api={api} brochure={doc} onEditDesign={…} onCover={…} />
 * `index` is the page's place in brochure.pages (photo spreads check where they stand).
 * Unknown types (e.g. from an old import) get a gentle explanation instead.
 */
export function PageFields({ page, index = -1, api, brochure, onEditDesign, onCover }) {
  const Editor = EDITORS[page.type];
  if (!Editor) {
    return <Note>This page type can’t be edited here. You can still move or delete it.</Note>;
  }
  return (
    <div className={styles.fields}>
      <Editor page={page} index={index} api={api} brochure={brochure} onEditDesign={onEditDesign} onCover={onCover} />
    </div>
  );
}
