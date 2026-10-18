import { useRef, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { ArrowDown, ArrowUp, CircleAlert, Copy, GripVertical, Trash2, Wand2 } from 'lucide-react';
import { spanOf } from '../../data/photoSpreads.js';
import { createPhotoSpread, moveSpread, pageInsertIndex, spreadInsertIndex, spreadIssues, spreadPairAt } from '../../data/photoSpreadEdits.js';
import { PAGE_TYPES } from '../../data/schema.js';
import { Button, Icon, IconButton } from '../ui/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { modKeyLabel } from '../../hooks/useHotkey.js';
import { createId } from '../../lib/id.js';
import { pad } from '../../lib/format.js';
import { spring } from '../../lib/motion.js';
import { pageHeading, SECTION_JP } from '../brochure/blocks/pageUtils.js';
import { AddPageMenu, SPREAD } from './AddPageMenu.jsx';
import { Note } from './Note.jsx';
import { studioActions as A } from './studioReducer.js';
import styles from './PagesPanel.module.css';

function PageRow({ page, brochure, index, total, selected, compact, warning, spread, onOpen, onMove, onDuplicate, onRemove, onDragEnd }) {
  const controls = useDragControls();
  const meta = PAGE_TYPES[page.type] ?? { label: 'Page', icon: 'Info' };
  const span = spanOf(page);
  // Half of a spread: the arrows move both halves, a spread at a time.
  const what = spread ? 'the spread' : '';
  const heading = pageHeading(page, brochure);
  // In the compact Tab order only the selected row's actions are tab stops; the
  // others stay one Enter away (and reachable by pointer and screen-reader browse).
  const actionTab = compact && !selected ? -1 : undefined;
  return (
    <Reorder.Item
      value={page.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      className={styles.row}
      data-page-id={page.id}
      data-selected={selected || undefined}
      data-warning={warning || undefined}
      whileDrag={{ scale: 1.03, boxShadow: 'var(--shadow-lg)', zIndex: 3 }}
      transition={spring.snappy}
    >
      <span
        className={styles.grip}
        onPointerDown={(event) => {
          event.preventDefault();
          controls.start(event);
        }}
        aria-hidden="true"
        title="Drag to reorder"
      >
        <GripVertical size={16} />
      </span>
      <button type="button" className={styles.main} data-action="open" onClick={onOpen} aria-current={selected ? 'page' : undefined}>
        <span className={styles.number}>{pad(index + 1)}</span>
        <span className={styles.typeIcon} aria-hidden="true">
          <Icon name={meta.icon} size={16} />
        </span>
        <span className={styles.text}>
          <span className={styles.heading}>{heading}</span>
          <span className={styles.type}>
            {span ? `Spread, ${span} half` : meta.label}
            <span lang="ja"> · {span ? '見開き' : (SECTION_JP[page.type] ?? '')}</span>
          </span>
        </span>
        {warning && (
          <span className={styles.warn} title={warning}>
            <CircleAlert size={15} aria-hidden="true" />
            <span className="sr-only">{` — ${warning}`}</span>
          </span>
        )}
      </button>
      <span className={styles.actions}>
        <IconButton
          label={spread ? `Move ${what} “${heading}” up` : `Move “${heading}” up`}
          icon={<ArrowUp />}
          size="sm"
          tooltipSide="top"
          data-action="up"
          tabIndex={actionTab}
          disabled={spread ? !spread.up : index === 0}
          onClick={() => (spread ? spread.move(-1) : onMove(index - 1))}
        />
        <IconButton
          label={spread ? `Move ${what} “${heading}” down` : `Move “${heading}” down`}
          icon={<ArrowDown />}
          size="sm"
          tooltipSide="top"
          data-action="down"
          tabIndex={actionTab}
          disabled={spread ? !spread.down : index === total - 1}
          onClick={() => (spread ? spread.move(1) : onMove(index + 1))}
        />
        <IconButton label={`Duplicate “${heading}”`} icon={<Copy />} size="sm" tooltipSide="top" data-action="duplicate" tabIndex={actionTab} onClick={onDuplicate} />
        <IconButton
          label={`Delete “${heading}”`}
          icon={<Trash2 />}
          size="sm"
          tooltipSide="left"
          data-action="delete"
          tabIndex={actionTab}
          disabled={total <= 1}
          onClick={onRemove}
        />
      </span>
    </Reorder.Item>
  );
}

/**
 * The page list: drag the handle (or use the arrow buttons) to reorder,
 * select to edit, duplicate, delete with an Undo toast, and add any page
 * type after the selected page. Keyboard focus follows the page you moved
 * or lands on a neighbour after a delete, like the item lists in the editor.
 * `compact` keeps only the selected row's actions in the Tab order (used
 * where selecting a row does not switch panels).
 *   <PagesPanel brochure={doc} selectedId={id} dispatch={dispatch} onOpenPage={(id) => …} compact />
 */
export function PagesPanel({ brochure, selectedId, dispatch, onOpenPage, compact = false }) {
  const toast = useToast();
  const rootRef = useRef(null);
  const pages = brochure.pages;
  const [dragOrder, setDragOrder] = useState(null);
  const [message, setMessage] = useState('');
  const byId = new Map(pages.map((p) => [p.id, p]));
  const order = dragOrder && dragOrder.length === pages.length && dragOrder.every((id) => byId.has(id)) ? dragOrder : pages.map((p) => p.id);
  const selectedIndex = pages.findIndex((p) => p.id === selectedId);
  const issues = spreadIssues(pages);
  const warnings = new Map(issues.flatMap((issue) => issue.ids.map((id) => [id, issue.message])));

  // New pages go after the selected one, before a closing back cover, and never between the halves of a spread.
  const after = selectedIndex === -1 ? pages.length : selectedIndex + 1;
  const base = after === pages.length && pages.at(-1)?.type === 'back' ? Math.max(0, after - 1) : after;

  const add = (type) => {
    if (type === SPREAD) {
      const at = spreadInsertIndex(pages, base);
      const spread = createPhotoSpread().map((fields) => ({ id: createId('pg'), type: 'photo', ...fields }));
      dispatch(A.addPages(spread, at));
      setMessage(`Added a double-page spread on pages ${at + 1} and ${at + 2}`);
      onOpenPage?.(spread[0].id, { added: true });
      return;
    }
    const page = { id: createId('pg'), type, ...PAGE_TYPES[type].create() };
    dispatch(A.addPage(page, pageInsertIndex(pages, base)));
    setMessage(`Added a ${PAGE_TYPES[type].label} page`);
    onOpenPage?.(page.id, { added: true });
  };

  /** Arrows on a spread half: both halves move, two pages at a time, so the spread keeps facing. */
  const spreadMoves = (id) => {
    const at = pages.findIndex((p) => p.id === id);
    if (!spreadPairAt(pages, at)) return null;
    const move = (dir) => {
      const next = moveSpread(pages, at, dir);
      const nextAt = next.findIndex((p) => p.id === id);
      const [first] = spreadPairAt(next, nextAt);
      dispatch(A.moveSpread(id, dir));
      setMessage(`Moved the spread to pages ${first + 1}–${first + 2}`);
      // Keep focus on the arrow just pressed, or hand it to the other one at the end of the line.
      const again = moveSpread(next, nextAt, dir) !== next;
      focusLater(id, (dir < 0) === again ? 'up' : 'down');
    };
    return { up: moveSpread(pages, at, -1) !== pages, down: moveSpread(pages, at, 1) !== pages, move };
  };

  const lineUp = () => {
    dispatch(A.fixSpreads());
    setMessage('Lined up the double-page spreads');
  };

  /** Focus a control in a row once React has committed the change. */
  const focusLater = (pageId, action) =>
    requestAnimationFrame(() => {
      // Matched by dataset, not a selector, so any imported page id is safe.
      const row = [...(rootRef.current?.querySelectorAll('[data-page-id]') ?? [])].find((el) => el.dataset.pageId === pageId);
      row?.querySelector(`[data-action="${action}"]`)?.focus();
    });

  const move = (id, from, to) => {
    dispatch(A.movePage(id, to));
    setMessage(`Moved “${pageHeading(byId.get(id), brochure)}” to position ${to + 1} of ${order.length}`);
    // At either end the button you pressed is now disabled: hand focus to the opposite arrow.
    const direction = to < from ? 'up' : 'down';
    const edge = to === 0 || to === order.length - 1;
    focusLater(id, edge ? (direction === 'up' ? 'down' : 'up') : direction);
  };

  const remove = (page, index) => {
    const neighbour = order[index + 1] ?? order[index - 1];
    dispatch(A.removePage(page.id));
    const heading = pageHeading(page, brochure);
    setMessage(`Deleted ${heading}`);
    if (neighbour) focusLater(neighbour, 'open');
    // Name the shortcut only where there is likely a keyboard (not on phones).
    const keyHint = window.matchMedia?.('(pointer: fine)').matches ? ` ${modKeyLabel} Z undoes it.` : '';
    toast({
      title: 'Page deleted',
      description: `“${heading}” was removed.${keyHint}`,
      action: { label: 'Undo', onClick: () => dispatch(A.addPage(page, index)) },
    });
  };

  const commitDrag = () => {
    if (dragOrder) dispatch(A.reorderPages(dragOrder));
    setDragOrder(null);
  };

  return (
    <div className={styles.panel} ref={rootRef}>
      <header className={styles.head}>
        <p className={styles.count}>
          <span className={styles.big}>{pages.length}</span> {pages.length === 1 ? 'page' : 'pages'}
          <span lang="ja" className={styles.jp}>
            頁
          </span>
        </p>
        <AddPageMenu onAdd={add} where={selectedIndex >= 0 ? `after page ${pad(selectedIndex + 1)}` : 'at the end'} />
      </header>

      {issues.length > 0 && (
        <Note
          tone="warning"
          className={styles.spreadNote}
          action={
            <Button size="sm" variant="secondary" iconLeft={<Wand2 />} onClick={lineUp}>
              Line up
            </Button>
          }
        >
          <strong>{issues.length === 1 ? 'A photo spread is out of place.' : `${issues.length} photo spreads are out of place.`}</strong> {issues[0].message}
        </Note>
      )}

      <Reorder.Group
        as="ol"
        axis="y"
        values={order}
        onReorder={setDragOrder}
        className={styles.list}
        data-compact={compact || undefined}
        aria-label="Pages in reading order"
      >
        {order.map((id, index) => {
          const page = byId.get(id);
          return (
            <PageRow
              key={id}
              page={page}
              brochure={brochure}
              index={index}
              total={order.length}
              selected={id === selectedId}
              compact={compact}
              warning={warnings.get(id)}
              spread={dragOrder ? null : spreadMoves(id)}
              onOpen={() => onOpenPage?.(id)}
              onMove={(to) => move(id, index, to)}
              onDuplicate={() => {
                dispatch(A.duplicatePage(id, createId('pg')));
                setMessage(`Duplicated ${pageHeading(page, brochure)}`);
              }}
              onRemove={() => remove(page, index)}
              onDragEnd={commitDrag}
            />
          );
        })}
      </Reorder.Group>

      <p className={styles.hint}>
        Drag the handle to reorder — or use the arrows. A brochure opens with a cover and closes with a back cover; a double-page spread starts on an even
        page (2, 4, 6…) so its halves face each other.
      </p>
      <p className="sr-only" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
