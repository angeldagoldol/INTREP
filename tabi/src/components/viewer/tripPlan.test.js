import { describe, expect, it } from 'vitest';
import {
  MAX_NIGHTS,
  MAX_PLANS,
  addDays,
  buildPlan,
  describeDates,
  describeNights,
  emptyPlan,
  groupPlans,
  migrateInquiries,
  parseDate,
  planText,
  planValues,
  readPlans,
  removePlan,
  seasonFit,
  toISODate,
  toggleInterest,
  tripNights,
  tripSeasons,
  upsertPlan,
  validatePlan,
} from './tripPlan.js';

const TODAY = '2026-10-17';
const NOW = new Date('2026-10-17T09:30:00.000Z');
const kyoto = { id: 'b_k', slug: 'kyoto', title: 'Kyoto', titleJp: '京都', category: 'heritage', seasons: ['spring', 'autumn'] };
const valid = { start: '2027-04-12', end: '2027-04-15', travellers: 2, interests: ['food'], notes: '' };

describe('dates', () => {
  it('parses real calendar dates only', () => {
    expect(parseDate('2027-04-12')).toBe(Date.UTC(2027, 3, 12));
    expect(parseDate('2027-02-30')).toBeNaN();
    expect(parseDate('12/04/2027')).toBeNaN();
    expect(parseDate(undefined)).toBeNaN();
  });

  it('formats local dates and adds days across months', () => {
    expect(toISODate(new Date(2026, 9, 7))).toBe('2026-10-07');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('nope', 1)).toBe('');
  });

  it('counts nights', () => {
    expect(tripNights('2027-04-12', '2027-04-15')).toBe(3);
    expect(tripNights('2027-04-12', '')).toBe(0);
    expect(tripNights('2027-04-15', '2027-04-12')).toBe(0);
    expect(describeNights('2027-04-12', '2027-04-13')).toBe('1 night');
    expect(describeNights('', '')).toBe('');
  });

  it('describes date ranges like print', () => {
    expect(describeDates('2027-04-12', '2027-04-15')).toBe('12–15 April 2027');
    expect(describeDates('2027-03-28', '2027-04-02')).toBe('28 March – 2 April 2027');
    expect(describeDates('2026-12-30', '2027-01-02')).toBe('30 Dec 2026 – 2 Jan 2027');
    expect(describeDates('2027-04-12', '')).toBe('From 12 April 2027');
    expect(describeDates('2027-04-12', '2027-04-12')).toBe('12 April 2027');
    expect(describeDates('', '')).toBe('Dates open');
  });
});

describe('seasons', () => {
  it('lists every season a trip touches', () => {
    expect(tripSeasons('2027-02-25', '2027-03-03')).toEqual(['winter', 'spring']);
    expect(tripSeasons('2027-04-01', '')).toEqual(['spring']);
    expect(tripSeasons('2026-11-20', '2027-01-05')).toEqual(['autumn', 'winter']);
    expect(tripSeasons('', '')).toEqual([]);
  });

  it('matches the brochure’s best seasons', () => {
    const fit = seasonFit('2027-04-12', '2027-04-15', kyoto.seasons);
    expect(fit.seasons.map((s) => s.id)).toEqual(['spring']);
    expect(fit.best.map((s) => s.id)).toEqual(['spring']);
    expect(seasonFit('2027-07-01', '', kyoto.seasons).best).toEqual([]);
  });
});

describe('validatePlan', () => {
  it('accepts a plan with or without dates', () => {
    expect(validatePlan(valid, TODAY)).toEqual({});
    expect(validatePlan(emptyPlan(kyoto), TODAY)).toEqual({});
  });

  it('rejects past, impossible and far-off starts', () => {
    expect(validatePlan({ ...valid, start: '2026-10-16', end: '' }, TODAY).start).toMatch(/today/);
    expect(validatePlan({ ...valid, start: '2027-02-30', end: '' }, TODAY).start).toBeDefined();
    expect(validatePlan({ ...valid, start: '2030-01-01', end: '' }, TODAY).start).toMatch(/three years/);
    expect(validatePlan({ ...valid, start: TODAY, end: '' }, TODAY)).toEqual({});
  });

  it('checks the end against the start', () => {
    expect(validatePlan({ ...valid, start: '' }, TODAY).end).toMatch(/arrive/);
    expect(validatePlan({ ...valid, end: '2027-04-10' }, TODAY).end).toMatch(/after/);
    expect(validatePlan({ ...valid, end: addDays(valid.start, MAX_NIGHTS + 1) }, TODAY).end).toMatch(/nights/);
    expect(validatePlan({ ...valid, end: addDays(valid.start, MAX_NIGHTS) }, TODAY)).toEqual({});
  });

  it('checks travellers and notes', () => {
    expect(validatePlan({ ...valid, travellers: 0 }, TODAY).travellers).toBeDefined();
    expect(validatePlan({ ...valid, travellers: 13 }, TODAY).travellers).toBeDefined();
    expect(validatePlan({ ...valid, travellers: '' }, TODAY).travellers).toBeDefined();
    expect(validatePlan({ ...valid, notes: 'x'.repeat(2001) }, TODAY).notes).toBeDefined();
  });
});

