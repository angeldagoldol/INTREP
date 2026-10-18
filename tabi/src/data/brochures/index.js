/**
 * Built-in brochures about Japan, one module per brochure (see src/data/schema.js).
 * Order here is the default "Featured" order in the library.
 */
import kyotoThousandGates from './kyoto-thousand-gates.js';
import tokyoAfterDark from './tokyo-after-dark.js';
import hokkaidoPowderSnow from './hokkaido-powder-snow.js';
import okinawaCoralIslands from './okinawa-coral-islands.js';
import hakoneOnsenRyokan from './hakone-onsen-ryokan.js';
import osakaKuidaore from './osaka-kuidaore.js';
import naoshimaArtIslands from './naoshima-art-islands.js';
import hiroshimaMiyajima from './hiroshima-miyajima.js';
import tohokuSummerFestivals from './tohoku-summer-festivals.js';
import japanAlps from './japan-alps.js';
import naraDeerAndTemples from './nara-deer-and-temples.js';
import mountFujiFiveLakes from './mount-fuji-five-lakes.js';
import nostalgicJapan from './nostalgic-japan.js';

export const BROCHURES = [
  kyotoThousandGates,
  tokyoAfterDark,
  hokkaidoPowderSnow,
  okinawaCoralIslands,
  hakoneOnsenRyokan,
  osakaKuidaore,
  naoshimaArtIslands,
  hiroshimaMiyajima,
  tohokuSummerFestivals,
  japanAlps,
  naraDeerAndTemples,
  mountFujiFiveLakes,
  nostalgicJapan,
];

export const FEATURED_BROCHURES = BROCHURES.filter((b) => b.featured);
