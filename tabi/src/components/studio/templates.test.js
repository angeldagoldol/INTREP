import { describe, expect, it } from 'vitest';
import { ART_STYLES, FORMATS, PAGE_TYPES } from '../../data/schema.js';
import { CATEGORY_MAP } from '../../data/categories.js';
import { REGION_MAP } from '../../data/regions.js';
import { SEASON_MAP } from '../../data/seasons.js';
import { ICON_NAMES } from '../ui/Icon.jsx';
import { contrast } from '../brochure/art/color.js';
import { getPhoto, photoIdsIn } from '../../data/photos/index.js';
import { coordinateCheck } from './fieldChecks.js';
import { LIST_LIMITS } from './pageLimits.js';
import { validateForPublish } from './publishCheck.js';
import { TEMPLATES, createBlank, createFromTemplate, createRemix } from './templates.js';

let counter = 0;
const makeId = (prefix) => `${prefix}_${(counter += 1)}`;
const now = new Date('2026-10-01T09:00:00Z');

function listsOf(page) {
  const limits = LIST_LIMITS[page.type] ?? {};
  const lists = Object.keys(limits)
    .filter((key) => key !== 'features' || page.type !== 'pricing')
    .map((key) => [key, page[key]]);
  if (page.type === 'pricing') page.plans.forEach((plan) => lists.push(['features', plan.features]));
  return lists.map(([key, list]) => ({ key, list, limit: limits[key] }));
}

