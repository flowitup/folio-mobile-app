/**
 * Width of one JetBrains Mono glyph, in em. The app's figures are set in it, so their width is
 * predictable from their length; a little above the font's 0.6 em covers digits, separators and
 * the euro sign alike.
 */
export const MONO_CHAR_EM = 0.62;

/** Width a figure needs at `fontSize`, in points. */
export function monoTextWidth(text: string, fontSize: number): number {
  return text.length * MONO_CHAR_EM * fontSize;
}

/**
 * Font size that fits `text` on one line of `width` points, never below `minScale` × `max`.
 * When even the smallest size does not fit, `wrap` asks for a second line rather than an
 * ellipsis: an amount must never read "415,00…". A width of 0 (not laid out yet) keeps `max`.
 *
 * Computed rather than left to `adjustsFontSizeToFit`, which react-native-web ignores.
 */
export function fitFontSize(
  text: string,
  width: number,
  max: number,
  minScale = 0.7,
): { fontSize: number; wrap: boolean } {
  const needed = monoTextWidth(text, max);
  if (width <= 0 || needed <= width) return { fontSize: max, wrap: false };
  const scale = width / needed;
  if (scale >= minScale)
    return { fontSize: Math.floor(max * scale * 10) / 10, wrap: false };
  return { fontSize: max * minScale, wrap: true };
}

/**
 * Columns for a row of `count` cards in `width` points: all on one row while each card still
 * fits its widest figure at `minScale`, else two (the odd one spans the row below).
 */
export function kpiColumns(
  count: number,
  width: number,
  gap: number,
  minCardWidth: number,
): number {
  if (count <= 2 || width <= 0) return count;
  const perCard = (width - gap * (count - 1)) / count;
  return perCard >= minCardWidth ? count : 2;
}

/**
 * Narrowest card that shows its widest figure at 85 % of `size` with `padding` points around
 * it: below that a KPI row goes to two columns rather than shrinking the figures further.
 */
export function kpiCardWidth(
  figures: string[],
  size: number,
  padding = 24,
): number {
  return (
    Math.max(
      0,
      ...figures.map((figure) => monoTextWidth(figure, size * 0.85)),
    ) + padding
  );
}
