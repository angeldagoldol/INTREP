/**
 * Grid arithmetic for the library's end-of-shelf tile: how many columns an
 * auto-fill grid resolved to, and how many cells its last row leaves empty.
 */

export const NO_TRACKS = Object.freeze({ count: 0, width: 0 });

/** Resolved grid tracks ("312px 312px …", from getComputedStyle) → { count, width }; anything else → none. */
export function readTracks(template) {
  const tracks = String(template ?? '').trim().split(/\s+/).filter(Boolean);
  if (!tracks.length || !tracks.every((t) => /^\d+(\.\d+)?px$/.test(t))) return NO_TRACKS;
  return { count: tracks.length, width: parseFloat(tracks[0]) };
}

/** Cells left empty on the last row of `count` items in `columns` columns. */
export function emptyCells(count, columns) {
  if (!Number.isInteger(count) || !Number.isInteger(columns) || count <= 0 || columns <= 0) return 0;
  const rest = count % columns;
  return rest ? columns - rest : 0;
}
