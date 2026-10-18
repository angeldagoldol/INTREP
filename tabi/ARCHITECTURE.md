# Tabi 旅 — architecture & conventions

Tabi is an online brochure system about Japan. Visitors browse a library of
interactive brochures (Kyoto, Tokyo, Hokkaido, Okinawa…), read them in a
flipbook with real 3D page-turns, and design their own Japan brochure in the
Studio. Everything runs in the browser; user data lives in `localStorage`.

## Design direction

**Japanese print culture meets a modern editorial magazine.**

- **Washi & sumi.** Warm unbleached paper (`--bg`), heavy ink (`--ink`), a
  fixed film-grain layer (`.grain`) over the whole app. Dark mode is "ink":
  near-black paper with cream type.
- **Wa-iro spot colours.** Vermilion `--wa-shu` (torii, seals), indigo
  `--wa-ai`, sakura, matcha, gold, wisteria… UI accent is `--accent` (deep
  vermilion, AA-contrast with `--accent-ink`). Never hard-code UI colours; use
  tokens from `src/styles/tokens.css`. Brochure pages are the exception: they
  use each brochure's own `theme` colours. Text fields and selects take
  `--control-border` (3:1 against the paper), not `--line-strong`; small
  accent text on a page uses `--b-accent-text` (`--b-accent-on-soft` on the
  `--b-soft` tint), raw `--b-accent` only for rules, dots and type ≥24px.
- **Type.** `--font-display` ('Tabi Macrons' → Fraunces → Shippori Mincho for
  kanji) for headlines — 'Tabi Macrons' (base.css) is Fraunces' latin-ext file
  limited to ā ē ī ō ū, so "Tōhoku" keeps its macron on the letter; h1–h6 and
  `.display` open their word gaps (`--word-space-heading/-display`) because
  Fraunces' space is narrow at opsz 144 — `--font-sans` (Geist → Zen Kaku Gothic New) for UI and body,
  `--font-mono` (Geist Mono) for labels/eyebrows/numbers, `--font-jp` for
  Japanese set on its own. Japanese text always gets `lang="ja"`.
- **Motifs.** Vertical Japanese type (`<VerticalText>`, 縦書き), red seal stamps
  (`<Hanko>`), the rising-sun circle, traditional patterns (seigaiha waves,
  asanoha, shippō, ichimatsu), hairline keylines, crop marks, page folios,
  generous negative space (*ma*, 間).
- **Motion with intent.** Expo-out easing, springs for physical things (pages,
  magnets), staggered text reveals, scroll-linked parallax. Motion explains
  what happened; it never blocks the user. Everything respects
  `prefers-reduced-motion`.

## Stack

React 19 · React Router 7 (hash routing) · framer-motion 12 · lucide-react ·
Vite 7 · Vitest + Testing Library · ESLint 9. Plain CSS: global tokens/base in
`src/styles/`, everything else in CSS Modules next to the component.

```
npm install
npm run dev       # http://localhost:5173 (+ /playground.html) — scripts/dev.mjs: Vite + the photo download
npm run build     # static site in dist/ (relative paths, any host); prebuild downloads missing photos
npm test          # vitest: unit, component, and a smoke test of every route (src/App.test.jsx)
npm run lint      # also lints scripts/*.mjs
npm run photos:fetch | photos:candidates | photos:import   # scripts/photos (see README "Real photos")
```

