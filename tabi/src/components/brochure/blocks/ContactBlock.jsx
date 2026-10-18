import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { safeUrl } from '../../../data/sanitize.js';
import { Button, Icon } from '../../ui/index.js';
import { usePage } from './pageContext.js';
import { fitSize, linkLabel, list, text } from './pageUtils.js';
import { Reveal } from './Reveal.jsx';
import styles from './ContactBlock.module.css';
import type from './type.module.css';

/** mailto:/tel: links for values that look like an email address or a phone number (user brochures). */
function valueHref(value) {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  if (/^\+?[\d\s().-]{7,}$/.test(value)) return `tel:${value.replace(/[^\d+]/g, '')}`;
  return null;
}

/**
 * Contact page — for built-ins, "Visitor information": a headline, a short
 * note, and a ruled list of official sources (tourist information centres,
 * official sites) whose links open in a new tab, each with the address it
 * leads to. The call to action is a real link when the page has a ctaUrl, a
 * button when the host passes `onCta` (the reader's "Plan this trip"), and
 * otherwise plain text: nothing is dressed as a button that does nothing.
 */
export function ContactBlock({ page }) {
  const { isStatic, onCta } = usePage();
  const heading = text(page.heading);
  const body = text(page.body);
  const cta = text(page.cta);
  const details = list(page.details, 4).filter((d) => text(d.value));
  const ctaUrl = safeUrl(page.ctaUrl);
  const canAct = typeof onCta === 'function' && !isStatic;

  return (
    <div className={styles.contact}>
      <span className={styles.watermark} lang="ja" aria-hidden="true">
        案内
      </span>
      <header className={type.header}>
        {heading && (
          <Reveal as="h2" className={type.heading} style={{ '--fs': `${fitSize(heading, { max: 7.2, min: 4.4, ideal: 22 })}cqw` }}>
            {heading}
          </Reveal>
        )}
        {body && (
          <Reveal as="p" className={`${type.lede} ${styles.lede}`}>
            {body}
          </Reveal>
        )}
      </header>

      <div className={styles.main} data-fit="" data-fit-min="0.62">
        {details.length > 0 && (
          <dl className={styles.details}>
            {details.map((detail, i) => {
              const value = text(detail.value);
              const url = safeUrl(detail.url);
              const mail = url ? null : valueHref(value);
              const shown = url ? linkLabel(url) : '';
              return (
                <Reveal key={i} className={styles.row}>
                  {/* A dl group may only hold dt/dd, so the icon lives inside the term. */}
                  <dt>
                    <span className={styles.icon} aria-hidden="true">
                      <Icon name={detail.icon} />
                    </span>
                    {text(detail.label) || 'Detail'}
                  </dt>
                  <dd>
                    {(url || mail) && !isStatic ? (
                      <a className={styles.link} href={url || mail} {...(url ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                        {value}
                        {url && <ArrowUpRight aria-hidden="true" focusable="false" />}
                        {url && <span className="sr-only"> (opens {shown} in a new tab)</span>}
                      </a>
                    ) : (
                      <span className={url || mail ? styles.link : undefined}>
                        {value}
                        {url && <ArrowUpRight aria-hidden="true" focusable="false" />}
                      </span>
                    )}
                    {shown && !shown.startsWith(value) && (
                      <span className={styles.address} aria-hidden="true">
                        {shown}
                      </span>
                    )}
                  </dd>
                </Reveal>
              );
            })}
          </dl>
        )}

        {cta && (
          <Reveal className={styles.action}>
            {ctaUrl ? (
              isStatic ? (
                <span className={`${styles.cta} ${styles.ctaStatic}`}>
                  {cta}
                  <ArrowUpRight aria-hidden="true" focusable="false" />
                </span>
              ) : (
                <Button variant="accent" className={styles.cta} href={ctaUrl} target="_blank" rel="noopener noreferrer" iconRight={<ArrowUpRight aria-hidden="true" />}>
                  {cta}
                  <span className="sr-only"> (opens {linkLabel(ctaUrl)} in a new tab)</span>
                </Button>
              )
            ) : canAct ? (
              <Button variant="accent" className={styles.cta} onClick={onCta} iconRight={<ArrowRight aria-hidden="true" />}>
                {cta}
              </Button>
            ) : (
              <p className={styles.ctaText}>{cta}</p>
            )}
            {ctaUrl && (
              <span className={styles.ctaAddress} aria-hidden="true">
                {linkLabel(ctaUrl)}
              </span>
            )}
          </Reveal>
        )}
      </div>
    </div>
  );
}
