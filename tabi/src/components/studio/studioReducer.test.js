import { describe, expect, it } from 'vitest';
import {
  COALESCE_MS,
  HISTORY_LIMIT,
  createStudioState,
  getIn,
  setIn,
  studioActions as A,
  studioReducer,
} from './studioReducer.js';

function makeDoc() {
  return {
    id: 'b_test',
    title: 'Kyoto weekend',
    titleJp: '京都',
    seasons: ['spring'],
    tags: [],
    theme: { paper: '#f4eee2', ink: '#22140f', accent: '#d23a22', accent2: '#1d4f7a', muted: '#6e5b4f', typeface: 'serif' },
    cover: { art: 'torii', seed: 5 },
    pages: [
      { id: 'p1', type: 'cover', title: 'Cover' },
      { id: 'p2', type: 'intro', heading: 'Hello' },
      {
        id: 'p3',
        type: 'features',
        heading: 'Sights',
        items: [
          { icon: 'Landmark', title: 'One', text: 'a' },
          { icon: 'Star', title: 'Two', text: 'b' },
          { icon: 'Heart', title: 'Three', text: 'c' },
        ],
      },
      {
        id: 'p4',
        type: 'pricing',
        plans: [{ name: 'Basic', price: '¥1', period: 'night', features: ['Bath', 'Tea'], highlight: false }],
      },
      { id: 'p5', type: 'back', title: 'Mata ne' },
    ],
  };
}

/** Apply a list of actions, stamping increasing times (far apart by default). */
function run(actions, state = createStudioState(makeDoc()), step = COALESCE_MS * 2) {
  return actions.reduce((s, action, i) => studioReducer(s, { at: (i + 1) * step, ...action }), state);
}

const ids = (state) => state.doc.pages.map((p) => p.id);

describe('path helpers', () => {
  it('reads and writes nested paths immutably', () => {
    const source = { a: [{ b: 1 }, { b: 2 }] };
    const next = setIn(source, ['a', 1, 'b'], 9);
    expect(getIn(next, ['a', 1, 'b'])).toBe(9);
    expect(source.a[1].b).toBe(2);
    expect(next.a[0]).toBe(source.a[0]);
    expect(Array.isArray(next.a)).toBe(true);
  });

  it('returns undefined for missing paths', () => {
    expect(getIn({}, ['x', 0, 'y'])).toBeUndefined();
  });
});

describe('createStudioState', () => {
  it('selects the first page by default and keeps a valid selection', () => {
    expect(createStudioState(makeDoc()).selectedId).toBe('p1');
    expect(createStudioState(makeDoc(), 'p3').selectedId).toBe('p3');
    expect(createStudioState(makeDoc(), 'nope').selectedId).toBe('p1');
  });

  it('copes with a document without pages', () => {
    expect(createStudioState({ pages: [] }).selectedId).toBeNull();
  });
});

describe('fields and theme', () => {
  it('sets editable brochure fields and records history', () => {
    const s = run([A.setField('title', 'Osaka nights')]);
    expect(s.doc.title).toBe('Osaka nights');
    expect(s.past).toHaveLength(1);
  });

  it('ignores unknown fields and no-op values', () => {
    const start = createStudioState(makeDoc());
    expect(studioReducer(start, A.setField('id', 'hack'))).toBe(start);
    expect(studioReducer(start, A.setField('title', 'Kyoto weekend'))).toBe(start);
  });

  it('sets theme colours and typeface without touching the rest', () => {
    const s = run([A.setTheme('accent', '#000000'), A.setTheme('typeface', 'mono')]);
    expect(s.doc.theme).toMatchObject({ accent: '#000000', typeface: 'mono', paper: '#f4eee2' });
    expect(studioReducer(s, A.setTheme('bogus', 1))).toBe(s);
  });

  it('applies a palette in one undo step and skips identical palettes', () => {
    const palette = { paper: '#ffffff', ink: '#000000', accent: '#ff0000', accent2: '#00ff00', muted: '#777777' };
    const s = run([A.applyPalette(palette)]);
    expect(s.doc.theme).toMatchObject({ ...palette, typeface: 'serif' });
    expect(s.past).toHaveLength(1);
    expect(studioReducer(s, A.applyPalette(palette))).toBe(s);
  });

  it('updates cover art and seed independently', () => {
    const s = run([A.setCover({ seed: 99 })]);
    expect(s.doc.cover).toEqual({ art: 'torii', seed: 99 });
    const t = studioReducer(s, A.setCover({ art: 'fuji' }));
    expect(t.doc.cover).toEqual({ art: 'fuji', seed: 99 });
    expect(studioReducer(t, A.setCover({ art: 'fuji', seed: 99 }))).toBe(t);
  });
});

