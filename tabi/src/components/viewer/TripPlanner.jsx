import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Check, Copy, Lock, Minus, PenLine, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { useBrochures } from '../../context/BrochureContext.jsx';
import { useClipboard } from '../../hooks/useClipboard.js';
import { SEASON_MAP } from '../../data/seasons.js';
import { ease } from '../../lib/motion.js';
import { readStorage, removeStorage, writeStorage } from '../../lib/storage.js';
import { Button, Chip, Drawer, Field, Hanko, Input, Textarea } from '../ui/index.js';
import { officialLinks } from './links.js';
import { MiniPage } from './MiniPage.jsx';
import { sealText } from './pageMeta.js';
import {
  INTERESTS,
  LEGACY_KEY,
  MAX_DAYS_AHEAD,
  MAX_TRAVELLERS,
  NOTES_LIMIT,
  STORAGE_KEY,
  addDays,
  buildPlan,
  describeDates,
  describeNights,
  emptyPlan,
  groupPlans,
  interestLabels,
  migrateInquiries,
  planText,
  planValues,
  readPlans,
  removePlan,
  seasonFit,
  toISODate,
  toggleInterest,
  upsertPlan,
  validatePlan,
} from './tripPlan.js';
import styles from './TripPlanner.module.css';

const FIELD_ORDER = ['start', 'end', 'travellers', 'notes'];

/**
 * Saved plans from storage. The old "inquiry" records (which pretended to be
 * sent to a publisher) are turned into plans once, without their name and
 * email address, and then removed.
 */
function loadPlans() {
  const stored = readStorage(STORAGE_KEY, null);
  if (stored != null) return readPlans(stored);
  const legacy = readStorage(LEGACY_KEY, null);
  if (!Array.isArray(legacy)) return [];
  const migrated = migrateInquiries(legacy);
  if (writeStorage(STORAGE_KEY, migrated)) removeStorage(LEGACY_KEY);
  return migrated;
}

/** "2 travellers" */
const travellersText = (n) => `${n} ${n === 1 ? 'traveller' : 'travellers'}`;

/** − n + control. Receives id / aria-* from <Field> and puts them on its input. */
function Stepper({ value, onChange, min = 1, max = MAX_TRAVELLERS, ...inputProps }) {
  const n = Number(value) || min;
  return (
    <div className={styles.stepper}>
      <button type="button" className={styles.step} onClick={() => onChange(Math.max(min, n - 1))} disabled={n <= min} aria-label="One traveller fewer">
        <Minus aria-hidden="true" />
      </button>
      <input
        {...inputProps}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        className={styles.stepValue}
        value={value}
        onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
      />
      <button type="button" className={styles.step} onClick={() => onChange(Math.min(max, n + 1))} disabled={n >= max} aria-label="One more traveller">
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}

/** The brochure this plan is for, as a ticket stub. */
function TripStub({ brochure }) {
  const seasons = (brochure.seasons ?? []).map((id) => SEASON_MAP[id]).filter(Boolean);
  return (
    <div className={styles.stub}>
      <span className={styles.stubCover}>
        <MiniPage brochure={brochure} face={0} />
      </span>
      <div className={styles.stubText}>
        <p className={styles.stubKicker}>Your trip</p>
        <p className={styles.stubTitle}>{brochure.title || 'Untitled brochure'}</p>
        {seasons.length > 0 && (
          <p className={styles.stubSeasons}>
            Best in{' '}
            {seasons.map((s, i) => (
              <span key={s.id}>
                {i > 0 && (i === seasons.length - 1 ? ' & ' : ', ')}
                {s.label.toLowerCase()}{' '}
                <span lang="ja" className={styles.kanjiSeason} style={{ '--season': s.color }}>
                  {s.jp}
                </span>
              </span>
            ))}
          </p>
        )}
      </div>
      <Hanko text={sealText(brochure)} size={40} className={styles.stubSeal} />
    </div>
  );
}

/** How the chosen dates sit with the brochure's best seasons — one quiet line under the dates. */
function SeasonNote({ values, brochure }) {
  const { seasons, best } = seasonFit(values.start, values.end, brochure.seasons);
  const recommended = (brochure.seasons ?? []).map((id) => SEASON_MAP[id]).filter(Boolean);
  const nights = describeNights(values.start, values.end);
  const mark = (s) => (
    <span key={s.id} lang="ja" className={styles.kanjiSeason} style={{ '--season': s.color }}>
      {s.jp}
    </span>
  );
  const names = (list) => list.map((s) => s.label.toLowerCase()).join(' & ');

  let text;
  if (!seasons.length) {
    text = recommended.length ? (
      <>Dates not fixed yet? Leave them open. This trip is best in {names(recommended)} {recommended.map(mark)}.</>
    ) : (
      <>Dates not fixed yet? Leave them open and come back later.</>
    );
  } else if (best.length) {
    text = (
      <>
        {nights && <strong>{nights} · </strong>}
        {names(seasons)} {seasons.map(mark)} — {best.length === seasons.length ? 'a' : 'partly in a'} best season for this trip.
      </>
    );
  } else {
    text = (
      <>
        {nights && <strong>{nights} · </strong>}
        {names(seasons)} {seasons.map(mark)}.{recommended.length > 0 && <> The brochure suggests {names(recommended)}.</>}
      </>
    );
  }
  return (
    <p className={styles.seasonNote} data-best={best.length > 0 || undefined} aria-live="polite">
      {text}
    </p>
  );
}

/** Interest marks as small kanji seals, with the names for screen readers. */
function InterestMarks({ ids }) {
  const list = interestLabels(ids);
  if (!list.length) return null;
  return (
    <span className={styles.marks}>
      <span className="sr-only">Interests: {list.map((i) => i.label).join(', ')}</span>
      {list.map((i) => (
        <span key={i.id} lang="ja" className={styles.mark} title={i.label} aria-hidden="true">
          {i.jp}
        </span>
      ))}
    </span>
  );
}

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });

