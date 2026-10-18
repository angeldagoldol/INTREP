/**
 * Fixed credits: the typefaces and the other work Tabi is built with. Every
 * name, licence and link here is real; keep it in step with index.html
 * (fonts) and package.json (libraries).
 */

export const OFL = { label: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org/' };

/** The five families index.html loads from Google Fonts, each set in itself on the page. */
export const FONTS = [
  {
    id: 'fraunces',
    name: 'Fraunces',
    by: 'Undercase Type',
    role: 'Headlines',
    family: "'Fraunces', serif",
    sample: 'Japan, folded into pages',
    italic: true,
    url: 'https://fonts.google.com/specimen/Fraunces',
  },
  {
    id: 'shippori',
    name: 'Shippori Mincho',
    by: 'Fontdasu',
    role: 'Japanese headlines',
    family: "'Shippori Mincho', serif",
    sample: '旅は道連れ',
    lang: 'ja',
    url: 'https://fonts.google.com/specimen/Shippori+Mincho',
  },
  {
    id: 'geist',
    name: 'Geist',
    by: 'Vercel',
    role: 'Text and interface',
    family: "'Geist', sans-serif",
    sample: 'Check before you go.',
    url: 'https://fonts.google.com/specimen/Geist',
  },
  {
    id: 'zen',
    name: 'Zen Kaku Gothic New',
    by: 'Yoshimichi Ohira',
    role: 'Japanese text',
    family: "'Zen Kaku Gothic New', sans-serif",
    sample: '旅のしおり',
    lang: 'ja',
    url: 'https://fonts.google.com/specimen/Zen+Kaku+Gothic+New',
  },
  {
    id: 'geist-mono',
    name: 'Geist Mono',
    by: 'Vercel',
    role: 'Labels and figures',
    family: "'Geist Mono', monospace",
    sample: '9:00–17:00',
    url: 'https://fonts.google.com/specimen/Geist+Mono',
  },
];

/** Everything else, briefly. */
export const ALSO = [
  { what: 'Icons', name: 'Lucide', licence: 'ISC licence', url: 'https://lucide.dev/' },
  { what: 'Interface', name: 'React and React Router', licence: 'MIT licence', url: 'https://react.dev/' },
  { what: 'Motion', name: 'Motion (framer-motion)', licence: 'MIT licence', url: 'https://motion.dev/' },
  { what: 'Build', name: 'Vite', licence: 'MIT licence', url: 'https://vite.dev/' },
];
