/**
 * Command-palette search. Pure functions, no DOM.
 *
 * Matching is case-, diacritic-, width- and kana-insensitive: "tohoku" finds
 * "Tōhoku", "ＫＹＯＴＯ" finds "Kyoto", hiragana finds katakana. Results rank
 * exact > prefix > word-prefix > substring > fuzzy subsequence, weighted per
 * field, and carry highlight ranges expressed in the ORIGINAL text's indices.
 */

const LATIN_MARKS = /[̀-ͯ]/g;
const KATAKANA = /[ァ-ヶ]/g;
const WORD_CHAR = /[\p{L}\p{N}]/u;

const SCORE = { exact: 100, prefix: 90, wordPrefix: 80, substring: 60, fuzzyCap: 55 };

function foldChar(ch) {
  return ch
    .normalize('NFKD')
    .replace(LATIN_MARKS, '')
    .toLowerCase()
    .replace(KATAKANA, (k) => String.fromCharCode(k.charCodeAt(0) - 0x60))
    .normalize('NFC');
}

/** Fold a string for comparison: "Tōhoku" → "tohoku", "キョウト" → "きょうと". */
export function fold(text) {
  let out = '';
  for (const ch of String(text ?? '')) out += foldChar(ch);
  return out;
}

/**
 * Fold a user query and collapse whitespace. The final NFC joins voicing
 * marks that arrive as separate characters (half-width "ｶﾞ" → "が").
 */
