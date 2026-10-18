import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ImagePlus, Images, Pencil, Search, Trash2, X } from 'lucide-react';
import { Button, Chip, Drawer } from '../../ui/index.js';
import { Photo } from '../../photo/Photo.jsx';
import { usePhotoRecord } from '../../photo/photoContext.js';
import { PhotoCredit } from '../../photo/PhotoCredit.jsx';
import { CoverArt } from '../../brochure/index.js';
import { resolvePhoto } from '../../../data/photos/index.js';
import { REGIONS } from '../../../data/regions.js';
import { useMediaQuery } from '../../../hooks/useMediaQuery.js';
import { ease } from '../../../lib/motion.js';
import { geometryIndex, nextIndex, tabPanelProps } from '../a11y.js';
import { PanelTabs } from '../PanelTabs.jsx';
import { groupLibrary, idSeed, libraryCounts, orientationOf, regionsWithPhotos, searchLibrary, suggestPhotos } from '../photoLibrary.js';
import { formatBytes, storedSize, userPhotoUses } from '../photoUpload.js';
import { PhotoDetailsForm, PhotoUpload } from './PhotoUpload.jsx';
import { PhotoTile } from './PhotoTile.jsx';
import { usePhotoLibrary } from './usePhotoLibrary.js';
import styles from './PhotoPicker.module.css';

const REGION_IDS = REGIONS.map((r) => r.id);
const REGION_LABEL = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

/** The brochure's uploads as picker entries, newest last. */
function userEntries(brochure) {
  const photos = brochure?.userPhotos && typeof brochure.userPhotos === 'object' ? brochure.userPhotos : {};
  return Object.keys(photos)
    .map((key) => {
      const id = `user:${key}`;
      const photo = resolvePhoto(id, brochure);
      if (!photo) return null;
      return {
        id,
        key,
        photo,
        caption: photo.caption || photo.alt,
        alt: photo.alt,
        place: '',
        orientation: orientationOf(photo),
        available: photo.available,
        user: true,
        bytes: storedSize(photos[key]?.src),
      };
    })
    .filter(Boolean);
}

const byIdGroup = (entries, id) => entries.find((e) => e.id === id)?.group;

/** A grid of tiles inside the roving-focus listbox (one per brochure group). */
function TileGroup({ id, groupKey, title, titleJp, note, entries, selected, value, focusId, focusGroup, onSelect, onUse, brochure, theme, art }) {
  return (
    <section className={styles.group} role="group" aria-labelledby={id}>
      {/* Inside a listbox only options and groups may be read out: the title names the group instead. */}
      <h3 id={id} className={styles.groupTitle} aria-hidden="true">
        {titleJp && (
          <span lang="ja" className={styles.groupJp} aria-hidden="true">
            {titleJp}
          </span>
        )}
        <span>{title}</span>
        <span className={styles.groupCount}>{note ?? entries.length}</span>
      </h3>
      <div className={styles.grid}>
        {entries.map((entry) => (
          <PhotoTile
            key={entry.id}
            entry={entry}
            selected={entry.id === selected}
            current={entry.id === value}
            tabIndex={entry.id === focusId && groupKey === focusGroup ? 0 : -1}
            onSelect={onSelect}
            onUse={onUse}
            brochure={brochure}
            theme={theme}
            art={art}
          />
        ))}
      </div>
    </section>
  );
}

/** What is selected, at the foot of the drawer: picture, caption, credit or state, and the actions. */
function Selection({ entry, tab, value, brochure, uses, confirmRemove, onUse, onClose, onEdit, onRemove, editing }) {
  if (!entry) {
    return (
      <div className={styles.footInner}>
        <p className={styles.footHint}>
          {tab === 'mine' ? 'Add a photo of your own, or choose one you added before.' : 'Choose a photo — double-click or press Enter to use it straight away.'}
        </p>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    );
  }
  return <SelectionBody entry={entry} value={value} brochure={brochure} uses={uses} confirmRemove={confirmRemove} onUse={onUse} onEdit={onEdit} onRemove={onRemove} editing={editing} />;
}

