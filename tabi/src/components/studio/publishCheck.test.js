import { describe, expect, it } from 'vitest';
import { autoFix, canAutoFix, validateForPublish } from './publishCheck.js';

let n = 0;
const makeId = (prefix) => `${prefix}_${(n += 1)}`;
const page = (type, extra = {}) => ({ id: `${type}_${(n += 1)}`, type, ...extra });
const types = (doc) => doc.pages.map((p) => p.type);
const issueIds = (doc) => validateForPublish(doc).map((i) => i.id);

describe('validateForPublish', () => {
  it('passes a well-formed brochure', () => {
    expect(validateForPublish({ title: 'Nara', pages: [page('cover'), page('intro'), page('back')] })).toEqual([]);
  });

  it('flags every structural problem', () => {
    expect(issueIds({ title: ' ', pages: [page('intro')] })).toEqual(['title', 'pages', 'cover', 'back']);
    expect(issueIds({ title: 'x', pages: [] })).toEqual(['pages', 'cover', 'back']);
    expect(issueIds({})).toEqual(['title', 'pages', 'cover', 'back']);
  });

  it('marks the title fixable only when the cover has a headline', () => {
    const [withCover] = validateForPublish({ title: '', pages: [page('cover', { title: 'Nara deer' }), page('intro'), page('back')] });
    expect(withCover).toMatchObject({ id: 'title', fixable: true });
    expect(withCover.message).toContain('Nara deer');
    const [without] = validateForPublish({ title: '', pages: [page('cover'), page('intro'), page('back')] });
    expect(without.fixable).toBe(false);
  });
});

describe('canAutoFix', () => {
  it('needs a title when the title issue is not fixable', () => {
    const issues = validateForPublish({ title: '', pages: [page('intro')] });
    expect(canAutoFix(issues)).toBe(false);
    expect(canAutoFix(issues, 'Nara')).toBe(true);
  });
});

describe('autoFix', () => {
  it('moves an existing cover to the front and back cover to the end', () => {
    const doc = { title: 'X', pages: [page('intro'), page('back'), page('cover'), page('quote')] };
    const fixed = autoFix(doc, { makeId });
    expect(types(fixed)).toEqual(['cover', 'intro', 'quote', 'back']);
    expect(fixed.pages).toHaveLength(4);
    expect(issueIds(fixed)).toEqual([]);
  });

  it('creates missing covers and pads to three pages', () => {
    const fixed = autoFix({ title: 'Sapporo', titleJp: '札幌', pages: [] }, { makeId });
    expect(types(fixed)).toEqual(['cover', 'intro', 'back']);
    expect(fixed.pages[0]).toMatchObject({ title: 'Sapporo', titleJp: '札幌' });
    expect(issueIds(fixed)).toEqual([]);
  });

  it('pads a lonely back cover', () => {
    expect(types(autoFix({ title: 'x', pages: [page('back')] }, { makeId }))).toEqual(['cover', 'intro', 'back']);
  });

  it('borrows the cover headline or a given title', () => {
    const doc = { title: '', pages: [page('cover', { title: 'Snow Country' }), page('intro'), page('back')] };
    expect(autoFix(doc, { makeId }).title).toBe('Snow Country');
    expect(autoFix(doc, { makeId, title: '  Yuki  ' }).title).toBe('Yuki');
  });

  it('lines up a double-page spread that a reorder pushed onto the wrong side', () => {
    const left = page('photo', { span: 'left', photo: 'kyoto-spread' });
    const right = page('photo', { span: 'right', photo: 'kyoto-spread' });
    const doc = { title: 'Kyoto', pages: [page('cover'), page('intro'), left, right, page('place'), page('back')] };
    expect(issueIds(doc)).toEqual(['spreads']);
    expect(validateForPublish(doc)[0]).toMatchObject({ fixable: true });
    const fixed = autoFix(doc, { makeId });
    expect(issueIds(fixed)).toEqual([]);
    expect(fixed.pages.indexOf(left)).toBe(3);
    expect(fixed.pages.indexOf(right)).toBe(4);
  });

  it('leaves a valid brochure untouched apart from a copy', () => {
    const doc = { title: 'Nara', pages: [page('cover'), page('intro'), page('back')] };
    const fixed = autoFix(doc, { makeId });
    expect(fixed.pages).toEqual(doc.pages);
    expect(fixed).not.toBe(doc);
  });
});
