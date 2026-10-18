import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, LayoutList, PenLine, Palette, RotateCcw } from 'lucide-react';
import { Button, Modal } from '../ui/index.js';
import { useBrochures } from '../../context/BrochureContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useHotkey } from '../../hooks/useHotkey.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { ease } from '../../lib/motion.js';
import { tabPanelProps, wantsStudioUndo } from './a11y.js';
import { exportFileName, MAX_IMPORT_BYTES, parseBrochureJson, serializeBrochure } from './brochureIO.js';
import { DesignPanel } from './DesignPanel.jsx';
import { DetailsPanel } from './DetailsPanel.jsx';
import { clearDraft, contentSignature, writeDraft } from './draftStore.js';
import { PageEditor } from './PageEditor.jsx';
import { PagesPanel } from './PagesPanel.jsx';
import { PanelTabs } from './PanelTabs.jsx';
import { PhoneDock } from './PhoneDock.jsx';
import { PreviewModal } from './PreviewModal.jsx';
import { PreviewStage } from './PreviewStage.jsx';
import { autoFix, validateForPublish } from './publishCheck.js';
import { PublishDialog } from './PublishDialog.jsx';
import { PublishStamp } from './PublishStamp.jsx';
import { relativeSaved } from './studioFormat.js';
import { studioActions as A } from './studioReducer.js';
import { StudioTopBar } from './StudioTopBar.jsx';
import { useAutosave, useNow, useStudio } from './useStudio.js';
import { useNavHidden } from '../layout/navState.js';
import styles from './StudioEditor.module.css';

const SIDE_TABS = {
  details: { value: 'details', label: 'Details', jp: '詳細', icon: <FileText /> },
  design: { value: 'design', label: 'Design', jp: '意匠', icon: <Palette /> },
  pages: { value: 'pages', label: 'Pages', jp: '頁', icon: <LayoutList /> },
  page: { value: 'page', label: 'Page', jp: '編集', icon: <PenLine /> },
};

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "3 min ago" for the restored-changes notice; ticks on its own, so the editor doesn't re-render. */
function RestoredAgo({ savedAt }) {
  const now = useNow();
  return relativeSaved(savedAt, now);
}

/**
 * The brochure editor. Desktop (≥ 1100px): settings tabs | live preview |
 * page inspector. Tablet: tabs (with the page form as a tab) | preview.
 * Phone: Edit / Preview views switched from a bottom dock.
 *
 *   <StudioEditor mode="new" initial={{ doc, selectedId, savedAt }} storageKey="studio-draft" />
 *   <StudioEditor mode="edit" initial={…} baseline={libraryCopy} storageKey="studio-edit:b_1" restored />
 */