describe('pages', () => {
  const page = (id, type = 'quote') => ({ id, type, quote: 'Hi' });

  it('adds a page after the selected one and selects it', () => {
    const s = run([A.select('p2'), A.addPage(page('n1'))]);
    expect(ids(s)).toEqual(['p1', 'p2', 'n1', 'p3', 'p4', 'p5']);
    expect(s.selectedId).toBe('n1');
  });

  it('never appends after a closing back cover', () => {
    const s = run([A.select('p5'), A.addPage(page('n1'))]);
    expect(ids(s).slice(-2)).toEqual(['n1', 'p5']);
  });

  it('honours an explicit index and rejects duplicates or unknown types', () => {
    const s = run([A.addPage(page('n1'), 0)]);
    expect(ids(s)[0]).toBe('n1');
    expect(studioReducer(s, A.addPage(page('n1')))).toBe(s);
    expect(studioReducer(s, A.addPage({ id: 'x', type: 'poster' }))).toBe(s);
  });

  it('duplicates a page deeply under a new id', () => {
    const s = run([A.duplicatePage('p3', 'p3copy')]);
    expect(ids(s)).toEqual(['p1', 'p2', 'p3', 'p3copy', 'p4', 'p5']);
    expect(s.selectedId).toBe('p3copy');
    const [original, copy] = [s.doc.pages[2], s.doc.pages[3]];
    expect(copy.items).toEqual(original.items);
    expect(copy.items).not.toBe(original.items);
  });

  it('removes a page and moves the selection to its neighbour', () => {
    const s = run([A.select('p3'), A.removePage('p3')]);
    expect(ids(s)).toEqual(['p1', 'p2', 'p4', 'p5']);
    expect(s.selectedId).toBe('p4');
    const last = run([A.select('p5'), A.removePage('p5')]);
    expect(last.selectedId).toBe('p4');
  });

  it('keeps at least one page', () => {
    const single = createStudioState({ ...makeDoc(), pages: [{ id: 'only', type: 'cover' }] });
    expect(studioReducer(single, A.removePage('only'))).toBe(single);
  });

  it('moves a page with clamping', () => {
    const s = run([A.movePage('p2', 3)]);
    expect(ids(s)).toEqual(['p1', 'p3', 'p4', 'p2', 'p5']);
    expect(ids(run([A.movePage('p2', 99)])).at(-1)).toBe('p2');
    const start = createStudioState(makeDoc());
    expect(studioReducer(start, A.movePage('p2', 1))).toBe(start);
  });

  it('reorders pages only from a full permutation', () => {
    const order = ['p5', 'p4', 'p3', 'p2', 'p1'];
    expect(ids(run([A.reorderPages(order)]))).toEqual(order);
    const start = createStudioState(makeDoc());
    expect(studioReducer(start, A.reorderPages(['p1', 'p2']))).toBe(start);
    expect(studioReducer(start, A.reorderPages(['p1', 'p1', 'p3', 'p4', 'p5']))).toBe(start);
  });

  it('selects only existing pages', () => {
    const start = createStudioState(makeDoc());
    expect(studioReducer(start, A.select('p4')).selectedId).toBe('p4');
    expect(studioReducer(start, A.select('ghost'))).toBe(start);
  });
});

