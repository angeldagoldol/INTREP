/**
 * List limits and blank list items for the Studio's page editors, mirroring
 * the item counts documented in data/schema.js. The reducer enforces them;
 * the editors use them to enable or disable add/remove buttons.
 */

/** { [pageType]: { [listKey]: { min, max } } } */
export const LIST_LIMITS = {
  features: { items: { min: 2, max: 6 } },
  gallery: { items: { min: 2, max: 4 } },
  stats: { items: { min: 2, max: 4 } },
  agenda: { items: { min: 3, max: 6 } },
  pricing: { plans: { min: 1, max: 3 }, features: { min: 1, max: 6 } },
  phrases: { items: { min: 3, max: 6 } },
  contact: { details: { min: 2, max: 4 } },
  place: { facts: { min: 1, max: 5 } },
};

/** The practical facts a place page usually lists, in the order a new row offers them. */
export const FACT_LABELS = ['Hours', 'Admission', 'Getting there', 'Time needed', 'Best time'];

const NO_LIMIT = { min: 0, max: Infinity };

/** Limits for the list at `path` (e.g. ['plans', 0, 'features']) on a page type. */
export function listLimit(pageType, path) {
  const key = [...(path ?? [])].reverse().find((part) => typeof part === 'string');
  return LIST_LIMITS[pageType]?.[key] ?? NO_LIMIT;
}

/** A random cover-art seed: a positive integer below 10 000. */
export function randomSeed(random = Math.random) {
  return 1 + Math.floor(random() * 9998);
}

/**
 * A fresh, sensible item for the list at `path` on a page type. Placeholder
 * copy is Japan-flavoured so a new row already reads like a brochure; rows
 * that hold facts (place facts, visitor information) start
 * empty, so nothing unchecked is printed by accident. `page` (optional) lets
 * a new fact row offer the next label the page doesn't have yet.
 */
export function newListItem(pageType, path, random = Math.random, page = null) {
  const key = [...(path ?? [])].reverse().find((part) => typeof part === 'string');
  switch (`${pageType}.${key}`) {
    case 'features.items':
      return { icon: 'Sparkles', title: 'New highlight', text: 'One or two sentences on why it is worth the detour.' };
    case 'gallery.items':
      return { art: 'kumo', seed: randomSeed(random), caption: 'A new view' };
    case 'stats.items':
      return { value: 10, prefix: '', suffix: '', label: 'Something worth counting' };
    case 'agenda.items':
      return { time: '09:00', title: 'Next stop', text: 'What happens here, in a sentence.' };
    case 'pricing.plans':
      return { name: 'New journey', price: '¥0', period: 'per person', features: ['What is included'], highlight: false };
    case 'pricing.features':
      return 'Another inclusion';
    case 'phrases.items':
      return { jp: 'よろしくお願いします', romaji: 'Yoroshiku onegaishimasu', meaning: 'Pleased to meet you' };
    case 'contact.details':
      return { icon: 'Globe', label: 'Official site', value: '', url: '' };
    case 'place.facts': {
      const used = new Set((Array.isArray(page?.facts) ? page.facts : []).map((f) => String(f?.label ?? '').trim().toLowerCase()));
      return { label: FACT_LABELS.find((label) => !used.has(label.toLowerCase())) ?? 'Good to know', value: '' };
    }
    default:
      return {};
  }
}
