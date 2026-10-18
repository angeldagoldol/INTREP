import { fitSize, list, text } from './pageUtils.js';
import { Reveal } from './Reveal.jsx';
import styles from './PricingBlock.module.css';
import type from './type.module.css';

/**
 * Costs, set as a printed price list (品書き): each line a name, a dotted
 * leader and the price — however long ("¥200–10,000", "About ¥300") — with
 * what it covers beneath in two columns. A highlighted line is tinted and
 * tagged おすすめ (recommended). The note (※) closes the page.
 */
export function PricingBlock({ page }) {
  const heading = text(page.heading);
  const note = text(page.note);
  const plans = list(page.plans, 3).filter((plan) => text(plan.name) || text(plan.price));

  return (
    <div className={styles.pricing}>
      <span className={type.watermark} lang="ja" aria-hidden="true">
        円
      </span>
      <header className={type.header}>
        {heading && (
          <Reveal as="h2" className={type.heading} style={{ '--fs': `${fitSize(heading, { max: 6.8, min: 4.2, ideal: 26 })}cqw` }}>
            {heading}
          </Reveal>
        )}
      </header>

      <div className={styles.body} data-fit="" data-fit-min="0.62">
        {plans.length > 0 && (
          <ul className={styles.plans} data-count={plans.length}>
            {plans.map((plan, i) => {
              const features = list(plan.features, 6).map(text).filter(Boolean);
              const price = text(plan.price);
              const name = text(plan.name);
              return (
                <Reveal as="li" key={i} className={styles.plan} data-highlight={plan.highlight ? true : undefined}>
                  <div className={styles.line}>
                    <h3 className={styles.name}>
                      {name}
                      {plan.highlight && (
                        <span className={styles.tag}>
                          <span lang="ja" aria-hidden="true">
                            おすすめ
                          </span>
                          <span className="sr-only"> (recommended)</span>
                        </span>
                      )}
                    </h3>
                    <span className={styles.leader} aria-hidden="true" />
                    {price && <p className={styles.price}>{price}</p>}
                  </div>
                  {text(plan.period) && <p className={styles.period}>{text(plan.period)}</p>}
                  {features.length > 0 && (
                    <ul className={styles.features} data-many={features.length > 3 || undefined}>
                      {features.map((feature, f) => (
                        <li key={f}>{feature}</li>
                      ))}
                    </ul>
                  )}
                </Reveal>
              );
            })}
          </ul>
        )}

        {note && (
          <Reveal as="p" variant="fade" className={styles.note}>
            <span className={styles.mark} aria-hidden="true">
              ※
            </span>
            {note}
          </Reveal>
        )}
      </div>
    </div>
  );
}
