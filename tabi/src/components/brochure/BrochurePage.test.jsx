import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BROCHURES } from '../../data/brochures.js';
import { PAGE_TYPE_IDS } from '../../data/schema.js';
import { BrochurePage } from './BrochurePage.jsx';
import { CoverArt } from './CoverArt.jsx';

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
const kyoto = BROCHURES.find((b) => b.slug === 'kyoto-thousand-gates');
// Page fixtures, so these tests do not depend on the (researched, changing) built-in copy.
const STATS = {
  id: 's',
  type: 'stats',
  heading: 'By the numbers',
  body: 'Kyoto in figures.',
  items: [
    { value: 1074, prefix: '', suffix: '', label: 'years as the imperial capital' },
    { value: 1600, prefix: '~', suffix: '', label: 'temples' },
  ],
};
const CONTACT = {
  id: 'c',
  type: 'contact',
  heading: 'Visitor information',
  body: 'Official sources.',
  cta: 'Request an itinerary',
  details: [
    { icon: 'Globe', label: 'Kyoto City', value: 'kyoto.travel', url: 'https://kyoto.travel/en/' },
    { icon: 'MapPin', label: 'Tourist information', value: 'Kyoto Station, 2F' },
    { icon: 'Mail', label: 'Email', value: 'hello@studio.example' },
  ],
};

