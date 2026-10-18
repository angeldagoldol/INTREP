import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PAGE_TYPES } from '../../data/schema.js';
import { Icon } from '../ui/index.js';
import { ease } from '../../lib/motion.js';
import { pad } from '../../lib/format.js';
import { SECTION_JP } from '../brochure/blocks/pageUtils.js';
import { newListItem } from './pageLimits.js';
import { PageFields } from './PageFields.jsx';
import { getIn, studioActions as A } from './studioReducer.js';
import styles from './PageEditor.module.css';

/**
 * Right-hand inspector: a header naming the selected page and the form for
 * its type. Fields write straight into the Studio reducer (typing coalesces
 * into single undo steps); photo slots get place/upload/update/remove
 * actions bound to their target (api.photos(path), api.coverPhotos()).
 *   <PageEditor brochure={doc} page={page} index={2} total={8} dispatch={dispatch} onEditDesign={…} />
 */
export function PageEditor({ brochure, page, index, total, dispatch, onEditDesign }) {
  const api = useMemo(() => {
    if (!page) return null;
    /** Photo actions for one slot: the cover (brochure.cover.photo) or a page field ending in 'photo'. */
    const photoSlot = (target) => ({
      place: (id) => dispatch(A.placePhoto(target, id)),
      upload: (key, photo) => dispatch(A.addUserPhoto(key, photo, target)),
      update: (key, path, value, typing = false) => dispatch(A.updateUserPhoto(key, path, value, typing)),
      remove: (key) => dispatch(A.removeUserPhoto(key)),
    });
    return {
      get: (path) => getIn(page, path),
      set: (path, value, typing = false) => dispatch(A.updatePage(page.id, path, value, typing)),
      merge: (path, patch, typing = false) => dispatch(A.mergePage(page.id, path, patch, typing)),
      add: (path, at) => dispatch(A.addItem(page.id, path, newListItem(page.type, path, Math.random, page), at)),
      remove: (path, at) => dispatch(A.removeItem(page.id, path, at)),
      move: (path, from, to) => dispatch(A.moveItem(page.id, path, from, to)),
      photos: (path) => photoSlot({ kind: 'page', id: page.id, path }),
      coverPhotos: () => photoSlot({ kind: 'cover', pageId: page.id }),
      fixSpreads: () => dispatch(A.fixSpreads()),
    };
  }, [page, dispatch]);

  if (!page) {
    return (
      <div className={styles.empty}>
        <p lang="ja" className={styles.emptyJp} aria-hidden="true">
          白紙
        </p>
        <p>Select a page to edit it.</p>
      </div>
    );
  }

  const meta = PAGE_TYPES[page.type] ?? { label: 'Unknown page', description: '', icon: 'Info' };

  return (
    <div className={styles.editor}>
      <header className={styles.head}>
        <span className={styles.typeIcon} aria-hidden="true">
          <Icon name={meta.icon} size={20} />
        </span>
        <div className={styles.headText}>
          <p className={styles.eyebrow}>
            Page {pad(index + 1)} <span className={styles.of}>/ {pad(total)}</span>
            <span lang="ja" className={styles.jp}>
              {SECTION_JP[page.type] ?? ''}
            </span>
          </p>
          <h2 className={styles.title}>{meta.label}</h2>
          <p className={styles.description}>{meta.description}</p>
        </div>
      </header>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={page.id}
          className={styles.body}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: ease.out } }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
        >
          <PageFields
            page={page}
            index={index}
            api={api}
            brochure={brochure}
            onEditDesign={onEditDesign}
            onCover={(cover) => dispatch(A.setCover(cover))}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
