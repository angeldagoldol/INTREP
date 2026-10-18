import { useRef, useState } from 'react';
import { Download, Ellipsis, Eye, Keyboard, Redo2, Stamp, Trash2, Undo2, Upload } from 'lucide-react';
import { Button, Hanko, IconButton } from '../ui/index.js';
import { modKeyLabel } from '../../hooks/useHotkey.js';
import { nextIndex } from './a11y.js';
import { Popover } from './Popover.jsx';
import { SavedIndicator } from './SavedIndicator.jsx';
import { ShortcutHelp } from './ShortcutHelp.jsx';
import styles from './StudioTopBar.module.css';

function MoreMenu({ items }) {
  const anchorRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const onKeyDown = (event) => {
    const buttons = [...(listRef.current?.querySelectorAll('[role="menuitem"]') ?? [])];
    const next = nextIndex(event.key, buttons.indexOf(document.activeElement), buttons.length);
    if (next === -1 || event.key === 'ArrowLeft' || event.key === 'ArrowRight') return;
    event.preventDefault();
    buttons[next]?.focus();
  };
  return (
    <>
      <IconButton ref={anchorRef} label="More actions" icon={<Ellipsis />} aria-haspopup="menu" aria-expanded={open} active={open} onClick={() => setOpen((o) => !o)} />
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} role="menu" label="More actions" placement="bottom-end" className={styles.menu}>
        <ul ref={listRef} role="none" className={styles.menuList} onKeyDown={onKeyDown}>
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                data-tone={item.tone}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </Popover>
    </>
  );
}

/**
 * The Studio's command bar: editable title, autosave status, undo / redo,
 * shortcuts, preview, JSON export / import and the primary Publish (or
 * Save changes) action. Collapses secondary actions into a menu on phones.
 */
export function StudioTopBar({
  mode,
  layout,
  title,
  onTitle,
  save,
  dirty,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPreview,
  onExport,
  onImportFile,
  onPublish,
  onDelete,
  shortcutsOpen,
  onShortcutsOpen,
}) {
  const fileRef = useRef(null);
  const phone = layout === 'phone';
  const editing = mode === 'edit';

  const moreItems = [
    { label: 'Preview', icon: <Eye size={16} />, onSelect: onPreview },
    { label: 'Export JSON', icon: <Download size={16} />, onSelect: onExport },
    { label: 'Import JSON', icon: <Upload size={16} />, onSelect: () => fileRef.current?.click() },
    ...(editing ? [{ label: 'Delete brochure', icon: <Trash2 size={16} />, onSelect: onDelete, tone: 'danger' }] : []),
  ];

  return (
    <div className={styles.bar} data-layout={layout}>
      <div className={styles.identity}>
        <Hanko text={editing ? '編' : '作'} size={34} className={styles.seal} />
        <div className={styles.titleWrap}>
          <span className={styles.mode}>
            {editing ? 'Editing' : 'Draft'}
            <span lang="ja">{editing ? '編集中' : '下書き'}</span>
          </span>
          <input
            className={styles.title}
            value={title ?? ''}
            onChange={(event) => onTitle(event.target.value)}
            placeholder="Untitled brochure"
            aria-label="Brochure title"
            maxLength={80}
            spellCheck={false}
          />
        </div>
      </div>

      <div className={styles.status}>
        <SavedIndicator {...save} mode={mode} dirty={dirty} compact={phone} />
      </div>

      <div className={styles.actions}>
        <div className={styles.group} role="group" aria-label="History">
          <IconButton label={`Undo (${modKeyLabel} Z)`} icon={<Undo2 />} disabled={!canUndo} onClick={onUndo} />
          <IconButton label={`Redo (⇧ ${modKeyLabel} Z)`} icon={<Redo2 />} disabled={!canRedo} onClick={onRedo} />
        </div>

        {phone ? (
          <MoreMenu items={[...moreItems, { label: 'Keyboard shortcuts', icon: <Keyboard size={16} />, onSelect: () => onShortcutsOpen(true) }]} />
        ) : (
          <>
            <span className={styles.divider} aria-hidden="true" />
            <ShortcutHelp open={shortcutsOpen} onOpenChange={onShortcutsOpen} />
            <IconButton label="Export JSON" icon={<Download />} onClick={onExport} />
            <IconButton label="Import JSON" icon={<Upload />} onClick={() => fileRef.current?.click()} />
            {editing && <IconButton label="Delete brochure" icon={<Trash2 />} onClick={onDelete} className={styles.danger} />}
            <IconButton label="Preview" icon={<Eye />} onClick={onPreview} className={styles.previewIcon} />
            <Button variant="secondary" size="sm" iconLeft={<Eye />} onClick={onPreview} className={styles.preview}>
              Preview
            </Button>
            <Button variant="accent" size="sm" iconLeft={<Stamp />} onClick={onPublish} disabled={editing && !dirty}>
              {editing ? 'Save changes' : 'Publish'}
            </Button>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onImportFile(file);
        }}
      />
    </div>
  );
}