/** "Apr 2027", "Mar–Apr 2027" or "Dec–Jan 2026/27" under the day numbers. */
function monthLine(start, end) {
  const y1 = start.getUTCFullYear();
  if (!end || (end.getUTCMonth() === start.getUTCMonth() && end.getUTCFullYear() === y1)) return `${monthName.format(start)} ${y1}`;
  const y2 = end.getUTCFullYear();
  const months = `${monthName.format(start)}–${monthName.format(end)}`;
  return y1 === y2 ? `${months} ${y2}` : `${months} ${y1}/${String(y2).slice(-2)}`;
}

/** The date block of a plan card: "12–15" over "Apr 2027" (or 未定 for open dates). */
function DateBlock({ plan }) {
  const start = plan.start ? new Date(`${plan.start}T00:00:00Z`) : null;
  if (!start) {
    return (
      <span className={styles.date} data-open="">
        <span lang="ja" className={styles.dateOpen}>
          未定
        </span>
        <span className={styles.dateSub}>open</span>
      </span>
    );
  }
  const end = plan.end && plan.end > plan.start ? new Date(`${plan.end}T00:00:00Z`) : null;
  return (
    <span className={styles.date}>
      <span className={styles.dateDays}>
        {start.getUTCDate()}
        {end && `–${end.getUTCDate()}`}
      </span>
      <span className={styles.dateSub}>{monthLine(start, end)}</span>
    </span>
  );
}

/**
 * The planner's contents, mounted each time the drawer opens (so saved plans
 * are read fresh — another tab may have changed them). The draft (`draft`,
 * `setDraft`) lives in <TripPlanner>, so it survives closing the drawer.
 */