export function StudioEditor({ mode, initial, baseline, storageKey, restored = false }) {
  const id = useId();
  const headingRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { saveBrochure, deleteBrochure } = useBrochures();
  const [state, dispatch] = useStudio(initial.doc, initial.selectedId);
  const { doc, selectedId } = state;

  const desktop = useMediaQuery('(min-width: 1100px)');
  const phone = useMediaQuery('(max-width: 699.98px)');
  const layout = desktop ? 'desktop' : phone ? 'phone' : 'tablet';
  // Phone tabs stick under the site navbar, and slide up when it tucks away.
  const navHidden = useNavHidden();

  const [tab, setTab] = useState('pages');
  const [phoneView, setPhoneView] = useState('edit');
  const [previewView, setPreviewView] = useState('single');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [publishCheck, setPublishCheck] = useState(null);
  const [stamp, setStamp] = useState(null);
  const [finished, setFinished] = useState(false);
  const [base, setBase] = useState(baseline);
  const [restoredNotice, setRestoredNotice] = useState(restored);

  useDocumentTitle(doc.title ? `${doc.title} · Studio` : 'Studio');

  // Entering from the start screen keeps the same route, so the shell neither
  // resets the scroll nor moves focus: the button that was pressed is gone.
  // Land on the editor's heading so screen readers hear where they are. A real
  // route change has already focused <main>, which is left alone.
  useEffect(() => {
    window.scrollTo(0, 0);
    const active = document.activeElement;
    if (!active || active === document.body) headingRef.current?.focus({ preventScroll: true });
  }, []);

  const dirty = useMemo(() => mode === 'edit' && contentSignature(doc) !== contentSignature(base), [mode, doc, base]);
  const draft = useMemo(() => ({ doc, selectedId }), [doc, selectedId]);
  const autosave = useAutosave(storageKey, draft, { enabled: !finished, initialSavedAt: initial.savedAt });

  // Everything but the pages, so thumbnails only redraw when their own page changes. The
  // real-place fields and the uploads are in it too: covers print the coordinates and the
  // facts-checked date, and "user:<key>" photos resolve here.
  const { title, titleJp, subtitle, organization, theme, cover, format, updatedAt, region, location, factsChecked, sources, userPhotos } = doc;
  const shell = useMemo(
    () => ({ title, titleJp, subtitle, organization, theme, cover, format, updatedAt, region, location, factsChecked, sources, userPhotos }),
    [title, titleJp, subtitle, organization, theme, cover, format, updatedAt, region, location, factsChecked, sources, userPhotos],
  );

  const pages = doc.pages;
  const selectedIndex = Math.max(0, pages.findIndex((p) => p.id === selectedId));
  const page = pages[selectedIndex];

  const tabs = layout === 'desktop' ? [SIDE_TABS.pages, SIDE_TABS.design, SIDE_TABS.details] : [SIDE_TABS.page, SIDE_TABS.pages, SIDE_TABS.design, SIDE_TABS.details];
  const activeTab = tabs.some((t) => t.value === tab) ? tab : tabs[0].value;
  const tabList = tabs.map((t) => (t.value === 'pages' ? { ...t, badge: pages.length } : t));

  /* --- Navigation within the editor ------------------------------------ */
  const select = useCallback((pageId) => dispatch(A.select(pageId)), [dispatch]);
  const openPage = useCallback(
    (pageId) => {
      dispatch(A.select(pageId));
      if (layout !== 'desktop') setTab('page');
    },
    [dispatch, layout],
  );
  const step = (delta) => {
    const target = pages[selectedIndex + delta];
    if (target) select(target.id);
  };
  const editDesign = () => {
    setTab('design');
    setPhoneView('edit');
  };

  /* --- History ----------------------------------------------------------- */
  const undo = () => dispatch(A.undo());
  const redo = () => dispatch(A.redo());

  /* --- Import / export ----------------------------------------------------- */
  const exportJson = () => {
    download(exportFileName(doc), serializeBrochure(doc));
    toast({ title: 'Exported', description: exportFileName(doc), tone: 'success' });
  };

  const importFile = async (file) => {
    if (file.size > MAX_IMPORT_BYTES) {
      toast({ title: 'Import failed', description: 'That file is too large to be a brochure.', tone: 'error' });
      return;
    }
    const result = parseBrochureJson(await file.text());
    if (!result.ok) {
      toast({ title: 'Import failed', description: result.error, tone: 'error' });
      return;
    }
    const imported = { ...result.doc, id: doc.id, slug: doc.slug, source: 'user' };
    // The toast's Undo restores exactly this document, even after more edits
    // (a plain undo would only take back the latest of those).
    const before = { doc, selectedId };
    dispatch(A.replaceDoc(imported, imported.pages[0].id));
    const skipped = [
      result.dropped ? ` ${result.dropped} unknown page${result.dropped === 1 ? ' was' : 's were'} skipped.` : '',
      result.retired ? ` ${result.retired} map page${result.retired === 1 ? ' was' : 's were'} left out — Tabi shows photographs of the places instead.` : '',
      result.droppedPhotos ? ` ${result.droppedPhotos} photo${result.droppedPhotos === 1 ? '' : 's'} couldn’t be kept (not a safe image, or over the size limit).` : '',
    ].join('');
    toast({
      title: 'Imported',
      description: `“${imported.title || 'Untitled'}” replaced this draft.${skipped}`,
      tone: 'success',
      action: { label: 'Undo import', onClick: () => dispatch(A.replaceDoc(before.doc, before.selectedId)) },
    });
  };

  /* --- Publish / save / delete ------------------------------------------- */
  const commit = (finalDoc) => {
    if (finalDoc !== doc) dispatch(A.replaceDoc(finalDoc));
    let saved = saveBrochure(finalDoc);
    if (!saved && finalDoc.userPhotos) {
      // Uploaded photos live in the draft too; while it is stored they count twice
      // against the browser's quota. Free the draft's copy and try once more —
      // and put it back if storage still refuses, so nothing is lost.
      clearDraft(storageKey);
      saved = saveBrochure(finalDoc);
      if (!saved) writeDraft(storageKey, { doc: finalDoc, selectedId });
    }
    if (!saved) {
      // Storage refused the write (usually a full quota): keep the draft and say so.
      toast({
        title: mode === 'new' ? 'Couldn’t publish' : 'Couldn’t save changes',
        description: finalDoc.userPhotos
          ? 'Your browser’s storage is full — your own photos take the most room. Remove one you don’t use, or export a copy. Your draft is safe.'
          : 'Your browser’s storage is full. Your draft is safe — export it to keep a copy.',
        tone: 'error',
        action: { label: 'Export JSON', onClick: () => download(exportFileName(finalDoc), serializeBrochure(finalDoc)) },
      });
      return;
    }
    clearDraft(storageKey);
    if (mode === 'new') {
      autosave.discard();
      setFinished(true);
    } else {
      setBase(saved);
      setRestoredNotice(false);
    }
    setStamp({ kind: mode === 'new' ? 'publish' : 'save', saved });
    toast({
      title: mode === 'new' ? 'Published' : 'Changes saved',
      description: `“${saved.title}” is on your shelf.`,
      tone: 'success',
      action: { label: 'Open', onClick: () => navigate(`/brochures/${saved.slug}`) },
    });
  };

  const requestPublish = () => {
    if (stamp || finished || (mode === 'edit' && !dirty)) return;
    const issues = validateForPublish(doc);
    if (issues.length) setPublishCheck({ issues, key: Date.now(), open: true });
    else commit(doc);
  };

  const closePublishCheck = () => setPublishCheck((check) => check && { ...check, open: false });

  const fixAndPublish = (typedTitle) => {
    closePublishCheck();
    commit(autoFix(doc, { title: typedTitle || doc.title }));
  };

  const onStampDone = () => {
    const done = stamp;
    setStamp(null);
    if (done?.kind === 'publish') navigate(`/brochures/${done.saved.slug}`);
  };

  const confirmDelete = () => {
    setDeleteOpen(false);
    if (!deleteBrochure(doc.id)) {
      toast({ title: 'Couldn’t delete', description: 'Your browser’s storage isn’t accepting changes right now.', tone: 'error' });
      return;
    }
    autosave.discard();
    clearDraft(storageKey);
    setFinished(true);
    navigate('/brochures');
    toast({ title: 'Brochure deleted', description: `“${doc.title || 'Untitled'}” was removed from your shelf.` });
  };

  const discardRestored = () => {
    dispatch(A.load(structuredClone(base), selectedId));
    clearDraft(storageKey);
    setRestoredNotice(false);
  };

  /* --- Keyboard ------------------------------------------------------------ */
  const overlayOpen = Boolean(publishCheck?.open || stamp || previewOpen || deleteOpen);
  // ⌘Z also works in the editor's own fields, on the Studio history, which
  // groups a burst of typing into one step (the browser's undo goes a letter
  // at a time on controlled inputs). Fields outside the editor (palette,
  // popovers) and ones holding text not yet in the document
  // ([data-native-undo]) keep the browser's undo.
  const historyKey = (redoKey) => (event) => {
    if (!wantsStudioUndo(event.target, event.target?.closest?.('[data-studio-editor]'))) return;
    const redo = redoKey || event.shiftKey;
    if (redo ? state.future.length === 0 : state.past.length === 0) return;
    event.preventDefault();
    dispatch(redo ? A.redo() : A.undo());
  };
  useHotkey('mod+z', historyKey(false), { preventDefault: false, enabled: !overlayOpen });
  useHotkey('mod+y', historyKey(true), { preventDefault: false, enabled: !overlayOpen });
  useHotkey('mod+s', () => autosave.flush(), { enabled: !finished });
  useHotkey('mod+enter', requestPublish, { enabled: !overlayOpen });
  useHotkey('[', () => step(-1), { enabled: !overlayOpen });
  useHotkey(']', () => step(1), { enabled: !overlayOpen });
  useHotkey('?', () => setShortcutsOpen((open) => !open), { enabled: !overlayOpen });

  /* --- Render ---------------------------------------------------------------- */
  const sidebar = (
    <aside className={styles.sidebar} aria-label="Brochure settings">
      <PanelTabs label="Studio panels" tabs={tabList} value={activeTab} onChange={setTab} idBase={id} className={styles.tabs} />
      <div key={activeTab} className={styles.panelScroll} data-flush={activeTab === 'page' || undefined} {...tabPanelProps(id, activeTab)}>
        <motion.div
          className={styles.panelInner}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: ease.out } }}
        >
          {activeTab === 'details' && <DetailsPanel brochure={doc} dispatch={dispatch} />}
          {activeTab === 'design' && <DesignPanel brochure={doc} dispatch={dispatch} />}
          {activeTab === 'pages' && (
            <PagesPanel brochure={doc} selectedId={selectedId} dispatch={dispatch} onOpenPage={openPage} compact={layout === 'desktop'} />
          )}
          {activeTab === 'page' && (
            <PageEditor brochure={doc} page={page} index={selectedIndex} total={pages.length} dispatch={dispatch} onEditDesign={editDesign} />
          )}
        </motion.div>
      </div>
    </aside>
  );

  const preview = (
    <div className={styles.centre}>
      <PreviewStage brochure={shell} pages={pages} selectedIndex={selectedIndex} onSelect={select} view={previewView} onViewChange={setPreviewView} />
    </div>
  );

  return (
    <div className={styles.studio} data-studio-editor="" data-layout={layout} data-nav-hidden={navHidden || undefined}>
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        {`${mode === 'edit' ? 'Studio: editing' : 'Studio: designing'} “${doc.title?.trim() || 'Untitled brochure'}”`}
      </h1>
      <StudioTopBar
        mode={mode}
        layout={layout}
        title={doc.title}
        onTitle={(value) => dispatch(A.setField('title', value, true))}
        save={{ saving: autosave.saving, savedAt: autosave.savedAt, error: autosave.error }}
        dirty={dirty}
        canUndo={state.past.length > 0}
        canRedo={state.future.length > 0}
        onUndo={undo}
        onRedo={redo}
        onPreview={() => setPreviewOpen(true)}
        onExport={exportJson}
        onImportFile={importFile}
        onPublish={requestPublish}
        onDelete={() => setDeleteOpen(true)}
        shortcutsOpen={shortcutsOpen}
        onShortcutsOpen={setShortcutsOpen}
      />

      <AnimatePresence initial={false}>
        {restoredNotice && (
          <motion.div
            className={styles.notice}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            role="status"
          >
            <p>
              <RotateCcw size={15} aria-hidden="true" />
              Restored the unsaved changes you made <RestoredAgo savedAt={initial.savedAt} />.
            </p>
            <div className={styles.noticeActions}>
              <Button size="sm" variant="ghost" onClick={() => setRestoredNotice(false)}>
                Keep them
              </Button>
              <Button size="sm" variant="secondary" onClick={discardRestored}>
                Discard changes
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.workspace}>
        {layout === 'phone' ? (
          phoneView === 'edit' ? sidebar : preview
        ) : (
          <>
            {sidebar}
            {preview}
            {layout === 'desktop' && (
              <aside className={styles.inspector} aria-label="Page editor">
                <PageEditor brochure={doc} page={page} index={selectedIndex} total={pages.length} dispatch={dispatch} onEditDesign={editDesign} />
              </aside>
            )}
          </>
        )}
      </div>

      {layout === 'phone' && (
        <PhoneDock
          view={phoneView}
          onViewChange={setPhoneView}
          onPublish={requestPublish}
          publishLabel={mode === 'edit' ? 'Save' : 'Publish'}
          publishDisabled={mode === 'edit' && !dirty}
          save={{ saving: autosave.saving, savedAt: autosave.savedAt, error: autosave.error }}
          mode={mode}
          dirty={dirty}
        />
      )}

      <PublishDialog
        key={publishCheck?.key ?? 0}
        open={Boolean(publishCheck?.open)}
        mode={mode}
        issues={publishCheck?.issues ?? []}
        onClose={closePublishCheck}
        onFix={fixAndPublish}
      />

      <PreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} brochure={doc} startIndex={selectedIndex} />

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        size="sm"
        title="Delete this brochure?"
        description={`“${doc.title || 'Untitled'}” will be removed from your shelf. This can’t be undone.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Keep it
            </Button>
            <Button variant="accent" onClick={confirmDelete}>
              Delete brochure
            </Button>
          </>
        }
      >
        <p className={styles.deleteNote}>Tip: export it as JSON first if you might want it back.</p>
      </Modal>

      <AnimatePresence>{stamp && <PublishStamp kind={stamp.kind} title={stamp.saved.title} onDone={onStampDone} />}</AnimatePresence>
    </div>
  );
}
