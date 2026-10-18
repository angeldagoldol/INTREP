const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * The short form of a brochure's `factsChecked` for cards: "October 2026" →
 * "Oct 2026". Anything that is not "<Month> <year>" comes back trimmed as it
 * is; missing or blank values give '' (the card then shows nothing).
 */
export function shortFactsChecked(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim().replace(/\s+/g, ' ');
  const match = /^([A-Za-z]+)\.? (\d{4})$/.exec(text);
  if (!match) return text;
  const month = MONTHS.find((m) => m.toLowerCase().startsWith(match[1].toLowerCase()) && match[1].length >= 3);
  return month ? `${month.slice(0, 3)} ${match[2]}` : text;
}
