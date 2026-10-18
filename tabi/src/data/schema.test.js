import { describe, expect, it } from 'vitest';
import { ICON_NAMES } from '../components/ui/Icon.jsx';
import { PAGE_TYPES, PAGE_TYPE_IDS } from './schema.js';

describe('PAGE_TYPES placeholders', () => {
  it.each(PAGE_TYPE_IDS)('"%s" creates fresh plain content', (type) => {
    const a = PAGE_TYPES[type].create();
    expect(a).toEqual(PAGE_TYPES[type].create());
    expect(a).not.toBe(PAGE_TYPES[type].create());
    expect(PAGE_TYPES[type].label).toBeTruthy();
    expect(PAGE_TYPES[type].jp).toMatch(/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u);
  });

  it('never suggests a dialable phone number on a new contact page', () => {
    for (const detail of PAGE_TYPES.contact.create().details) expect(detail.value).not.toMatch(/\+81|^\+?[\d\s().-]{7,}$/);
  });

  it('reads like a Japan brochure, not a software price list (regression)', () => {
    const all = JSON.stringify(PAGE_TYPE_IDS.map((type) => PAGE_TYPES[type].create()));
    expect(all).not.toMatch(/\$\d|per month|Happy clients|Years in business|seals the deal/);
    for (const plan of PAGE_TYPES.pricing.create().plans) expect(plan.price).toMatch(/^¥[\d,]+$/);
  });

  it('only suggests registry icons and fictional .example addresses', () => {
    const icons = [...PAGE_TYPES.features.create().items, ...PAGE_TYPES.contact.create().details].map((item) => item.icon);
    for (const icon of icons) expect(ICON_NAMES).toContain(icon);
    for (const email of JSON.stringify(PAGE_TYPE_IDS.map((t) => PAGE_TYPES[t].create())).match(/[\w.+-]+@[\w.-]+/g) ?? []) {
      expect(email).toMatch(/\.example$/);
    }
  });
});
