/**
 * Editorial copy for the Home page. Facts about Japan are real and logged in
 * docs/research/home.md; quotes are real haiku with our own translations.
 * Photo ids point at src/data/photos/manifest/home.json (`home-…`); until a
 * photo is downloaded, each slot shows its generative fallback art.
 */

/** Section running heads: number, English label, Japanese label. */
export const SECTIONS = {
  hero: { num: '01', label: 'Online brochures about Japan', jp: '表紙' },
  words: { num: '02', label: 'Words to travel with', jp: '言葉' },
  nostalgic: { num: '03', label: 'Nostalgic Japan', jp: '懐かしい日本' },
  featured: { num: '04', label: 'Featured', jp: '特集' },
  seasons: { num: '05', label: 'Seasons', jp: '四季' },
  regions: { num: '06', label: 'Regions', jp: '地方' },
  how: { num: '07', label: 'How it works', jp: '使い方' },
  numbers: { num: '08', label: 'Japan in numbers', jp: '数字' },
  haiku: { num: '09', label: 'Haiku', jp: '俳句' },
  studio: { num: '10', label: 'Studio', jp: '制作' },
};

/**
 * 懐かしい日本 — Nostalgic Japan: a mosaic of real photographs of nostalgic
 * places, from the Nostalgic Japan brochure's photo manifest
 * (src/data/photos/manifest, ids starting "nostalgic-"). The section shows
 * nothing until that manifest has photos.
 */
export const NOSTALGIC = {
  prefix: 'nostalgic-',
  slug: 'nostalgic-japan',
  /** The mosaic's largest number of photographs. */
  limit: 7,
  word: { jp: '懐かしい', romaji: 'natsukashii' },
  intro:
    'Natsukashii (懐かしい) is the warm, wistful feeling of something dear from long ago. Old streets, wooden inns and quiet stations where it still lingers — in real photographs.',
};

/** Manifest uses in the order the mosaic wants them: tall pictures lead, wide ones fill the long tiles. */
const USE_ORDER = { cover: 0, full: 1, wide: 2, spread: 3, any: 4 };

/**
 * The photographs the Nostalgic Japan section shows, from a listPhotos()
 * result: ids starting "nostalgic-", the lead picture first (a cover-shaped
 * one when there is one), then the rest in manifest-id order with wide
 * pictures last (the mosaic's bottom row is wide) and one picture per place
 * (a second view of the same street waits for the brochure), at most `limit`.
 * Pure; [] when the manifest has no such photos yet.
 */
export function nostalgicPhotos(photos, limit = NOSTALGIC.limit) {
  const mine = (Array.isArray(photos) ? photos : []).filter((p) => typeof p?.id === 'string' && p.id.startsWith(NOSTALGIC.prefix));
  const rank = (p) => USE_ORDER[p.use] ?? USE_ORDER.any;
  const lead = mine.reduce((best, p) => (best === null || rank(p) < rank(best) ? p : best), null);
  if (!lead) return [];
  const wide = (p) => (p.use === 'wide' || p.use === 'spread' ? 1 : 0);
  const placeOf = (p) => (typeof p.place === 'string' ? p.place.trim().toLowerCase() : '');
  const picked = [lead];
  const places = new Set([placeOf(lead)].filter(Boolean));
  for (const p of mine.filter((x) => x !== lead).sort((a, b) => wide(a) - wide(b))) {
    const place = placeOf(p);
    if (place && places.has(place)) continue;
    if (place) places.add(place);
    picked.push(p);
  }
  return picked.slice(0, Math.max(0, limit));
}

/**
 * A caption split into its parts for a magazine caption:
 *   "Ginzan Onsen, Yamagata — wooden inns on a snowy day · 銀山温泉"
 *     → { text: 'Ginzan Onsen, Yamagata — wooden inns on a snowy day', title: 'Ginzan Onsen, Yamagata',
 *         note: 'wooden inns on a snowy day', jp: '銀山温泉' }
 * `jp` is the longest run of kana/kanji (with ・ and spaces inside it), and the
 * separators around it are tidied away; `title`/`note` split the English at
 * its first spaced dash (" — " or " – "), else `title` is the whole line and
 * `note` is ''. No Japanese: `jp` is ''.
 */
