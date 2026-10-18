import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from '../../../components/ui/index.js';
import { CoverArt } from '../../../components/brochure/index.js';
import { getCategory } from '../../../data/categories.js';
import { getRegion } from '../../../data/regions.js';
import styles from './RemixPicker.module.css';

function matches(brochure, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [brochure.title, brochure.titleJp, brochure.subtitle, getRegion(brochure.region).label, ...(brochure.tags ?? [])]
    .join(' ')
    .toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

/**
 * Pick a library brochure to copy into the Studio. Searchable by title,
 * region, tags or Japanese name.
 *   <RemixPicker open={open} onClose={close} brochures={builtins} onPick={(b) => …} />
 */
export function RemixPicker({ open, onClose, brochures, onPick }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => brochures.filter((b) => matches(b, query)), [brochures, query]);

  return (
    <Modal open={open} onClose={onClose} size="xl" title="Remix a library brochure" description="Pick one to copy into the Studio — the original stays exactly as it is.">
      <label className={styles.search}>
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Search brochures</span>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Kyoto, onsen, 祭…" className={styles.input} />
      </label>
      <p className={styles.count} aria-live="polite">
        {results.length} {results.length === 1 ? 'brochure' : 'brochures'}
      </p>
      {results.length > 0 ? (
        <ul className={styles.grid}>
          {results.map((b) => (
            <li key={b.id}>
              <button type="button" className={styles.option} onClick={() => onPick(b)}>
                <span className={styles.cover} aria-hidden="true">
                  <CoverArt style={b.cover?.art} seed={b.cover?.seed} theme={b.theme} />
                  <span lang="ja" className={styles.jp} style={{ color: b.theme?.ink, background: b.theme?.paper }}>
                    {b.titleJp}
                  </span>
                </span>
                <span className={styles.meta}>{`${getCategory(b.category).label} · ${getRegion(b.region).label}`}</span>
                <span className={styles.title}>{b.title}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <p lang="ja" className={styles.emptyJp} aria-hidden="true">
            無
          </p>
          <p>Nothing matches “{query}”. Try a place, a season or a food.</p>
        </div>
      )}
    </Modal>
  );
}