Bundling (`vite.config.js`): an entry chunk (shell, contexts, the built-in
brochures' *outlines*, the stored-brochure normaliser), two long-lived vendor
chunks — `react` (react, react-dom, router) and `motion` (framer-motion) — and
one lazy chunk per route. Each built-in brochure's full pages are a lazy chunk
of their own (`kyoto-thousand-gates-[hash].js`, ~5 KB gzipped), loaded through
`data/catalog.js` when a page is drawn (see "Data contract": twelve real
brochures are ~140 KB of text, which used to double the entry).
The command palette panel (`PalettePanel.jsx` with its search index) is a lazy
chunk prefetched when the browser is idle. Code several routes share gets its
own lazy chunk: `cover-art`, `Icon` (the named lucide registry), `BrochurePage`,
`BrochureCard`, and small ones Rollup names after a module inside them
(`progress`, `pageMeta`, `Switch`). `<Photo>` travels with `<CoverArt>` in
the `cover-art` chunk: every route that draws one draws the other (the art is
each photograph's fallback). The photo registry (`data/photos`, with the
manifests, `photos.generated.json` and the live-photo resolver `live.js`) is
its own `photos-[hash].js` chunk, because the lazy photo notice
(`PhotoNotice`, mounted by AppShell a few seconds in) shares it; the
`cover-art` chunk imports it, so both load together. Once photos are bundled
it carries their records (a 24 px LQIP each, ~0.8 KB). Only the tiny
live-photos *setting* (`data/photos/liveSetting.js`, the footer's switch) is
in the entry. The
Studio's photo picker (`PhotoPicker`) is a lazy chunk of its own. Tabi draws
no maps (there is no map chunk, no geo data and no `map` page type any more:
photographs of the places lead every page). Two build plugins:
`tabi-photo-manifests` (in `vite.config.js`) folds a manifest entry's curated
`file` in front of its `candidates` (live photos try it first) before the
JSON is bundled, and
`tabi-brochure-outlines` (`scripts/build/brochure-outline.mjs`, tested) serves
`?outline` imports of `src/data/brochures/*.js` from the source text — no file
in that folder changes. A third, dev-only plugin, `tabi-photo-status`
(`scripts/build/photo-status.mjs`), serves the background photo download's
progress (`.cache/photo-fetch/status.json`: state, counts, and why it stopped
early — `offline`, `refused`, `busy` or `tools`) at `/__tabi/photo-status` and
pushes each change as the HMR event `tabi:photo-status`. `clearScreen: false`
keeps Vite from wiping the download's lines in the shared terminal. Keep route-only code out of the entry: a
top-level call such as `Object.assign(…)` counts as a side effect, so Rollup
keeps the whole module in the first chunk that imports it — even through the
`components/ui` barrel. Build prototype-free tables with `dict()`/`byId()`
from `data/lookup.js`, which are marked `@__NO_SIDE_EFFECTS__`.

## Folder layout

```
src/
  main.jsx                 providers: MotionConfig → Theme → Toast → Brochure
  App.jsx                  routes (lazy-loaded pages), last-resort error boundary
  styles/tokens.css        design tokens (colours, type, space, shadow, motion, z)
  styles/base.css          reset, typography, .container .eyebrow .display .jp .sr-only .grain
  lib/                     motion.js, cn.js, id.js, storage.js, format.js (also isEmail,
                           sealChars: the two seal characters of a Japanese title),
                           librarySearch.js (the Library view the reader returns to),
                           progress.js (page to resume each brochure at) (+ tests)
  hooks/                   useMediaQuery, useHotkey, useLockBodyScroll, useFocusTrap,
                           useClipboard, useDocumentTitle, useMinuteClock (the clocks' tick),
                           useFullBrochure / useLoadedBrochure (a built-in's pages, see catalog.js) (+ tests)
  context/                 ThemeContext, ToastContext, BrochureContext (+ tests)
  data/                    schema.js, photoSpreads.js (double-page photo spreads: the booklet binding, a
                           half's partner — what the renderer needs) + photoSpreadEdits.js (the validator,
                           insertion, moves, the automatic line-up), brochures.js (the full
                           built-ins: tests, playground), catalog.js (what
                           the app holds: outlines + lazy full brochures), brochures/<slug>.js (one per
                           brochure, index.js = order), categories.js, regions.js, seasons.js,
                           lookup.js (prototype-free id tables), sanitize.js (stored-brochure normaliser:
                           also safeUrl, toLat/toLng, normalizePage, sanitizeUserPhotoMap,
                           isRetiredPageType: old `map` pages are dropped), kana.js
                           (hiragana readings for search)
  data/photos/             photo registry: index.js (getPhoto, resolvePhoto, listPhotos, creditsFor, photoIdsIn,
                           livePhotos, bundledCount, subscribePhotos/photosSnapshot, updateBundledPhotos — the
                           dev server's hot update of photos.generated.json), registry.js (pure merge: bundled > live > none; "user:<key>" uploads
                           from brochure.userPhotos), safeImageSrc.js (the only image URLs an upload may use;
                           also used by sanitize.js), manifest/<brochure>.json
                           (researchers), photos.generated.json (written by scripts/photos/fetch.mjs),
                           live.js (live photos: the browser's Commons resolver — batching, rounds, cache),
                           commons.js (pure: API URLs, policy, thumbnail steps, search pick; shares
                           scripts/photos/lib.mjs), liveSetting.js ("Load photos from Wikimedia Commons"),
                           fixtures/ (Commons API responses for the tests)
  components/ui/           design-system primitives (see below)
  components/layout/       AppShell, Navbar, Footer, RouteTransition, CommandPalette
                           (lazy PalettePanel), search.js (shared text folding),
                           navState.js (navbar visibility), japanTime.js,
                           ErrorBoundary + RouteErrorBoundary/RouteError (chunkError.js),
                           AppearanceSwitch (light / dark / auto, in the footer)
  components/brochure/     CoverArt (+ art/: PRNG, colour, 10 pattern generators),
                           BrochurePage (+ blocks/: one block per page type; fit.js + useFit.js: copy
                           fitting; pageUtils.js placeLayout: how tall a place page's photograph can be),
                           BrochureCard (factsChecked.js: "Oct 2026" for the cover's obi)
  components/photo/        Photo: srcset/sizes, LQIP + dominant colour (or the art under a live photo), fade-in,
                           credit chip/caption, fallback (the brochure's CoverArt) when a photo is unknown, not
                           found yet or broken; PhotoCredit (the credit line, placeable anywhere); photoContext.js
                           (PhotoContext, usePhotoRecord: resolve ids in the brochure being drawn;
                           PrintPhotosContext: eager, fixed-size photos in the print edition);
                           useLivePhotos.js (useLivePhotos, useRequestLivePhotos, useLiveCredits);
                           useLivePhotosSetting.js + LivePhotosToggle (footer, #/credits);
                           MastheadPlate (a page masthead's photograph: the first known id of a preference
                           list, a vertical word on a hung slip, a seal, place + credit; a band on phones);
                           PhotoNotice (lazy, from AppShell) + photoNotice.js (pure: when and what): the
                           once-per-session note explaining placeholder art and how to get the photos
  components/viewer/       flipbook + reader UI (pure maths in spreads/flipMath/layout.js); TripPlanner
                           ("Plan this trip", tripPlan.js), links.js (a brochure's sources and official
                           sites, http(s) only, de-duplicated, with hosts);
                           the reader's key map and visibility rules are pages/Viewer/readerKeys.js
  components/studio/       brochure editor UI (studioReducer, templates, palettes, publishCheck…).
                           "Add page" also offers a photo page and a double-page spread (two pages placed
                           on facing pages, data/photoSpreadEdits.js); the page list warns when a spread is out
                           of place ("Line up"), its arrows move both halves a spread at a time, and the
                           reducer keeps a spread's photo and caption/credit placement the same on both halves.
                           Spread previews use viewer/spreads.js, so proofs pair pages as the
                           reader does. ⌘Z in the editor's fields uses the Studio history; a field
                           holding text not yet in the document opts out with [data-native-undo].
                           Real-place fields: fieldChecks.js (coordinates inside Japan — JAPAN_AREAS —,
                           pasted pairs, https links), CoordsField (two boxes, no map),
                           photoLibrary.js + fields/PhotoPicker (lazy chunk) for library photos and
                           uploads, photoUpload.js (downscale, budget, sanitizeUserPhotos)
  pages/<Page>/            route components and their sections (Viewer/aboutFacts.js: fact-check wording,
                           the About plate photo; Credits/credits.js: credit groups, totals, licences;
                           Home/homeContent.js: section copy, NOSTALGIC + nostalgicPhotos/splitCaption/
                           homePhotoIds; Home/sections/mosaic.js: the Nostalgic Japan mosaic's placement)
  dev/                     playground.html workbench (dev server only, not built): every page of every
                           brochure at reader and thumbnail size on light or dark paper; audit.js finds
                           clipped, cut-off or off-page text (?section=reader&audit=1, window.__tabiAudit())
  test/setup.js            jsdom polyfills (skipped in `// @vitest-environment node` suites)
scripts/dev.mjs            `npm run dev`: spawns Vite and, 1.2 s later, `fetch.mjs --auto --dev`; Ctrl+C, `q`,
                           a signal or its parent going away stops both (the download is asked to stop over
                           IPC — a signal to a child is a hard kill on Windows — and killed after 4 s)
scripts/photos/            fetch.mjs (the download; `--auto` for dev/prebuild), candidates.mjs, import-local.mjs;
                           lib.mjs (pure, tested with Commons API fixtures in fixtures/: titles, policy, credits,
                           search ranking shared with the browser), plan.mjs (pure: which slots, batches, choice,
                           resume — journal and the published.json copy —, progress), process.mjs (sharp, loaded
                           only when there is work: WebP widths, LQIP, colour), io.mjs (paths, polite client
                           with a per-host Retry-After pause, requestTrouble/stopHint for refusals and
                           throttling, proxy, journal/failures/status/lock/published in .cache/photo-fetch/)
scripts/build/             brochure-outline.mjs (the `?outline` Vite plugin + its pure transform, tested),
                           photo-status.mjs (dev-only plugin: the download's progress for PhotoNotice)
docs/                      REAL_CONTENT.md (the standard), research/<slug>.md (each brochure's fact log;
                           linked from #/credits and published with the build as raw Markdown)
public/photos/             <id>-<480|960|1600>.webp, committed with photos.generated.json
.cache/                    gitignored: candidate contact sheets
```

## Routes

| Path | Page |
| --- | --- |
| `#/` | Home |
| `#/brochures` | Library — `q` (text), `category`, `season` (comma list, matches ANY), `region`, `fav=1`, `sort` (`featured\|newest\|az\|quickest`), `view=list`. Unknown values are dropped. |
| `#/brochures/:slug` | Viewer — `p` = 0-based page index (clamped, and the address bar is rewritten to the page shown; `p=0` is omitted). A slug in another letter case still opens and is corrected in place. |
| `#/studio` | Studio start screen: templates, blank, remix |
| `#/studio?draft=1` | Studio editor on the working draft (autosaved to `tabi:studio-draft`) |
| `#/studio?from=<slug>` | Remix any brochure into a fresh draft (asks before replacing an unpublished one), then replaces the URL with `?draft=1` |
| `#/studio/:id` | Studio, edit a user brochure (built-ins open read-only with a Remix button) |
| `#/credits` | Credits & sources (奥付): every photo credit grouped by Home and brochure (licence links, photos still to come; it looks up every live photo, so their credits are listed too), the "Load photos from Wikimedia Commons" switch, the fact checks with links to `docs/REAL_CONTENT.md` and `docs/research/<slug>.md` (Vite copies them into the build as `?url&no-inline` assets) and the fonts |
| anything else | NotFound (迷子) |

The Home page (`pages/Home`) is photo-led: after the hero and the word
marquee comes **03 Nostalgic Japan (懐かしい日本)**, a magazine mosaic of real
photographs of nostalgic places — `listPhotos()` entries whose id starts
`nostalgic-` (the Nostalgic Japan brochure's manifest), a cover-shaped lead
first and wide pictures last (`nostalgicPhotos`), placed by
`sections/mosaic.js` (12 columns on wide screens, pairs on phones), each with
its caption split into the English line and the Japanese name
(`splitCaption`) and its credit; it links to `#/brochures/nostalgic-japan`
once that brochure is in the library and renders nothing while the manifest
has no such photos. **06 Regions** is a grid of eight photographs (the
`home-region-*` slots), each one link to `/brochures?region=…` with the
region's Japanese name and brochure count — plain links in reading order, no
map. Every Home photograph (`homePhotoIds`) is requested in one batch and
listed under "Home page" on `#/credits`, whose totals count a photograph once
even when a brochure shows it too.

The other routes lead with photographs as well: the Library and Credits
mastheads carry a photograph of a nostalgic place (`MastheadPlate`, with
旅のしおり / 奥付 on its slip; ids `nostalgic-…` in `LibraryHeader.jsx` and
`Credits.jsx`, the art standing in until one is found), the Studio start's fan
of templates and the 404's suggested brochure show cover photographs, and the
reader opens on each brochure's cover photograph.

Shell behaviour every page can rely on (`components/layout/AppShell.jsx`):

- Route changes play the curtain transition when the **pathname** changes;
  query-string changes never do. A navigation with
  `state: { shellTransition: false }` keeps the page mounted (the viewer uses
  it to correct a slug's letter case in place).
- Each route renders inside its own error boundary (`RouteErrorBoundary`): a
  page that throws, or whose lazy chunk can't be downloaded, shows
  `<RouteError>` ("This page tore") while the navbar, footer and palette keep
  working, and navigating away clears it. A failed chunk (usually a tab left
  open across a deploy) first reloads the page once on its own; the
  sessionStorage stamp `tabi:chunk-reload` stops a second reload within 30 s,
  and nothing reloads while offline. `App.jsx` has a last-resort boundary
  for the shell itself, and a palette panel that fails closes with a toast.
- On tool routes (the reader, `/studio?draft=1`, `/studio/:id`) the navbar is
  full-bleed and shares `--tool-gutter` with the tool bar below it; the
  "Create a brochure" button is hidden anywhere in the Studio.
- After a transition the shell scrolls to the top and focuses `<main>`.
- `/brochures/:slug` is *immersive*: `--nav-h` is 60px (72px elsewhere), the
  navbar always shows, and there is no footer. Size full-height views with
  `calc(100dvh - var(--nav-h))`.
- The viewer syncs `?p=` with `history.replaceState` (no router navigation per
  page turn), so `useLocation().search` inside it can lag `window.location`.
  Code that runs while its route animates out must not write the URL: the
  router already holds the next one (`useIsPresent()` is false then).
- Each page is pinned to the location it was rendered at (AppShell re-provides
  React Router's location context per `RoutePage`), so `useLocation` and
  `useSearchParams` in a page that is animating out still read *its* URL.
  Without this the outgoing page re-renders for the next URL — the Library
  losing its `?q=` remounted "Your brochures" mid-exit and left the curtain
  covering the screen.
- `.shell` has `overflow-x: clip`: nothing can cause horizontal page scroll,
  and sticky/fixed UI is unaffected.

The reader (`pages/Viewer/Reader.jsx`):

- Fit: the book is as large as the stage allows, with a vertical margin of
  ~6% of the stage height (what a turning leaf needs not to clip). Below
  `READABLE_PAGE_WIDTH` (300px, `viewer/layout.js`) pages stop shrinking: on
  a short stage (browser zoom, a small window) the book keeps that width and
  the stage scrolls instead. In-app zoom goes 100–400% (`ZOOM_LEVELS`).
- From 760px the bottom bar is only the scrubber; the thumbnail filmstrip is
  a dock that rises over the foot of the stage while the bar is hovered,
  focused or scrubbed (the stage never resizes), and stands in for the
  scrubber's preview bubble. Phones keep the strip in the bar.
- Keys (`readerKeys.js`): ←/→ turn and + − 0 zoom (characters, so any
  keyboard layout) while the reader is mostly on screen; PageUp/PageDown/
  Home/End turn only with focus in the reader or on the page itself, and
  scroll the document otherwise. Menus over the reader keep their own keys.
- Print (`viewer/PrintPages.jsx`, `printBrochure.js`): the print edition — every
  page on its own A4 sheet — exists only while printing. The toolbar's Print
  and ⌘/Ctrl+P in the reader draw it first, wait until its photographs have
  loaded (≤ 6 s), then open the dialog; inside it `<Photo>` loads eagerly from
  one fixed 1280 px file (`PrintPhotosContext`: a srcset would be re-chosen
  for the paper and print a blank). A print from the browser's menu draws it
  on `beforeprint`, with whatever has loaded by then.
- Opening the trip planner from fullscreen waits for the exit
  (`useFullscreen().exit()`), since everything outside the fullscreen
  element is inert until then.

Hash routing means **`href="#section"` anchors would change the route**. For
in-page jumps call `element.scrollIntoView({ behavior: 'smooth' })`.

## Data contract

See `src/data/schema.js` (JSDoc) — the single source of truth. A brochure has
`id, slug, title, titleJp, subtitle, category, region, seasons[], organization,
summary, tags[], format, updatedAt, readMinutes, featured, source, theme,
cover, pages[]`, plus `location`, `sources` and `factsChecked` for built-ins.
Pages are `{ id, type, ...fields }` with types `cover, intro, features,
gallery, place, stats, agenda, pricing, phrases, quote, contact, photo, back`.
`map` is a **retired** type (`RETIRED_PAGE_TYPES` in schema.js): Tabi shows
photographs of the places, never a map. Stored brochures, Studio drafts and
JSON imports drop map pages when they are read back (`sanitizePages`,
`parseBrochureJson`, which reports them as `retired`), and a map page handed
to the renderer directly draws the quiet fallback. `lat`/`lng` stay in the
data (place pages and `location`) and are only printed.
A `photo` page with `span: 'left' | 'right'` is half of a **double-page
spread**: the left half sits at an odd index (page 2, 4, 6…, the left-hand
page of a booklet spread — the cover is alone on the right) and its right
half right after it, with the same `photo`. `data/photoSpreads.js` knows the
binding (tested against `viewer/spreads.js`) and finds a half's partner
(`spreadPartner`, all the renderer loads); `data/photoSpreadEdits.js` has
`spreadIssues(pages)` (used by `brochures.test.js`, the Studio and the
publish check), `spreadInsertIndex` / `pageInsertIndex` (where new pages go),
`moveSpread` and `fixSpreadPlacement` (reunite halves pulled apart, line
pairs up by moving one neighbouring page, a lone half becomes a full-page
photo).
`PAGE_TYPES[type].create()` returns placeholder content for a new page, and
`PAGE_TYPES[type].jp` is its Japanese section name (はじめに, お問い合わせ…),
the one the page margin, the Studio and the reader's overview all show.
`ART_STYLES` lists the generative cover-art motifs.

User-made content can have empty or missing fields: renderers must never
crash on them. Brochures and Studio drafts read back from storage go through
`data/sanitize.js` first: pages without a string id or a known type are
skipped, fields of the wrong type are reset, and a valid record comes back
unchanged (copy-on-write, same key order). Links in brochure data
(`place.website`, `contact.ctaUrl`, `details[].url`, `sources[].url`) must be
absolute http(s) — `safeUrl()` turns anything else (javascript:, data:,
relative) into ''; renderers call it again before making a link, which opens
in a new tab with `rel="noopener noreferrer"`. Coordinates must be finite
(lat −90…90, lng −180…180) or they are removed; photo ids are strings.
JSON imports (`studio/brochureIO.js`) apply the same rules (`normalizePage`).

Real places, facts and photos follow `docs/REAL_CONTENT.md`.

**Outlines and full brochures (`data/catalog.js`).** The app never imports
`data/brochures.js` (that is for tests and the playground). `BrochureContext`
holds `BUILTINS` from the catalog: every top-level field of each brochure
(title, cover, theme, location, sources, factsChecked…) and one stub per page
with only `id, type, name, nameJp, kicker, photo`, the `photo` of each
`items[]` entry, plus `outline: '<file stem>'`. That is all the Library, search, the palette's
Places, Credits, cards and the Studio's photo library read, so
`placeNames()`, `placeItems()`, `photoIdsIn()` and page counts work on an
outline. **Anything that draws pages or copies a brochure must get the full
one**: `useFullBrochure(b)` (suspends; the Viewer and `?from=` remix use it),
`useLoadedBrochure(b)` (null until loaded, no suspense; the Home flip sketch)
or `await loadBrochure(b)` (the Studio's remix picker). Anything that is not
an outline (user brochures, templates, the full built-ins) comes straight
back, and only the catalog's own objects count as outlines (a stored
brochure with an `outline` field does not). Loads are shared, a failed one is
retried on the next call, and `preloadBrochure(b)` starts one early: `main.jsx`
does it for a deep link, `BrochureCard` on hover/focus. A new page field the
Library, palette or Credits needs without drawing the page must be added to
`OUTLINE_PAGE_KEYS` / `OUTLINE_LIST_KEYS` in `scripts/build/brochure-outline.mjs`.

**Facts, sources and credits — where they show.** `sources` are listed,
numbered and linked in the Viewer's "About this brochure", counted on the back
page's colophon ("Facts checked October 2026 · 8 sources") and in the Credits
page's facts table (with a link to `docs/research/<slug>.md`). `factsChecked`
on a built-in is Tabi Guides' check ("Facts checked October 2026"); on a
Studio brochure the same field is shown as the author's own claim ("…, says
the author"), and a built-in without one says "Facts awaiting check". Photo
credits show where the photo appears (overlay chip or caption), on the back
page (`creditsFor`), in "About this brochure" and on `#/credits` (grouped by
Home and brochure, with the photos still to download). Studio sources are
edited in the Details panel; a source without a valid http(s) link is dropped
when the brochure is read back (`sanitizeSources`).

**User photos (the Studio's uploads).** A brochure can carry its own photos:

```js
brochure.userPhotos = {
  [key]: {                       // key: any string; pages refer to it as "user:<key>"
    src,                         // data:image/(png|jpeg|webp|gif|avif);base64,… or a blob: URL — nothing else
    alt,                         // what the photo shows ('' = decorative)
    caption?, focus?,            // optional, like a manifest entry ("50% 40%")
    width, height,               // pixels of `src`
    credit: { author, license, licenseUrl?, sourceUrl? },   // links http(s) only
  },
};
page.photo = 'user:abc';         // also items[].photo and cover.photo
```

`resolvePhoto(id, brochure)` (data/photos) answers both kinds of id with the
same record shape (`user: true`, one `src`, no srcset); hotlinks (http(s)),
SVG and anything else are `available: false`, so the art fallback shows.
`<BrochurePage>` provides its brochure through `PhotoContext`, so every block's
`<Photo id="user:…">` finds the upload; outside a page pass `brochure` to
`<Photo>`. `creditsFor(brochure)` lists uploads that name an author or licence
(`user: true`), and the back page prints them with the rest. Blob URLs only
live as long as the tab: store data: URLs in saved brochures. A stored
brochure read back through `sanitize.js` keeps only entries that are objects
with a `safeImageSrc` (`sanitizeUserPhotoMap`); fields pointing at a dropped
key show the art. Large data: URLs
count against the `localStorage` quota — downscale before storing (the Studio
stores JPEG ≤ 1600 px at quality 0.82, ≤ 1.2 M characters each, 24 photos and
3 M characters per brochure; JSON imports keep only inline JPEG/PNG/WebP within
those caps — `studio/photoUpload.js`). Data flow for
photos: manifest (`data/photos/manifest/<brochure>.json`: what a photo shows)
→ the download (`scripts/photos/fetch.mjs`: run by `npm run dev` in the
background, by `prebuild`, or as `npm run photos:fetch`; Commons API,
licence/size policy, search fallback, sharp) →
`public/photos/*.webp` + `photos.generated.json` (size, LQIP, colour,
credit) → `getPhoto(id)` merges both → `<Photo id>` renders it, or its
`fallback` while `available` is false. Photo URLs are relative
(`photos/<id>-<w>.webp`), like every asset (base `./`). A slot with no
bundled file is shown **live from Wikimedia Commons** instead (next section).
In development the registry follows photos.generated.json as the download
publishes it (after the Home/cover batch, then about every 60 photos):
`index.js` accepts the JSON's hot update (`import.meta.hot.accept`),
rebuilds the registry (`updateBundledPhotos`), drops newly bundled slots from
the live resolver and notifies `subscribePhotos` listeners — `useLivePhotos`
subscribes through it, so every `<Photo>` swaps art (or a live photo) for the
local file without a reload. Id tables (`CATEGORY_MAP`, `REGION_MAP`, `SEASON_MAP`,
`PAGE_TYPES`, `ART_LABELS`, `BLOCKS`, `ICONS`, `SECTION_JP/EN`) have no
prototype (`data/lookup.js`), so `MAP[userValue]` never finds `constructor`
or `__proto__`; use `hasKey(MAP, id)` to validate an id.

Built-in brochures carry `titleKana`, the hiragana reading of `titleJp`, and
regions, categories and seasons have `kana`: `data/kana.js` joins them into a
hidden search field, so きょうと finds 京都 (a remix's copied `titleKana` is
ignored, since `source: 'user'` titles can change).

Slugs keep every script (`slugify('京都の秋')` → `京都の秋`; Latin accents and
widths are folded), so links must go through the router (it percent-encodes
them). `estimateReadMinutes` reads Japanese by the character.

## Shared APIs

```js
const { theme, preference, setPreference, toggle } = useTheme();
// preference 'light' | 'dark' | 'system'; toggle() picks light or dark, setPreference('system')
// goes back to the OS (footer AppearanceSwitch, ⌘K "Match system appearance"). Synced across tabs.
const toast = useToast(); toast({ title, description, tone: 'success' | 'error' | 'default', action: { label, onClick }, duration });
// duration defaults to 4200 ms, or 10000 ms with an action (0 = sticky); hovering or
// focusing a toast pauses its clock, so its action can always be reached. Screen readers
// hear it once, from a polite (or, for errors, assertive) announcer; the visible stack is
// not a live region, so don't add another live region for the same event (PublishStamp is aria-hidden).
const {
  brochures, builtins, userBrochures, favoriteIds, recentIds,
  getBySlug, getById, saveBrochure, deleteBrochure, toggleFavorite, isFavorite, markViewed,
} = useBrochures();
// saveBrochure(draft) → the saved copy, or null when storage refused the write
// (full quota): nothing changes then, so keep the draft and tell the user.
// deleteBrochure(id) → true, or false when storage refused.
// builtins (and the built-ins in brochures/getBySlug/getById) are outlines — see "Data contract".
import { BUILTINS, isOutline, loadBrochure, preloadBrochure, peekBrochure } from '../../data/catalog.js';
const full = useFullBrochure(brochure);     // hooks/useFullBrochure.js — suspends until the pages are in
const maybe = useLoadedBrochure(brochure);  // same, but null while loading (decorative use)
```

UI kit (`import { … } from '../../components/ui'`):
`Button` (variant primary|accent|secondary|ghost, size sm|md|lg, `to`/`href`,
iconLeft/iconRight, loading, block) · `IconButton` (label required, tooltip) ·
`Chip` · `Badge` · `Field` + `Input`/`Textarea`/`Select` · `Switch` ·
`Modal`/`Drawer` (focus trap, Esc, scroll lock; portalled, so their header and footer are
divs, never `<header>`/`<footer>` landmarks) · `Kbd` · `Skeleton` ·
`RevealText` (masked word/char reveal) · `Marquee` · `Counter` · `Magnetic` ·
`Tilt` (3D tilt + glare, exposes `--mx/--my`) · `VerticalText` · `Hanko` ·
`Icon` (by name from the registry, for data-driven icons).

Motion presets: `import { ease, spring, fadeUp, stagger, viewportOnce, … } from '../../lib/motion.js'`.

Brochure kit (`import { … } from '../../components/brochure/index.js'`):

```jsx
<CoverArt style="torii" seed={5} theme={b.theme} animated title="…" />   // fills its box
<BrochurePage brochure={b} page={b.pages[i]} index={i} total={n}
              active      // replays the entrance + counters each time it turns true
              isStatic    // thumbnails/back faces: no motion, nothing focusable
              facing      // drawn beside its facing page (the reader's two-page mode, spread thumbnails,
                          // the Studio's spread proof): a photo spread's halves draw their half of the picture
              partner={p} // the spread's other half, when `brochure` has no pages (the Studio's shell)
              onCta={…} />// contact page without a ctaUrl: its call to action becomes a button
                          // (with neither, the line is plain text — never a button that does nothing)
<BrochureCard brochure={b} index={i} variant="grid|list|feature" layout />
                          // cover photo (art fallback); "Facts checked Oct 2026" on the obi
                          // only when b.factsChecked is set
```

Page text is never clipped: blocks mark the copy regions that take up the
slack with `data-fit` and size their type `calc(<size> * var(--fit, 1))`;
after layout (and again once web fonts load, or the page changes width)
`BrochurePage` bisects each region's `--fit` (floor 0.6, or `data-fit-min`)
until nothing overflows (`blocks/fit.js`). Regions are measured vertically;
`data-fit="both"` adds the width (multi-column copy). Inside a region, rows
must not shrink below their text (`flex: 1 0 auto`, `minmax(auto, 1fr)`) and
nothing may clip with `overflow: hidden`, or the overflow is invisible to the
measurement. Credits wrap instead of being cut. Check with the playground's
audit (`/playground.html?section=reader&audit=1`).

Real-place pages: **cover** — full-bleed photo, scrims in `--b-shade`, type in
`--b-light` (the darker/lighter of paper and ink, so dark themes work),
vertical `titleJp` with the place's coordinates, a foot scrim that leaves the
upper half of the photograph clear, cover lines ("In this issue":
the place pages with their page numbers), a filled seal and the credit
along the foot. **photo** — the magazine photo page: the picture to the trim
and a caption (accent rule, the place in small capitals, its Japanese name,
one line, the credit) over a scrim (`captionPlacement: 'overlay'`) or on a
paper band under the picture (`'below'`); `creditPlacement: 'edge'` sets the
credit up the outer trim. A spread half drawn `facing` lays the photo out at
twice the page width (shifted a page on the right half), so both halves crop
it identically and meet at the gutter, which the flipbook shades; the
captioned half (the right one first) sets the shared layout, and its scrim
fades out before the gutter. Read one page at a time (phones, print, the
contact sheet, the Studio's strip) the left half is the photo on its own page
with the caption, the right half the whole wide picture as a plate (the Home
page's flip sketch always shows facing pairs, so it draws spreads whole). A half
that is not placed correctly draws as a full page. **place** — photo first, like
a travel magazine: the photograph runs off the top trim and both sides (no
running head: `HEADLESS` in blocks/index.js), as tall as the text leaves room
for (`placeLayout`: 52–80cqw, sized so the story and facts fit at ~90% or
more, the facts column widened to balance them), the Japanese name on a
vertical slip hung from the top trim (two columns when it breaks at a space or
・), then the kicker with the coordinates in small type, the name, the story
and the facts with the official site. No map. **intro** — the photo plate takes
the wider column (1.22 : 1). **gallery** — layouts by count (1–4) on a subgrid,
captions with credits; photo first: one plate runs off both side trims, three
put a tall plate first that runs off the left trim, four put a wide plate that
runs off both side trims over three (`data-bleed` hides the margin label). **quote** —
`quoteJp` vertical (spaces break columns), `quote` split into verse lines at
" / ". **pricing** — a price list with dotted leaders. **contact** — ruled list
of official links. **back** — colophon with facts-checked date and source
count, and every photo's credit (`creditsFor`).

Photos (`components/photo/Photo.jsx`):

```jsx
<Photo id="kyoto-senbon-torii" sizes="(min-width: 900px) 50vw, 100vw" priority? fit="cover|contain"
       focus="50% 40%" credit="none|overlay|caption" creditLinks={!isStatic}
       brochure={b}?                                     // where "user:<key>" ids resolve; defaults to
                                                         // the PhotoContext every BrochurePage provides
       fallback={<CoverArt …/>} rounded? kenBurns? />     // fills its box; host CSS vars:
                                                         // --photo-credit-size, --photo-chip-left/right/top/bottom
<PhotoCredit credit={photo.credit | creditsFor(b)[i]} links={!isStatic} label="Photo:" />
const record = usePhotoRecord(id);                      // resolved in the current PhotoContext, or null
// `sizes` is only the first guess: the frame measures itself (ResizeObserver) and asks
// for the width the picture is drawn at (cover-cropped photos are wider than their box).
import { getPhoto, resolvePhoto, listPhotos, creditsFor, photoIdsIn } from '../../data/photos/index.js';
// Only from code that is already lazy (the brochure renderer, a route): never from the entry.

// Live photos (components/photo/useLivePhotos.js). The registry's lookups are synchronous;
// anything that reads `available`/credits from them must subscribe, or it will not see a
// live photo arrive. <Photo>, usePhotoRecord and BrochurePage already do.
const live = useLivePhotos(ids);       // asks for these ids (one batch per tick) and re-renders as they
                                       // resolve → { getPhoto, resolvePhoto, creditsFor, listPhotos,
                                       //   loading, ready, failed, enabled, blocked } — use these lookups,
                                       //   or `live` as a memo dependency
useRequestLivePhotos(ids);             // ask without subscribing (a page that knows all its photos)
const credits = useLiveCredits(b);     // creditsFor(b) that follows live photos (back page, About)
// useLivePhotos re-renders on live results *and* on bundled photos arriving (subscribePhotos/photosSnapshot
// in data/photos/index.js), so photos downloaded while the page is open appear without a reload.
const [on, setOn] = useLivePhotosSetting();   // entry-safe; <LivePhotosToggle /> is the switch
```

**Live photos** (`data/photos/live.js`, `commons.js`). A manifest slot with no
bundled photo is looked up by the visitor's browser on Wikimedia Commons —
no build step, no server, no key: the API answers anonymous CORS requests
(`origin=*`, `credentials: 'omit'`, no custom headers, so no preflight):

- *What it asks.* `action=query&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1280`
  (+ `iiextmetadatafilter`, `redirects`) for ≤ 50 titles a request, following
  `continue` while imageinfo is owed; `generator=search&gsrnamespace=6&gsrsearch=<query> filetype:bitmap&gsrlimit=10`
  for the search fallback. Ids asked for in the same tick (every `<Photo>` of
  a render, plus `useRequestLivePhotos` from the Viewer — a brochure's whole
  set — and Home) form one batch, resolved in rounds: (1) each slot's first
  candidate, (2) the other candidates of slots still without a photo,
  (3) one search per slot still without one. A brochure is usually one
  request; ≤ 2 API requests run at once.
- *Policy* (shared with `npm run photos:fetch` through `scripts/photos/lib.mjs`):
  the file exists (missing/invalid titles skipped, normalised titles and
  redirects followed), is JPEG/PNG/WebP, ≥ 1600 px on its long edge, and has
  a free licence (CC0, PD, CC BY, CC BY-SA; NC/ND, non-free or no licence
  rejected; CC BY/BY-SA need a licence link). Search results: right shape for
  the slot's `use` (cover/full portrait or near-square, 0.5–1.1 : 1; wide/spread
  1.4–2.4 : 1, so no panorama strip that the page would crop to a sliver;
  any = largest), then size, never a file another slot already shows
  (`rankSearchResults` and `orientationFit` live in `scripts/photos/lib.mjs`,
  so the download's search fallback picks the same way).
- *Images.* Only Wikimedia's standard thumbnail steps — 500, 960, 1280, 1920 —
  derived from `thumburl` by swapping its `/<n>px-` segment (or built the way
  Wikimedia names thumbnails when the original is ≤ 1280 px), never a step at
  or above the original's width (the original itself tops the srcset when it
  is ≤ 1920 px). `width`/`height` are the original's, so no layout shift. Only
  `https://upload.wikimedia.org/wikipedia/commons/…` URLs are accepted.
- *Credits* from `extmetadata`, as plain text (HTML stripped, entities
  decoded, never injected): author (`Attribution`, else `Artist`; its first
  link kept as `authorUrl`), `LicenseShortName`, `LicenseUrl`, the file page
  (`descriptionurl`) as `sourceUrl`. A photo found by search uses the work's
  title as alt text (the manifest's may not describe it).
- *Cache.* Memory, plus `localStorage` `tabi:live-photos:v1`
  (`{ v: 1, photos: { [id]: { s: <slot signature>, at, r: record } | { s, at, fail: 1 } } }`):
  photos 30 days, "nothing usable" 1 day; a changed manifest entry (new
  candidates or query) changes the signature, so it is looked up again.
  Each round's finds are written as soon as the round ends, so a reload in
  the middle of a long batch (`#/credits`) keeps them.
  Records read back are re-validated (`sanitizeLiveRecord`). Every slot
  cached takes ~0.85 KB (~130 KB for all 151); a full quota only loses the cache. HTTP/API errors and timeouts are kept in memory only.
- *Off switches.* `navigator.onLine === false` → nothing is asked until the
  `online` event; the visitor's setting `tabi:live-photos-enabled` (default on,
  footer and `#/credits`) → nothing asked or shown; a request that cannot reach
  Commons at all (no network, a CSP in a sandboxed preview) → the session
  stops asking after that one attempt, silently (the browser itself logs the
  blocked request once); three live images failing before any loads (an
  `img-src` CSP) → no live images, and no more API requests, for the session.
  Switching the setting off (or going offline) while a batch is out aborts
  its requests in flight and asks nothing more. In every case the art stays.
- *Priority* in `getPhoto`/`resolvePhoto`/`<Photo>`: bundled photo > live
  photo (`live: true`, no LQIP — the art stays under it until it has faded
  in) > generative art. Vitest never reaches Wikimedia (`index.js` passes no
  `fetch` in test mode); `live.test.js` drives a resolver with a fake one.
- *Explaining the art.* `live.health()` (`{ asked, ready, failed, loading,
  waiting, enabled, online, blocked, transport }`) feeds `PhotoNotice`
  (`components/photo/`, lazy, mounted by AppShell 2.5 s in): when slots on
  screen lack a photo because live photos are off, the browser is offline,
  Commons is blocked or every lookup failed (`placeholderReason`), it shows
  one dismissible note — once per session (`sessionStorage`
  `tabi:photo-notice`), never in the console — saying the patterned pictures
  are placeholder art, why, and how to get the photos (Try again, Turn photo
  loading on, `npm run photos:fetch`). In development it reads the
  background download's progress from the `tabi-photo-status` plugin
  instead. It closes itself once every slot it was about has a photo.
  Bundled search finds (`via: 'search'` in photos.generated.json) take the
  work's title as alt text, like live ones.

Pages are fixed layouts measured in `cqw`; the host gives them a width and
adds radius/shadow. Page headings are h2/h3, so the host provides the h1.
Keep host selectors class-only around pages (`.x h2 {}` would override them).

Shell helpers:

```js
const { open, close, toggle, isOpen } = usePalette();  // components/layout/palette.js (⌘K is bound once)
const navHidden = useNavHidden();                      // components/layout/navState.js — navbar tucked away?
import { fold, foldQuery, createSearchIndex, search, highlight } from '../../components/layout/search.js';
import { matchesHotkey, modKeyLabel } from '../../hooks/useHotkey.js';     // '+' and 'mod++' mean the plus key
```

Text search everywhere (palette and Library) folds case, Latin diacritics,
full/half width and katakana→hiragana through `search.js`, so a query matches
the same way in both. Both also index the hiragana readings from
`data/kana.js`, so a reading typed with an IME finds the kanji title.

In the Library, filters push a history entry; a search pushes one for its
first query and then replaces it while typing, so Back steps out of a search
to the view before it.

## Layers

| z-index | What |
| --- | --- |
| `--z-grain` 1000 | film grain (pointer-events: none) |
| `--z-toast` + 1 | skip link |
| `--z-toast` 100 | toasts (rendered into the fullscreen element while one is active) |
| `--z-toast` − 1 | Studio publish stamp |
| `--z-modal` + 2 | Studio popovers (inside modals) |
| `--z-modal` 90 | Modal, Drawer, command palette |
| `--z-nav` + 2 | viewer "More" menu |
| `--z-nav` 50 | navbar |
| `--z-nav` − 1 | route-transition curtain |
| `--z-nav` − 2 | sticky page toolbars: Library filter bar, viewer toolbar, Studio phone dock |
| `--z-nav` − 3 | viewer page overview |
| `--z-raised` 10 | IconButton tooltips, local raises |

Anything with a larger local z-index (the flipbook's spine and dog-ears)
lives inside an `isolation: isolate` container.

## Conventions

- One component per file, `PascalCase.jsx` with a sibling `PascalCase.module.css`.
  Pure logic (filtering, search scoring, reducers) lives in plain `.js`
  modules with unit tests next to them (`*.test.js`).
- Short JSDoc on every exported component describing props.
- Accessibility is not optional: semantic landmarks and headings, labelled
  controls, visible focus, keyboard support for every pointer interaction,
  `aria-live` for dynamic results, `lang="ja"` on Japanese.
- Animate `transform` and `opacity`. Avoid layout thrash and heavy filters on
  many elements. Custom rAF/canvas animation must check `useReducedMotion()`.
- Responsive from 360px to 1920px+. No horizontal page scroll on phones.
- Facts about Japan must be real and conservative. Built-in brochures follow
  `docs/REAL_CONTENT.md`: real places, facts checked against official sources,
  credited free-licence photos, published by "Tabi Guides" (the app's own
  imprint), no phone numbers. Studio templates use real places (with
  coordinates and library photos) and real quotes, but every story, hour,
  price and link is placeholder copy: no businesses, people, prices or
  contact details (`templates.test.js`).
- Photos are never typed in by hand: only the scripts write
  `public/photos/` and `photos.generated.json`, and live photos come only
  from Wikimedia Commons' own servers (thumbnails on upload.wikimedia.org,
  which Wikimedia allows with attribution; `data/photos/live.js`). Never
  commit placeholder or "test" images there. `TABI_COMMONS_API` /
  `TABI_COMMONS_UPLOAD` (`scripts/photos/io.mjs` `routeUrl`) send the
  download to a fake Commons server for the end-to-end test only — run it
  in a copy of the project, never in the real one.
- Storage keys (all via `lib/storage.js`, prefix `tabi:`): `theme`
  (ThemeContext, synced across tabs), `brochures`, `favorites`, `recent`
  (BrochureContext, synced across tabs), `progress` (`{ [brochureId]: page }`,
  written by the reader, read by "Continue reading" — `lib/progress.js`),
  `studio-draft`, `studio-edit:<id>`, `trips` (the viewer's private trip
  planner, `components/viewer/tripPlan.js`; nothing is sent anywhere — the
  old `inquiries` records are migrated once, without name or email, and
  removed), `motion`
  (`'auto' | 'paused'`, the Home hero's "Pause motion" control —
  `pages/Home/homeMotion.js`; ambient Home loops check `useStill()`),
  `live-photos-enabled` (`true | false`, "Load photos from Wikimedia
  Commons" — `data/photos/liveSetting.js`, synced across tabs) and
  `live-photos:v1` (the live-photo cache, written directly by
  `data/photos/live.js`).
  `newsletter` (an e-mail address the old, never-sending "Seasonal letters"
  sign-up kept) is removed at startup by `main.jsx`.
  Per-tab keys live in sessionStorage: `tabi:library-search`, the
  Library's last query, which the reader's "Library" link returns to
  (`lib/librarySearch.js`), `tabi:chunk-reload`, the time of the last
  automatic reload after a failed chunk (`components/layout/chunkError.js`),
  and `tabi:photo-notice` (the photo notice has been shown this session —
  `components/photo/photoNotice.js`).
