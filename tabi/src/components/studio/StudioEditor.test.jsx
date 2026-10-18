import { useRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { MemoryRouter } from 'react-router-dom';
import { BrochureProvider } from '../../context/BrochureContext.jsx';
import { ToastProvider } from '../../context/ToastContext.jsx';
import { serializeBrochure } from './brochureIO.js';
import { pageHeading } from '../brochure/blocks/pageUtils.js';
import { IconPicker } from './fields/IconPicker.jsx';
import { ListEditor } from './fields/ListEditor.jsx';
import { NumberField } from './fields/NumberField.jsx';
import { PagesPanel } from './PagesPanel.jsx';
import { StudioEditor } from './StudioEditor.jsx';
import { DRAFT_KEY, readDraft } from './draftStore.js';
import { createBlank, createFromTemplate } from './templates.js';
import { useAutosave, useStudio } from './useStudio.js';

// Canvas is not drawn in jsdom: the upload's downscale returns a ready JPEG.
vi.mock('./photoUpload.js', async (importOriginal) => ({
  ...(await importOriginal()),
  downscaleImage: vi.fn(async () => ({ src: 'data:image/jpeg;base64,QUJD', width: 1600, height: 1067, size: 27, quality: 0.82 })),
}));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});

function renderEditor(doc = createBlank()) {
  return render(
    <MemoryRouter initialEntries={['/studio?draft=1']}>
      <ToastProvider>
        <BrochureProvider>
          <StudioEditor mode="new" initial={{ doc, selectedId: doc.pages[0].id, savedAt: 0 }} storageKey="studio-draft" />
        </BrochureProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const undoKey = (target) => fireEvent.keyDown(target, { key: 'z', code: 'KeyZ', ctrlKey: true });
// Lets presence animations (the save indicator's label swap) finish inside act().
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

describe('<StudioEditor>', () => {
  it('lands focus on its heading when opened from the start screen (regression)', () => {
    document.body.focus();
    renderEditor(createFromTemplate('food-crawl'));
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveFocus();
    expect(heading).toHaveTextContent('Studio: designing “Osaka: A Food Crawl”');
  });

  it('says how long ago restored changes were made', () => {
    const doc = { ...createBlank(), id: 'b_mine', source: 'user' };
    render(
      <MemoryRouter initialEntries={['/studio/b_mine']}>
        <ToastProvider>
          <BrochureProvider>
            <StudioEditor
              mode="edit"
              initial={{ doc: { ...doc, title: 'Changed' }, selectedId: null, savedAt: Date.now() - 5 * 60_000 }}
              baseline={doc}
              storageKey="studio-edit:b_mine"
              restored
            />
          </BrochureProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Restored the unsaved changes you made 5 min ago\./)).toBeInTheDocument();
  });

  it('undoes a whole burst of typing in a field with ⌘Z (regression)', async () => {
    renderEditor();
    const title = screen.getByLabelText('Brochure title');
    const original = title.value;
    for (const suffix of [' X', ' XY', ' XYZ']) fireEvent.change(title, { target: { value: original + suffix } });
    expect(title).toHaveValue(`${original} XYZ`);
    undoKey(title);
    expect(title).toHaveValue(original);
    fireEvent.keyDown(title, { key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: true });
    expect(title).toHaveValue(`${original} XYZ`);
    await settle();
  });

  it('“Undo import” restores the document from before the import, even after more edits (regression)', async () => {
    const { container } = renderEditor();
    const title = screen.getByLabelText('Brochure title');
    const original = title.value;
    const incoming = { ...createFromTemplate('temple-trail'), title: 'Imported trail' };
    const file = new File([serializeBrochure(incoming)], 'trail.tabi.json', { type: 'application/json' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
    await waitFor(() => expect(title).toHaveValue('Imported trail'));
    fireEvent.change(title, { target: { value: 'Imported trail, edited' } });
    fireEvent.click(screen.getByRole('button', { name: 'Undo import' }));
    expect(title).toHaveValue(original);
    await settle();
  });
});

describe('<StudioEditor> real-place editing', () => {
  // Warm the photo picker's lazy chunk so a busy test run doesn't time out on it.
  beforeAll(async () => {
    await import('./fields/PhotoPicker.jsx');
  });
  const slow = { timeout: 5000 };
  const openPage = (name) => fireEvent.click(screen.getAllByRole('button', { name: new RegExp(name) }).find((b) => b.dataset.action === 'open'));

  it('fills a place’s coordinates from a pasted pair, with no map', async () => {
    renderEditor(createFromTemplate('food-crawl'));
    openPage('Kuromon Market');
    const lat = await screen.findByLabelText('Latitude', {}, slow);
    fireEvent.paste(lat, { clipboardData: { getData: () => '34.6687, 135.5013' } });
    expect(lat).toHaveValue('34.6687');
    expect(screen.getByLabelText('Longitude')).toHaveValue('135.5013');
    expect(await screen.findByText('34.6687° N, 135.5013° E', {}, slow)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /map/i })).toBeNull();
    await settle();
  }, 15_000);

  it('uploads a photo into a page in one undoable step', async () => {
    renderEditor(createFromTemplate('food-crawl'));
    openPage('Come hungry');
    fireEvent.click(await screen.findByRole('button', { name: 'Choose photo' }, slow));
    const dialog = await screen.findByRole('dialog', { name: 'Choose a photo' }, slow);
    fireEvent.click(within(dialog).getByRole('tab', { name: /Your photos/ }));
    const file = new File(['jpeg-bytes'], 'kuromon-market-stalls.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(within(dialog).getByLabelText(/Drop a photo here/), { target: { files: [file] } });
    });
    // A descriptive file name suggests the alt text; the person can change it.
    const alt = await within(dialog).findByLabelText(/Describe the photo/, {}, slow);
    expect(alt).toHaveValue('Kuromon market stalls');
    fireEvent.change(alt, { target: { value: 'Seafood stalls under a covered market roof' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Add to brochure/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Choose a photo' })).not.toBeInTheDocument(), slow);
    expect(screen.getByText('Seafood stalls under a covered market roof')).toBeInTheDocument();
    const draft = await waitFor(() => {
      const value = readDraft(DRAFT_KEY);
      expect(Object.keys(value?.doc.userPhotos ?? {})).toHaveLength(1);
      return value;
    }, slow);
    const [key] = Object.keys(draft.doc.userPhotos);
    expect(draft.doc.pages[1].photo).toBe(`user:${key}`);
    expect(draft.doc.userPhotos[key].credit).toEqual({ author: 'Your photo', license: '' });
    // One undo takes back both the upload and its placement.
    fireEvent.keyDown(document.body, { key: 'z', code: 'KeyZ', ctrlKey: true });
    expect(screen.queryByText('Seafood stalls under a covered market roof')).not.toBeInTheDocument();
    await settle();
  }, 15_000);

  it('marks the facts as checked this month from the Details panel', async () => {
    renderEditor(createFromTemplate('temple-trail'));
    fireEvent.click(screen.getByRole('tab', { name: /Details/ }));
    const button = await screen.findByRole('button', { name: /^Mark / });
    fireEvent.click(button);
    expect(screen.getByLabelText(/Checked in/)).toHaveValue(new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date()));
    await settle();
  });
});

describe('<ListEditor>', () => {
  const limit = { min: 1, max: 6 };
  const renderList = (items, onAdd = () => {}) => (
    <ListEditor
      title="Stops"
      noun="stop"
      items={items}
      limit={limit}
      onAdd={onAdd}
      onRemove={() => {}}
      onMove={() => {}}
      itemTitle={(item) => item}
      renderItem={(item) => <span>{item}</span>}
    />
  );
  const rowOpacity = (container, index) => container.querySelector(`[data-item="${index}"]`).style.opacity;

  it('plays the entrance only on a row that was just added, not one restored by undo (regression)', () => {
    MotionGlobalConfig.skipAnimations = false;
    try {
      const { container, rerender } = render(renderList(['a', 'b', 'c']));
      rerender(renderList(['a', 'c']));
      rerender(renderList(['a', 'b', 'c'])); // undo brings row 3 back
      expect(rowOpacity(container, 2)).not.toBe('0');
      fireEvent.click(screen.getByRole('button', { name: 'Add stop' }));
      rerender(renderList(['a', 'b', 'c', 'd']));
      expect(rowOpacity(container, 3)).toBe('0');
    } finally {
      MotionGlobalConfig.skipAnimations = true;
    }
  });
});

describe('useAutosave', () => {
  function Saver({ draft }) {
    useAutosave('studio-draft', draft, { delay: 60_000 });
    return null;
  }

  it('flushes pending work when the tab is hidden (regression)', () => {
    const first = { doc: { id: 'b_1', title: 'One', pages: [{ id: 'p', type: 'cover' }] }, selectedId: 'p' };
    const second = { ...first, doc: { ...first.doc, title: 'Two' } };
    const { rerender } = render(<Saver draft={first} />);
    rerender(<Saver draft={second} />);
    expect(readDraft(DRAFT_KEY)).toBeNull();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    try {
      fireEvent(document, new Event('visibilitychange'));
    } finally {
      visibility.mockRestore();
    }
    expect(readDraft(DRAFT_KEY)?.doc.title).toBe('Two');
  });
});

function PanelHarness({ doc, compact = false }) {
  const [state, dispatch] = useStudio(doc, doc.pages[0].id);
  return (
    <ToastProvider>
      <PagesPanel brochure={state.doc} selectedId={state.selectedId} dispatch={dispatch} onOpenPage={() => {}} compact={compact} />
    </ToastProvider>
  );
}

describe('<PagesPanel>', () => {
  const doc = createFromTemplate('food-crawl');
  const second = doc.pages[1];
  const heading = (page) => pageHeading(page, doc);

  it('keeps focus on the moved page, on the arrow that still works (regression)', async () => {
    render(<PanelHarness doc={doc} />);
    const up = screen.getByRole('button', { name: `Move “${heading(second)}” up` });
    act(() => up.focus());
    fireEvent.click(up);
    await waitFor(() => expect(screen.getByRole('button', { name: `Move “${heading(second)}” down` })).toHaveFocus());
    expect(screen.getByRole('button', { name: `Move “${heading(second)}” up` })).toBeDisabled();
  });

  it('moves focus to a neighbour after a delete and says how to undo (regression)', async () => {
    const fine = vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: query === '(pointer: fine)', media: query, addEventListener() {}, removeEventListener() {} }));
    render(<PanelHarness doc={doc} />);
    fireEvent.click(screen.getByRole('button', { name: `Delete “${heading(second)}”` }));
    const neighbour = doc.pages[2];
    await waitFor(() => expect(document.activeElement).toHaveTextContent(heading(neighbour)));
    expect(document.activeElement.closest('[data-page-id]').dataset.pageId).toBe(neighbour.id);
    // The toast's announcer is what a screen reader hears.
    expect(screen.getByRole('status')).toHaveTextContent(/was removed\. Ctrl Z undoes it\./);
    fine.mockRestore();
  });

  it('keeps only the selected row’s actions in the Tab order when compact', () => {
    render(<PanelHarness doc={doc} compact />);
    const firstRow = screen.getByRole('button', { name: `Duplicate “${heading(doc.pages[0])}”` });
    const otherRow = screen.getByRole('button', { name: `Duplicate “${heading(second)}”` });
    expect(firstRow).not.toHaveAttribute('tabindex');
    expect(otherRow).toHaveAttribute('tabindex', '-1');
  });
});

