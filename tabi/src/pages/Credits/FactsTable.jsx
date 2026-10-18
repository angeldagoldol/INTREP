import { Link } from 'react-router-dom';
import { ArrowUpRight, BadgeCheck, CircleDashed, FileText } from 'lucide-react';
import { STANDARD_URL, researchLogUrl } from './docLinks.js';
import styles from './Credits.module.css';

/**
 * How the facts are checked, with a link to the standard (docs/REAL_CONTENT.md),
 * then one row per built-in brochure: when its facts were checked, how many
 * sources it cites (listed in the brochure's "About" section) and its
 * research log (docs/research/<slug>.md), plus the Home page's log.
 * Props: groups (credits.js creditGroups).
 */
export function FactsTable({ groups }) {
  const rows = groups.filter((g) => g.kind === 'builtin');
  const homeLog = researchLogUrl('home');
  return (
    <div className={styles.facts}>
      <div className={styles.factsNote}>
        <p>
          The built-in brochures are written by <strong>Tabi Guides</strong>, this site’s own editorial imprint, about real
          places. Every fact — history, heights, hours, prices, access, festival dates — is checked against at least two
          independent sources, official ones first (the temple, museum or railway itself, city and prefectural tourism
          sites, JNTO), and logged with its sources and the date it was checked. Values that could not be verified are left
          out, and prices and hours are phrased as what they are: the latest we could confirm.
        </p>
        <p>
          No businesses, guides, people or reviews are invented, and no brochure prints a phone number. Each brochure lists its
          sources under “About this brochure”. Opening hours and prices change: check the official sites before you travel.
        </p>
        <ul className={styles.docLinks}>
          <li>
            <a href={STANDARD_URL} target="_blank" rel="noopener noreferrer" className={styles.docLink}>
              <FileText aria-hidden="true" focusable="false" />
              <span>
                The standard every brochure follows
                <span className={styles.docFile}>REAL_CONTENT.md</span>
              </span>
              <ArrowUpRight aria-hidden="true" focusable="false" className={styles.docArrow} />
              <span className="sr-only"> (Markdown file, opens in a new tab)</span>
            </a>
          </li>
          {homeLog && (
            <li>
              <a href={homeLog} target="_blank" rel="noopener noreferrer" className={styles.docLink}>
                <FileText aria-hidden="true" focusable="false" />
                <span>
                  Research log for the Home page
                  <span className={styles.docFile}>research/home.md</span>
                </span>
                <ArrowUpRight aria-hidden="true" focusable="false" className={styles.docArrow} />
                <span className="sr-only"> (Markdown file, opens in a new tab)</span>
              </a>
            </li>
          )}
        </ul>
      </div>

      {/* Explicit roles keep the table semantics when phones restyle the rows. */}
      <table className={`${styles.table} ${styles.factsTable}`} role="table">
        <caption className="sr-only">Fact checks of the built-in brochures</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">
              Brochure
            </th>
            <th scope="col" role="columnheader">
              Facts checked
            </th>
            <th scope="col" role="columnheader">
              Sources
            </th>
            <th scope="col" role="columnheader">
              Research log
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((g) => {
            const log = researchLogUrl(g.slug);
            return (
              <tr key={g.id} role="row">
                <th scope="row" role="rowheader" className={styles.what}>
                  <Link to={`/brochures/${encodeURIComponent(g.slug)}`} className={styles.rowLink}>
                    {g.title}
                  </Link>
                  {g.titleJp && (
                    <span lang="ja" className={styles.whatJp}>
                      {g.titleJp}
                    </span>
                  )}
                </th>
                <td role="cell" data-label="Facts checked">
                  <span className={styles.checked} data-checked={g.factsChecked ? '' : undefined}>
                    {g.factsChecked ? <BadgeCheck aria-hidden="true" focusable="false" /> : <CircleDashed aria-hidden="true" focusable="false" />}
                    {g.factsChecked || 'Awaiting check'}
                  </span>
                </td>
                <td role="cell" data-label="Sources">
                  <span className={styles.num}>{g.sources.length}</span>
                </td>
                <td role="cell" data-label="Research log">
                  {log ? (
                    <a href={log} target="_blank" rel="noopener noreferrer" className={styles.ext}>
                      <span className={styles.host}>{g.slug}.md</span>
                      <ArrowUpRight aria-hidden="true" focusable="false" />
                      <span className="sr-only"> (Markdown file, opens in a new tab)</span>
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
