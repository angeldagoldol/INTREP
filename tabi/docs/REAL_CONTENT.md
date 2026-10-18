# Real places, real facts, real photos

Tabi's built-in brochures describe **real places in Japan with verified
information and real, credited photographs**. This guide is the standard for
writing them. Data shapes are in `src/data/schema.js`.

## 1. Facts

- Every factual claim (history, dates, heights, distances, hours, prices,
  access, festival dates, UNESCO status) must be checked against **at least two
  independent sources**. Prefer official sources: the temple/shrine/museum's
  own site, city or prefectural tourism sites, JNTO (japan.travel), railway
  operators (JR, Odakyu, Hankyu…), national park pages. Use Wikipedia for
  history and coordinates, cross-checked.
- Log every fact and its sources in `docs/research/<slug>.md` (a table:
  claim → value → source URLs → date checked). Reviewers check this file.
- Prices and opening hours change. Use the latest values you can verify, set
  the brochure's `factsChecked` (e.g. `"October 2026"`), and phrase uncertain
  values honestly ("about ¥500", "usually 9:00–17:00"). If you cannot verify a
  number, leave it out.
- No invented businesses, hotels, tour operators, guides, people, testimonials,
  prices or contact details. Built-in brochures are published by **Tabi Guides**
  (this app's own editorial imprint). Never present a brochure as published by
  a real organisation.
- Real businesses may be *mentioned* as places to visit (a famous market, a
  museum, a ryokan town), but do not endorse or advertise a specific private
  business as if sponsored.
- `contact` pages are **Visitor information**: official websites (real `https`
  URLs you found) and tourist information centres with their real location. No
  phone numbers.
- `quote` pages carry a **real, attributable** quote: a haiku or poem (Bashō,
  Buson, Issa, Shiki…, give `quoteJp` = original Japanese and `quote` = an
  English translation; label your own translation "Translation: Tabi Guides" in
  `role`), a proverb, or a documented historical line. Verify the wording.
- `place` pages describe one real sight, led by its photograph: what it is,
  why it matters, what to look for, plus 2–5 `facts` rows (Hours, Admission,
  Getting there, Time needed, Best time) and its `lat`/`lng` (decimal
  degrees, 4 decimals — printed in small type beside the name) and official
  `website`. Keep the story short: the photograph takes the room the text
  leaves.
- **No maps.** Tabi shows real photographs of the places, never a map; the
  `map` page type is retired (old brochures and drafts drop such pages when
  they are read back).
- Japanese must be correct: kanji/kana, natural romaji with macrons
  (Tōdai-ji, Arigatō). Use common English names for big cities (Tokyo, Kyoto,
  Osaka). Phrasebook entries must be natural, polite Japanese.
- Be respectful: Hiroshima, religious sites, Ainu and Ryūkyū cultures,
  geiko/maiko etiquette, photography rules.

## 2. Photos

All photos come from **Wikimedia Commons** under free licences (CC0, public
domain, CC BY, CC BY-SA). They are downloaded, resized and credited by
`scripts/photos/fetch.mjs`, or — until they are — shown live from Wikimedia
Commons by the visitor's browser under the same licence and size policy
(`src/data/photos/live.js`), using each slot's `candidates` and then its
`query` (Commons search words), so write a `query` that finds the place.

Each brochure lists its photos in `src/data/photos/manifest/<slug>.json`:

```json
{
  "brochure": "kyoto-thousand-gates",
  "photos": [
    {
      "id": "kyoto-senbon-torii",
      "use": "cover",
      "candidates": [
        "File:Fushimi Inari-taisha, Senbon Torii.jpg",
        "File:Another candidate.jpg",
        "File:A third candidate.jpg"
      ],
      "alt": "A tunnel of vermilion torii gates on a forest path",
      "caption": "Senbon Torii at Fushimi Inari Taisha",
      "place": "Fushimi Inari Taisha",
      "focus": "50% 45%"
    }
  ]
}
```

- `id`: kebab-case, globally unique, prefixed with the place (`kyoto-…`).
  Pages reference it: `photo: 'kyoto-senbon-torii'`.
- `use`: `cover` (portrait page; needs a strong central subject), `wide`
  (landscape), or `any`.
- `candidates`: exact Commons file titles, best first, at least 2 and ideally 3.
  Find them with web search, e.g. `site:commons.wikimedia.org File: Fushimi Inari
  torii`, and prefer files marked *Featured picture*, *Quality image* or
  *Valued image*. A result URL `https://commons.wikimedia.org/wiki/File:Foo_bar.jpg`
  is the title `File:Foo bar.jpg` (underscores → spaces, percent-decoded).
  Avoid: people as the main subject, watermarks, collages, heavy HDR, night
  shots that are mostly black, images under ~2000 px wide.
- `alt` describes what is visible; `caption` names the place (and season/time
  if relevant). The photographer credit and licence are filled in
  automatically from Commons — never type them by hand.
- `focus`: CSS `object-position` keeping the subject in frame when cropped.
- A curation step later downloads every candidate, looks at them and records
  the chosen one as `"file"`. Until a photo is downloaded the app shows the
  brochure's generative art in its place, so brochures always render.

Typical photo budget per brochure: cover 1, intro 1, each `place` page 1,
each gallery 3–4, plus a full-page photo (`<prefix>-fullpage`, `use: "full"`,
portrait or near-square) and a double-page spread (`<prefix>-spread`,
`use: "spread"`, a wide landscape that still works cut down the middle) —
about 13–16 in total.

## 3. Brochure outline (16–18 pages)

`cover` (photo) → `intro` (photo) → 2–3 × `place` → `features` → `gallery` →
a second `gallery` of real photographs (3–4) → `agenda` (a realistic day or trip plan using real opening hours and
travel times) → `pricing` as **Costs** (real admission fees, passes, fares) →
`phrases` → `quote` (real) → `contact` as **Visitor information** → `back`
(sign-off, `tagline` = "Facts checked <month year> · Tabi Guides").

Between them, two magazine **photo pages** (`type: "photo"`):

- a **double-page spread** — two pages with `span: "left"` and `span: "right"`
  and the same `photo` — usually just after the opening pages, beside the
  place it shows. The left half must be at an odd index (page 2, 4, 6…) with
  the right half right after it, or the halves will not face each other in
  the booklet (`src/data/brochures.test.js` checks it, with
  `src/data/photoSpreadEdits.js`);
- a **full-page photo**, often facing a gallery or a place page.

Their captions come from the manifest: `caption` is the slot's caption,
`name` its place, `nameJp` the place's Japanese name — log it in the research
file like any other fact. Don't add facts the manifest and research log don't have.

The brochure-level `location`, `sources` (official sites first) and
`factsChecked` fields are required for built-ins.