describe('page fields and lists', () => {
  it('updates nested list item fields', () => {
    const s = run([A.updatePage('p3', ['items', 1, 'title'], 'Second')]);
    expect(s.doc.pages[2].items[1].title).toBe('Second');
    expect(s.selectedId).toBe('p3');
  });

  it('updates strings inside nested lists', () => {
    const s = run([A.updatePage('p4', ['plans', 0, 'features', 1], 'Kaiseki')]);
    expect(s.doc.pages[3].plans[0].features).toEqual(['Bath', 'Kaiseki']);
  });

  it('refuses to rewrite a page id or type', () => {
    const start = createStudioState(makeDoc());
    expect(studioReducer(start, A.updatePage('p2', ['type'], 'cover'))).toBe(start);
    expect(studioReducer(start, A.updatePage('p2', ['id'], 'x'))).toBe(start);
    expect(studioReducer(start, A.updatePage('ghost', ['heading'], 'x'))).toBe(start);
  });

  it('adds list items up to the schema limit', () => {
    let s = createStudioState(makeDoc());
    for (let i = 0; i < 6; i += 1) s = studioReducer(s, { ...A.addItem('p3', ['items'], { title: `n${i}` }), at: i * 5000 });
    expect(s.doc.pages[2].items).toHaveLength(6);
  });

  it('inserts list items at an index and creates missing lists', () => {
    const s = run([A.addItem('p3', ['items'], { title: 'First' }, 0)]);
    expect(s.doc.pages[2].items[0].title).toBe('First');
    const t = run([A.addItem('p2', ['items'], { title: 'x' })]);
    expect(t.doc.pages[1].items).toEqual([{ title: 'x' }]);
  });

  it('removes list items down to the schema minimum', () => {
    const s = run([A.removeItem('p3', ['items'], 0)]);
    expect(s.doc.pages[2].items.map((i) => i.title)).toEqual(['Two', 'Three']);
    expect(studioReducer(s, A.removeItem('p3', ['items'], 0))).toBe(s);
    const plans = createStudioState(makeDoc());
    expect(studioReducer(plans, A.removeItem('p4', ['plans'], 0))).toBe(plans);
  });

  it('enforces nested limits (pricing plan features)', () => {
    const s = run([A.removeItem('p4', ['plans', 0, 'features'], 0)]);
    expect(s.doc.pages[3].plans[0].features).toEqual(['Tea']);
    expect(studioReducer(s, A.removeItem('p4', ['plans', 0, 'features'], 0))).toBe(s);
  });

  it('moves list items with clamping and ignores bad indexes', () => {
    const s = run([A.moveItem('p3', ['items'], 0, 2)]);
    expect(s.doc.pages[2].items.map((i) => i.title)).toEqual(['Two', 'Three', 'One']);
    expect(studioReducer(s, A.moveItem('p3', ['items'], 9, 0))).toBe(s);
    expect(studioReducer(s, A.moveItem('p3', ['items'], 1, 1))).toBe(s);
  });
});

describe('undo / redo', () => {
  it('undoes and redoes, restoring the selection of each step', () => {
    const s = run([A.select('p3'), A.updatePage('p3', ['heading'], 'Sights of Kyoto'), A.select('p1')]);
    const undone = studioReducer(s, A.undo());
    expect(undone.doc.pages[2].heading).toBe('Sights');
    expect(undone.selectedId).toBe('p3');
    const redone = studioReducer(undone, A.redo());
    expect(redone.doc.pages[2].heading).toBe('Sights of Kyoto');
    expect(redone.future).toHaveLength(0);
  });

  it('is a no-op with empty stacks', () => {
    const start = createStudioState(makeDoc());
    expect(studioReducer(start, A.undo())).toBe(start);
    expect(studioReducer(start, A.redo())).toBe(start);
  });

  it('clears the redo stack on a new edit', () => {
    const s = run([A.setField('title', 'A'), A.undo(), A.setField('title', 'B')]);
    expect(s.future).toHaveLength(0);
    expect(s.doc.title).toBe('B');
  });

  it('undoes a page removal back to the removed page', () => {
    const s = run([A.select('p2'), A.removePage('p2'), A.undo()]);
    expect(ids(s)).toContain('p2');
    expect(s.selectedId).toBe('p2');
  });

  it(`caps history at ${HISTORY_LIMIT} steps`, () => {
    let s = createStudioState(makeDoc());
    for (let i = 0; i < HISTORY_LIMIT + 15; i += 1) s = studioReducer(s, { ...A.setField('title', `t${i}`), at: i * 5000 });
    expect(s.past).toHaveLength(HISTORY_LIMIT);
    let undone = s;
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) undone = studioReducer(undone, A.undo());
    expect(undone.doc.title).toBe('t14');
  });

  it('coalesces rapid typing in one field into a single step', () => {
    const typing = ['K', 'Ky', 'Kyo', 'Kyot', 'Kyoto'].map((v) => A.setField('title', v, true));
    const s = run(typing, undefined, 120);
    expect(s.doc.title).toBe('Kyoto');
    expect(s.past).toHaveLength(1);
    expect(studioReducer(s, A.undo()).doc.title).toBe('Kyoto weekend');
  });

  it('starts a new step after a typing pause, a different field or an undo', () => {
    const start = createStudioState(makeDoc());
    const a = studioReducer(start, { ...A.setField('title', 'A', true), at: 100 });
    const b = studioReducer(a, { ...A.setField('title', 'AB', true), at: 100 + COALESCE_MS + 1 });
    expect(b.past).toHaveLength(2);
    const c = studioReducer(b, { ...A.setField('subtitle', 'x', true), at: 100 + COALESCE_MS + 50 });
    expect(c.past).toHaveLength(3);
    const d = studioReducer(studioReducer(c, A.undo()), { ...A.setField('subtitle', 'y', true), at: 100 + COALESCE_MS + 60 });
    expect(d.past).toHaveLength(3);
  });

  it('coalesces typing within the same page field only', () => {
    const s = run(
      [A.updatePage('p3', ['items', 0, 'title'], 'O', true), A.updatePage('p3', ['items', 0, 'title'], 'On', true), A.updatePage('p3', ['items', 1, 'title'], 'T', true)],
      undefined,
      50,
    );
    expect(s.past).toHaveLength(2);
  });

  it('does not coalesce non-typing edits', () => {
    const s = run([A.setField('format', 'bifold'), A.setField('format', 'trifold')], undefined, 10);
    expect(s.past).toHaveLength(2);
  });
});

