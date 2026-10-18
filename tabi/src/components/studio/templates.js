/**
 * Starting points for the Studio: five Japan brochures laid out the way the
 * library's real-content brochures are (docs/REAL_CONTENT.md) — a photo
 * cover, real places on photo-led place pages with their coordinates, a
 * gallery or full-page photograph of more real places, costs, phrases, a real
 * quote with its original Japanese and visitor information —
 * plus a blank three-page brochure and a remix of any library brochure.
 *
 * What is real: the places, their Japanese names and coordinates (as checked
 * for the library's own brochures), the photos (ids from the photo library,
 * credited free-licence pictures of those places), the phrases and the
 * quotes (docs/research/home.md, mount-fuji-five-lakes.md, osaka-kuidaore.md).
 * What is yours to write: every story, hour, price and link. Those start as
 * plain prompts and dashes, so nothing unchecked looks finished — and there
 * are no businesses, people, prices or contact details to mistake for real.
 */
import { PAGE_TYPES } from '../../data/schema.js';
import { createId } from '../../lib/id.js';
import { randomSeed } from './pageLimits.js';
import { PALETTE_MAP } from './palettes.js';

const theme = (paletteId, typeface) => ({ ...PALETTE_MAP[paletteId].theme, typeface });

/** Who the template says made it — obviously the person's to change. */
const YOU = 'Your name';

/* --- Shared placeholder pages --------------------------------------------- */

/** Practical facts, waiting for values checked on the official site. */
const factsToCheck = (getThere) => [
  { label: 'Hours', value: 'Check the official site' },
  { label: 'Admission', value: '—' },
  { label: 'Getting there', value: getThere },
];

/** Placeholder story for a place page: what to write, in the brochure's voice. */
const placeBody = (focus) =>
  `Say what this place is and why it is worth the trip — ${focus}. Three or four sentences are plenty.\n\nKeep hours, prices and directions in the facts beside this text, and check each one on the official site before you publish.`;

const costs = (lines) => ({
  type: 'pricing',
  heading: 'What it costs',
  note: 'Add the prices you checked, and the month you checked them in Details. Prices change, so say “about” when you are unsure.',
  plans: lines,
});

const visitorInformation = (where) => ({
  type: 'contact',
  heading: 'Visitor information',
  body: `List the official sites and the tourist information centre readers can check before they go to ${where}. Add a link to each one.`,
  cta: 'Open the official guide',
  ctaUrl: '',
  details: [
    { icon: 'Globe', label: 'Official site', value: 'Name of the official site', url: '' },
    { icon: 'MapPin', label: 'Tourist information', value: 'Where the nearest centre is', url: '' },
  ],
});

const back = (title) => ({
  type: 'back',
  title,
  body: 'Say who made this brochure and why — then thank your readers.',
  tagline: 'Facts checked — month and year · Your name',
});

