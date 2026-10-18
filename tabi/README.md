# Tabi 旅 — Japan, folded into pages

**Tabi** (旅, "journey") is an online brochure system about Japan. Visitors
browse a library of interactive travel brochures (Kyoto, Tokyo, Hokkaidō,
Okinawa, Osaka, Hakone, Naoshima, Hiroshima, Tōhoku, the Japan Alps, Nara,
Mount Fuji), read them in a flipbook with real 3D page-turns, and design their
own Japan brochure in the Studio. The built-in brochures describe **real
places**: every fact is checked against official sources (logged in
`docs/research/`), every photograph is a credited, free-licence picture from
Wikimedia Commons — the brochures show the places themselves, never a map. It is a static
single-page app: no server, no account. Everything a visitor makes is stored
in their own browser.

## Feature tour

| Route | What you get |
| --- | --- |
| `#/` **Home** | A 3D tri-fold hero of real photographs (Fuji, Fushimi Inari, Shibuya; credited) that unfolds and follows the pointer, a live Tokyo clock, a bilingual word marquee, a featured-brochure carousel, **Nostalgic Japan 懐かしい日本** — a magazine mosaic of real photographs of nostalgic places (old streets, wooden inns, quiet stations; from the Nostalgic Japan brochure, captioned and credited, linking to it), the four seasons with a photograph each (opening on the current season in Japan), the eight regions as a grid of real photographs (one per region, with its Japanese name and brochure count, each a link into the Library), "how it works" sketches, Japan in numbers, five classic haiku as postcards (original, romaji, our translation) and a Studio call to action. Facts are logged in `docs/research/home.md`. |
| `#/brochures` **Library** | Opens on a photograph of a nostalgic street (credited, with 旅のしおり on a paper slip). Search in English or Japanese (accent-, width- and kana-insensitive: `tohoku`, `ＫＹＯＴＯ` and `きょうと` all work; the places inside a brochure count too, so `Shirakawa-gō` or `伏見稲荷` find theirs), multi-season toggles, region, category, favourites, four sorts, and grid or list views. Every filter lives in the URL, so views are shareable and Back steps through them. Also shelves for your own brochures and recently viewed ones, where "Continue reading" reopens the page you left off on. |
| `#/brochures/:slug` **Viewer** | A flipbook with spreads on wide screens and single pages on phones, laid out like a magazine: every brochure has a full-page photograph and a double-page photo spread whose picture runs across the fold (on a phone, the spread's halves become the photo on its own page and the whole wide view): drag a corner, click or tap a page edge, swipe, or use ← → / PageUp / PageDown / Home / End. Also a scrubber with a thumbnail filmstrip that rises on hover or focus, an all-pages overview, zoom (100–400%) with pan, fullscreen, print to A4 (one page per sheet; the Print button and ⌘/Ctrl+P wait for the photographs before the print dialog opens), share/deep link (`?p=` is the page index), favourites, a private "Plan this trip" planner kept on your device (dates, travellers, interests, notes, copy as text, the official sites to check; nothing is sent), "About this brochure" with a full-bleed photograph, the fact-check date, numbered sources and every photo credit, and "More like this". |
| `#/credits` **Credits** | 奥付, under a photograph of a nostalgic street: every photograph's credit grouped by where it appears (author, licence, source, plus the photos still to come — live photos from Wikimedia Commons are looked up and credited here too), the "Load photos from Wikimedia Commons" switch, how the facts are checked with links to the standard and each brochure's research log, the typefaces and the rest. |
| `#/studio` **Studio** | Start from five Japan templates, a blank brochure or a remix of any library brochure (`?from=<slug>`). Edit every page with a live preview — real places with their coordinates (paste a pair or a link; checked to be in Japan), sources and a facts-checked date — choose real photos from the library or upload your own (resized in the browser, with alt text and credit), add full-page photos and double-page spreads (placed on facing pages, with a warning and a one-click "Line up" if a reorder pushes one out of place), change palette, colours (with contrast warnings and auto-fix), typeface and generative cover art, and reorder pages by drag or keyboard. Undo/redo, autosave, JSON import/export, then publish (a hanko stamp) to your shelf. `#/studio/:id` edits a published brochure. |
| **⌘K / Ctrl K** | The command palette searches brochures, the places inside them (opening the brochure at that page), seasons, library filters, the Credits page and actions from anywhere. |
| `#/anything-else` | A 404 page ("迷子 — maigo, lost") with a suggested brochure. |

Light ("washi") and dark ("sumi ink") themes follow the system and can be
toggled; the footer's Washi / Sumi / Auto switch goes back to following the
system, and the choice syncs across open tabs. All motion respects
`prefers-reduced-motion`. A page that fails to load shows a "This page tore"
screen with Reload, while the rest of the app keeps working.

## Tech stack

- **React 19** with **React Router 7** (hash routing, route-level code splitting)
- **framer-motion 12** for springs, gestures, layout and presence animations
- **lucide-react** icons (only a named registry of about 110 icons is bundled)
- **Vite 7**, plain CSS: design tokens in `src/styles/`, CSS Modules next to each component
- **Vitest** + Testing Library (jsdom) and **ESLint 9** with the React Hooks rules

## Getting started

Requires Node 20.19+ or 22.12+ (Vite 7).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npm run preview    # serve dist/ on http://localhost:4173
npm test           # vitest run (unit, component and route smoke tests)
npm run test:watch
npm run lint       # eslint .

npm run photos:fetch       # bundle + credit the brochure photos (otherwise they load live from Commons)
npm run photos:candidates  # contact sheets of every candidate, for curation
npm run photos:import      # add a photo you own or licensed (fallback)
```

`/playground.html` (dev server only, never built) is a workbench for the
brochure kit: every cover-art style, every page of every brochure at reader
and thumbnail size (on its own paper or dark paper), empty-field pages, theme
crops, `<Photo>` states (with a test card drawn at runtime,
also as an uploaded `user:` photo), the place, gallery (3 and 4 plates) and quote pages and a layout
audit that lists any clipped or cut-off text. Query parameters:
`section=art|reader|pages|audit|large|empty|photo|real`, `rb=<slug>|all`,
`w=340|460|640` (reader page width), `paper=dark`, `audit=1`, `style`,
`seeds=1,2,3`, `b=<slug>`, `crop=native|3:4|1:1`, `animate=1`.

## Project structure

```
index.html                 app shell, fonts, no-flash theme script
playground.html            dev-only kit workbench (src/dev/)
src/
  main.jsx                 providers: MotionConfig → Theme → Toast → Brochure
  App.jsx                  routes (lazy pages inside <AppShell>)
  styles/                  tokens.css (colour, type, space, motion, z-index), base.css
  lib/                     motion presets, cn, ids/slugs, storage, formatting
  hooks/                   useHotkey, useFocusTrap, useLockBodyScroll, useMediaQuery…
  context/                 ThemeContext, ToastContext, BrochureContext
  data/                    schema.js (the data contract), categories, regions, seasons
    brochures/             one module per built-in brochure (+ index.js: the order)
    catalog.js             what the app loads: light outlines + each brochure's pages on demand
    photos/                photo registry: manifest/<brochure>.json + photos.generated.json
  components/
    ui/                    design-system primitives (Button, IconButton, Modal/Drawer, Hanko…)
    layout/                AppShell, Navbar, Footer, command palette, route transition, search
    brochure/              CoverArt (generative art in art/), BrochurePage (+ blocks/), BrochureCard
    photo/                 <Photo>: responsive, credited photographs with an art fallback
    viewer/                Flipbook, reader toolbar, scrubber, thumbnails, overview, print, trip planner
    studio/                editor reducer, panels, fields, preview, publish checks, import/export
  pages/                   Home, Library, Viewer, Studio, Credits, NotFound (route components + sections)
  dev/                     the kit playground
  test/setup.js            jsdom polyfills for Vitest
scripts/
  photos/                  fetch.mjs, candidates.mjs, import-local.mjs (+ lib.mjs, process.mjs, io.mjs)
  build/brochure-outline.mjs  the Vite plugin that makes the brochure outlines
public/photos/             resized photos, <id>-<480|960|1600>.webp (written by the scripts)
docs/REAL_CONTENT.md       the standard for real places, facts and photos
docs/research/<slug>.md    each brochure's fact log (claim → value → sources → date checked)
```

[`ARCHITECTURE.md`](./ARCHITECTURE.md) has the conventions, routes, shared
APIs and layering rules.

## Design notes

**Direction: Japanese print culture meets a modern editorial magazine.** Warm
unbleached washi paper, heavy sumi ink, vermilion seals, a fixed film grain
over everything, hairline keylines, crop marks, folios and generous *ma* (間,
negative space).

**Palette: wa-iro (和色), traditional Japanese colours.** Defined once in
`src/styles/tokens.css`. Components use only tokens; brochure pages use each
brochure's own theme.

| Token | Colour | |
| --- | --- | --- |
| `--wa-shu` | 朱 *shu* | vermilion: torii, seals |
| `--wa-beni` | 紅 *beni* | crimson |
| `--wa-ai` / `--wa-kon` | 藍 *ai* / 紺 *kon* | indigo dye / deep navy |
| `--wa-sora` | 空 *sora* | sky |
| `--wa-sakura` | 桜 *sakura* | cherry blossom |
| `--wa-momiji` | 紅葉 *momiji* | autumn maple |
| `--wa-matcha` | 抹茶 *matcha* | green tea |
| `--wa-kin` / `--wa-yamabuki` | 金 *kin* / 山吹 *yamabuki* | gold leaf / golden yellow |
| `--wa-fuji` | 藤 *fuji* | wisteria |
| `--wa-sumi` / `--wa-kinari` | 墨 *sumi* / 生成 *kinari* | ink / unbleached washi |

The UI accent `--accent` is a deep *shu* that reaches 4.5:1 as text on the
paper. Dark mode swaps paper and ink and uses a brighter vermilion.

**Typography.** *Fraunces* for display (with optical size and its "soft"
and "wonky" axes) falls back to *Shippori Mincho* for kanji and kana. *Geist*
→ *Zen Kaku Gothic New* is the UI and body face, and *Geist Mono* is used for
eyebrows, folios and numbers. Japanese text is always marked `lang="ja"`,
uses proportional `palt` spacing, and sets vertically (縦書き) where it acts
as a motif. A tiny "Tabi Macrons" face (Fraunces' latin-ext subset, restricted
to ā ē ī ō ū) comes first in `--font-display` so romanised names like
*Tōhoku* keep their macrons on top of the letter.

**Motion.** Motion explains what changed and never blocks. Expo-out easing is
used for UI, springs for physical things (pages, magnets), staggered reveals
for text, and a vermilion-and-sumi curtain with a 旅 seal between routes.
Animations use `transform` and `opacity` only, idle cover-art motion pauses
off-screen, and `prefers-reduced-motion` turns everything into fades or
static states (the flipbook becomes a cross-fade).

**Accessibility.**
- Semantics: landmarks, one `h1` per route, labelled controls and visible focus rings.
- Focus: focus moves to `<main>` after every route change. Modals, drawers, the palette and the mobile menu trap and restore focus.
- Keyboard: every gesture has a key, and the palette is keyboard-first; the Home page's region photographs are plain links in reading order. The reader's keys switch off once it is scrolled out of view, so PageDown, Home and End scroll the rest of the page again.
- Zoom: brochure pages stop shrinking at a readable width (the stage scrolls instead), so 200% browser zoom makes their text larger, not smaller; the reader's own zoom goes to 400%.
- Live regions: result counts and the current page are announced through `aria-live`.
- Pausing: the Home hero's "Pause motion" button stops every looping animation on the page (marquee, petals, sketches, postcard autoplay) and is remembered; the OS reduced-motion setting turns them off outright.
- Static thumbnails are fully inert.
- Contrast: brochure themes are nudged to AA contrast automatically, so even user-made palettes stay legible.
- Layout: it works from 360px to 1920px+ with no horizontal scroll.

## Adding a brochure

Built-in brochures describe real places with verified facts and real,
credited photographs: follow [`docs/REAL_CONTENT.md`](./docs/REAL_CONTENT.md)
(sources, `factsChecked`, the 16–18 page outline with a full-page photo and a
double-page spread, photo manifests).

1. Research first: log every fact in `docs/research/<slug>.md` (the Credits
   page links that file by the brochure's slug) and list the photos in
   `src/data/photos/manifest/<slug>.json` (see "Real photos").
2. Add a module in `src/data/brochures/` and list it in
   `src/data/brochures/index.js`. The shape is documented in `src/data/schema.js`:

   ```js
   {
     id: 'b_kanazawa-gold-leaf',          // unique, stable
     slug: 'kanazawa-gold-leaf',          // URL: #/brochures/kanazawa-gold-leaf
     title: 'Kanazawa: Gold Leaf & Gardens',
     titleJp: '金沢',                     // set vertically on the cover and card
     subtitle: '…', summary: '…', tags: ['kanazawa', 'gardens'],
     category: 'craft',                   // id from data/categories.js
     region: 'chubu',                     // id from data/regions.js
     seasons: ['autumn', 'winter'],       // ids from data/seasons.js
     organization: 'Tabi Guides',         // the app's own editorial imprint
     location: { name: 'Kenroku-en', nameJp: '兼六園', prefecture: 'Ishikawa', lat: 36.5621, lng: 136.6627 },
     sources: [{ label: 'Kenroku-en official site', url: 'https://…' }],  // official sources first, verified
     factsChecked: 'October 2026',
     format: 'booklet',                   // booklet | bifold | trifold
     updatedAt: '2026-10-01T09:00:00.000Z',
     readMinutes: 5,
     featured: false,
     source: 'builtin',
     theme: { paper: '#f6f1e6', ink: '#1f1a14', accent: '#b8862b', accent2: '#1d4f7a', muted: '#6b5e4e', typeface: 'serif' },
     cover: { art: 'kumo', seed: 7, photo: 'kanazawa-kenrokuen' },  // art = fallback; photo = registry id
     pages: [
       { id: 'p1', type: 'cover', eyebrow: '…', title: '…', subtitle: '…' },
       { id: 'p2', type: 'intro', kicker: '…', heading: '…', body: 'Paragraph one.\n\nParagraph two.', pullQuote: '…' },
       // features · gallery · stats · agenda · pricing · phrases · quote · contact
       { id: 'p11', type: 'back', title: '…', body: '…', tagline: '…' },
     ],
   }
   ```

3. Page types and their fields: `cover, intro, features, gallery, place, photo,
   stats, agenda, pricing, phrases, quote, contact, back`.
   `PAGE_TYPES[type].create()` in `schema.js` returns a filled example of
   each. Start with a `cover`, end with a `back`. Icons are names from the
   registry in `src/components/ui/Icon.jsx`. Photos are ids from the photo
   registry (`photo: 'kanazawa-kenrokuen'`, see below).
4. Run `npm test`. `src/data/brochures.test.js` checks the schema, unique ids
   and slugs, 16–18 pages with the cover first and the back last, every
   double-page photo spread on facing pages (`data/photoSpreadEdits.js`), icon names
   and palette contrast (ink ≥ 7:1, muted ≥ 4.5:1, accent ≥ 3:1 on the paper),
   and the real-content rules: published by Tabi Guides, a main `location`
   with Japanese name and coordinates in Japan, at least two `https` sources,
   place coordinates inside Japan, no (retired) map pages, `https` official websites, no e-mail
   addresses or phone numbers on Visitor information, `factsChecked` set
   whenever the back page claims it, and every photo id present in a manifest.
   `scripts/build/brochure-outline.test.mjs` checks the brochure still
   outlines (keep the file a plain `export default { … }` literal).
5. Look at it in `/playground.html?section=reader&rb=<slug>&audit=1` (every
   page at reader size, with the clipped-text audit) and in the viewer.

Renderers never crash on missing or empty fields, because user-made
brochures are often half-finished.

## Real photos

Photos come from **Wikimedia Commons** under free licences only — CC0,
public domain, CC BY, CC BY-SA (any version or port). NonCommercial,
NoDerivatives, "fair use" and unrecognised licences are rejected, and so are
images under 1600 px on the long edge. Each photo slot shows, in order of
preference: a photo **bundled** with the site (downloaded once by
`npm run photos:fetch`, served from `public/photos/`), else the same kind of
photo shown **live from Wikimedia Commons** by the visitor's browser, else the
brochure's generative art.

### Live photos (no build step)

Run the app with an internet connection (`npm run dev`, or any deploy) and
every slot without a bundled photo shows a real photograph straight away:
the browser asks the Commons API for the slot's `candidates` (and, if none
qualifies, searches Commons for its `query`), checks the licence and size,
and shows Wikimedia's own thumbnails with the photographer's credit and
licence — on the page, on the back page, in "About this brochure" and on
`#/credits`. Nothing needs to be configured: the Commons API answers
anonymous requests from any origin.

- **Few requests.** Photos asked for together go out together (a brochure's
  pages, a page of library cards, the Home page): usually one API request
  per brochure, plus one search for each slot whose candidates all fail.
  Images come in Wikimedia's standard thumbnail sizes (500, 960, 1280,
  1920 px), as large as the slot needs and never upscaled.