describe('<NumberField>', () => {
  function Harness({ onCommit }) {
    const [value, setValue] = useState(47);
    return (
      <>
        <NumberField
          label="Number"
          value={value}
          onChange={(next) => {
            onCommit(next);
            setValue(next);
          }}
        />
        <button type="button" onClick={() => setValue(3776)}>
          Undo
        </button>
      </>
    );
  }

  it('keeps “0.0” while typing 0.05, and follows outside changes (regression)', () => {
    const commits = [];
    render(<Harness onCommit={(n) => commits.push(n)} />);
    const input = screen.getByLabelText('Number');
    for (const text of ['0', '0.0', '0.05']) fireEvent.change(input, { target: { value: text } });
    expect(input).toHaveValue(0.05);
    expect(input.value).toBe('0.05');
    expect(commits).toEqual([0, 0, 0.05]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(input.value).toBe('3776');
    // Past the limit the field shows the clamped figure instead of piling up digits.
    fireEvent.change(input, { target: { value: '99999999999999999999' } });
    expect(input.value).toBe('1000000000000');
    expect(commits.at(-1)).toBe(1e12);
  });
});

describe('Studio popovers', () => {
  function Harness() {
    const [icon, setIcon] = useState('Landmark');
    const after = useRef(null);
    return (
      <>
        <IconPicker value={icon} onChange={setIcon} label="Highlight icon" />
        <input ref={after} aria-label="Title" />
      </>
    );
  }

  it('Tab past the end closes the picker and continues after its trigger (regression)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Highlight icon: .*Change/ }));
    const search = await screen.findByRole('searchbox', { name: 'Search icons' });
    fireEvent.change(search, { target: { value: 'temple' } });
    const option = screen.getAllByRole('option').find((el) => el.tabIndex === 0);
    act(() => option.focus());
    fireEvent.keyDown(option, { key: 'Tab' });
    expect(screen.getByLabelText('Title')).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Shift+Tab before the start returns to the trigger', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: /Highlight icon: .*Change/ });
    fireEvent.click(trigger);
    const search = await screen.findByRole('searchbox', { name: 'Search icons' });
    act(() => search.focus());
    fireEvent.keyDown(search, { key: 'Tab', shiftKey: true });
    expect(trigger).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('<PagesPanel> double-page photo spreads', () => {
  const base = createFromTemplate('food-crawl');
  const rows = (container) => [...container.querySelectorAll('[data-page-id]')];
  const spans = (container) => rows(container).map((row) => row.querySelector('[data-action="open"]').textContent.match(/Spread, (left|right) half/)?.[1] ?? '-');

  it('adds a spread on facing pages from the Add page menu, in one step', async () => {
    const { container } = render(<PanelHarness doc={base} />);
    // The cover is selected: the spread goes on pages 2–3, never between the cover and page 2's partner.
    fireEvent.click(screen.getByRole('button', { name: 'Add page' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Double-page spread/ }));
    await waitFor(() => expect(spans(container).slice(0, 4)).toEqual(['-', 'left', 'right', '-']));
    expect(screen.queryByText(/out of place/)).toBeNull();
    // A single photo page added on the left half goes after the pair, then the arrows move the pair together.
    fireEvent.click(screen.getByRole('button', { name: 'Add page' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Photo page/ }));
    await waitFor(() => expect(rows(container)).toHaveLength(base.pages.length + 3));
  });

  it('warns when a spread is out of place, and lines it up', async () => {
    const [cover, ...rest] = base.pages;
    const left = { id: 'sl', type: 'photo', span: 'left', photo: 'kyoto-spread' };
    const right = { id: 'sr', type: 'photo', span: 'right', photo: 'kyoto-spread', name: 'Kiyomizu-dera' };
    // Pages 3–4: the left half is on a right-hand page.
    const doc = { ...base, pages: [cover, rest[0], left, right, ...rest.slice(1)] };
    const { container } = render(<PanelHarness doc={doc} />);
    expect(screen.getByText(/A photo spread is out of place\./)).toBeInTheDocument();
    expect(rows(container).filter((row) => row.dataset.warning)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Line up' }));
    await waitFor(() => expect(screen.queryByText(/out of place/)).toBeNull());
    const index = rows(container).findIndex((row) => row.dataset.pageId === 'sl');
    expect(index % 2).toBe(1);
    expect(rows(container)[index + 1].dataset.pageId).toBe('sr');
  });

  it('moves both halves with the arrows, a spread at a time', async () => {
    const [cover, ...rest] = base.pages;
    const left = { id: 'sl', type: 'photo', span: 'left', photo: 'kyoto-spread' };
    const right = { id: 'sr', type: 'photo', span: 'right', photo: 'kyoto-spread', name: 'Kiyomizu-dera' };
    const doc = { ...base, pages: [cover, rest[0], rest[1], left, right, ...rest.slice(2)] };
    const { container } = render(<PanelHarness doc={doc} />);
    fireEvent.click(screen.getByRole('button', { name: 'Move the spread “Kiyomizu-dera” up' }));
    await waitFor(() => expect(spans(container).slice(0, 3)).toEqual(['-', 'left', 'right']));
    expect(screen.getByRole('button', { name: 'Move the spread “Kiyomizu-dera” up' })).toBeDisabled();
    expect(screen.queryByText(/out of place/)).toBeNull();
  });
});

describe('<StudioEditor> photo page editor', () => {
  it('explains a spread half, warns when it is out of place and lines it up', async () => {
    const base = createFromTemplate('food-crawl');
    const [cover, ...rest] = base.pages;
    const left = { id: 'sl', type: 'photo', span: 'left', photo: 'kyoto-spread', captionPlacement: 'overlay', creditPlacement: 'caption' };
    const right = { id: 'sr', type: 'photo', span: 'right', photo: 'kyoto-spread', name: 'Kiyomizu-dera', caption: 'The city', captionPlacement: 'overlay', creditPlacement: 'caption' };
    const doc = { ...base, pages: [cover, rest[0], left, right, ...rest.slice(1)] };
    render(
      <MemoryRouter initialEntries={['/studio?draft=1']}>
        <ToastProvider>
          <BrochureProvider>
            <StudioEditor mode="new" initial={{ doc, selectedId: 'sr', savedAt: 0 }} storageKey="studio-draft" />
          </BrochureProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    // The page list warns first; opening the half shows the editor's own warning.
    expect(screen.getByText(/A photo spread is out of place\./)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Kiyomizu-dera/ }).find((button) => button.dataset.action === 'open'));
    expect(await screen.findByText(/Until then it reads as a page of its own\./)).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Caption' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Up the edge/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Line up spreads' }));
    await waitFor(() => expect(screen.getByText(/The right half of a double-page spread on pages 4–5/)).toBeInTheDocument());
    // Layout choices apply to both halves.
    fireEvent.click(screen.getByRole('radio', { name: /Under it/ }));
    await settle();
    const saved = () => readDraft(DRAFT_KEY)?.doc;
    await waitFor(() => expect(saved()?.pages.filter((p) => p.span).map((p) => p.captionPlacement)).toEqual(['below', 'below']), { timeout: 4000 });
  });
});
