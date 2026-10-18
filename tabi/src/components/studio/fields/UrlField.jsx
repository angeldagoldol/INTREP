import { useId } from 'react';
import { ArrowUpRight, CircleAlert, Wand2 } from 'lucide-react';
import { Button } from '../../ui/index.js';
import { urlCheck } from '../fieldChecks.js';
import styles from './UrlField.module.css';

/**
 * A web link for a brochure (an official site, a call to action, a source),
 * checked as it is typed: https links show where they lead; http and bare
 * addresses ("www.example.jp") get a one-click fix (a bare address is also
 * completed when focus leaves the box); anything that isn't a
 * web address (javascript:, mailto:, words) is an error and is never linked.
 *   <UrlField label="Official website" value={page.website} onChange={(url) => …} />
 * `onChange(value, typing)` — typing is false for the one-click fixes.
 */
export function UrlField({ label, value, onChange, hint, placeholder = 'https://', compact = false }) {
  const id = useId();
  const text = typeof value === 'string' ? value : '';
  const check = urlCheck(text);
  const messageId = `${id}-message`;
  const message =
    check.state === 'ok' ? `Opens ${check.host} in a new tab` : check.state === 'empty' ? (hint ?? 'Optional') : check.message;

  return (
    <div className={styles.url} data-tone={check.tone} data-compact={compact || undefined}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          id={id}
          className={styles.input}
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={placeholder}
          value={text}
          aria-invalid={check.tone === 'error' || undefined}
          aria-describedby={messageId}
          onChange={(event) => onChange(event.target.value, true)}
          // Leaving the box completes a bare address ("www.example.jp" → https://…), which would
          // otherwise be dropped as "not a link" when the brochure is saved and read back.
          onBlur={() => {
            if (check.state === 'bare') onChange(check.fix, false);
            else if (text !== text.trim()) onChange(text.trim(), false);
          }}
        />
        {check.state === 'ok' && <ArrowUpRight className={styles.ok} size={15} aria-hidden="true" />}
      </div>
      <div className={styles.foot}>
        <p id={messageId} className={styles.message}>
          {check.tone === 'warning' || check.tone === 'error' ? <CircleAlert size={13} aria-hidden="true" /> : null}
          <span>{message}</span>
        </p>
        {check.fix && (
          <Button size="sm" variant="ghost" iconLeft={<Wand2 />} onClick={() => onChange(check.fix, false)} className={styles.fix}>
            {check.state === 'http' ? 'Use https' : 'Add https://'}
          </Button>
        )}
      </div>
    </div>
  );
}