describe('plan records', () => {
  it('starts from the brochure', () => {
    expect(emptyPlan(kyoto)).toEqual({ start: '', end: '', travellers: 2, interests: ['temples'], notes: '' });
    expect(emptyPlan({}).interests).toEqual([]);
  });

  it('toggles known interests only', () => {
    expect(toggleInterest([], 'food')).toEqual(['food']);
    expect(toggleInterest(['food', 'onsen'], 'food')).toEqual(['onsen']);
    expect(toggleInterest(['food'], 'karaoke')).toEqual(['food']);
  });

  it('builds a trimmed record tied to the brochure, with no personal details', () => {
    const plan = buildPlan({ ...valid, travellers: '3', interests: ['food', 'x'], notes: '  Ryokan night  ' }, kyoto, { now: NOW });
    expect(plan).toMatchObject({
      brochureId: 'b_k',
      brochureSlug: 'kyoto',
      brochureTitle: 'Kyoto',
      brochureTitleJp: '京都',
      start: '2027-04-12',
      end: '2027-04-15',
      travellers: 3,
      interests: ['food'],
      notes: 'Ryokan night',
      createdAt: NOW.toISOString(),
    });
    expect(plan.id).toMatch(/^trip_/);
    expect(Object.keys(plan)).not.toContain('email');
  });

  it('updates in place, keeping id and creation time', () => {
    const first = buildPlan(valid, kyoto, { now: NOW });
    const later = new Date('2026-10-18T10:00:00.000Z');
    const edited = buildPlan({ ...valid, travellers: 4 }, kyoto, { now: later, existing: first });
    expect(edited.id).toBe(first.id);
    expect(edited.createdAt).toBe(first.createdAt);
    expect(edited.updatedAt).toBe(later.toISOString());
    expect(planValues(edited)).toEqual({ ...valid, travellers: 4 });
  });

  it('drops an end date without a start', () => {
    expect(buildPlan({ ...valid, start: '' }, kyoto, { now: NOW }).end).toBe('');
  });
});

describe('stored plans', () => {
  const a = buildPlan(valid, kyoto, { now: NOW });
  const b = buildPlan({ ...valid, start: '2026-11-20', end: '' }, kyoto, { now: NOW });
  const undated = buildPlan(emptyPlan(kyoto), kyoto, { now: NOW });
  const elsewhere = buildPlan(valid, { id: 'b_t', slug: 'tokyo', title: 'Tokyo' }, { now: NOW });

  it('reads corrupt storage as an empty or repaired list', () => {
    expect(readPlans(null)).toEqual([]);
    expect(readPlans('nope')).toEqual([]);
    const repaired = readPlans([{ id: 'x', start: 'soon', end: '2027-01-01', travellers: 99, interests: ['food', 'bad'] }, 42, { id: 'x' }]);
    expect(repaired).toHaveLength(1);
    expect(repaired[0]).toMatchObject({ id: 'x', start: '', end: '', travellers: 12, interests: ['food'] });
  });

  it('upserts, removes and caps the list', () => {
    let list = upsertPlan([], a);
    list = upsertPlan(list, b);
    expect(list.map((p) => p.id)).toEqual([a.id, b.id]);
    list = upsertPlan(list, { ...a, travellers: 5 });
    expect(list).toHaveLength(2);
    expect(list[0].travellers).toBe(5);
    expect(removePlan(list, a.id).map((p) => p.id)).toEqual([b.id]);
    const full = Array.from({ length: MAX_PLANS }, (_, i) => ({ ...a, id: `p${i}` }));
    const next = upsertPlan(full, b);
    expect(next).toHaveLength(MAX_PLANS);
    expect(next.at(-1).id).toBe(b.id);
    expect(next[0].id).toBe('p1');
  });

  it('groups by brochure, soonest trips first and undated last', () => {
    const { mine, others } = groupPlans([undated, a, elsewhere, b], kyoto);
    expect(mine.map((p) => p.id)).toEqual([b.id, a.id, undated.id]);
    expect(others.map((p) => p.id)).toEqual([elsewhere.id]);
  });

  it('migrates old inquiries without their name or email', () => {
    const [plan] = migrateInquiries([
      { id: 'inq_abc', brochureId: 'b_k', brochureSlug: 'kyoto', brochureTitle: 'Kyoto', name: 'Aiko', email: 'a@b.jp', month: '2026-11', travellers: 3, interests: ['food'], message: 'Hi', createdAt: NOW.toISOString() },
      'junk',
    ]);
    expect(plan).toMatchObject({ id: 'trip_abc', brochureId: 'b_k', travellers: 3, interests: ['food'], notes: 'Travel month: November 2026\nHi', start: '' });
    expect(JSON.stringify(plan)).not.toMatch(/Aiko|a@b\.jp/);
  });
});

describe('planText', () => {
  it('writes a plan as plain text with the official links', () => {
    const plan = buildPlan({ ...valid, interests: ['temples', 'food'], notes: 'Book Tenryū-ji early.' }, kyoto, { now: NOW });
    const text = planText(plan, { links: [{ label: 'Kyoto guide', url: 'https://kyoto.travel/en/' }], url: 'https://tabi.example/#/brochures/kyoto' });
    expect(text).toBe(
      [
        'Kyoto (京都)',
        '12–15 April 2027 · 3 nights',
        '2 travellers',
        'Interests: Food & drink, Temples & shrines',
        '',
        'Book Tenryū-ji early.',
        '',
        'Check before you go:',
        '- Kyoto guide: https://kyoto.travel/en/',
        '',
        'Brochure: https://tabi.example/#/brochures/kyoto',
      ].join('\n'),
    );
  });

  it('copes with an open plan', () => {
    const plan = buildPlan({ ...emptyPlan({}), travellers: 1 }, {}, { now: NOW });
    expect(planText(plan)).toBe('A trip to Japan\nDates open\n1 traveller');
  });
});