describe('templates', () => {
  it('offers five distinct templates with Japanese names', () => {
    expect(TEMPLATES).toHaveLength(5);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(5);
    expect(new Set(TEMPLATES.map((t) => t.brochure.cover.art)).size).toBe(5);
    for (const t of TEMPLATES) expect(t.jp).toMatch(/[぀-ヿ一-龯]/);
  });

  it.each(TEMPLATES.map((t) => [t.name, t]))('%s is a complete, valid brochure', (_, template) => {
    const b = template.brochure;
    expect(validateForPublish({ ...b, pages: b.pages })).toEqual([]);
    expect(CATEGORY_MAP[b.category]).toBeTruthy();
    expect(REGION_MAP[b.region]).toBeTruthy();
    expect(b.seasons.length).toBeGreaterThan(0);
    for (const s of b.seasons) expect(SEASON_MAP[s]).toBeTruthy();
    expect(FORMATS.map((f) => f.id)).toContain(b.format);
    expect(ART_STYLES).toContain(b.cover.art);
    expect(contrast(b.theme.ink, b.theme.paper)).toBeGreaterThanOrEqual(4.5);
    expect(b.summary.length).toBeLessThanOrEqual(240);
    expect(b.pages.length).toBeGreaterThanOrEqual(6);

    for (const page of b.pages) {
      expect(PAGE_TYPES[page.type]).toBeTruthy();
      for (const { list, limit } of listsOf(page)) {
        expect(list.length).toBeGreaterThanOrEqual(limit.min);
        expect(list.length).toBeLessThanOrEqual(limit.max);
      }
      for (const item of page.items ?? []) if (item.icon) expect(ICON_NAMES).toContain(item.icon);
      for (const item of page.details ?? []) {
        expect(ICON_NAMES).toContain(item.icon);
        // Japan has no fictional phone range: never print a dialable number.
        expect(item.value).not.toMatch(/\+81|^\+?[\d\s().-]{7,}$/);
      }
      if (page.type === 'gallery') for (const item of page.items) expect(ART_STYLES).toContain(item.art);
      if (page.type === 'stats') for (const item of page.items) expect(Number.isFinite(item.value)).toBe(true);
      if (page.type === 'phrases') {
        for (const item of page.items) {
          expect(item.jp).toMatch(/[぀-ヿ一-龯]/);
          expect(item.romaji).toMatch(/^[A-Za-zāēīōū]/);
          expect(item.meaning).toBeTruthy();
        }
      }
    }
  });

  it.each(TEMPLATES.map((t) => [t.name, t]))('%s follows the real-content outline with placeholder copy', (_, template) => {
    const b = template.brochure;
    const types = b.pages.map((p) => p.type);
    expect(types[0]).toBe('cover');
    expect(types.at(-1)).toBe('back');
    expect(types.filter((t) => t === 'place').length).toBeGreaterThanOrEqual(2);
    // Photographs of the places, never a map.
    expect(types).not.toContain('map');
    expect(types.some((t) => t === 'gallery' || t === 'photo')).toBe(true);
    expect(types).toContain('contact');
    // No invented publisher: the person's own name goes here.
    expect(b.organization).toBe('Your name');
    expect(b.location).toMatchObject({ name: expect.any(String), nameJp: expect.stringMatching(/[぀-ヿ一-龯]/) });
    for (const page of b.pages) {
      if (page.type === 'place') {
        expect(page.nameJp).toMatch(/[぀-ヿ一-龯]/);
        expect(page.facts.length).toBeGreaterThan(0);
        expect(page.website).toBe('');
      }
      if (page.type === 'contact') {
        expect(page.heading).toBe('Visitor information');
        expect(page.ctaUrl).toBe('');
        for (const detail of page.details) expect(detail.url).toBe('');
      }
      if (page.type === 'quote') {
        expect(page.quoteJp).toMatch(/[぀-ヿ一-龯]/);
        expect(page.role).toMatch(/Translation: Tabi Guides$/);
      }
      if (page.type === 'pricing') for (const plan of page.plans) expect(plan.price).not.toMatch(/\d/);
    }
    // No unchecked prices or times dressed as facts anywhere.
    expect(JSON.stringify(b)).not.toMatch(/[¥$€£]\s?\d/);
  });

  it.each(TEMPLATES.map((t) => [t.name, t]))('%s names real places inside Japan, with coordinates', (_, template) => {
    const b = template.brochure;
    for (const point of [b.location, ...b.pages.filter((p) => p.type === 'place')]) {
      expect(coordinateCheck(point.lat, point.lng).state).toBe('ok');
    }
    expect(b.location.prefecture).toMatch(/^[A-Z]/);
  });

  it.each(TEMPLATES.map((t) => [t.name, t]))('%s leads with photographs: every gallery plate and photo page has a library photo', (_, template) => {
    for (const page of template.brochure.pages) {
      if (page.type === 'gallery') for (const item of page.items) expect(getPhoto(item.photo), item.photo).not.toBeNull();
      if (page.type === 'photo') expect(getPhoto(page.photo), page.photo).not.toBeNull();
    }
  });

  it.each(TEMPLATES.map((t) => [t.name, t]))('%s uses photos from the library', (_, template) => {
    const ids = photoIdsIn(template.brochure);
    expect(ids.length).toBeGreaterThanOrEqual(3);
    for (const id of ids) expect(getPhoto(id), id).not.toBeNull();
  });

  it('uses only fictional .example web and email addresses', () => {
    const text = JSON.stringify(TEMPLATES);
    const domains = text.match(/[a-z0-9-]+(?:\.[a-z0-9-]+)+(?=["\s,])/gi) ?? [];
    for (const d of domains.filter((x) => /@|\.(com|jp|net|org|example)$/i.test(x))) expect(d).toMatch(/\.example$/);
  });
});

describe('draft factories', () => {
  it('creates a template draft with fresh ids and no slug', () => {
    const doc = createFromTemplate('onsen-escape', { makeId, now });
    expect(doc.id).toMatch(/^b_/);
    expect(doc.slug).toBe('');
    expect(doc.source).toBe('user');
    expect(doc.updatedAt).toBe(now.toISOString());
    expect(new Set(doc.pages.map((p) => p.id)).size).toBe(doc.pages.length);
    expect(doc.pages.every((p) => p.id.startsWith('pg_'))).toBe(true);
    expect(doc.title).toBe('Hakone: A Hot-Spring Weekend');
  });

  it('does not share nested objects with the template', () => {
    const doc = createFromTemplate('city-weekend', { makeId, now });
    doc.pages[2].facts[0].value = 'Changed';
    doc.location.lat = 0;
    expect(TEMPLATES[0].brochure.pages[2].facts[0].value).not.toBe('Changed');
    expect(TEMPLATES[0].brochure.location.lat).not.toBe(0);
  });

  it('falls back to the first template for unknown ids', () => {
    expect(createFromTemplate('nope', { makeId, now }).title).toBe(TEMPLATES[0].brochure.title);
  });

  it('creates a blank cover / intro / back brochure', () => {
    const doc = createBlank({ makeId, now, random: () => 0.5 });
    expect(doc.pages.map((p) => p.type)).toEqual(['cover', 'intro', 'back']);
    expect(doc.title).toBe('');
    expect(doc.cover.seed).toBe(5000);
  });

  it('remixes a brochure as a new user copy', () => {
    const source = { ...TEMPLATES[4].brochure, id: 'b_src', slug: 'src', source: 'builtin', featured: true };
    const doc = createRemix(source, { makeId, now });
    expect(doc.title).toBe('Nara: The Temple Trail (remix)');
    expect(doc.id).not.toBe('b_src');
    expect(doc).toMatchObject({ slug: '', source: 'user', featured: false });
    expect(doc.pages).toHaveLength(source.pages.length);
    expect(createRemix({ pages: [] }, { makeId, now }).title).toBe('Untitled brochure (remix)');
  });
});