describe('load and replace', () => {
  it('load resets history', () => {
    const s = run([A.setField('title', 'X'), A.load({ ...makeDoc(), title: 'Fresh' }, 'p2')]);
    expect(s.past).toHaveLength(0);
    expect(s.doc.title).toBe('Fresh');
    expect(s.selectedId).toBe('p2');
  });

  it('replaceDoc is undoable and repairs a stale selection', () => {
    const next = { ...makeDoc(), title: 'Imported', pages: [{ id: 'z1', type: 'cover' }] };
    const s = run([A.select('p3'), A.replaceDoc(next)]);
    expect(s.doc.title).toBe('Imported');
    expect(s.selectedId).toBe('z1');
    expect(studioReducer(s, A.undo()).doc.title).toBe('Kyoto weekend');
    expect(studioReducer(s, A.replaceDoc({ title: 'no pages' }))).toBe(s);
  });

  it('ignores unknown actions', () => {
    const start = createStudioState(makeDoc());
    expect(studioReducer(start, { type: 'nope' })).toBe(start);
  });
});

describe('brochure-level real-place fields', () => {
  it('sets factsChecked like any brochure field', () => {
    const s = run([A.setField('factsChecked', 'October 2026')]);
    expect(s.doc.factsChecked).toBe('October 2026');
    expect(s.past).toHaveLength(1);
  });

  it('edits the location by path, creating it when missing, and removes it', () => {
    let s = run([A.updateDoc(['location', 'name'], 'Kiyomizu-dera', true), A.updateDoc(['location', 'lat'], 34.9949)]);
    expect(s.doc.location).toEqual({ name: 'Kiyomizu-dera', lat: 34.9949 });
    s = studioReducer(s, A.updateDoc(['location'], null));
    expect(s.doc).not.toHaveProperty('location');
    expect(studioReducer(s, A.updateDoc(['location'], null))).toBe(s);
  });

  it('coalesces typing in one location field into one undo step', () => {
    const s = run([A.updateDoc(['location', 'name'], 'K', true), A.updateDoc(['location', 'name'], 'Ky', true), A.updateDoc(['location', 'name'], 'Kyo', true)], undefined, 10);
    expect(s.past).toHaveLength(1);
    expect(studioReducer(s, A.undo()).doc).not.toHaveProperty('location');
  });

  it('only edits allowed brochure paths', () => {
    const start = createStudioState(makeDoc());
    expect(studioReducer(start, A.updateDoc(['title'], 'x'))).toBe(start);
    expect(studioReducer(start, A.updateDoc(['userPhotos', 'a'], {}))).toBe(start);
    expect(studioReducer(start, A.updateDoc([], 'x'))).toBe(start);
    // Sources are added with addDocItem, never conjured by a path edit.
    expect(studioReducer(start, A.updateDoc(['sources', 0, 'url'], 'https://x.jp'))).toBe(start);
  });

  it('adds, edits, moves and removes sources within the limit', () => {
    let s = run([
      A.addDocItem(['sources'], { label: 'Official site', url: '' }),
      A.addDocItem(['sources'], { label: 'JNTO', url: 'https://www.japan.travel/en/' }),
      A.updateDoc(['sources', 0, 'url'], 'https://www.kiyomizudera.or.jp/en/'),
      A.moveDocItem(['sources'], 1, 0),
    ]);
    expect(s.doc.sources.map((x) => x.label)).toEqual(['JNTO', 'Official site']);
    expect(s.doc.sources[1].url).toBe('https://www.kiyomizudera.or.jp/en/');
    s = studioReducer(s, A.removeDocItem(['sources'], 0));
    expect(s.doc.sources.map((x) => x.label)).toEqual(['Official site']);
    expect(studioReducer(s, A.removeDocItem(['sources'], 5))).toBe(s);
    expect(studioReducer(s, A.moveDocItem(['sources'], 0, 0))).toBe(s);
    expect(studioReducer(s, A.addDocItem(['pages'], {}))).toBe(s);
    const full = run(Array.from({ length: 14 }, (_, i) => A.addDocItem(['sources'], { label: `S${i}`, url: '' })));
    expect(full.doc.sources).toHaveLength(12);
  });
});