export function splitCaption(caption) {
  const source = typeof caption === 'string' ? caption.trim() : '';
  const runs = source.match(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff々〆ヶ][\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff々〆ヶ・ー\u3000 ]*/g) ?? [];
  const jp = runs.reduce((best, run) => (run.trim().length > best.length ? run.trim() : best), '');
  if (!jp) return { text: source, jp: '', ...titled(source) };
  // "Name (銀山温泉), place": the brackets go with the Japanese.
  const at = source.indexOf(jp);
  let before = source.slice(0, at);
  let after = source.slice(at + jp.length);
  if (/[（(]\s*$/.test(before) && /^\s*[)）]/.test(after)) {
    before = before.replace(/\s*[（(]\s*$/, '');
    after = after.replace(/^\s*[)）]/, '');
  }
  const SEP = /[—–·|/:;,]/;
  const left = before.replace(/[\s—–·|/:;,]+$/, '');
  const right = after.replace(/^[\s—–·|/:;,]+/, '');
  const sep = before.trimEnd().slice(-1).match(SEP)?.[0] ?? after.trimStart()[0]?.match(SEP)?.[0] ?? '';
  const joiner = !left || !right ? '' : sep === ',' ? ', ' : sep ? ` ${sep} ` : ' ';
  const text = `${left}${joiner}${right}`.replace(/\s+([,.;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  return { text, jp, ...titled(text) };
}

/** "Place, Region — what it shows" → { title: 'Place, Region', note: 'what it shows' }. */
function titled(text) {
  const at = text.search(/\s[—–]\s/);
  if (at <= 0) return { title: text, note: '' };
  return { title: text.slice(0, at).trim(), note: text.slice(at + 3).trim() };
}

/**
 * Every photograph the Home page shows, asked for together (so live photos
 * arrive in one batch) and listed under "Home page" on #/credits: the hero,
 * the Nostalgic Japan mosaic (from `photos`, a listPhotos() result), the
 * seasons and the regions.
 */
export function homePhotoIds(photos) {
  return [
    ...Object.values(HERO_PANELS).map((p) => p.photo),
    ...nostalgicPhotos(photos).map((p) => p.id),
    ...Object.values(SEASON_PHOTOS),
    ...Object.values(REGION_NOTES).map((r) => r.photo),
  ];
}

/**
 * The hero tri-fold's three inside panels: a real photograph each (falling
 * back to the generative `art`), with a printed caption block.
 */
export const HERO_PANELS = {
  left: {
    photo: 'home-hero-fuji',
    art: 'fuji',
    seed: 23,
    jp: '富士山',
    title: 'Mount Fuji',
    body: 'Japan’s highest peak rises 3,776 m between Shizuoka and Yamanashi.',
    folio: '02',
  },
  middle: {
    photo: 'home-hero-torii',
    art: 'torii',
    seed: 23,
    jp: '伏見稲荷大社',
    title: 'Fushimi Inari',
    body: 'Some 10,000 vermilion torii, gifts from worshippers, climb Mount Inari in Kyoto.',
    folio: '03',
  },
  right: {
    photo: 'home-hero-shibuya',
    art: 'ichimatsu',
    seed: 61,
    jp: '渋谷',
    title: 'Shibuya Crossing',
    body: 'At peak times, up to 3,000 people cross at once when the lights turn green.',
    folio: '04',
  },
};

/** Two marquee rows of Japanese words: jp · romaji · meaning. */
export const WORDS = [
  [
    { jp: '旅', romaji: 'tabi', meaning: 'journey' },
    { jp: '桜', romaji: 'sakura', meaning: 'cherry blossom' },
    { jp: '温泉', romaji: 'onsen', meaning: 'hot spring' },
    { jp: '祭', romaji: 'matsuri', meaning: 'festival' },
    { jp: '侘び寂び', romaji: 'wabi-sabi', meaning: 'beauty in the imperfect and impermanent' },
    { jp: '一期一会', romaji: 'ichigo ichie', meaning: 'one time, one meeting' },
    { jp: '木漏れ日', romaji: 'komorebi', meaning: 'sunlight through leaves' },
    { jp: 'おもてなし', romaji: 'omotenashi', meaning: 'wholehearted hospitality' },
    { jp: '間', romaji: 'ma', meaning: 'the space between' },
  ],
  [
    { jp: '生き甲斐', romaji: 'ikigai', meaning: 'a reason for being' },
    { jp: '金継ぎ', romaji: 'kintsugi', meaning: 'mending with gold' },
    { jp: '花見', romaji: 'hanami', meaning: 'flower viewing' },
    { jp: '森林浴', romaji: 'shinrin-yoku', meaning: 'forest bathing' },
    { jp: '紅葉', romaji: 'momiji', meaning: 'autumn maple leaves' },
    { jp: '月見', romaji: 'tsukimi', meaning: 'moon viewing' },
    { jp: '風鈴', romaji: 'fūrin', meaning: 'wind chime' },
    { jp: '物の哀れ', romaji: 'mono no aware', meaning: 'the gentle sadness of passing things' },
    { jp: '縁', romaji: 'en', meaning: 'the ties that bring people together' },
  ],
];

/** One line per season for the 四季 accordion (data/seasons.js has the rest). */
export const SEASON_LINES = {
  spring: 'Hanami picnics under the blossom as the sakura front travels north, week by week, towards Hokkaidō.',
  summer: 'Lantern-lit matsuri, fireworks over the rivers, lavender in Hokkaidō and cool air high in the Japan Alps.',
  autumn: 'Maple leaves turn crimson from the north southwards and from the peaks down, and temple gardens glow for weeks.',
  winter: 'Powder snow in Hokkaidō, steaming outdoor onsen and quiet temples under a white roof.',
};

/** The photograph an open season shows (manifest ids; the summer line mentions its lavender). */
export const SEASON_PHOTOS = {
  spring: 'home-season-spring',
  summer: 'home-season-summer',
  autumn: 'home-season-autumn',
  winter: 'home-season-winter',
};

/**
 * Panel colours per season: the wa-iro fill and an ink that stays AA-legible
 * on it in both themes. Autumn's maple is deepened a touch to carry cream text.
 */
export const SEASON_SWATCH = {
  spring: { fill: 'var(--wa-sakura)', ink: 'var(--wa-sumi)' },
  summer: { fill: 'var(--wa-ai)', ink: 'var(--wa-kinari)' },
  autumn: { fill: 'color-mix(in srgb, var(--wa-momiji) 80%, var(--wa-sumi))', ink: 'var(--wa-kinari)' },
  winter: { fill: 'var(--wa-sora)', ink: 'var(--wa-sumi)' },
};

/**
 * What each region is known for (docs/research/home.md §3), the place its
 * tile pictures (`place`/`placeJp`, the manifest photo `photo`) and the
 * generative art shown until that photo is downloaded.
 */
export const REGION_NOTES = {
  hokkaido: {
    knownFor: 'Powder snow, Furano’s July lavender, Ainu heritage and the wild Shiretoko Peninsula.',
    place: 'Shiretoko Five Lakes',
    placeJp: '知床五湖',
    photo: 'home-region-hokkaido',
    art: 'kumo',
    seed: 23,
  },
  tohoku: {
    knownFor: 'August lantern festivals, apple orchards, mountain onsen and Bashō’s Narrow Road.',
    place: 'Yamadera (Risshaku-ji)',
    placeJp: '山寺（立石寺）',
    photo: 'home-region-tohoku',
    art: 'asanoha',
    seed: 7,
  },
  kanto: {
    knownFor: 'Tokyo and Yokohama, the shrines of Nikkō, Kamakura’s Great Buddha and Hakone’s hot springs.',
    place: 'Sensō-ji, Asakusa',
    placeJp: '浅草寺',
    photo: 'home-region-kanto',
    art: 'ichimatsu',
    seed: 23,
  },
  chubu: {
    knownFor: 'Mount Fuji, the Japan Alps, thatched Shirakawa-gō and castle towns like Matsumoto.',
    place: 'Matsumoto Castle',
    placeJp: '松本城',
    photo: 'home-region-chubu',
    art: 'fuji',
    seed: 7,
  },
  kansai: {
    knownFor: 'Kyoto’s temples, Nara’s deer and Great Buddha, Osaka’s street food and Himeji’s white castle.',
    place: 'Tōdai-ji, Nara',
    placeJp: '東大寺',
    photo: 'home-region-kansai',
    art: 'torii',
    seed: 7,
  },
  chugoku: {
    knownFor: 'Hiroshima’s Peace Memorial, Miyajima’s floating torii and the Seto Inland Sea.',
    place: 'Itsukushima Shrine, Miyajima',
    placeJp: '厳島神社',
    photo: 'home-region-chugoku',
    art: 'seigaiha',
    seed: 61,
  },
  shikoku: {
    knownFor: 'The 88-temple pilgrimage, Iya Valley vine bridges and Dōgo’s ancient hot spring.',
    place: 'Iya no Kazurabashi',
    placeJp: '祖谷のかずら橋',
    photo: 'home-region-shikoku',
    art: 'enso',
    seed: 19,
  },
  kyushu: {
    knownFor: 'Smoking Sakurajima and Aso, Beppu’s hot springs and Okinawa’s coral seas.',
    place: 'Sakurajima',
    placeJp: '桜島',
    photo: 'home-region-kyushu',
    art: 'hinomaru',
    seed: 23,
  },
};

/** "How it works" steps. */
export const STEPS = [
  {
    id: 'browse',
    title: 'Browse',
    jp: '探す',
    romaji: 'sagasu',
    text: 'Filter the library by region, season or mood — from Kyoto’s temple lanes to Tokyo’s late-night counters.',
  },
  {
    id: 'flip',
    title: 'Flip',
    jp: 'めくる',
    romaji: 'mekuru',
    text: 'Open any brochure and turn its pages like paper — real 3D page-turns, on any screen, with or without a mouse.',
  },
  {
    id: 'create',
    title: 'Create',
    jp: '作る',
    romaji: 'tsukuru',
    text: 'Pick a cover motif, colours and pages in the Studio. Your brochure is saved right here in your browser.',
  },
];

/** Japan in numbers (docs/research/home.md §1.2, §2.1). */
export const FACTS = [
  {
    id: 'prefectures',
    value: 47,
    unit: '',
    label: 'prefectures',
    jp: '都道府県',
    note: 'From Hokkaidō in the north to Okinawa in the south.',
  },
  {
    id: 'islands',
    value: 14125,
    unit: '',
    label: 'islands',
    jp: '島',
    note: 'Recounted by the Geospatial Information Authority in 2023; the old figure was 6,852.',
  },
  {
    id: 'volcanoes',
    value: 111,
    unit: '',
    label: 'active volcanoes',
    jp: '活火山',
    // "About 50": JMA's list of continuously monitored volcanoes was 50 from 2016; 51 is unconfirmed.
    note: 'About 50 of them are watched around the clock by the Japan Meteorological Agency.',
  },
  {
    id: 'shinkansen',
    value: 320,
    unit: 'km/h',
    label: 'top Shinkansen service speed',
    jp: '新幹線',
    note: 'Reached by Hayabusa trains between Utsunomiya and Morioka, on the Tōhoku Shinkansen.',
  },
];

/** Credit for every translation below (REAL_CONTENT: label our own translations). */
export const TRANSLATION_CREDIT = 'Translation: Tabi Guides';

/**
 * Five classic haiku, sent as postcards from the places that inspired them
 * (docs/research/home.md §1.1). `jp`, `romaji` and `en` hold the three
 * phrases of each poem; `en` is our own translation. `year` is softened to
 * "c." where the research marks the date uncertain. `art`/`seed` draw the
 * postage stamp. All three poets died before 1903: the poems are public domain.
 */
export const HAIKU = [
  {
    id: 'basho-furuike',
    poet: 'Matsuo Bashō',
    poetJp: '松尾芭蕉',
    place: 'Fukagawa, Edo',
    today: 'Kōtō, Tokyo',
    postmark: 'EDO',
    year: '1686',
    jp: ['古池や', '蛙飛びこむ', '水の音'],
    romaji: ['Furuike ya', 'kawazu tobikomu', 'mizu no oto'],
    en: ['The old pond —', 'a frog jumps in,', 'the sound of water.'],
    art: 'seigaiha',
    seed: 23,
  },
  {
    id: 'basho-hiraizumi',
    poet: 'Matsuo Bashō',
    poetJp: '松尾芭蕉',
    place: 'Hiraizumi, Iwate',
    postmark: 'HIRAIZUMI',
    year: '1689',
    jp: ['夏草や', '兵どもが', '夢の跡'],
    romaji: ['Natsukusa ya', 'tsuwamono-domo ga', 'yume no ato'],
    en: ['Summer grasses —', 'all that is left', 'of warriors’ dreams.'],
    art: 'asanoha',
    seed: 7,
  },
  {
    id: 'basho-yamadera',
    poet: 'Matsuo Bashō',
    poetJp: '松尾芭蕉',
    place: 'Yamadera (Risshaku-ji), Yamagata',
    postmark: 'YAMADERA',
    year: '1689',
    jp: ['閑さや', '岩にしみ入る', '蝉の声'],
    romaji: ['Shizukasa ya', 'iwa ni shimiiru', 'semi no koe'],
    en: ['Such stillness —', 'the cicadas’ cry', 'soaks into the rocks.'],
    art: 'enso',
    seed: 19,
  },
  {
    id: 'issa-kashiwabara',
    poet: 'Kobayashi Issa',
    poetJp: '小林一茶',
    place: 'Kashiwabara, Shinano',
    today: 'Shinano-machi, Nagano',
    postmark: 'KASHIWABARA',
    year: 'c. 1812',
    jp: ['是がまあ', 'つひの栖か', '雪五尺'],
    romaji: ['Kore ga maa', 'tsui no sumika ka', 'yuki go-shaku'],
    en: ['So this, then,', 'is my final home?', 'Five feet of snow.'],
    art: 'kumo',
    seed: 23,
  },
  {
    id: 'shiki-horyuji',
    poet: 'Masaoka Shiki',
    poetJp: '正岡子規',
    place: 'Hōryū-ji, Ikaruga, Nara',
    postmark: 'IKARUGA',
    year: '1895',
    jp: ['柿食へば', '鐘が鳴るなり', '法隆寺'],
    romaji: ['Kaki kueba', 'kane ga naru nari', 'Hōryūji'],
    en: ['I bite a persimmon —', 'and the bell rings out', 'at Hōryū-ji.'],
    art: 'hinomaru',
    seed: 61,
  },
];