function PlannerBody({ brochure, formId, draft, setDraft, onClose }) {
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const { getBySlug } = useBrochures();
  const { copy } = useClipboard();
  const uid = useId();
  const [plans, setPlans] = useState(loadPlans);
  const [today] = useState(() => toISODate(new Date()));
  const [errors, setErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [flash, setFlash] = useState(null);
  const listRef = useRef(null);
  const formTopRef = useRef(null);
  const ids = Object.fromEntries(FIELD_ORDER.map((f) => [f, `${uid}-${f}`]));
  const links = useMemo(() => officialLinks(brochure, 5), [brochure]);
  const { mine, others } = useMemo(() => groupPlans(plans, brochure), [plans, brochure]);
  const { values, editing } = draft;
  const editingPlan = editing ? plans.find((p) => p.id === editing) : null;

  useEffect(() => {
    if (!flash) return undefined;
    const timer = setTimeout(() => setFlash(null), 2400);
    return () => clearTimeout(timer);
  }, [flash]);

  const update = (field, value) => {
    const next = { ...values, [field]: value };
    setDraft((d) => ({ ...d, values: next }));
    if (attempted) setErrors(validatePlan(next, today));
  };

  const persist = (next) => {
    if (!writeStorage(STORAGE_KEY, next)) {
      toast({ title: 'Couldn’t save the plan', description: 'This browser’s storage is full or turned off.', tone: 'error' });
      return false;
    }
    setPlans(next);
    return true;
  };

  const resetForm = () => {
    setDraft({ values: emptyPlan(brochure), editing: null });
    setErrors({});
    setAttempted(false);
  };

  const onSubmit = (event) => {
    event.preventDefault();
    const found = validatePlan(values, today);
    setErrors(found);
    setAttempted(true);
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first) {
      document.getElementById(ids[first])?.focus();
      return;
    }
    const plan = buildPlan(values, brochure, { existing: editingPlan });
    if (!persist(upsertPlan(plans, plan))) return;
    resetForm();
    setFlash(plan.id);
    toast({
      title: editingPlan ? 'Plan updated' : 'Plan saved on this device',
      description: 'It stays in this browser. Nothing was sent anywhere.',
      tone: 'success',
    });
    requestAnimationFrame(() => {
      listRef.current?.querySelector(`[data-plan="${CSS.escape(plan.id)}"]`)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    });
  };

  const startEdit = (plan) => {
    setDraft({ values: planValues(plan), editing: plan.id });
    setErrors({});
    setAttempted(false);
    formTopRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    requestAnimationFrame(() => document.getElementById(ids.start)?.focus({ preventScroll: true }));
  };

  const remove = (plan) => {
    if (!persist(removePlan(plans, plan.id))) return;
    if (editing === plan.id) resetForm();
    toast({
      title: 'Plan deleted',
      description: describeDates(plan.start, plan.end),
      action: {
        label: 'Undo',
        onClick: () => {
          const current = readPlans(readStorage(STORAGE_KEY, []));
          if (writeStorage(STORAGE_KEY, upsertPlan(current, plan))) setPlans(upsertPlan(current, plan));
        },
      },
    });
  };

  const copyPlan = async (plan) => {
    const url = `${window.location.origin}${window.location.pathname}#/brochures/${encodeURIComponent(brochure.slug ?? '')}`;
    const ok = await copy(planText(plan, { links, url }));
    toast(
      ok
        ? { title: 'Plan copied', description: 'Paste it into a message or your notes.', tone: 'success' }
        : { title: 'Couldn’t copy', description: 'Your browser blocked the clipboard.', tone: 'error' },
    );
  };

  const form = (
    <form id={formId} className={styles.form} onSubmit={onSubmit} noValidate aria-labelledby={`${uid}-form-title`}>
      <div className={styles.formHead} ref={formTopRef}>
        <h3 id={`${uid}-form-title`} className={styles.sectionTitle}>
          {editingPlan ? 'Edit plan' : 'New plan'}
          <span lang="ja" className={styles.sectionJp}>
            {editingPlan ? '修正' : '計画'}
          </span>
        </h3>
        {editingPlan && (
          <button type="button" className={styles.textButton} onClick={resetForm}>
            Stop editing
          </button>
        )}
      </div>

      <fieldset className={styles.dates}>
        <legend className={styles.legend}>
          Dates <span className={styles.optional}>optional</span>
        </legend>
        <div className={styles.row}>
          <Field id={ids.start} label="First day" error={errors.start}>
            <Input type="date" value={values.start} min={today} max={addDays(today, MAX_DAYS_AHEAD)} onChange={(e) => update('start', e.target.value)} />
          </Field>
          <Field id={ids.end} label="Last day" error={errors.end}>
            <Input type="date" value={values.end} min={values.start || today} onChange={(e) => update('end', e.target.value)} />
          </Field>
        </div>
        <SeasonNote values={values} brochure={brochure} />
      </fieldset>

      <Field id={ids.travellers} label="Travellers" error={errors.travellers} className={styles.travellers}>
        <Stepper value={values.travellers} onChange={(n) => update('travellers', n)} />
      </Field>

      <fieldset className={styles.interests}>
        <legend className={styles.legend}>
          Interests <span className={styles.optional}>optional</span>
        </legend>
        <div className={styles.chips}>
          {INTERESTS.map((interest) => (
            <Chip
              key={interest.id}
              selected={values.interests.includes(interest.id)}
              onClick={() => update('interests', toggleInterest(values.interests, interest.id))}
              icon={
                <span lang="ja" className={styles.kanji}>
                  {interest.jp}
                </span>
              }
            >
              {interest.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <Field id={ids.notes} label="Notes" hint={`${values.notes.length} / ${NOTES_LIMIT}`} error={errors.notes}>
        <Textarea
          rows={4}
          value={values.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="A ryokan to book, a festival date to check, who is coming…"
        />
      </Field>

      <p className={styles.privacy}>
        <Lock aria-hidden="true" focusable="false" />
        Saved in this browser only. Clearing your browsing data deletes it.
      </p>
    </form>
  );

  const saved = (
    <section className={styles.saved} aria-labelledby={`${uid}-saved`} ref={listRef}>
      <h3 id={`${uid}-saved`} className={styles.sectionTitle}>
        Saved on this device
        <span lang="ja" className={styles.sectionJp}>
          保存済み
        </span>
        <span className={styles.count}>{mine.length}</span>
      </h3>
      {mine.length === 0 ? (
        <p className={styles.empty}>No plans for this trip yet. Saved plans appear here, ready to edit or copy.</p>
      ) : (
        <ul className={styles.plans}>
          <AnimatePresence initial={false}>
            {mine.map((plan) => {
              const when = describeDates(plan.start, plan.end);
              const nights = describeNights(plan.start, plan.end);
              return (
                <motion.li
                  key={plan.id}
                  layout={!reduceMotion}
                  data-plan={plan.id}
                  className={styles.plan}
                  data-editing={editing === plan.id || undefined}
                  data-flash={flash === plan.id || undefined}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: ease.out } }}
                  exit={{ opacity: 0, x: 24, transition: { duration: 0.2, ease: ease.in } }}
                >
                  <DateBlock plan={plan} />
                  <div className={styles.planBody}>
                    <p className={styles.planWhen}>{when}</p>
                    <p className={styles.planMeta}>
                      {[nights, travellersText(plan.travellers)].filter(Boolean).join(' · ')}
                      <InterestMarks ids={plan.interests} />
                    </p>
                    {plan.notes && <p className={styles.planNotes}>{plan.notes}</p>}
                    <div className={styles.planActions}>
                      <button type="button" className={styles.action} onClick={() => startEdit(plan)} aria-label={`Edit plan: ${when}`}>
                        <PenLine aria-hidden="true" /> Edit
                      </button>
                      <button type="button" className={styles.action} onClick={() => copyPlan(plan)} aria-label={`Copy plan as text: ${when}`}>
                        <Copy aria-hidden="true" /> Copy
                      </button>
                      <button type="button" className={styles.action} data-tone="danger" onClick={() => remove(plan)} aria-label={`Delete plan: ${when}`}>
                        <Trash2 aria-hidden="true" /> Delete
                      </button>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {others.length > 0 && (
        <div className={styles.others}>
          <p className={styles.othersTitle}>Other trips on this device</p>
          <ul className={styles.otherList}>
            {others.map((plan) => {
              const target = plan.brochureSlug ? getBySlug(plan.brochureSlug) : null;
              const label = (
                <>
                  <span className={styles.otherTitle}>
                    {plan.brochureTitle || 'A brochure'}
                    {plan.brochureTitleJp && (
                      <span lang="ja" className={styles.otherJp}>
                        {plan.brochureTitleJp}
                      </span>
                    )}
                  </span>
                  <span className={styles.otherWhen}>{describeDates(plan.start, plan.end)}</span>
                </>
              );
              return (
                <li key={plan.id}>
                  {target ? (
                    <Link to={`/brochures/${encodeURIComponent(target.slug)}`} className={styles.other} onClick={onClose}>
                      {label}
                    </Link>
                  ) : (
                    <span className={styles.other}>{label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );

  return (
    <div className={styles.planner}>
      <TripStub brochure={brochure} />
      {/* Plans already saved come first; a first visit starts with the form. */}
      {mine.length > 0 ? saved : form}
      {mine.length > 0 ? form : saved}

      {links.length > 0 && (
        <section className={styles.official} aria-labelledby={`${uid}-official`}>
          <h3 id={`${uid}-official`} className={styles.sectionTitle}>
            Check before you go
            <span lang="ja" className={styles.sectionJp}>
              公式サイト
            </span>
          </h3>
          <p className={styles.officialNote}>Opening hours, prices and access change. The official sites have the latest.</p>
          <ul className={styles.links}>
            {links.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                  <span className={styles.linkLabel}>{link.label}</span>
                  <span className={styles.linkHost}>
                    {link.host}
                    <ArrowUpRight aria-hidden="true" focusable="false" />
                  </span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * "Plan this trip": a private trip plan kept in this browser — dates,
 * travellers, interests and notes — with the plans already saved for this
 * brochure (edit, copy as text, delete with undo), the other trips planned
 * on this device, and the brochure's official sites to check before going.
 * Nothing is sent anywhere and nobody is contacted: Tabi's brochures have no
 * tour operator behind them. Plans live under the storage key `trips`
 * (tripPlan.js). A draft survives closing the drawer.
 * Props: open, onClose, brochure.
 */
export function TripPlanner({ open, onClose, brochure }) {
  const uid = useId();
  const formId = `${uid}-form`;
  const [draft, setDraft] = useState(() => ({ values: emptyPlan(brochure), editing: null }));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      title="Plan this trip"
      description="A private planning note for this brochure, kept in this browser. Nothing is sent and no one will contact you."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" form={formId} variant="accent" iconLeft={draft.editing ? <Check /> : <Plus />}>
            {draft.editing ? 'Save changes' : 'Save plan'}
          </Button>
        </>
      }
    >
      <PlannerBody brochure={brochure} formId={formId} draft={draft} setDraft={setDraft} onClose={onClose} />
    </Drawer>
  );
}