describe('photos', () => {
  const upload = { src: 'data:image/jpeg;base64,QUJD', alt: 'Lanterns', width: 1600, height: 1067, credit: { author: 'Your photo', license: '' } };

  it('places a library photo on a page field and selects that page', () => {
    const s = run([A.placePhoto({ kind: 'page', id: 'p2', path: ['photo'] }, 'kyoto-senbon-torii')]);
    expect(s.doc.pages[1].photo).toBe('kyoto-senbon-torii');
    expect(s.selectedId).toBe('p2');
    expect(s.past).toHaveLength(1);
  });

  it('places photos on list items, never on locked keys or missing items', () => {
    let s = run([A.placePhoto({ kind: 'page', id: 'p3', path: ['items', 1, 'photo'] }, 'nara-deer')]);
    expect(s.doc.pages[2].items[1].photo).toBe('nara-deer');
    expect(s.doc.pages[2].items[0]).not.toHaveProperty('photo');
    const same = s;
    s = studioReducer(s, A.placePhoto({ kind: 'page', id: 'p3', path: ['items', 9, 'photo'] }, 'x'));
    expect(s).toBe(same);
    expect(studioReducer(s, A.placePhoto({ kind: 'page', id: 'p3', path: ['id'] }, 'x'))).toBe(same);
    expect(studioReducer(s, A.placePhoto({ kind: 'page', id: 'p3', path: ['heading'] }, 'x'))).toBe(same);
    expect(studioReducer(s, A.placePhoto({ kind: 'page', id: 'nope', path: ['photo'] }, 'x'))).toBe(same);
    expect(studioReducer(s, A.placePhoto({ kind: 'page', id: 'p3', path: ['items', 1, 'photo'] }, 'nara-deer'))).toBe(same);
  });

  it('sets the cover photo on the brochure and drops the cover page’s own one', () => {
    const doc = makeDoc();
    doc.pages[0] = { ...doc.pages[0], photo: 'old-photo' };
    const s = run([A.placePhoto({ kind: 'cover', pageId: 'p1' }, 'kyoto-senbon-torii')], createStudioState(doc));
    expect(s.doc.cover).toEqual({ art: 'torii', seed: 5, photo: 'kyoto-senbon-torii' });
    expect(s.doc.pages[0]).not.toHaveProperty('photo');
    const cleared = studioReducer(s, A.placePhoto({ kind: 'cover', pageId: 'p1' }, ''));
    expect(cleared.doc.cover.photo).toBe('');
  });

  it('stores an upload and places it in one undo step', () => {
    const s = run([A.addUserPhoto('ph1', upload, { kind: 'page', id: 'p2', path: ['photo'] })]);
    expect(s.doc.userPhotos).toEqual({ ph1: upload });
    expect(s.doc.pages[1].photo).toBe('user:ph1');
    expect(s.past).toHaveLength(1);
    const undone = studioReducer(s, A.undo());
    expect(undone.doc).not.toHaveProperty('userPhotos');
    expect(undone.doc.pages[1]).not.toHaveProperty('photo');
  });

  it('refuses bad or duplicate upload keys', () => {
    const s = run([A.addUserPhoto('ph1', upload)]);
    expect(studioReducer(s, A.addUserPhoto('ph1', upload))).toBe(s);
    expect(studioReducer(s, A.addUserPhoto('bad key', upload))).toBe(s);
    expect(studioReducer(s, A.addUserPhoto('__proto__x!', upload))).toBe(s);
    expect(studioReducer(s, A.addUserPhoto('ph2', { alt: 'no src' }))).toBe(s);
  });

  it('edits an upload’s alt text and credit, coalescing typing', () => {
    let s = run([A.addUserPhoto('ph1', upload)]);
    s = run([A.updateUserPhoto('ph1', ['alt'], 'L', true), A.updateUserPhoto('ph1', ['alt'], 'La', true)], s, 10);
    expect(s.doc.userPhotos.ph1.alt).toBe('La');
    expect(s.past).toHaveLength(2);
    s = studioReducer(s, A.updateUserPhoto('ph1', ['credit', 'author'], 'Aiko Tanaka'));
    expect(s.doc.userPhotos.ph1.credit).toEqual({ author: 'Aiko Tanaka', license: '' });
    expect(studioReducer(s, A.updateUserPhoto('ph1', ['src'], 'data:x'))).toBe(s);
    expect(studioReducer(s, A.updateUserPhoto('nope', ['alt'], 'x'))).toBe(s);
  });

  it('removes an upload and clears every field that showed it', () => {
    const doc = makeDoc();
    let s = run(
      [
        A.addUserPhoto('ph1', upload, { kind: 'cover', pageId: 'p1' }),
        A.addUserPhoto('ph2', upload, { kind: 'page', id: 'p2', path: ['photo'] }),
        A.placePhoto({ kind: 'page', id: 'p3', path: ['items', 0, 'photo'] }, 'user:ph1'),
      ],
      createStudioState(doc),
    );
    s = studioReducer(s, A.removeUserPhoto('ph1'));
    expect(Object.keys(s.doc.userPhotos)).toEqual(['ph2']);
    expect(s.doc.cover.photo).toBe('');
    expect(s.doc.pages[2].items[0].photo).toBe('');
    expect(s.doc.pages[1].photo).toBe('user:ph2');
    s = studioReducer(s, A.removeUserPhoto('ph2'));
    expect(s.doc).not.toHaveProperty('userPhotos');
    expect(studioReducer(s, A.removeUserPhoto('ph2'))).toBe(s);
  });
});

