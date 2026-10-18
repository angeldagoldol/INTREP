/**
 * "Plan this trip": a personal trip plan kept in this browser (storage key
 * `trips`). Nothing is sent anywhere — there is no tour operator behind a
 * brochure, so the planner is a private note: dates, travellers, interests
 * and notes, tied to the brochure it was made from. Pure functions, so the
 * drawer stays a thin view and everything here is unit-tested.
 *
 * Plan = { id, brochureId, brochureSlug, brochureTitle, brochureTitleJp,
 *          start, end,            // 'YYYY-MM-DD' or '' (dates still open)
 *          travellers,            // 1…MAX_TRAVELLERS
 *          interests,             // INTERESTS ids
 *          notes, createdAt, updatedAt }
 */
import { SEASON_MAP } from '../../data/seasons.js';
import { seasonIdForMonth } from '../layout/japanTime.js';

export const STORAGE_KEY = 'trips';
/** The old "inquiry" records (name, email, month…), migrated once and then removed. */
export const LEGACY_KEY = 'inquiries';
export const MAX_TRAVELLERS = 12;
export const NOTES_LIMIT = 2000;
export const MAX_PLANS = 100;
export const MAX_NIGHTS = 90;
/** How far ahead a trip can start, in days (about three years). */
export const MAX_DAYS_AHEAD = 1100;

/** What a traveller cares about, each with a one-kanji mark. */
export const INTERESTS = [
  { id: 'food', label: 'Food & drink', jp: '食' },
  { id: 'temples', label: 'Temples & shrines', jp: '寺' },
  { id: 'nature', label: 'Nature & hiking', jp: '山' },
  { id: 'onsen', label: 'Onsen', jp: '湯' },
  { id: 'nightlife', label: 'Nightlife', jp: '夜' },
  { id: 'festivals', label: 'Festivals', jp: '祭' },
  { id: 'craft', label: 'Art & craft', jp: '匠' },
  { id: 'coast', label: 'Islands & coast', jp: '海' },
];

const INTEREST_MAP = new Map(INTERESTS.map((i) => [i.id, i]));

/** Brochure category → the interest it implies, pre-selected in a new plan. */
const CATEGORY_INTEREST = {
  cities: 'nightlife',
  heritage: 'temples',
  nature: 'nature',
  islands: 'coast',
  food: 'food',
  onsen: 'onsen',
  festivals: 'festivals',
  craft: 'craft',
};

const DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const str = (value) => (typeof value === 'string' ? value.trim() : '');
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** 'YYYY-MM-DD' → UTC midnight (ms), or NaN for anything that is not a real calendar date. */
export function parseDate(value) {
  const match = ISO_DATE.exec(str(value));
  if (!match) return Number.NaN;
  const [, y, m, d] = match.map(Number);
  const time = Date.UTC(y, m - 1, d);
  const back = new Date(time);
  return back.getUTCFullYear() === y && back.getUTCMonth() === m - 1 && back.getUTCDate() === d ? time : Number.NaN;
}

/** The visitor's local calendar date as 'YYYY-MM-DD' (what a date input shows as "today"). */
export function toISODate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 'YYYY-MM-DD' plus `days`. */
export function addDays(iso, days) {
  const time = parseDate(iso);
  return Number.isNaN(time) ? '' : new Date(time + days * DAY).toISOString().slice(0, 10);
}

/** Nights between two dates (0 when either is missing or the order is wrong). */
export function tripNights(start, end) {
  const a = parseDate(start);
  const b = parseDate(end);
  return Number.isNaN(a) || Number.isNaN(b) || b < a ? 0 : Math.round((b - a) / DAY);
}

