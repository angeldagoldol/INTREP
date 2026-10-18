import { cn } from '../../lib/cn.js';
import styles from './Photo.module.css';

/** Only http(s) links leave the page. */
function safeHref(href) {
  if (typeof href !== 'string' || !href) return null;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * "Photo: Author · CC BY-SA 4.0" — the author links to the work's source page
 * (title, author and licence are all there), the licence to its deed, both in
 * a new tab. A long credit wraps onto a second line rather than being cut
 * off, and the licence never breaks; the full credit, with the work's title,
 * is also in the tooltip.
 *
 *   <PhotoCredit credit={photo.credit} links={!isStatic} className={…} />
 *
 * - `credit`  { title, author, license, licenseUrl, sourceUrl } (a photo record's
 *             `credit`, or an entry from creditsFor()).
 * - `links`   false prints plain text (static pages, thumbnails).
 * - `label`   the lead-in ('Photo:' by default; '' for none).
 * - `as`      the element (default <small>).
 * Renders nothing when there is neither an author nor a licence.
 */
export function PhotoCredit({ credit, links = true, label = 'Photo:', as: Tag = 'small', className }) {
  const { title, author, license, licenseUrl, sourceUrl } = credit ?? {};
  if (!author && !license) return null;
  const name = author || 'Unknown author';
  const full = `${title ? `“${title}” by ` : ''}${name}${license ? ` · ${license}` : ''}`;
  const external = (href, children, aria) =>
    links && safeHref(href) ? (
      <a href={safeHref(href)} target="_blank" rel="noopener noreferrer" aria-label={aria}>
        {children}
      </a>
    ) : (
      children
    );
  return (
    <Tag className={cn(styles.credit, className)} title={full}>
      {label && (
        <>
          <span className={styles.creditLabel}>{label}</span>{' '}
        </>
      )}
      <span className={styles.creditAuthor}>{external(sourceUrl, name, `${name}, source of this photo (opens in a new tab)`)}</span>
      {license && (
        <>
          <span className={styles.creditSep} aria-hidden="true">
            {' · '}
          </span>
          <span className={styles.creditLicense}>{external(licenseUrl, license, `Licence ${license} (opens in a new tab)`)}</span>
        </>
      )}
    </Tag>
  );
}
