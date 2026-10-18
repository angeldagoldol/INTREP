/**
 * Links to the project's own fact-checking documents, published with the
 * site: Vite copies each Markdown file into the build as an asset (never
 * inlined), so the Credits page can link the standard every brochure follows
 * (docs/REAL_CONTENT.md) and each brochure's research log
 * (docs/research/<slug>.md: claim → value → sources → date checked).
 */
import standardUrl from '../../../docs/REAL_CONTENT.md?url&no-inline';

const logs = import.meta.glob('../../../docs/research/*.md', { query: '?url&no-inline', import: 'default', eager: true });

/** URL of docs/REAL_CONTENT.md, the standard for real places, facts and photos. */
export const STANDARD_URL = standardUrl;

/** URL of docs/research/<slug>.md ('home' for the Home page), or '' when there is none. */
export function researchLogUrl(slug) {
  if (typeof slug !== 'string' || !/^[\w-]+$/.test(slug)) return '';
  return logs[`../../../docs/research/${slug}.md`] ?? '';
}