/** The chosen photo's proof, credit and actions (a library photo may have turned live meanwhile). */
function SelectionBody({ entry, value, brochure, uses, confirmRemove, onUse, onEdit, onRemove, editing }) {
  const fresh = usePhotoRecord(entry.user ? '' : entry.id);
  const record = entry.user || !fresh ? entry.photo : fresh;
  const isCurrent = entry.id === value;
  return (
    <div className={styles.footInner}>
      <div className={styles.selected}>
        <span className={styles.selectedThumb} aria-hidden="true">
          <Photo photo={record} brochure={brochure} alt="" sizes="96px" fallback={<CoverArt style={entry.brochure?.cover?.art ?? brochure.cover?.art} seed={idSeed(entry.id)} theme={entry.brochure?.theme ?? brochure.theme} />} />
        </span>
        <div className={styles.selectedText}>
          <p className={styles.selectedCaption}>{entry.caption || 'Untitled photo'}</p>
          {entry.user ? (
            <p className={styles.selectedMeta}>
              {[record.width && record.height ? `${record.width} × ${record.height}` : '', entry.bytes ? `${formatBytes(entry.bytes)} stored` : '', uses.length ? `on ${uses.length} ${uses.length === 1 ? 'page' : 'pages'}` : 'not used yet'].filter(Boolean).join(' · ')}
            </p>
          ) : record.available ? (
            <PhotoCredit credit={record.credit} className={styles.selectedCredit} />
          ) : (
            <p className={styles.selectedMeta} data-pending="">
              Not downloaded yet — your page shows its cover art until the photo arrives, then the photo appears by itself.
            </p>
          )}
        </div>
      </div>
      <div className={styles.footActions}>
        {entry.user && (
          <>
            <Button variant="ghost" size="sm" iconLeft={<Pencil />} onClick={onEdit} aria-pressed={editing}>
              {editing ? 'Done' : 'Details'}
            </Button>
            <Button variant="ghost" size="sm" iconLeft={<Trash2 />} onClick={onRemove} className={confirmRemove ? styles.danger : undefined}>
              {confirmRemove ? (uses.length ? `Remove from ${uses.length} ${uses.length === 1 ? 'page' : 'pages'}?` : 'Remove for good?') : 'Remove'}
            </Button>
          </>
        )}
        <Button variant="accent" size="sm" iconLeft={<Check />} onClick={() => onUse(entry.id)}>
          {isCurrent ? 'Keep this photo' : 'Use this photo'}
        </Button>
      </div>
    </div>
  );
}

/**
 * The photo picker: a drawer (a bottom sheet on phones) with the built-in
 * library of real photographs — searchable, by region, grouped by brochure,
 * with suggestions for the field being edited and honest "not downloaded
 * yet" states — and "Your photos": uploads kept in the brochure itself,
 * with their alt text and credit.
 *
 *   <PhotoPicker open={open} onClose={close} value={id} brochure={doc} label="Cover photo"
 *     hints={['Fushimi Inari Taisha']} preferred="portrait"
 *     onPick={(id) => …} onAdd={(key, photo) => …} onUpdatePhoto={…} onRemovePhoto={(key) => …} />
 * `onPick(id)` uses a library photo or an existing upload; `onAdd(key, photo)`
 * stores a new upload (the host places it); both close the picker.
 */