describe('<BrochurePage>', () => {
  it.each(BROCHURES.map((b) => [b.slug, b]))('renders every page of %s, live and static', (_slug, brochure) => {
    brochure.pages.forEach((page, i) => {
      const total = brochure.pages.length;
      const { container, unmount } = render(<BrochurePage brochure={brochure} page={page} index={i} total={total} active={i === 0} onCta={() => {}} />);
      const article = container.querySelector('article');
      expect(article).toHaveAttribute('aria-label', expect.stringMatching(new RegExp(`^Page ${i + 1} of ${total}: .+`)));
      expect(article).toHaveAttribute('data-type', page.type);
      expect(container.querySelector('h2')).not.toBeNull();
      unmount();

      const still = render(<BrochurePage brochure={brochure} page={page} index={i} total={total} isStatic />);
      expect(still.container.querySelectorAll(FOCUSABLE)).toHaveLength(0);
      still.unmount();
    });
  });

  it.each(PAGE_TYPE_IDS)('survives a "%s" page with empty fields', (type) => {
    expect(() => render(<BrochurePage brochure={{}} page={{ id: 'x', type }} index={0} total={1} active />)).not.toThrow();
    expect(() => render(<BrochurePage brochure={{ theme: { paper: 'nope' } }} page={{ id: 'y', type, items: [null, {}], plans: 'x', details: [{}] }} isStatic />)).not.toThrow();
  });

  it('renders a quiet fallback for unknown page types and missing pages', () => {
    render(<BrochurePage brochure={kyoto} page={{ id: 'z', type: 'hologram', heading: 'Future page' }} index={2} total={3} />);
    expect(screen.getByRole('article', { name: 'Page 3 of 3: Future page' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Future page' })).toBeInTheDocument();
    expect(() => render(<BrochurePage brochure={null} page={undefined} />)).not.toThrow();
  });

  it('applies the brochure theme as CSS variables', () => {
    const { container } = render(<BrochurePage brochure={kyoto} page={kyoto.pages[1]} index={1} total={11} isStatic />);
    const article = container.querySelector('article');
    expect(article.style.getPropertyValue('--b-paper')).toBe(kyoto.theme.paper);
    expect(article.style.getPropertyValue('--b-font')).toBe('var(--font-display)');
  });

  it('calls onCta from the contact page button', async () => {
    const onCta = vi.fn();
    render(<BrochurePage brochure={kyoto} page={CONTACT} index={9} total={11} active onCta={onCta} />);
    await userEvent.click(screen.getByRole('button', { name: /request an itinerary/i }));
    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it('links the contact call to action and details to their official sites (http(s) only, new tab)', () => {
    const onCta = vi.fn();
    const contact = {
      id: 'c',
      type: 'contact',
      heading: 'Visitor information',
      cta: 'Kyoto City official travel guide',
      ctaUrl: 'https://kyoto.travel/en/',
      details: [
        { icon: 'Globe', label: 'Shrine', value: 'inari.jp', url: 'https://inari.jp/en/' },
        { icon: 'Globe', label: 'Bad', value: 'click me', url: 'javascript:alert(1)' },
      ],
    };
    render(<BrochurePage brochure={kyoto} page={contact} index={9} total={11} active onCta={onCta} />);
    const cta = screen.getByRole('link', { name: /Kyoto City official travel guide/ });
    expect(cta).toHaveAttribute('href', 'https://kyoto.travel/en/');
    expect(cta).toHaveAttribute('target', '_blank');
    expect(cta).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: /inari\.jp/ })).toHaveAttribute('href', 'https://inari.jp/en/');
    expect(screen.queryByRole('link', { name: /click me/ })).toBeNull();
    expect(screen.getByText('click me')).toBeInTheDocument();
  });

  it('marks Japanese text with lang="ja" and lists phrases as a list', () => {
    const phrases = kyoto.pages.find((p) => p.type === 'phrases');
    const { container } = render(<BrochurePage brochure={kyoto} page={phrases} index={6} total={11} isStatic />);
    expect(screen.getAllByRole('listitem')).toHaveLength(phrases.items.length);
    expect(container.querySelector('li p[lang="ja"]')).toHaveTextContent(phrases.items[0].jp);
  });

  it('shows final figures on static stats pages, with the prefix as a small affix', () => {
    render(<BrochurePage brochure={kyoto} page={STATS} index={5} total={11} isStatic />);
    expect(screen.getByText('1,074')).toBeInTheDocument();
    const figure = screen.getByText('1,600');
    expect(figure).toHaveTextContent('~1,600');
    expect(screen.getByText('~').parentElement).toBe(figure);
  });

  it('keeps the whole figure, prefix included, in the text of a live counter', () => {
    const { container } = render(<BrochurePage brochure={kyoto} page={STATS} index={5} total={11} active />);
    expect(container.textContent).toContain('~1,600');
  });

  it('builds a valid definition list on the contact page', () => {
    const { container } = render(<BrochurePage brochure={kyoto} page={CONTACT} index={9} total={11} isStatic />);
    const groups = container.querySelectorAll('dl > div');
    expect(groups).toHaveLength(CONTACT.details.length);
    for (const group of groups) expect([...group.children].map((el) => el.tagName)).toEqual(['DT', 'DD']);
  });

  it('never dresses a call to action as a button when it cannot do anything', () => {
    const page = { ...CONTACT, ctaUrl: '' };
    const still = render(<BrochurePage brochure={kyoto} page={page} index={9} total={11} isStatic />);
    expect(still.getByText('Request an itinerary').tagName).toBe('P');
    still.unmount();
    // Live without a handler: plain text too.
    render(<BrochurePage brochure={kyoto} page={page} index={9} total={11} active />);
    expect(screen.queryByRole('button', { name: /request an itinerary/i })).toBeNull();
    expect(screen.getByText('Request an itinerary')).toBeInTheDocument();
  });

  it('survives Object.prototype names as page types and icon names (regression)', () => {
    const features = { id: 'f', type: 'features', heading: 'Hi', items: [{ icon: 'constructor', title: 'A' }, { icon: '__proto__', title: 'B' }] };
    expect(() => render(<BrochurePage brochure={kyoto} page={features} index={2} total={3} active />)).not.toThrow();
    render(<BrochurePage brochure={kyoto} page={{ id: 'c', type: 'constructor', heading: 'Odd page' }} index={1} total={3} />);
    expect(screen.getByRole('heading', { name: 'Odd page' })).toBeInTheDocument();
  });
});

describe('real-place pages', () => {
  const place = {
    id: 'pl',
    type: 'place',
    kicker: 'Spotlight',
    name: 'Kiyomizu-dera',
    nameJp: '清水寺',
    photo: 'not-downloaded-yet',
    body: 'A wooden stage on 139 pillars.\n\nGo at opening time.',
    facts: [
      { label: 'Hours', value: '6:00–18:00' },
      { label: 'Admission', value: '¥500' },
    ],
    lat: 34.9949,
    lng: 135.785,
    website: 'https://www.kiyomizudera.or.jp/en/',
  };

  it('renders a place page: name, Japanese name, facts, website and position', () => {
    const { container } = render(<BrochurePage brochure={kyoto} page={place} index={3} total={12} active />);
    expect(screen.getByRole('article', { name: 'Page 4 of 12: Kiyomizu-dera' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Kiyomizu-dera/ })).toBeInTheDocument();
    expect(container.querySelector('h2 [lang="ja"]')).toHaveTextContent('清水寺');
    const groups = container.querySelectorAll('dl > div');
    expect(groups).toHaveLength(2);
    expect([...groups[0].children].map((el) => el.tagName)).toEqual(['DT', 'DD']);
    const site = screen.getByRole('link', { name: /kiyomizudera\.or\.jp/ });
    expect(site).toHaveAttribute('href', 'https://www.kiyomizudera.or.jp/en/');
    expect(site).toHaveAttribute('target', '_blank');
    expect(site).toHaveAttribute('rel', 'noopener noreferrer');
    expect(container.textContent).toContain('34.9949° N · 135.7850° E');
    // The photo is not downloaded: the brochure's art stands in.
    expect(container.querySelector('[data-state="fallback"] svg')).not.toBeNull();
  });

  it('keeps a static place page free of links and focusable things', () => {
    const { container } = render(<BrochurePage brochure={kyoto} page={{ ...place, website: 'javascript:alert(1)' }} index={3} total={12} isStatic />);
    expect(container.querySelectorAll(FOCUSABLE)).toHaveLength(0);
    expect(container.textContent).not.toContain('javascript');
  });

  it('draws an old map page (a retired type) as the quiet fallback, with no map', () => {
    const map = {
      id: 'm',
      type: 'map',
      heading: 'Where it all is',
      places: [{ name: 'Fushimi Inari Taisha', nameJp: '伏見稲荷大社', lat: 34.9671, lng: 135.7727 }],
    };
    const { container } = render(<BrochurePage brochure={kyoto} page={map} index={8} total={12} active />);
    expect(screen.getByRole('heading', { level: 2, name: 'Where it all is' })).toBeInTheDocument();
    expect(container.textContent).toContain('Tabi now shows photographs of the places instead');
    expect(screen.queryByRole('img', { name: /map/i })).toBeNull();
    expect(container.querySelector('[data-region], [data-pin]')).toBeNull();
  });

  it('sets the original Japanese of a quote vertically and the translation as verse lines', () => {
    const quote = { id: 'q', type: 'quote', quote: 'The old pond — / a frog jumps in, / the sound of water.', quoteJp: '古池や蛙飛び込む水の音', author: 'Matsuo Bashō', role: 'Translation: Tabi Guides' };
    const { container } = render(<BrochurePage brochure={kyoto} page={quote} index={10} total={12} isStatic />);
    expect(screen.getByRole('article', { name: 'Page 11 of 12: Quote from Matsuo Bashō' })).toBeInTheDocument();
    expect(container.querySelector('figure p[lang="ja"]')).toHaveTextContent('古池や蛙飛び込む水の音');
    const lines = [...container.querySelectorAll('blockquote p > span')].map((el) => el.textContent);
    expect(lines).toEqual(['The old pond —', 'a frog jumps in,', 'the sound of water.']);
    // A tanka breaks into columns where the poem breaks.
    const tanka = render(<BrochurePage brochure={kyoto} page={{ ...quote, quoteJp: '浅草の夜のにぎはひに　まぎれ入り　まぎれ出で来しさびしき心' }} index={10} total={12} isStatic />);
    expect(tanka.container.querySelectorAll('p[lang="ja"] > span')).toHaveLength(3);
  });

  it('shows a brochure’s own uploaded photo ("user:<key>") through the page’s photo context', () => {
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const mine = {
      ...kyoto,
      source: 'user',
      userPhotos: { gate: { src: PNG, alt: 'My own photo of the gate', width: 800, height: 600, credit: { author: 'Aiko', license: 'CC BY 4.0' } } },
    };
    const page = { ...place, photo: 'user:gate' };
    const { container } = render(<BrochurePage brochure={mine} page={page} index={3} total={12} isStatic />);
    expect(screen.getByRole('img', { name: 'My own photo of the gate' })).toHaveAttribute('src', PNG);
    expect(container.textContent).toContain('Photo: Aiko · CC BY 4.0');
    // The back page credits it in the colophon.
    const back = render(<BrochurePage brochure={{ ...mine, pages: [...mine.pages, page] }} page={kyoto.pages.at(-1)} index={13} total={14} active />);
    expect(back.container.textContent).toContain('Photo credits');
    expect(back.container.textContent).toContain('Aiko · CC BY 4.0');
  });

  it('prints when the facts were checked, and against how many sources, in the colophon', () => {
    const { container } = render(<BrochurePage brochure={kyoto} page={kyoto.pages.at(-1)} index={13} total={14} isStatic />);
    expect(container.textContent).toContain(`${kyoto.factsChecked} · ${kyoto.sources.length} sources`);
  });

  it('draws the cover photo slot with the art as its fallback', () => {
    const brochure = { ...kyoto, cover: { ...kyoto.cover, photo: 'not-downloaded-yet' } };
    const { container } = render(<BrochurePage brochure={brochure} page={brochure.pages[0]} index={0} total={12} isStatic />);
    expect(container.querySelector('[data-state="fallback"] svg[data-art]')).not.toBeNull();
    expect(container.querySelectorAll(FOCUSABLE)).toHaveLength(0);
  });

  it.each(['place', 'map'])('survives a "%s" page full of junk', (type) => {
    const junk = { id: 'j', type, name: {}, nameJp: [], photo: 5, facts: 'x', places: [null, { lat: 'a' }, 7], lat: 'north', website: 42, body: null };
    expect(() => render(<BrochurePage brochure={kyoto} page={junk} index={0} total={1} active />)).not.toThrow();
    expect(() => render(<BrochurePage brochure={{}} page={junk} isStatic />)).not.toThrow();
  });
});

describe('<BrochurePage> photo pages and double-page spreads', () => {
  const theme = kyoto.theme;
  const LEFT = { id: 'sl', type: 'photo', span: 'left', photo: '', captionPlacement: 'overlay', creditPlacement: 'caption' };
  const RIGHT = { id: 'sr', type: 'photo', span: 'right', photo: '', name: 'Kiyomizu-dera', nameJp: '清水寺', caption: 'The city below the hill', captionPlacement: 'overlay', creditPlacement: 'caption' };
  const FULL = { id: 'fp', type: 'photo', photo: '', name: 'Arashiyama', nameJp: '竹林の小径', caption: 'Early morning', captionPlacement: 'below', creditPlacement: 'edge' };
  const book = { title: 'Kyoto', theme, cover: { art: 'torii', seed: 5 }, pages: [{ id: 'c', type: 'cover' }, LEFT, RIGHT, FULL, { id: 'b', type: 'back' }] };
  const draw = (index, props = {}) => render(<BrochurePage brochure={book} page={book.pages[index]} index={index} total={book.pages.length} isStatic {...props} />);
  const mode = (container) => container.querySelector('figure[data-mode]')?.dataset.mode;

  it('draws a full-page photo with its magazine caption and a heading', () => {
    const { container } = draw(3);
    expect(mode(container)).toBe('full');
    expect(container.querySelector('figure')).toHaveAttribute('data-placement', 'below');
    expect(container.querySelector('figcaption')).toHaveTextContent('Arashiyama竹林の小径Early morning');
    expect(screen.getByRole('heading', { level: 2, name: 'Arashiyama' })).toBeInTheDocument();
    expect(container.querySelector('article')).not.toHaveAttribute('data-spread-half');
  });

  it('draws each half of a placed spread as its half of one picture when facing', () => {
    const left = draw(1, { facing: true });
    expect(left.container.querySelector('article')).toHaveAttribute('data-spread-half', 'left');
    expect(mode(left.container)).toBe('half');
    // The caption is printed on the right half only; both halves share the art across the gutter.
    expect(left.container.querySelector('figcaption')).toBeNull();
    const leftArt = left.container.querySelector('svg[data-art]');
    left.unmount();
    const right = draw(2, { facing: true });
    expect(right.container.querySelector('article')).toHaveAttribute('data-spread-half', 'right');
    expect(right.container.querySelector('figcaption')).toHaveTextContent('Kiyomizu-dera清水寺The city below the hill');
    const rightArt = right.container.querySelector('svg[data-art]');
    expect(rightArt.dataset.seed).toBe(leftArt.dataset.seed);
    expect(right.container.querySelector('figure')).toHaveAttribute('data-span', 'right');
  });

  it('reads one page at a time: the left half with the caption, the right half as the whole view', () => {
    const left = draw(1);
    expect(mode(left.container)).toBe('full');
    expect(left.container.querySelector('figcaption')).toHaveTextContent('Kiyomizu-dera');
    expect(left.container).toHaveTextContent('Double-page spread · 1 / 2');
    left.unmount();
    const right = draw(2);
    expect(mode(right.container)).toBe('plate');
    expect(right.container).toHaveTextContent('the whole view');
  });

  it('draws a misplaced half as a page of its own, and takes the partner from the host', () => {
    const moved = { ...book, pages: [book.pages[0], { id: 'x', type: 'intro' }, LEFT, RIGHT, book.pages[4]] };
    const { container, unmount } = render(<BrochurePage brochure={moved} page={LEFT} index={2} total={5} isStatic facing />);
    expect(container.querySelector('article')).not.toHaveAttribute('data-spread-half');
    expect(mode(container)).toBe('full');
    unmount();
    // The Studio's shell has no pages: the host passes the other half.
    const shell = { title: 'Kyoto', theme, cover: book.cover };
    const withPartner = render(<BrochurePage brochure={shell} page={RIGHT} partner={LEFT} index={2} total={5} isStatic facing />);
    expect(withPartner.container.querySelector('article')).toHaveAttribute('data-spread-half', 'right');
  });

  it('survives junk in a photo page', () => {
    const junk = { id: 'j', type: 'photo', span: 'sideways', photo: 7, name: {}, caption: [], captionPlacement: 'diagonal', creditPlacement: 9 };
    expect(() => render(<BrochurePage brochure={book} page={junk} index={1} total={2} active facing />)).not.toThrow();
    expect(() => render(<BrochurePage brochure={{}} page={{ id: 'k', type: 'photo', span: 'left' }} isStatic facing />)).not.toThrow();
  });
});

describe('<CoverArt>', () => {
  it('is decorative by default and an image when titled', () => {
    const { container, rerender } = render(<CoverArt style="seigaiha" seed={7} theme={kyoto.theme} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    rerender(<CoverArt style="seigaiha" seed={7} theme={kyoto.theme} title="Waves at dawn" />);
    expect(screen.getByRole('img', { name: 'Waves at dawn' })).toBeInTheDocument();
  });

  it('draws identical art for identical props and namespaces ids per instance', () => {
    const { container } = render(
      <>
        <CoverArt style="fuji" seed={3} theme={kyoto.theme} />
        <CoverArt style="fuji" seed={3} theme={kyoto.theme} />
      </>,
    );
    const [a, b] = container.querySelectorAll('svg');
    const strip = (svg) => svg.innerHTML.replace(/art[^"#)\s]*?-/g, 'ID-');
    expect(strip(a)).toBe(strip(b));
    const ids = [...container.querySelectorAll('[id]')].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