export const TEMPLATES = [
  {
    id: 'city-weekend',
    name: 'Weekend in a city',
    jp: '週末の街',
    blurb: 'Two days in Tokyo: a temple at dawn, the scramble at dusk, four real places in photographs.',
    brochure: {
      title: 'Tokyo in 48 Hours',
      titleJp: '東京',
      subtitle: 'Old temples, new towers and a counter for dinner — your weekend in the capital',
      category: 'cities',
      region: 'kanto',
      seasons: ['spring', 'autumn'],
      organization: YOU,
      location: { name: 'Tokyo', nameJp: '東京', prefecture: 'Tokyo', lat: 35.6897, lng: 139.6922 },
      summary: 'A two-day Tokyo weekend through four real places — Sensō-ji, the Shibuya scramble, Tokyo Tower and Golden Gai — ready for your own words and photos.',
      tags: ['tokyo', 'weekend', 'neighbourhoods', 'trains'],
      format: 'bifold',
      theme: theme('neon-tokyo', 'sans'),
      cover: { art: 'ichimatsu', seed: 14, photo: 'tokyo-kaminarimon' },
      pages: [
        {
          type: 'cover',
          eyebrow: 'Kantō · A two-day city guide',
          title: 'Tokyo in 48 Hours',
          titleJp: '東京',
          subtitle: 'Write one line that makes people want to turn the page.',
        },
        {
          type: 'intro',
          kicker: 'Before you go',
          heading: 'Your Tokyo, in two days',
          body: 'Start with why: the Tokyo you want readers to find, the season you would choose and who this weekend suits.\n\nThen set the scene for the places that follow. Short paragraphs read best — people skim a brochure before they read it.',
          pullQuote: 'One sentence worth remembering.',
          photo: 'tokyo-shibuya-street',
        },
        {
          type: 'place',
          kicker: 'Stop 01 · Asakusa',
          name: 'Sensō-ji',
          nameJp: '浅草寺',
          photo: 'tokyo-sensoji-night',
          body: placeBody('the gate, the incense, the hour you would go'),
          facts: factsToCheck('Nearest station, minutes on foot'),
          lat: 35.7148,
          lng: 139.7967,
          website: '',
        },
        {
          type: 'place',
          kicker: 'Stop 02 · Shibuya',
          name: 'Shibuya Crossing',
          nameJp: '渋谷スクランブル交差点',
          photo: 'tokyo-shibuya-crossing',
          body: placeBody('where to watch it from, and when to cross it yourself'),
          facts: [
            { label: 'Best time', value: 'Dusk, as the screens light up' },
            { label: 'Admission', value: 'Free' },
            { label: 'Getting there', value: 'Shibuya Station — add the exit' },
          ],
          lat: 35.6595,
          lng: 139.7005,
          website: '',
        },
        {
          type: 'gallery',
          heading: 'The city after dark',
          items: [
            { photo: 'tokyo-tower-night', art: 'hinomaru', seed: 17, caption: 'Tokyo Tower at night, Minato' },
            { photo: 'tokyo-golden-gai', art: 'ichimatsu', seed: 29, caption: 'Shinjuku Golden Gai at night' },
            { photo: 'tokyo-omoide-yokocho', art: 'kumo', seed: 41, caption: 'Omoide Yokochō, Shinjuku' },
          ],
        },
        {
          type: 'agenda',
          heading: 'How the weekend runs',
          items: [
            { time: '07:30', title: 'Sensō-ji', text: 'Why go early? Say what the morning is like.' },
            { time: '12:00', title: 'Lunch', text: 'A counter you love, or what to look for.' },
            { time: '16:00', title: 'Tokyo Tower', text: 'Add the opening hours once you have checked them.' },
            { time: '18:30', title: 'Shibuya Crossing', text: 'Where to watch the scramble from.' },
            { time: '21:00', title: 'Golden Gai', text: 'A line on how to visit politely.' },
          ],
        },
        {
          type: 'features',
          kicker: 'Good to know',
          heading: 'Four things that make Tokyo easy',
          items: [
            { icon: 'TrainFront', title: 'Get an IC card', text: 'Rechargeable cards such as Suica and PASMO work on most trains, subways and buses, and in many shops.' },
            { icon: 'Moon', title: 'Quiet on trains', text: 'Phone calls on trains are frowned upon — switch to silent mode and keep your voice low.' },
            { icon: 'Banknote', title: 'Carry some cash', text: 'Cards are common, but small restaurants, shrines and stalls may still take cash only.' },
            { icon: 'Leaf', title: 'Take your rubbish', text: 'Public bins are rare. Carry a small bag and recycle at stations or your hotel.' },
          ],
        },
        costs([
          { name: 'Sights', price: '—', period: 'adult tickets', features: ['Add each ticket you checked'], highlight: false },
          { name: 'Getting around', price: '—', period: 'per day', features: ['IC card fares, or a day pass', 'Say which lines it covers'], highlight: true },
        ]),
        {
          type: 'phrases',
          heading: 'City Japanese',
          items: [
            { jp: 'すみません', romaji: 'Sumimasen', meaning: 'Excuse me (to get attention)' },
            { jp: '渋谷駅はどこですか？', romaji: 'Shibuya-eki wa doko desu ka?', meaning: 'Where is Shibuya Station?' },
            { jp: 'これをください', romaji: 'Kore o kudasai', meaning: 'This one, please' },
            { jp: 'カードで払えますか？', romaji: 'Kādo de haraemasu ka?', meaning: 'Can I pay by card?' },
          ],
        },
        {
          type: 'quote',
          quote: 'The old pond — / a frog jumps in, / the sound of water.',
          quoteJp: '古池や蛙飛びこむ水の音',
          author: 'Matsuo Bashō',
          role: 'Fukagawa, Edo (today’s Tokyo), 1686 · Translation: Tabi Guides',
        },
        visitorInformation('Tokyo'),
        back('Mata ne, Tōkyō'),
      ],
    },
  },
  {
    id: 'onsen-escape',
    name: 'Onsen escape',
    jp: '湯めぐり',
    blurb: 'Hakone’s hot springs: a steaming volcanic valley, a sculpture park and a torii in the lake.',
    brochure: {
      title: 'Hakone: A Hot-Spring Weekend',
      titleJp: '箱根',
      subtitle: 'Steam vents, a lakeside shrine and a long evening in the bath — an onsen weekend in the hills',
      category: 'onsen',
      region: 'kanto',
      seasons: ['autumn', 'winter'],
      organization: YOU,
      location: { name: 'Hakone', nameJp: '箱根', prefecture: 'Kanagawa', lat: 35.2323, lng: 139.1069 },
      summary: 'An onsen weekend in Hakone through real places — Ōwakudani, the Open-Air Museum and Hakone Shrine — with bath etiquette and words for the bath.',
      tags: ['onsen', 'hakone', 'ryokan', 'weekend'],
      format: 'booklet',
      theme: theme('yuki', 'serif'),
      cover: { art: 'kumo', seed: 7, photo: 'hakone-heiwa-torii' },
      pages: [
        {
          type: 'cover',
          eyebrow: 'Kanagawa · An onsen weekend',
          title: 'A Hot-Spring Weekend',
          titleJp: '箱根',
          subtitle: 'Write one line that makes people want to pack a yukata.',
        },
        {
          type: 'intro',
          kicker: 'Welcome to Hakone',
          heading: 'Why the hills, why the bath',
          body: 'Say what kind of weekend this is — slow, steamy, a little volcanic — and who it suits.\n\nThen tell readers how the days fit together: up into the hills by train and ropeway, down to the lake, back to the bath.',
          pullQuote: 'One sentence worth remembering.',
          photo: 'hakone-lake-ashi-fuji',
        },
        {
          type: 'place',
          kicker: 'Stop 01 · Volcanic valley',
          name: 'Ōwakudani',
          nameJp: '大涌谷',
          photo: 'hakone-owakudani',
          body: placeBody('the steam, the smell of sulphur, the view on a clear day'),
          facts: factsToCheck('Ropeway station — add the line'),
          lat: 35.2419,
          lng: 139.0207,
          website: '',
        },
        {
          type: 'place',
          kicker: 'Stop 02 · Sculpture park',
          name: 'Hakone Open-Air Museum',
          nameJp: '彫刻の森美術館',
          photo: 'hakone-open-air-museum',
          body: placeBody('the lawns, a favourite work, how long to stay'),
          facts: factsToCheck('Nearest station, minutes on foot'),
          lat: 35.2447,
          lng: 139.0514,
          website: '',
        },
        {
          type: 'features',
          kicker: 'The ritual',
          heading: 'How to bathe like a local',
          items: [
            { icon: 'Bath', title: 'Wash first', text: 'Sit at the low showers and wash before you get in. The bath is for soaking, not washing.' },
            { icon: 'Waves', title: 'Towel out of the water', text: 'Fold your small towel on your head or leave it at the edge — never in the bath.' },
            { icon: 'Info', title: 'Ask about tattoos', text: 'Rules differ from bath to bath. Ask ahead, or book a private bath.' },
            { icon: 'Coffee', title: 'Drink water', text: 'Hot water dehydrates. Have a glass before and after, and get out slowly.' },
          ],
        },
        {
          type: 'gallery',
          heading: 'Around the loop',
          items: [
            { photo: 'hakone-tozan-railway', art: 'kumo', seed: 13, caption: 'Hakone Tozan Railway near Miyanoshita' },
            { photo: 'hakone-ropeway', art: 'fuji', seed: 27, caption: 'Hakone Ropeway above Ōwakudani' },
            { photo: 'hakone-lake-ashi-cruise', art: 'seigaiha', seed: 39, caption: 'A sightseeing ship and the Peace Torii on Lake Ashi' },
          ],
        },
        costs([
          { name: 'Getting around', price: '—', period: 'pass or single tickets', features: ['Say what a pass covers', 'Add the price you checked'], highlight: true },
          { name: 'Baths', price: '—', period: 'per visit', features: ['Day-use bath entry'], highlight: false },
        ]),
        {
          type: 'phrases',
          heading: 'Words for the bath',
          items: [
            { jp: '気持ちいい！', romaji: 'Kimochi ii!', meaning: 'That feels wonderful!' },
            { jp: 'いいお湯でした', romaji: 'Ii oyu deshita', meaning: 'That was a lovely bath' },
            { jp: '貸切風呂はありますか？', romaji: 'Kashikiri-buro wa arimasu ka?', meaning: 'Is there a private bath?' },
            { jp: '何時まで入れますか？', romaji: 'Nanji made hairemasu ka?', meaning: 'Until what time is it open?' },
          ],
        },
        {
          type: 'quote',
          quote: 'Snail — little by little, climb Mount Fuji.',
          quoteJp: '蝸牛そろそろ登れ富士の山',
          author: 'Kobayashi Issa',
          role: 'Haiku poet, 1763–1828 · Translation: Tabi Guides',
        },
        visitorInformation('Hakone'),
        back('Go-yukkuri — take your time'),
      ],
    },
  },
  {
    id: 'festival-night',
    name: 'Festival night',
    jp: '祭りの夜',
    blurb: 'The lantern floats of Aomori, Hirosaki and Goshogawara, lit for a few nights each August.',
    brochure: {
      title: 'Aomori: Nights of Nebuta',
      titleJp: 'ねぶた',
      subtitle: 'Lantern floats, taiko and dancers in the streets of northern Tōhoku',
      category: 'festivals',
      region: 'tohoku',
      seasons: ['summer'],
      organization: YOU,
      location: { name: 'Aomori', nameJp: '青森', prefecture: 'Aomori', lat: 40.8287, lng: 140.7356 },
      summary: 'Festival nights in Aomori Prefecture: the Nebuta of Aomori, the fan-shaped neputa of Hirosaki and the towering floats of Goshogawara — ready for your dates and stories.',
      tags: ['matsuri', 'aomori', 'summer', 'nebuta', 'festival'],
      format: 'trifold',
      theme: theme('ai-night', 'serif'),
      cover: { art: 'hinomaru', seed: 21, photo: 'tohoku-nebuta-float' },
      pages: [
        {
          type: 'cover',
          eyebrow: 'Tōhoku · August nights',
          title: 'Nights of Nebuta',
          titleJp: 'ねぶた',
          subtitle: 'Write one line that sounds like drums in the street.',
        },
        {
          type: 'intro',
          kicker: 'Matsuri season',
          heading: 'Three towns, three kinds of float',
          body: 'Say what readers will see and hear: paper floats lit from within, drums and flutes, dancers calling out as they go.\n\nAdd this year’s dates once they are announced, and say how to see more than one town in a trip.',
          pullQuote: 'One sentence worth remembering.',
        },
        {
          type: 'place',
          kicker: 'Festival 01 · Aomori',
          name: 'Aomori Nebuta Matsuri',
          nameJp: '青森ねぶた祭',
          photo: 'tohoku-nebuta-parade',
          body: placeBody('the floats, the dancers, where to stand'),
          facts: [
            { label: 'Dates', value: 'Add this year’s dates' },
            { label: 'Admission', value: 'Free from the street; seats extra' },
            { label: 'Getting there', value: 'Aomori Station — add the walk' },
          ],
          lat: 40.8287,
          lng: 140.7356,
          website: '',
        },
        {
          type: 'place',
          kicker: 'Festival 02 · Hirosaki',
          name: 'Hirosaki Neputa Matsuri',
          nameJp: '弘前ねぷたまつり',
          photo: 'tohoku-hirosaki-neputa',
          body: placeBody('the fan-shaped floats, the painted warriors, the castle town'),
          facts: [
            { label: 'Dates', value: 'Add this year’s dates' },
            { label: 'Admission', value: '—' },
            { label: 'Getting there', value: 'From Aomori by train — add the time' },
          ],
          lat: 40.6078,
          lng: 140.4642,
          website: '',
        },
        {
          type: 'gallery',
          heading: 'Lit from within',
          items: [
            { photo: 'tohoku-goshogawara-tachineputa', art: 'hinomaru', seed: 31, caption: 'Tachineputa towering over Goshogawara' },
            { photo: 'tohoku-nebuta-warasse', art: 'kumo', seed: 12, caption: 'Floats on show at Nebuta Museum WA-RASSE' },
            { photo: 'tohoku-nebuta-float', art: 'seigaiha', seed: 44, caption: 'A Nebuta float lit from within' },
          ],
        },
        {
          type: 'photo',
          photo: 'tohoku-fullpage',
          name: 'Nebuta Museum WA-RASSE',
          nameJp: 'ねぶたの家 ワ・ラッセ',
          caption: 'One line on what the picture shows — the float, the hall, the light.',
          captionPlacement: 'overlay',
          creditPlacement: 'caption',
        },
        {
          type: 'agenda',
          heading: 'A festival night, hour by hour',
          items: [
            { time: '17:00', title: 'Find your spot', text: 'Where to stand, and how early to get there.' },
            { time: '19:00', title: 'The floats set off', text: 'Add the start time for this year.' },
            { time: '20:00', title: 'Street food', text: 'What to eat between floats.' },
            { time: '21:00', title: 'Last floats', text: 'Say when the parade ends, and the way home.' },
          ],
        },
        {
          type: 'phrases',
          heading: 'Festival Japanese',
          items: [
            { jp: 'どこで見られますか？', romaji: 'Doko de miraremasu ka?', meaning: 'Where can we watch?' },
            { jp: 'ひとつください', romaji: 'Hitotsu kudasai', meaning: 'One, please' },
            { jp: 'きれい！', romaji: 'Kirei!', meaning: 'Beautiful!' },
            { jp: '暑いですね', romaji: 'Atsui desu ne', meaning: 'Hot, isn’t it?' },
          ],
        },
        visitorInformation('Aomori'),
        back('Mata rainen — see you next summer'),
      ],
    },
  },
  {
    id: 'food-crawl',
    name: 'Food crawl',
    jp: '食べ歩き',
    blurb: 'Osaka from Dōtonbori to Shinsekai: takoyaki, a covered market and skewers under the tower.',
    brochure: {
      title: 'Osaka: A Food Crawl',
      titleJp: '大阪',
      subtitle: 'Takoyaki on the canal, a covered market and skewers under the tower — one stall at a time',
      category: 'food',
      region: 'kansai',
      seasons: ['spring', 'summer', 'autumn', 'winter'],
      organization: YOU,
      location: { name: 'Dōtonbori', nameJp: '道頓堀', prefecture: 'Osaka', lat: 34.6687, lng: 135.5013 },
      summary: 'Eat your way across Osaka through three real places — Dōtonbori, Kuromon Market and Shinsekai — with what to order and how to order it.',
      tags: ['osaka', 'street food', 'takoyaki', 'market'],
      format: 'bifold',
      theme: theme('momiji', 'serif'),
      cover: { art: 'seigaiha', seed: 33, photo: 'osaka-dotonbori-night' },
      pages: [
        {
          type: 'cover',
          eyebrow: 'Kansai · A day of eating',
          title: 'A Food Crawl',
          titleJp: '大阪',
          subtitle: 'Write one line that makes people hungry.',
        },
        {
          type: 'intro',
          kicker: 'Welcome to Osaka',
          heading: 'Come hungry',
          body: 'Say what makes eating here different, and how to pace a day of it.\n\nThen tell readers the route: canal to market to old downtown, and where to rest in between.',
          pullQuote: 'One sentence worth remembering.',
        },
        {
          type: 'place',
          kicker: 'Stop 01 · Minami',
          name: 'Dōtonbori',
          nameJp: '道頓堀',
          photo: 'osaka-dotonbori-canal',
          body: placeBody('the canal, the signs, what to eat on the bridge'),
          facts: factsToCheck('Namba Station — add the exit'),
          lat: 34.6687,
          lng: 135.5013,
          website: '',
        },
        {
          type: 'place',
          kicker: 'Stop 02 · Nippombashi',
          name: 'Kuromon Market',
          nameJp: '黒門市場',
          photo: 'osaka-kuromon-market',
          body: placeBody('what to graze on, and when the stalls are busiest'),
          facts: factsToCheck('Nippombashi Station — add the exit'),
          lat: 34.6658,
          lng: 135.5065,
          website: '',
        },
        {
          type: 'place',
          kicker: 'Stop 03 · Ebisuchō',
          name: 'Shinsekai',
          nameJp: '新世界',
          photo: 'osaka-shinsekai-tsutenkaku',
          body: placeBody('the tower, the neon, the kushikatsu counters'),
          facts: factsToCheck('Ebisuchō Station — add the exit'),
          lat: 34.6525,
          lng: 135.5062,
          website: '',
        },
        {
          type: 'features',
          kicker: 'Must-eats',
          heading: 'Three tastes of Osaka',
          items: [
            { icon: 'Soup', title: 'Takoyaki', text: 'Batter balls with octopus, turned in iron moulds — let them cool before the first bite.', photo: 'osaka-takoyaki' },
            { icon: 'Flame', title: 'Okonomiyaki', text: 'A savoury pancake of cabbage and batter, cooked on a hotplate, often at your table.', photo: 'osaka-okonomiyaki' },
            { icon: 'Utensils', title: 'Kushikatsu', text: 'Breaded, deep-fried skewers. Dip once in the shared sauce — never twice.', photo: 'osaka-kushikatsu' },
          ],
        },
        {
          type: 'gallery',
          heading: 'Between meals',
          items: [
            { photo: 'osaka-fullpage', art: 'hinomaru', seed: 19, caption: 'Winter lights in Tennōji Park, below Abeno Harukas' },
            { photo: 'osaka-hozenji-fudo', art: 'enso', seed: 23, caption: 'Mizukake Fudō at Hōzen-ji, green with moss' },
            { photo: 'osaka-castle', art: 'shippo', seed: 47, caption: 'The main tower of Osaka Castle' },
          ],
        },
        costs([
          { name: 'Eating', price: 'Per dish', period: 'pay as you go', features: ['Add what a tray or skewer costs', 'Say if stalls take cards'], highlight: true },
          { name: 'Sights', price: '—', period: 'adult tickets', features: ['Add any tickets you checked'], highlight: false },
        ]),
        {
          type: 'phrases',
          heading: 'Counter Japanese',
          items: [
            { jp: 'おすすめは何ですか？', romaji: 'Osusume wa nan desu ka?', meaning: 'What do you recommend?' },
            { jp: 'これをください', romaji: 'Kore o kudasai', meaning: 'This one, please' },
            { jp: '乾杯！', romaji: 'Kanpai!', meaning: 'Cheers!' },
            { jp: 'お会計お願いします', romaji: 'Okaikei onegaishimasu', meaning: 'The bill, please' },
          ],
        },
        {
          type: 'quote',
          quote: 'Kyoto ruins itself on fine clothes; Osaka, on food.',
          quoteJp: '京の着倒れ、大阪の食い倒れ',
          author: 'Japanese proverb',
          role: 'Kyō no kidaore, Ōsaka no kuidaore · Translation: Tabi Guides',
        },
        visitorInformation('Osaka'),
        back('Gochisōsama deshita'),
      ],
    },
  },
  {
    id: 'temple-trail',
    name: 'Temple trail',
    jp: '寺めぐり',
    blurb: 'Nara on foot: the Great Buddha, a lantern-lined shrine and the deer of the park in between.',
    brochure: {
      title: 'Nara: The Temple Trail',
      titleJp: '奈良',
      subtitle: 'The Great Buddha, a lantern-lined shrine and the deer of the park in between',
      category: 'heritage',
      region: 'kansai',
      seasons: ['spring', 'autumn'],
      organization: YOU,
      location: { name: 'Tōdai-ji', nameJp: '東大寺', prefecture: 'Nara', lat: 34.6892, lng: 135.8397 },
      summary: 'A day on foot through Nara’s temples and shrines — Kōfuku-ji, Tōdai-ji and Kasuga Taisha — with temple manners and the Japanese to go with them.',
      tags: ['nara', 'temples', 'shrines', 'deer', 'day trip'],
      format: 'booklet',
      theme: theme('sumi', 'serif'),
      cover: { art: 'enso', seed: 8, photo: 'nara-deer' },
      pages: [
        {
          type: 'cover',
          eyebrow: 'Kansai · A day on foot',
          title: 'The Temple Trail',
          titleJp: '奈良',
          subtitle: 'Write one line about the old capital that makes people want to walk it.',
        },
        {
          type: 'intro',
          kicker: 'Welcome to Nara',
          heading: 'The old capital, on foot',
          body: 'Say why Nara rewards a slow day: what readers will see, and the season you would choose.\n\nThen give the shape of the walk — where it starts, roughly how far it goes and where it ends.',
          pullQuote: 'One sentence worth remembering.',
        },
        {
          type: 'place',
          kicker: 'Stop 01 · Nara Park',
          name: 'Tōdai-ji',
          nameJp: '東大寺',
          photo: 'nara-todaiji-daibutsuden',
          body: placeBody('the great hall, the Buddha inside, the gate on the way'),
          facts: factsToCheck('Kintetsu Nara Station — add the walk'),
          lat: 34.6892,
          lng: 135.8397,
          website: '',
        },
        {
          type: 'place',
          kicker: 'Stop 02 · Kasugano',
          name: 'Kasuga Taisha',
          nameJp: '春日大社',
          photo: 'nara-kasuga-lanterns',
          body: placeBody('the lantern path through the forest, the vermilion halls'),
          facts: factsToCheck('Bus or a walk through the park'),
          lat: 34.6814,
          lng: 135.8483,
          website: '',
        },
        {
          type: 'features',
          kicker: 'Temple manners',
          heading: 'How to visit with respect',
          items: [
            { icon: 'Leaf', title: 'Purify first', text: 'At the water basin, rinse your left hand, then your right, then your mouth from a cupped palm.' },
            { icon: 'Footprints', title: 'Shoes off', text: 'Leave your shoes where you are asked to. Slippers are for corridors — never wear them on tatami.' },
            { icon: 'Camera', title: 'Mind the signs', text: 'Some halls don’t allow photographs. When in doubt, ask — or simply look.' },
            { icon: 'Scroll', title: 'Collect goshuin', text: 'Bring a stamp book: many temples and shrines brush a calligraphy seal for a small offering.' },
          ],
        },
        {
          type: 'gallery',
          heading: 'Along the walk',
          items: [
            { photo: 'nara-kofukuji-chukondo', art: 'enso', seed: 11, caption: 'The Central Golden Hall of Kōfuku-ji' },
            { photo: 'nara-ukimido', art: 'seigaiha', seed: 25, caption: 'Ukimidō pavilion on Sagi-ike pond, Nara Park' },
            { photo: 'nara-naramachi', art: 'asanoha', seed: 37, caption: 'Latticed town houses in Naramachi' },
          ],
        },
        {
          type: 'agenda',
          heading: 'The day, step by step',
          items: [
            { time: '09:00', title: 'Kōfuku-ji', text: 'What to see first, near the station.' },
            { time: '10:30', title: 'Tōdai-ji', text: 'Add the opening time you checked.' },
            { time: '13:00', title: 'Lunch', text: 'Somewhere to rest your feet.' },
            { time: '14:30', title: 'Kasuga Taisha', text: 'The lantern path, slowly.' },
          ],
        },
        costs([
          { name: 'Temples and shrines', price: '—', period: 'adult tickets', features: ['Add each fee you checked', 'Say which grounds are free'], highlight: false },
        ]),
        {
          type: 'phrases',
          heading: 'Temple Japanese',
          items: [
            { jp: 'おはようございます', romaji: 'Ohayō gozaimasu', meaning: 'Good morning' },
            { jp: '御朱印をお願いします', romaji: 'Goshuin o onegaishimasu', meaning: 'A temple seal, please' },
            { jp: '東大寺はどちらですか？', romaji: 'Tōdai-ji wa dochira desu ka?', meaning: 'Which way is Tōdai-ji?' },
            { jp: 'ありがとうございました', romaji: 'Arigatō gozaimashita', meaning: 'Thank you very much' },
          ],
        },
        {
          type: 'quote',
          quote: 'I bite a persimmon — / and the bell rings out / at Hōryū-ji.',
          quoteJp: '柿食へば鐘が鳴るなり法隆寺',
          author: 'Masaoka Shiki',
          role: 'Hōryū-ji, Ikaruga, 1895 · Translation: Tabi Guides',
        },
        visitorInformation('Nara'),
        back('Otsukaresama deshita — well walked'),
      ],
    },
  },
];