/** Season ids a trip touches, in order: a trip from 25 Feb to 3 Mar is winter and spring. */
export function tripSeasons(start, end) {
  const a = parseDate(start);
  if (Number.isNaN(a)) return [];
  const b = Number.isNaN(parseDate(end)) || parseDate(end) < a ? a : parseDate(end);
  const seasons = [];
  // Step month by month from the start's month to the end's month.
  const from = new Date(a);
  const to = new Date(b);
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth();
  while (y < to.getUTCFullYear() || (y === to.getUTCFullYear() && m <= to.getUTCMonth())) {
    const id = seasonIdForMonth(m + 1);
    if (!seasons.includes(id)) seasons.push(id);
    if (seasons.length === 4) break;
    m += 1;
    if (m === 12) {
      m = 0;
      y += 1;
    }
  }
  return seasons;
}

/**
 * How the dates sit with the brochure's best seasons:
 *   { seasons: [season…], best: [season…] } — `best` are the touched seasons the brochure recommends.
 */
export function seasonFit(start, end, brochureSeasons = []) {
  const wanted = new Set(Array.isArray(brochureSeasons) ? brochureSeasons : []);
  const seasons = tripSeasons(start, end).map((id) => SEASON_MAP[id]).filter(Boolean);
  return { seasons, best: seasons.filter((s) => wanted.has(s.id)) };
}

const dayMonthYear = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortDayMonthYear = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * Human dates: "12–15 April 2027", "28 March – 2 April 2027",
 * "30 Dec 2026 – 2 Jan 2027", "From 12 April 2027", "Dates open".
 */
export function describeDates(start, end) {
  const a = parseDate(start);
  if (Number.isNaN(a)) return 'Dates open';
  const b = parseDate(end);
  if (Number.isNaN(b) || b <= a) return Number.isNaN(b) ? `From ${dayMonthYear.format(a)}` : dayMonthYear.format(a);
  const from = new Date(a);
  const to = new Date(b);
  if (from.getUTCFullYear() !== to.getUTCFullYear()) return `${shortDayMonthYear.format(a)} – ${shortDayMonthYear.format(b)}`;
  if (from.getUTCMonth() !== to.getUTCMonth()) return `${dayMonth.format(a)} – ${dayMonthYear.format(b)}`;
  return `${from.getUTCDate()}–${dayMonthYear.format(b)}`;
}

/** "3 nights", "1 night", '' without both dates. */
export function describeNights(start, end) {
  const n = tripNights(start, end);
  return n > 0 ? `${n} ${n === 1 ? 'night' : 'nights'}` : '';
}

/** Form values for a new plan: dates open, two travellers, the interest the brochure's category implies. */
export function emptyPlan(brochure) {
  const interest = CATEGORY_INTEREST[brochure?.category];
  return { start: '', end: '', travellers: 2, interests: interest ? [interest] : [], notes: '' };
}

/** Form values from a saved plan (for editing). */
export function planValues(plan) {
  return {
    start: str(plan?.start),
    end: str(plan?.end),
    travellers: Number.isInteger(plan?.travellers) ? plan.travellers : 2,
    interests: Array.isArray(plan?.interests) ? plan.interests.filter((id) => INTEREST_MAP.has(id)) : [],
    notes: typeof plan?.notes === 'string' ? plan.notes : '',
  };
}

/**
 * Field errors keyed by field name ({} = valid). Dates are optional, but an
 * end needs a start, comes after it and keeps the trip under MAX_NIGHTS; a
 * start may not lie in the past (`today`, 'YYYY-MM-DD') or years ahead.
 */
