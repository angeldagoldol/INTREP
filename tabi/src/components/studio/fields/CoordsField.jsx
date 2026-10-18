import { useId, useState } from 'react';
import { ArrowLeftRight, CircleAlert, MapPin } from 'lucide-react';
import { Button } from '../../ui/index.js';
import { coordinateCheck, describeCoords, parseCoordinatePair, readNumber } from '../fieldChecks.js';
import { draftShows, numberFromDraft } from '../studioFormat.js';
import styles from './CoordsField.module.css';

/** A decimal-degrees box that keeps half-typed text ("34.", "-") and reads a pasted pair. */
function CoordInput({ id, label, unit, value, onChange, onPair, describedBy, invalid }) {
  const shown = value === '' || value == null ? '' : String(value);
  const [draft, setDraft] = useState(shown);
  const [seen, setSeen] = useState(value);
  // Follow outside changes (undo, a pasted pair) unless the draft already says the same number.
  if (!Object.is(value, seen)) {
    setSeen(value);
    if (!draftShows(draft, value)) setDraft(shown);
  }
  return (
    <div className={styles.box}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control} data-invalid={invalid || undefined}>
        <input
          id={id}
          className={styles.input}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            const raw = event.target.value.replace(/[−–]/g, '-');
            setDraft(raw);
            const next = numberFromDraft(raw, { limit: 1000 });
            if (next !== undefined) onChange(next);
          }}
          onPaste={(event) => {
            const pair = parseCoordinatePair(event.clipboardData?.getData('text') ?? '');
            if (!pair) return;
            event.preventDefault();
            onPair(pair);
          }}
          onBlur={() => {
            if (!draftShows(draft, value)) setDraft(shown);
          }}
        />
        <span className={styles.unit} aria-hidden="true">
          {unit}
        </span>
      </div>
    </div>
  );
}

/**
 * Latitude and longitude for a real place, in decimal degrees, with the help
 * a person needs to get them right: paste "34.9949, 135.7850", a DMS pair or
 * a link with the coordinates in it into either box and both fill in (rounded
 * to 4 places); values that are swapped, impossible or outside Japan are
 * explained (with a one-click swap). Brochures print them in small type (the
 * cover, beside a place's name); Tabi draws no maps.
 *   <CoordsField lat={page.lat} lng={page.lng} onChange={({ lat, lng }, typing) => …} />
 * `onChange` receives both values ('' for an empty box). `compact` sets the
 * two boxes side by side without a frame (list rows).
 */
export function CoordsField({ lat, lng, onChange, label = 'Coordinates', compact = false }) {
  const id = useId();
  const [pasted, setPasted] = useState('');
  const check = coordinateCheck(lat, lng);
  const latN = readNumber(lat);
  const lngN = readNumber(lng);
  const where = check.state === 'ok' ? describeCoords(latN, lngN) : '';
  const messageId = `${id}-message`;
  const setPair = (pair) => {
    onChange(pair, false);
    setPasted(`Filled in ${describeCoords(pair.lat, pair.lng)}.`);
  };
  const invalid = check.tone === 'error';

  return (
    <fieldset className={styles.coords} data-compact={compact || undefined} data-state={check.state}>
      <legend className={styles.legend}>
        <MapPin size={14} aria-hidden="true" />
        {label}
      </legend>
      <div className={styles.inputs}>
        <CoordInput
          id={`${id}-lat`}
          label="Latitude"
          unit="° N"
          value={lat}
          invalid={invalid}
          describedBy={messageId}
          onChange={(value) => onChange({ lat: value, lng: lng ?? '' }, true)}
          onPair={setPair}
        />
        <CoordInput
          id={`${id}-lng`}
          label="Longitude"
          unit="° E"
          value={lng}
          invalid={invalid}
          describedBy={messageId}
          onChange={(value) => onChange({ lat: lat ?? '', lng: value }, true)}
          onPair={setPair}
        />
      </div>

      <div id={messageId} className={styles.message} data-tone={check.tone}>
        {check.state === 'ok' ? (
          <p className={styles.where}>{where}</p>
        ) : (
          <p className={styles.note}>
            {check.tone !== 'info' && <CircleAlert size={14} aria-hidden="true" />}
            <span>{check.message}</span>
          </p>
        )}
        {check.fix && (
          <Button size="sm" variant="secondary" iconLeft={<ArrowLeftRight />} onClick={() => onChange(check.fix, false)}>
            Swap them
          </Button>
        )}
        {check.state === 'empty' && !compact && <p className={styles.tip}>Tip: paste “34.9949, 135.7850”, or a link with the coordinates in it, into either box.</p>}
      </div>
      <p className="sr-only" aria-live="polite">
        {pasted}
      </p>
    </fieldset>
  );
}