describe('mergePage', () => {
  const place = () => {
    const doc = makeDoc();
    doc.pages.splice(1, 0, { id: 'pl', type: 'contact', details: [{ icon: 'Globe', label: 'A', value: 'x', url: '' }] });
    return createStudioState(doc);
  };

  it('sets several page fields in one step', () => {
    const s = run([A.mergePage('p2', [], { lat: 34.9949, lng: 135.785 })]);
    expect(s.doc.pages[1]).toMatchObject({ lat: 34.9949, lng: 135.785 });
    expect(s.past).toHaveLength(1);
  });

  it('merges into an item and coalesces typing', () => {
    const s = run([A.mergePage('pl', ['details', 0], { label: 'B', value: 'x' }, true), A.mergePage('pl', ['details', 0], { label: 'B', value: 'y' }, true)], place(), 10);
    expect(s.doc.pages[1].details[0]).toEqual({ icon: 'Globe', label: 'B', value: 'y', url: '' });
    expect(s.past).toHaveLength(1);
  });

  it('refuses locked keys, missing targets and no-ops', () => {
    const start = place();
    expect(studioReducer(start, A.mergePage('pl', [], { id: 'x' }))).toBe(start);
    expect(studioReducer(start, A.mergePage('pl', ['details', 5], { label: 'B' }))).toBe(start);
    expect(studioReducer(start, A.mergePage('pl', ['details', 0], { label: 'A', value: 'x' }))).toBe(start);
    expect(studioReducer(start, A.mergePage('pl', [], null))).toBe(start);
  });
});