export function foldQuery(query) {
  return fold(query).normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * Fold `text` while remembering where every folded unit came from, so match
 * ranges can be mapped back onto the original string for highlighting.
 */
export function prepare(text) {
  const source = String(text ?? '');
  let folded = '';
  const starts = [];
  const ends = [];
  let index = 0;
  for (const ch of source) {
    const f = foldChar(ch);
    for (let k = 0; k < f.length; k += 1) {
      starts.push(index);
      ends.push(index + ch.length);
    }
    folded += f;
    index += ch.length;
  }
  return { source, folded, starts, ends };
}

function isWordStart(folded, at) {
  return at === 0 || !WORD_CHAR.test(folded[at - 1]);
}

/** Collapse sorted positions into [start, end) runs. */
function positionsToRanges(positions) {
  const ranges = [];
  for (const p of positions) {
    const last = ranges[ranges.length - 1];
    if (last && last[1] === p) last[1] = p + 1;
    else ranges.push([p, p + 1]);
  }
  return ranges;
}

function substringMatch(folded, q) {
  let first = -1;
  for (let at = folded.indexOf(q); at !== -1; at = folded.indexOf(q, at + 1)) {
    if (first === -1) first = at;
    if (isWordStart(folded, at)) return { at, wordStart: true };
  }
  return first === -1 ? null : { at: first, wordStart: false };
}

/** Pick each query char greedily; `preferWordStarts` tries word starts first. */
function subsequence(folded, q, preferWordStarts) {
  const positions = [];
  let from = 0;
  for (const ch of q) {
    let at = -1;
    if (preferWordStarts) {
      for (let i = folded.indexOf(ch, from); i !== -1; i = folded.indexOf(ch, i + 1)) {
        if (isWordStart(folded, i)) {
          at = i;
          break;
        }
      }
    }
    if (at === -1) at = folded.indexOf(ch, from);
    if (at === -1) return null;
    positions.push(at);
    from = at + 1;
  }
  return positions;
}

function scoreSubsequence(folded, positions) {
  const span = positions[positions.length - 1] - positions[0] + 1;
  let score = 20;
  let weak = 0;
  positions.forEach((p, k) => {
    const consecutive = k > 0 && p === positions[k - 1] + 1;
    const wordStart = isWordStart(folded, p);
    if (consecutive) score += 4;
    if (wordStart) score += 5;
    if (k > 0 && !consecutive && !wordStart) weak += 1;
  });
  if (positions[0] === 0) score += 6;
  score -= (span - positions.length) * 0.75;
  // Scattered letters in the middle of words are noise, not intent.
  if (weak > 0 && span > positions.length * 3 + 3) return null;
  return score < 8 ? null : Math.min(score, SCORE.fuzzyCap);
}

function fuzzyMatch(folded, q) {
  let best = null;
  for (const preferWordStarts of [true, false]) {
    const positions = subsequence(folded, q, preferWordStarts);
    if (!positions) continue;
    const score = scoreSubsequence(folded, positions);
    if (score != null && (!best || score > best.score)) best = { score, positions };
  }
  return best;
}

/**
 * Match a folded query against one prepared field.
 * Returns { score, ranges } (ranges in ORIGINAL indices) or null.
 */
export function matchPrepared(prep, q, { fuzzy = true } = {}) {
  const { folded, starts, ends } = prep;
  if (!q) return { score: 0, ranges: [] };
  if (!folded) return null;

  const toOriginal = (ranges) => ranges.map(([a, b]) => [starts[a], ends[b - 1]]);

  const hit = substringMatch(folded, q);
  if (hit) {
    let score;
    if (hit.at === 0 && q.length === folded.length) score = SCORE.exact;
    else if (hit.at === 0) score = SCORE.prefix;
    else if (hit.wordStart) score = SCORE.wordPrefix;
    else score = SCORE.substring;
    score += (q.length / folded.length) * 5 - Math.min(hit.at, 40) * 0.1;
    return { score, ranges: toOriginal([[hit.at, hit.at + q.length]]) };
  }

  if (!fuzzy || q.length < 2 || q.includes(' ')) return null;
  const fz = fuzzyMatch(folded, q);
  return fz ? { score: fz.score, ranges: toOriginal(positionsToRanges(fz.positions)) } : null;
}

/** Convenience: match a raw query against raw text. */
export function matchText(text, query, options) {
  return matchPrepared(prepare(text), foldQuery(query), options);
}

/**
 * Build a reusable index. `getFields(item)` returns
 * [{ key, text, weight = 1, fuzzy = true }]; empty texts are skipped.
 */
export function createSearchIndex(items, getFields) {
  return items.map((item, order) => ({
    item,
    order,
    fields: getFields(item)
      .filter((f) => f && f.text)
      .map((f) => ({ key: f.key, weight: f.weight ?? 1, fuzzy: f.fuzzy ?? true, prep: prepare(f.text) })),
  }));
}

function bestField(fields, q) {
  let best = null;
  for (const field of fields) {
    const m = matchPrepared(field.prep, q, { fuzzy: field.fuzzy });
    if (!m) continue;
    const score = m.score * field.weight;
    if (!best || score > best.score) best = { key: field.key, score, ranges: m.ranges };
  }
  return best;
}

function addRanges(matches, key, ranges) {
  matches[key] = mergeRanges([...(matches[key] ?? []), ...ranges]);
}

/** Sort and merge overlapping/adjacent [start, end) ranges. */
export function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/**
 * Score one indexed entry. Multi-word queries match if every word matches
 * some field (in any order); a whole-phrase hit gets a small bonus.
 */
function scoreEntry(entry, q) {
  const whole = bestField(entry.fields, q);
  const tokens = q.split(' ');

  let tokenResult = null;
  if (tokens.length > 1) {
    let total = 0;
    const matches = {};
    for (const token of tokens) {
      const hit = bestField(entry.fields, token);
      if (!hit) {
        total = -1;
        break;
      }
      total += hit.score;
      addRanges(matches, hit.key, hit.ranges);
    }
    if (total >= 0) tokenResult = { score: total / tokens.length, matches };
  }

  const wholeResult = whole && { score: whole.score + (tokens.length > 1 ? 5 : 0), matches: { [whole.key]: whole.ranges } };
  if (wholeResult && (!tokenResult || wholeResult.score >= tokenResult.score)) return wholeResult;
  return tokenResult;
}

/**
 * Rank indexed items for `query`. An empty query returns everything in
 * original order with score 0. Returns [{ item, score, matches }].
 */
export function search(index, query, { limit = Infinity } = {}) {
  const q = foldQuery(query);
  const results = [];
  for (const entry of index) {
    if (!q) {
      results.push({ item: entry.item, score: 0, matches: {}, order: entry.order });
      continue;
    }
    const scored = scoreEntry(entry, q);
    if (scored) results.push({ item: entry.item, ...scored, order: entry.order });
  }
  results.sort((a, b) => b.score - a.score || a.order - b.order);
  return results.slice(0, limit).map(({ order: _order, ...rest }) => rest);
}

/** Split `text` into [{ text, match }] segments for rendering highlights. */
export function highlight(text, ranges = []) {
  const source = String(text ?? '');
  if (!ranges.length) return source ? [{ text: source, match: false }] : [];
  const segments = [];
  let cursor = 0;
  for (const [a, b] of mergeRanges(ranges)) {
    const start = Math.max(a, cursor);
    const end = Math.min(b, source.length);
    if (start >= end) continue;
    if (start > cursor) segments.push({ text: source.slice(cursor, start), match: false });
    segments.push({ text: source.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < source.length) segments.push({ text: source.slice(cursor), match: false });
  return segments;
}
