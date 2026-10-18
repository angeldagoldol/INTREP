import { Field, Input, Textarea } from '../../ui/index.js';
import { charCount } from '../studioFormat.js';

/**
 * Labelled text input or textarea for Studio forms. `onChange` receives the
 * new string. With `max`, a live character count is shown as the hint and
 * an error once the text runs over. `hideLabel` keeps the label for screen
 * readers only and `quietCount` shows the count only near the limit (dense rows).
 *   <TextField label="Heading" value={page.heading} onChange={set} max={80} />
 */
export function TextField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  max,
  hint,
  lang,
  placeholder,
  required = false,
  type = 'text',
  inputMode,
  className,
  autoComplete = 'off',
  hideLabel = false,
  quietCount = false,
}) {
  const text = value == null ? '' : String(value);
  const counter = max ? charCount(text, max) : null;
  // `quietCount` (dense rows) shows the count only once the text nears the limit.
  const showCount = counter && (!quietCount || counter.near);
  const counterHint = showCount ? `${counter.count} / ${max}${hint ? ` · ${hint}` : ''}` : hint;
  const error = counter?.over ? `Keep it under ${max} characters — it is ${counter.count} now.` : undefined;
  const Control = multiline ? Textarea : Input;
  const extra = multiline ? { rows } : { type, inputMode, autoComplete };

  return (
    <Field label={label} hint={counterHint} error={error} required={required} className={className} labelHidden={hideLabel}>
      <Control
        value={text}
        onChange={(event) => onChange(event.target.value)}
        lang={lang}
        placeholder={placeholder}
        spellCheck={lang === 'ja' ? false : undefined}
        {...extra}
      />
    </Field>
  );
}
