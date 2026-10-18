import { useState } from 'react';
import { Field, Input } from '../../ui/index.js';
import { draftShows, numberFromDraft } from '../studioFormat.js';

/**
 * Labelled number input that keeps the text you type ("0.0", "1.", "-")
 * while it is still on its way to a number, so values like 0.05 can be
 * typed. `onChange` receives a number, or '' for an empty field. Undo or
 * any other outside change to `value` replaces the text.
 *   <NumberField label="Number" value={item.value} onChange={(n) => …} />
 */
export function NumberField({ label, value, onChange, hint }) {
  const shown = value === '' || value == null ? '' : String(value);
  const [draft, setDraft] = useState(shown);
  const [seen, setSeen] = useState(value);
  // Adjust state on prop change: follow `value` unless the draft already says it.
  if (!Object.is(value, seen)) {
    setSeen(value);
    if (!draftShows(draft, value)) setDraft(shown);
  }

  return (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        inputMode="decimal"
        step="any"
        autoComplete="off"
        value={draft}
        onChange={(event) => {
          const raw = event.target.value;
          const next = numberFromDraft(raw, { badInput: Boolean(event.target.validity?.badInput) });
          // Past the limit the field shows the clamped number, so extra digits don't pile up.
          setDraft(typeof next === 'number' && next !== Number(raw) ? String(next) : raw);
          if (next !== undefined) onChange(next);
        }}
        // Leaving a half-typed number ("-") shows the stored value again.
        onBlur={(event) => {
          if (event.target.validity?.badInput) event.target.value = shown;
          if (!draftShows(draft, value)) setDraft(shown);
        }}
      />
    </Field>
  );
}