export const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

/** Turn brochure content into a fresh user draft: new ids, no slug, now as the edit date. */
function toDraft(content, { makeId, now }) {
  // `outline` marks a catalog stub (src/data/catalog.js); a draft is always complete.
  const { outline: _outline, ...copy } = structuredClone(content);
  return {
    ...copy,
    id: makeId('b'),
    slug: '',
    source: 'user',
    featured: false,
    updatedAt: now.toISOString(),
    readMinutes: copy.readMinutes ?? 1,
    pages: (copy.pages ?? []).map((page) => ({ ...page, id: makeId('pg') })),
  };
}

const defaults = (options = {}) => ({ makeId: options.makeId ?? createId, now: options.now ?? new Date() });

/** A complete draft brochure from a template id (falls back to the first template). */
export function createFromTemplate(templateId, options) {
  const template = TEMPLATE_MAP[templateId] ?? TEMPLATES[0];
  return toDraft(template.brochure, defaults(options));
}

/** Cover, introduction and back cover with schema placeholders. */
export function createBlank(options) {
  const random = options?.random ?? Math.random;
  return toDraft(
    {
      title: '',
      titleJp: '旅',
      subtitle: '',
      category: 'heritage',
      region: 'kansai',
      seasons: [],
      organization: '',
      summary: '',
      tags: [],
      format: 'booklet',
      theme: theme('shu-kinari', 'serif'),
      cover: { art: 'hinomaru', seed: randomSeed(random) },
      pages: ['cover', 'intro', 'back'].map((type) => ({ type, ...PAGE_TYPES[type].create() })),
    },
    defaults(options),
  );
}

/** A deep, editable copy of any brochure: new ids, "(remix)" title, owned by the user. */
export function createRemix(source, options) {
  const draft = toDraft(source, defaults(options));
  const title = String(source.title ?? '').trim() || 'Untitled brochure';
  return { ...draft, title: `${title} (remix)` };
}