- **Cached.** Results are kept in the browser (`localStorage`,
  `tabi:live-photos:v1`): found photos for 30 days, "nothing usable" for a
  day, so a reload makes no API request. Editing a slot's candidates or query
  in a manifest makes it look again.
- **Fails quietly.** Offline, nothing is asked until the browser is back
  online. If Commons cannot be reached (a network or a Content-Security-Policy
  that blocks it, as in some sandboxed previews), the app tries once and then
  keeps the art, without filling the console. Switching live photos off stops
  any lookup already under way.
- **Privacy.** With live photos, each visitor's browser requests the
  pictures and their metadata from Wikimedia's servers
  (commons.wikimedia.org and upload.wikimedia.org), which see the visitor's
  IP address and browser like any website they visit (see the
  [Wikimedia privacy policy](https://foundation.wikimedia.org/wiki/Policy:Privacy_policy)).
  The API requests are sent without cookies, and browsers send only the
  site's origin as the referrer (never the brochure being read: it lives in
  the URL's hash). Visitors can switch it off with **Load photos
  from Wikimedia Commons** (in the footer and on `#/credits`; remembered as
  `tabi:live-photos-enabled`); the art then shows wherever no photo is
  bundled.
- **Bundling instead.** To serve every photo from your own site — no
  third-party requests, the blurred preview while loading, photos that never
  change under you — run `npm run photos:fetch` (below) and commit
  `public/photos/` with `photos.generated.json`. Bundled photos always win
  over live ones, slot by slot, so you can bundle some and leave the rest live.
  A strict CSP needs `connect-src https://commons.wikimedia.org` and
  `img-src https://upload.wikimedia.org` for live photos.

Live photos found by search (not one of the researched candidates) use the
work's title as alt text; check them before you bundle (see "After a fetch"
below).

### Bundling photos with the site

1. Researchers list candidates per brochure in
   `src/data/photos/manifest/<brochure>.json` — `id`, `use`, `candidates`
   (Commons file titles, best first), `alt`, `caption`, `place`, `focus` —
   and pages reference the id (`photo: 'kyoto-senbon-torii'`).
2. `npm run photos:candidates -- <brochure>` downloads every candidate as a
   preview and writes a contact sheet per photo to
   `.cache/photo-candidates/<brochure>/<id>.jpg` (gitignored), marked ✓/✗
   with size and licence. Record the winner as `"file"` in the manifest.
3. `npm run photos:fetch` takes each photo's `file` (or the first candidate
   that passes), downloads Commons' 1920 px thumbnail (a standard thumbnail
   step; other widths may be refused), writes WebP at 480/960/1600 px
   (quality 72, never upscaled) to `public/photos/`, and records size, a
   24 px blurred preview (LQIP), the dominant colour, the work's title,
   author (the attribution the author asked for, when Commons has one),
   licence + deed URL and source page in
   `src/data/photos/photos.generated.json`. API requests go one at a time,
   follow `continue`, and the registry file is written atomically after each
   photo (a damaged file stops the run instead of being overwritten). It is cached:
   photos already fetched are skipped unless `--force`. Other flags:
   `--only <brochure|photo-id>`, `--dry-run` (check, write nothing),
   `--list-candidates` (print the Commons links, offline), `--prune` (drop
   photos no manifest lists). Wikimedia asks for a contact in the
   User-Agent: set `PHOTOS_CONTACT` (a URL or e-mail) when you run it. Behind
   an HTTPS proxy, Node's `fetch` needs `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21).
