import { AgendaBlock } from './AgendaBlock.jsx';
import { BackBlock } from './BackBlock.jsx';
import { ContactBlock } from './ContactBlock.jsx';
import { CoverBlock } from './CoverBlock.jsx';
import { FallbackBlock } from './FallbackBlock.jsx';
import { FeaturesBlock } from './FeaturesBlock.jsx';
import { GalleryBlock } from './GalleryBlock.jsx';
import { IntroBlock } from './IntroBlock.jsx';
import { PlaceBlock } from './PlaceBlock.jsx';
import { PhotoBlock } from './PhotoBlock.jsx';
import { PhrasesBlock } from './PhrasesBlock.jsx';
import { PricingBlock } from './PricingBlock.jsx';
import { QuoteBlock } from './QuoteBlock.jsx';
import { StatsBlock } from './StatsBlock.jsx';
import { dict } from '../../../data/lookup.js';

/** Page type → block component (types from data/schema.js PAGE_TYPES). No prototype, so
 *  a stored type like "constructor" falls back instead of finding Object; so does a page of a
 *  retired type (an old map page) that reaches the renderer without going through sanitize.js. */
export const BLOCKS = dict({
  cover: CoverBlock,
  intro: IntroBlock,
  features: FeaturesBlock,
  gallery: GalleryBlock,
  place: PlaceBlock,
  stats: StatsBlock,
  agenda: AgendaBlock,
  pricing: PricingBlock,
  phrases: PhrasesBlock,
  quote: QuoteBlock,
  contact: ContactBlock,
  photo: PhotoBlock,
  back: BackBlock,
});

/** Full-bleed page types draw their own layout instead of the running head and folio. */
export const FULL_BLEED = new Set(['cover', 'photo', 'back']);

/** Page types whose photograph runs off the top trim: no running head (the folio stays). */
export const HEADLESS = new Set(['place']);

export { FallbackBlock };
