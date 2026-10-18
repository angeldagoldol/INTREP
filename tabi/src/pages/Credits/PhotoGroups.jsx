import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Photo } from '../../components/photo/Photo.jsx';
import { hostOf } from '../../components/viewer/links.js';
import { pad } from '../../lib/format.js';
import styles from './Credits.module.css';

/** An outbound link (new tab), or plain text when there is no safe URL. */
function External({ href, children, label }) {
  if (!href) return children;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.ext} aria-label={label}>
      {children}
      <ArrowUpRight aria-hidden="true" focusable="false" />
    </a>
  );
}

/** The credits of one group as a table: picture, author, licence, source. */
function CreditTable({ group }) {
  return (
    // Explicit roles keep the table semantics when phones restyle the rows as cards.
    <table className={`${styles.table} ${styles.creditTable}`} role="table">
      <caption className="sr-only">Photo credits — {group.title}</caption>
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col" role="columnheader" className={styles.thumbCol}>
            <span className="sr-only">Thumbnail</span>
          </th>
          <th scope="col" role="columnheader">
            Photograph
          </th>
          <th scope="col" role="columnheader">
            Author
          </th>
          <th scope="col" role="columnheader">
            Licence
          </th>
          <th scope="col" role="columnheader">
            Source
          </th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {group.credits.map((credit) => {
          const host = hostOf(credit.sourceUrl);
          return (
            <tr key={credit.id} role="row">
              <td role="cell" className={styles.thumbCell}>
                <span className={styles.thumb}>
                  <Photo id={credit.id} brochure={group.brochure ?? undefined} alt="" sizes="160px" credit="none" />
                </span>
              </td>
              <th scope="row" role="rowheader" className={styles.what}>
                <span className={styles.whatCaption}>{credit.caption || credit.place || credit.title || 'Photograph'}</span>
                {credit.title && <span className={styles.whatTitle}>“{credit.title}”</span>}
              </th>
              <td role="cell" data-label="Author">
                <External href={credit.authorUrl} label={`${credit.author || 'Unknown author'} (opens in a new tab)`}>
                  {credit.author || 'Unknown author'}
                </External>
              </td>
              <td role="cell" data-label="Licence">
                {credit.license ? (
                  <External href={credit.licenseUrl} label={`Licence ${credit.license} (opens in a new tab)`}>
                    <span className={styles.licence}>{credit.license}</span>
                  </External>
                ) : (
                  '—'
                )}
              </td>
              <td role="cell" data-label="Source">
                {host ? (
                  <External href={credit.sourceUrl} label={`Source of this photo on ${host} (opens in a new tab)`}>
                    <span className={styles.host}>{host}</span>
                  </External>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Every photograph in the app, a group per place it appears: a running row
 * (number, title, how many are credited and still to come, a link to it),
 * the credits table, and a disclosure listing the photographs chosen but not
 * downloaded yet (their pages show generated art meanwhile).
 * Props: groups (credits.js creditGroups).
 */
export function PhotoGroups({ groups }) {
  return (
    <ol className={styles.groups}>
      {groups.map((group, i) => {
        const headingId = `credits-group-${i}`;
        const to = group.kind === 'home' ? '/' : group.slug ? `/brochures/${encodeURIComponent(group.slug)}` : '';
        const count = group.credits.length;
        return (
          <li key={group.id} className={styles.group} data-empty={count === 0 || undefined}>
            <div className={styles.groupHead}>
              <span className={styles.groupNum} aria-hidden="true">
                {pad(i + 1)}
              </span>
              <h3 id={headingId} className={styles.groupTitle}>
                {group.title}
                {group.titleJp && (
                  <span lang="ja" className={styles.groupJp}>
                    {group.titleJp}
                  </span>
                )}
                {group.kind === 'user' && <span className={styles.groupTag}>Your brochure</span>}
              </h3>
              <p className={styles.groupMeta}>
                <span className={styles.groupCount} data-none={count === 0 || undefined}>
                  {count} credited
                </span>
                {group.pending.length > 0 && <span className={styles.groupPending}>{group.pending.length} to come</span>}
              </p>
              {to && (
                <Link to={to} className={styles.groupLink} aria-label={`Open ${group.title}`}>
                  Open <ArrowRight aria-hidden="true" focusable="false" />
                </Link>
              )}
            </div>
            {count > 0 && <CreditTable group={group} />}
            {group.pending.length > 0 && (
              <details className={styles.pending}>
                <summary>
                  {group.pending.length === 1 ? 'The photograph' : `The ${group.pending.length} photographs`} still to download
                </summary>
                <ul className={styles.pendingList}>
                  {group.pending.map((photo) => (
                    <li key={photo.id}>{photo.caption || photo.place || photo.id}</li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        );
      })}
    </ol>
  );
}