4. Commit `public/photos/` and `photos.generated.json` with the manifests.

If Commons cannot be reached, `npm run photos:import -- photo.jpg --id <id>
--author "Name" --license "CC BY-SA 4.0" --license-url <url> --source <url>`
runs a photo you own or have licensed through the same resizing (add
`--permission` for a photo that is yours but not under a free licence).

Until a photo is bundled or found live — or if it fails to load — pages
show the brochure's generative art in its place, so every brochure always
renders. **Today no photo is bundled yet** (`photos.generated.json` is
empty): with an internet connection every slot is shown live from Commons,
and `#/credits` counts the photographs still to come. After a fetch, check:

- `#/credits` — every downloaded photo listed with author, licence and source;
- `/playground.html?section=reader&rb=all&audit=1` — no clipped text with the
  real pictures in place, on light and dark paper;
- each manifest's `caption`/`alt` still describe the file that was chosen
  (several candidates were picked from search results, not by eye).

**Credits.** Each photo is credited where it appears ("Photo: Author ·
CC BY-SA 4.0", linking to the Commons file page and the licence deed, in a
new tab); the credit comes from the Commons metadata, never typed by hand.
`creditsFor(brochure)` in `src/data/photos` lists every credit a brochure
needs (with the work's title); the back page prints them all, the Viewer's
"About this brochure" lists them with thumbnails, and `#/credits` gathers
every credit in Tabi (Home and each brochure). A long credit
wraps rather than being cut off, and the licence never breaks. Credits are plain text (HTML
in Commons metadata is stripped) and carry only http(s) links. CC BY / BY-SA
photos without a licence link (Commons' or the deed for their version) are
rejected. CC BY-SA photos are only resized and re-encoded.

## Facts and sources

Each built-in brochure carries `sources` (official sites first) and
`factsChecked` (e.g. `"October 2026"`). Readers see them in three places:
"About this brochure" under the reader (the check date, how it was checked
and every source, numbered and linked), the back page's colophon ("Facts
checked October 2026 · 8 sources") and the facts table on `#/credits`, which
also links each brochure's research log. The build publishes
`docs/REAL_CONTENT.md` and `docs/research/<slug>.md` as plain Markdown files
for those links (some hosts download `.md` instead of showing it).

Brochures made in the Studio can list their own sources and a facts-checked
date (Details panel); the reader shows that date as the author's claim ("…,
says the author"), never as a Tabi Guides check.

## Your photos in the Studio

Every photo field in the Studio (cover, intro, place, gallery and feature
items) opens a photo picker — a side drawer, or a bottom sheet on phones:

- **Library**: every registry photo, grouped by the brochure that uses it,
  with search, a region filter and suggestions matched to the place being
  edited. Photos not downloaded yet say so; the cover art stands in for them.
- **Your photos**: drop, choose or paste an image. It is resized in the
  browser to a JPEG of at most 1600 px (quality 0.82, then lower quality,
  1280 px or 1024 px until it is under ~1.2 MB of data), asks for alt text
  (required) and a credit ("Your photo" unless you name an author and
  licence), and is stored inside the brochure as `userPhotos`; pages point at
  it as `user:<key>`. A meter shows the 3 MB-per-brochure budget (24 photos at
  most) and warns when browser storage (about 5 MB per site) is nearly full.

Uploads never leave the browser. They travel with Export JSON, and an import
keeps only JPEG, PNG or WebP data within the same limits (files up to 4.5 MB).
Uploads with an author or licence are credited on the back page like any
other photo. Removing an upload clears every field that used it.

## Deploying

`npm run build` writes a fully static site to `dist/`. Two settings make it
work anywhere without configuration:

- **Relative base** (`base: './'` in `vite.config.js`): every asset URL is
  relative, so `dist/` works at a domain root, under a sub-path, or opened
  from a folder.
- **Hash routing** (`#/brochures/kyoto-thousand-gates`): the server only ever
  serves `index.html`, so no rewrite rules are needed.

Recipes:

- **Vercel**: framework preset "Vite", build `npm run build`, output `dist`.
- **Netlify**: build `npm run build`, publish directory `dist`.
- **GitHub Pages**: build, then publish `dist/` (for example with
  `actions/upload-pages-artifact` + `actions/deploy-pages`). The relative
  base already handles the `/<repo>/` sub-path.
- **Anything else**: copy `dist/` to any static file host or bucket.

The production bundle is split into a small entry chunk (about 40 KB
gzipped), two long-lived vendor chunks (`react`, `motion`) and one lazy chunk
per route. The entry carries only an outline of each built-in brochure
(titles, covers, places, sources); each brochure's pages are a chunk of their
own (about 5 KB gzipped), fetched when the reader opens it — straight away for
a deep link, on hover or focus from a card. The command palette, the
cover-art generator, the icon registry and the photo registry are loaded on
demand. (Tabi no longer draws maps, which took away the largest lazy chunk:
~60 KB of prefecture outlines.)

## Credits

- Fonts are served by Google Fonts: Fraunces (Undercase Type), Geist and
  Geist Mono (Vercel), Shippori Mincho (Fontdasu) and Zen Kaku Gothic New
  (Yoshimichi Ohira), all under the SIL Open Font License.
- Icons are by [Lucide](https://lucide.dev) (ISC).
- Cover art and illustrations are generated in code from traditional
  patterns (seigaiha, asanoha, shippō, ichimatsu, ensō, torii, kumo…).
- Photographs are from Wikimedia Commons under CC0, public-domain, CC BY or
  CC BY-SA licences, credited to their authors on the page where they appear
  (see "Real photos").
- The Credits page (`#/credits`) lists all of the above, with every photo credit.
- Built-in brochures describe real places with facts checked against official
  sources (`docs/REAL_CONTENT.md`); they are published by Tabi Guides, the
  app's own editorial imprint, and print no phone numbers.