describe('double-page photo spreads', () => {
  const left = { id: 'sl', type: 'photo', span: 'left', photo: 'kyoto-spread', captionPlacement: 'overlay', creditPlacement: 'caption' };
  const right = { id: 'sr', type: 'photo', span: 'right', photo: 'kyoto-spread', name: 'Kiyomizu-dera', captionPlacement: 'overlay', creditPlacement: 'caption' };
  const withSpread = () => {
    const doc = makeDoc();
    // cover, spread (pages 2–3), intro, features, pricing, back
    return createStudioState({ ...doc, pages: [doc.pages[0], left, right, ...doc.pages.slice(1)] }, 'sl');
  };

  it('adds both halves in one undo step and selects the left one', () => {
    const state = createStudioState(makeDoc(), 'p1');
    const next = studioReducer(state, A.addPages([{ ...left }, { ...right }], 1));
    expect(ids(next)).toEqual(['p1', 'sl', 'sr', 'p2', 'p3', 'p4', 'p5']);
    expect(next.selectedId).toBe('sl');
    expect(studioReducer(next, A.undo()).doc).toBe(state.doc);
    // Duplicate or unknown pages are refused.
    expect(studioReducer(next, A.addPages([{ ...left }], 1))).toBe(next);
    expect(studioReducer(state, A.addPages([{ id: 'x', type: 'hologram' }], 1))).toBe(state);
  });

  it('keeps one photo and one layout across both halves', () => {
    let state = withSpread();
    state = studioReducer(state, A.placePhoto({ kind: 'page', id: 'sl', path: ['photo'] }, 'kyoto-fullpage'));
    expect(state.doc.pages.find((p) => p.id === 'sr').photo).toBe('kyoto-fullpage');
    state = studioReducer(state, A.updatePage('sr', ['captionPlacement'], 'below'));
    expect(state.doc.pages.find((p) => p.id === 'sl').captionPlacement).toBe('below');
    state = studioReducer(state, A.updatePage('sl', ['creditPlacement'], 'edge'));
    expect(state.doc.pages.find((p) => p.id === 'sr').creditPlacement).toBe('edge');
    // Captions belong to each half.
    state = studioReducer(state, A.updatePage('sr', ['caption'], 'The view'));
    expect(state.doc.pages.find((p) => p.id === 'sl').caption).toBeUndefined();
    // Uploads placed on a half land on both, and removing one clears both.
    state = studioReducer(state, A.addUserPhoto('pic', { src: 'data:image/jpeg;base64,AAAA', alt: 'x', width: 10, height: 5, credit: { author: 'Me', license: 'Own' } }, { kind: 'page', id: 'sr', path: ['photo'] }));
    expect(state.doc.pages.filter((p) => p.span).map((p) => p.photo)).toEqual(['user:pic', 'user:pic']);
    state = studioReducer(state, A.removeUserPhoto('pic'));
    expect(state.doc.pages.filter((p) => p.span).map((p) => p.photo)).toEqual(['', '']);
  });

  it('never edits span directly, and duplicates a half as a full-page photo', () => {
    const state = withSpread();
    expect(studioReducer(state, A.updatePage('sl', ['span'], 'right'))).toBe(state);
    const copy = studioReducer(state, A.duplicatePage('sl', 'copy'));
    const page = copy.doc.pages.find((p) => p.id === 'copy');
    expect(page).toMatchObject({ type: 'photo', photo: 'kyoto-spread' });
    expect(page).not.toHaveProperty('span');
  });

  it('moves a spread by both halves, a spread at a time', () => {
    const state = withSpread();
    const later = studioReducer(state, A.moveSpread('sr', 1));
    expect(ids(later)).toEqual(['p1', 'p2', 'p3', 'sl', 'sr', 'p4', 'p5']);
    expect(studioReducer(later, A.moveSpread('sl', 1))).toBe(later);
    expect(studioReducer(state, A.moveSpread('sl', -1))).toBe(state);
    expect(studioReducer(state, A.moveSpread('p2', 1))).toBe(state);
  });

  it('lines up spreads after a reorder, in one undo step', () => {
    let state = withSpread();
    state = studioReducer(state, A.movePage('p2', 1)); // intro in front: the spread now starts on page 3
    expect(ids(state)).toEqual(['p1', 'p2', 'sl', 'sr', 'p3', 'p4', 'p5']);
    const fixed = studioReducer(state, A.fixSpreads());
    expect(ids(fixed)).toEqual(['p1', 'p2', 'p3', 'sl', 'sr', 'p4', 'p5']);
    expect(studioReducer(fixed, A.fixSpreads())).toBe(fixed);
    expect(studioReducer(fixed, A.undo()).doc).toBe(state.doc);
  });
});