export function validatePlan(values, today) {
  const errors = {};
  const start = str(values?.start);
  const end = str(values?.end);
  const startTime = parseDate(start);
  const todayTime = parseDate(today);
  if (start) {
    if (Number.isNaN(startTime)) errors.start = 'Enter a date like 2027-04-12.';
    else if (!Number.isNaN(todayTime) && startTime < todayTime) errors.start = 'Pick a day from today onwards.';
    else if (!Number.isNaN(todayTime) && startTime > todayTime + MAX_DAYS_AHEAD * DAY) errors.start = 'Pick a date within the next three years.';
  }
  if (end) {
    const endTime = parseDate(end);
    if (Number.isNaN(endTime)) errors.end = 'Enter a date like 2027-04-15.';
    else if (!start) errors.end = 'Add the day you arrive first.';
    else if (!Number.isNaN(startTime) && endTime < startTime) errors.end = 'The last day comes after the first.';
    else if (!Number.isNaN(startTime) && tripNights(start, end) > MAX_NIGHTS) errors.end = `Keep a plan to ${MAX_NIGHTS} nights or fewer.`;
  }
  const travellers = Number(values?.travellers);
  if (!Number.isInteger(travellers) || travellers < 1 || travellers > MAX_TRAVELLERS) {
    errors.travellers = `Between 1 and ${MAX_TRAVELLERS} travellers.`;
  }
  if (String(values?.notes ?? '').length > NOTES_LIMIT) errors.notes = `Keep notes under ${NOTES_LIMIT} characters.`;
  return errors;
}

/** Add or remove an interest id, ignoring unknown ids. */
export function toggleInterest(list, id) {
  if (!INTEREST_MAP.has(id)) return list;
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Labels of interest ids, in the INTERESTS order. */
export function interestLabels(ids) {
  const wanted = new Set(Array.isArray(ids) ? ids : []);
  return INTERESTS.filter((i) => wanted.has(i.id));
}

let sequence = 0;

/**
 * A plan record from form values. Pass `existing` to update a saved plan
 * (keeps its id, brochure and createdAt).
 */
export function buildPlan(values, brochure, { now = new Date(), existing = null } = {}) {
  const v = planValues(values);
  const stamp = now.toISOString();
  return {
    id: existing?.id ?? `trip_${now.getTime().toString(36)}${(sequence++ % 1296).toString(36).padStart(2, '0')}`,
    brochureId: existing?.brochureId ?? brochure?.id ?? null,
    brochureSlug: existing?.brochureSlug ?? brochure?.slug ?? '',
    brochureTitle: brochure?.title ?? existing?.brochureTitle ?? '',
    brochureTitleJp: brochure?.titleJp ?? existing?.brochureTitleJp ?? '',
    start: Number.isNaN(parseDate(v.start)) ? '' : v.start,
    end: Number.isNaN(parseDate(v.end)) || Number.isNaN(parseDate(v.start)) ? '' : v.end,
    travellers: Math.min(MAX_TRAVELLERS, Math.max(1, Number(values?.travellers) || 1)),
    interests: v.interests,
    notes: v.notes.trim().slice(0, NOTES_LIMIT),
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  };
}

/** One stored plan, repaired, or null when it is not a plan at all. */
function cleanPlan(raw) {
  if (!isRecord(raw) || !str(raw.id)) return null;
  const start = Number.isNaN(parseDate(raw.start)) ? '' : str(raw.start);
  const end = start && !Number.isNaN(parseDate(raw.end)) && parseDate(raw.end) >= parseDate(start) ? str(raw.end) : '';
  const travellers = Number.isInteger(raw.travellers) ? Math.min(MAX_TRAVELLERS, Math.max(1, raw.travellers)) : 2;
  return {
    id: str(raw.id),
    brochureId: typeof raw.brochureId === 'string' ? raw.brochureId : null,
    brochureSlug: str(raw.brochureSlug),
    brochureTitle: str(raw.brochureTitle),
    brochureTitleJp: str(raw.brochureTitleJp),
    start,
    end,
    travellers,
    interests: Array.isArray(raw.interests) ? raw.interests.filter((id) => INTEREST_MAP.has(id)) : [],
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, NOTES_LIMIT) : '',
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt) || str(raw.createdAt),
  };
}