export function PhotoPicker({ open, onClose, value, brochure, label = 'Photo', hints = [], preferred = '', onPick, onAdd, onUpdatePhoto, onRemovePhoto }) {
  const id = useId();
  const phone = useMediaQuery('(max-width: 699.98px)');
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const library = usePhotoLibrary();
  const uploads = useMemo(() => userEntries(brochure), [brochure]);

  const valueIsUser = typeof value === 'string' && value.startsWith('user:');
  const [tab, setTab] = useState(valueIsUser ? 'mine' : 'library');
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [selected, setSelected] = useState(value || '');
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadPhase, setUploadPhase] = useState('idle');
  // Each opening starts from the field's current photo, on the tab that holds it.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelected(value || '');
      setTab(valueIsUser ? 'mine' : 'library');
      setEditing(false);
      setConfirmRemove(false);
      setUploadPhase('idle');
    }
  }
  const describing = tab === 'mine' && (uploadPhase === 'ready' || uploadPhase === 'over');

  const results = useMemo(() => searchLibrary(library, { query, region }), [library, query, region]);
  const groups = useMemo(() => groupLibrary(results), [results]);
  // `hints` is a fresh array each render; its text is what matters.
  const hintKey = hints.join('|');
  const suggestions = useMemo(
    () => (query || region || !hintKey ? [] : suggestPhotos(library, { hints: hintKey.split('|'), preferred, limit: 4 })),
    [library, query, region, hintKey, preferred],
  );
  const counts = useMemo(() => libraryCounts(library), [library]);
  const regions = useMemo(() => regionsWithPhotos(library, REGION_IDS), [library]);

  const visible = tab === 'library' ? [...suggestions, ...results] : uploads;
  const byId = useMemo(() => new Map([...library, ...uploads].map((e) => [e.id, e])), [library, uploads]);
  const selectedEntry = byId.get(selected) ?? null;
  const focusId = visible.some((e) => e.id === selected) ? selected : visible[0]?.id;
  // A suggested photo also sits in its brochure's group: only its first tile is the Tab stop.
  const focusGroup = tab === 'mine' ? 'mine' : suggestions.some((e) => e.id === focusId) ? 'suggested' : (byIdGroup(results, focusId) ?? '');
  const uses = selectedEntry?.user ? userPhotoUses(brochure, selectedEntry.key) : [];
  // The footer speaks for the tab on show: a library pick is not "yours", and vice versa.
  const footerEntry = selectedEntry && Boolean(selectedEntry.user) === (tab === 'mine') ? selectedEntry : null;

  const select = useCallback((photoId) => {
    setSelected(photoId);
    setEditing(false);
    setConfirmRemove(false);
  }, []);
  const use = useCallback(
    (photoId) => {
      onPick(photoId);
      onClose();
    },
    [onPick, onClose],
  );

  const onListKeyDown = (event) => {
    const options = [...(listRef.current?.querySelectorAll('[role="option"]') ?? [])];
    const index = options.indexOf(document.activeElement);
    if (index === -1) return;
    const next = geometryIndex(event.key, options.map((el) => el.getBoundingClientRect()), index);
    if (next === -1) return;
    event.preventDefault();
    options[next].focus();
    select(options[next].dataset.photoId);
  };

  const onRegionKeyDown = (event) => {
    const options = ['', ...regions];
    const next = nextIndex(event.key, Math.max(0, options.indexOf(region)), options.length);
    if (next === -1) return;
    event.preventDefault();
    setRegion(options[next]);
    const chip = event.currentTarget.querySelector(`[data-region="${options[next]}"]`);
    chip?.focus();
    chip?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  const remove = () => {
    if (!selectedEntry?.user) return;
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    onRemovePhoto(selectedEntry.key);
    setMessage(`Removed ${selectedEntry.caption || 'the photo'}.`);
    setSelected('');
    setConfirmRemove(false);
    setEditing(false);
  };

  const tabs = [
    { value: 'library', label: 'Photo library', jp: '写真集', icon: <Images />, badge: counts.total },
    { value: 'mine', label: 'Your photos', jp: '手持ち', icon: <ImagePlus />, badge: uploads.length },
  ];
  const regionLabel = region ? REGION_LABEL[region]?.label : '';
  const resultsText = tab === 'library' ? `${results.length} ${results.length === 1 ? 'photo' : 'photos'}${query ? ` for “${query}”` : ''}${regionLabel ? ` in ${regionLabel}` : ''}` : '';
  const pendingAll = counts.ready === 0;
  const editingEntry = editing && selectedEntry?.user ? selectedEntry : null;
  const editValues = editingEntry
    ? {
        alt: editingEntry.photo.alt,
        caption: brochure.userPhotos?.[editingEntry.key]?.caption ?? '',
        author: brochure.userPhotos?.[editingEntry.key]?.credit?.author ?? '',
        license: brochure.userPhotos?.[editingEntry.key]?.credit?.license ?? '',
        sourceUrl: brochure.userPhotos?.[editingEntry.key]?.credit?.sourceUrl ?? '',
      }
    : null;
  const editPath = { alt: ['alt'], caption: ['caption'], author: ['credit', 'author'], license: ['credit', 'license'], sourceUrl: ['credit', 'sourceUrl'] };

  const listProps = { selected, value, focusId, focusGroup, onSelect: select, onUse: use, brochure, theme: brochure.theme, art: { style: brochure.cover?.art } };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side={phone ? 'bottom' : 'right'}
      size="lg"
      title="Choose a photo"
      description={`${label}${hints[0] ? ` · ${hints[0]}` : ''}`}
      className={phone ? styles.sheet : styles.drawer}
      initialFocusRef={tab === 'library' ? searchRef : undefined}
      footer={
        !describing && (
        <Selection
          entry={footerEntry}
          tab={tab}
          value={value}
          brochure={brochure}
          uses={uses}
          editing={editing}
          confirmRemove={confirmRemove}
          onUse={use}
          onClose={onClose}
          onEdit={() => setEditing((on) => !on)}
          onRemove={remove}
        />
        )
      }
    >
      <div className={styles.picker}>
        <PanelTabs label="Photo sources" tabs={tabs} value={tab} onChange={setTab} idBase={id} className={styles.tabs} />

        <div {...tabPanelProps(id, tab)} tabIndex={-1} className={styles.panel}>
          {tab === 'library' ? (
            <>
              <div className={styles.tools}>
                <label className={styles.search}>
                  <Search size={16} aria-hidden="true" />
                  <span className="sr-only">Search photos</span>
                  <input
                    ref={searchRef}
                    type="search"
                    value={query}
                    placeholder="Search places, captions — try torii, snow, 京都"
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown' && visible.length) {
                        event.preventDefault();
                        const first = listRef.current?.querySelector('[role="option"]');
                        first?.focus();
                        if (first) select(first.dataset.photoId);
                      }
                    }}
                    aria-controls={`${id}-list`}
                    data-native-undo=""
                  />
                  {query && (
                    <button type="button" className={styles.clear} onClick={() => setQuery('')} aria-label="Clear search">
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                </label>
                {/* One Tab stop for the whole row; the arrow keys move between regions. */}
                <div className={styles.chips} role="radiogroup" aria-label="Region" onKeyDown={onRegionKeyDown}>
                  {['', ...regions].map((r) => (
                    <Chip
                      key={r || 'all'}
                      role="radio"
                      aria-checked={region === r}
                      aria-pressed={undefined}
                      tabIndex={region === r ? 0 : -1}
                      data-region={r}
                      selected={region === r}
                      onClick={() => setRegion(r)}
                    >
                      {r ? REGION_LABEL[r].label : 'All regions'}
                    </Chip>
                  ))}
                </div>
              </div>

              <p className={styles.summary}>
                <span lang="ja" className={styles.summaryJp} aria-hidden="true">
                  実写
                </span>
                <span>
                  {counts.total} real photographs of the places in Tabi’s brochures, free-licensed and credited.{' '}
                  {pendingAll
                    ? 'None is downloaded yet: each shows your cover art until it arrives, and you can choose them now.'
                    : `${counts.ready} downloaded; the others show your cover art until they arrive.`}
                </span>
              </p>
              <p className="sr-only" aria-live="polite">
                {resultsText}
              </p>

              {/* One listbox for every group, so the arrow keys travel across them. */}
              <div ref={listRef} id={`${id}-list`} role="listbox" aria-label="Photos" className={styles.list} onKeyDown={onListKeyDown}>
                {suggestions.length > 0 && <TileGroup id={`${id}-suggested`} groupKey="suggested" title={`Suggested for ${hints[0]}`} titleJp="おすすめ" entries={suggestions} {...listProps} />}
                {groups.map((group) => (
                  <TileGroup key={group.key} id={`${id}-g-${group.key}`} groupKey={group.key} title={group.title} titleJp={group.titleJp} entries={group.entries} {...listProps} />
                ))}
              </div>
              {results.length === 0 && (
                <div className={styles.empty}>
                  <p>
                    No photos match {query ? `“${query}”` : 'that'}
                    {regionLabel ? ` in ${regionLabel}` : ''}.
                  </p>
                  <div className={styles.emptyActions}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setQuery('');
                        setRegion('');
                      }}
                    >
                      Show all photos
                    </Button>
                    <Button size="sm" variant="ghost" iconLeft={<ImagePlus />} onClick={() => setTab('mine')}>
                      Upload your own
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {editingEntry && (
                  <motion.section
                    key={editingEntry.key}
                    className={styles.editing}
                    aria-label="Photo details"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto', transition: { duration: 0.35, ease: ease.out } }}
                    exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
                  >
                    <h3 className={styles.editingTitle}>Details of this photo</h3>
                    <PhotoDetailsForm values={editValues} onChange={(field, next) => onUpdatePhoto(editingEntry.key, editPath[field], next, true)} />
                  </motion.section>
                )}
              </AnimatePresence>
              {!editingEntry && (
                <PhotoUpload
                  brochure={brochure}
                  active={open && tab === 'mine'}
                  onPhase={setUploadPhase}
                  onAdd={(key, photo) => {
                    onAdd(key, photo);
                    onClose();
                  }}
                />
              )}
              {uploads.length > 0 ? (
                <div ref={listRef} role="listbox" aria-label="Your photos" className={styles.list} onKeyDown={onListKeyDown}>
                  <TileGroup id={`${id}-mine`} groupKey="mine" title="In this brochure" titleJp="手持ち" entries={uploads} {...listProps} />
                </div>
              ) : (
                <p className={styles.mineEmpty}>Photos you add are kept inside this brochure, with your description and credit.</p>
              )}
            </>
          )}
          <p className="sr-only" aria-live="polite">
            {message}
          </p>
        </div>
      </div>
    </Drawer>
  );
}