/** Whatever was stored under `trips` (possibly missing or corrupt) → a clean list, ids unique, newest MAX_PLANS. */
export function readPlans(stored) {
  const seen = new Set();
  const plans = [];
  for (const raw of Array.isArray(stored) ? stored : []) {
    const plan = cleanPlan(raw);
    if (!plan || seen.has(plan.id)) continue;
    seen.add(plan.id);
    plans.push(plan);
  }
  return plans.slice(-MAX_PLANS);
}

/** Insert or replace `plan` (by id); the oldest plans drop off beyond MAX_PLANS. */
export function upsertPlan(list, plan) {
  const plans = readPlans(list);
  const at = plans.findIndex((p) => p.id === plan.id);
  const next = at === -1 ? [...plans, plan] : plans.map((p, i) => (i === at ? plan : p));
  return next.slice(-MAX_PLANS);
}

/** The list without the plan `id`. */
export function removePlan(list, id) {
  return readPlans(list).filter((p) => p.id !== id);
}

/** Dated plans first, soonest first; then undated, newest first. */
function byTrip(a, b) {
  const ta = parseDate(a.start);
  const tb = parseDate(b.start);
  if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta - tb || b.updatedAt.localeCompare(a.updatedAt);
  if (!Number.isNaN(ta)) return -1;
  if (!Number.isNaN(tb)) return 1;
  return b.updatedAt.localeCompare(a.updatedAt);
}

/** Plans split by brochure: { mine: plans for `brochure`, others: every other plan }, both in trip order. */
export function groupPlans(list, brochure) {
  const plans = readPlans(list);
  const id = brochure?.id ?? null;
  return {
    mine: plans.filter((p) => p.brochureId === id).sort(byTrip),
    others: plans.filter((p) => p.brochureId !== id).sort(byTrip),
  };
}

const legacyMonth = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * The old "Plan this trip" inquiries (which pretended to be sent) become
 * plans: travellers, interests and the message are kept, the travel month
 * goes into the notes, and the name and email address are dropped.
 */
export function migrateInquiries(stored) {
  const plans = [];
  for (const raw of Array.isArray(stored) ? stored : []) {
    if (!isRecord(raw)) continue;
    const month = /^(\d{4})-(\d{2})$/.exec(str(raw.month));
    const monthText = month ? `Travel month: ${legacyMonth.format(Date.UTC(Number(month[1]), Number(month[2]) - 1, 1))}` : '';
    const notes = [monthText, str(raw.message)].filter(Boolean).join('\n');
    const plan = cleanPlan({
      id: `trip_${str(raw.id).replace(/^inq_/, '') || plans.length}`,
      brochureId: raw.brochureId,
      brochureSlug: raw.brochureSlug,
      brochureTitle: raw.brochureTitle,
      travellers: Number(raw.travellers),
      interests: raw.interests,
      notes,
      createdAt: raw.createdAt,
    });
    if (plan) plans.push(plan);
  }
  return readPlans(plans);
}

/**
 * The plan as plain text, to paste into a message or a notes app:
 * title, dates, travellers, interests, notes, official sites and a link
 * back to the brochure (`url`).
 */
export function planText(plan, { links = [], url = '' } = {}) {
  const title = [plan.brochureTitle || 'A trip to Japan', plan.brochureTitleJp ? `(${plan.brochureTitleJp})` : ''].filter(Boolean).join(' ');
  const nights = describeNights(plan.start, plan.end);
  const lines = [
    title,
    [describeDates(plan.start, plan.end), nights].filter(Boolean).join(' · '),
    `${plan.travellers} ${plan.travellers === 1 ? 'traveller' : 'travellers'}`,
  ];
  const interests = interestLabels(plan.interests).map((i) => i.label);
  if (interests.length) lines.push(`Interests: ${interests.join(', ')}`);
  if (plan.notes) lines.push('', plan.notes);
  if (links.length) lines.push('', 'Check before you go:', ...links.map((l) => `- ${l.label}: ${l.url}`));
  if (url) lines.push('', `Brochure: ${url}`);
  return lines.join('\n');
}
