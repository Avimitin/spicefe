export const IIDX_TICKER_LENGTH = 9;
export const BLANK_IIDX_TICKER = ' '.repeat(IIDX_TICKER_LENGTH);
export const IIDX_TICKER_PREVIEW_STEP_MS = 500;

function printableCharacters(value) {
  return Array.from(String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' '));
}

export function normalizeIidxTickerText(value) {
  const characters = printableCharacters(value).slice(0, IIDX_TICKER_LENGTH);
  while (characters.length < IIDX_TICKER_LENGTH) {
    characters.push(' ');
  }
  return characters.join('');
}

// Sixteen-Mono reserves U+00B0 as an invisible, full-width display cell.
// Ordinary spaces are intentionally narrower, so use the reserved glyph only
// at the presentation boundary while keeping state and accessible text plain.
export function iidxTickerDisplayGlyphs(value) {
  return normalizeIidxTickerText(value).replaceAll(' ', '\u00b0');
}

export function iidxTickerPreviewFrame(value, offset = 0) {
  const characters = printableCharacters(value);
  if (characters.length <= IIDX_TICKER_LENGTH) {
    return normalizeIidxTickerText(characters.join(''));
  }

  const sequence = characters.concat(Array(IIDX_TICKER_LENGTH).fill(' '));
  const numericOffset = Number.isFinite(offset) ? Math.trunc(offset) : 0;
  const start = ((numericOffset % sequence.length) + sequence.length) % sequence.length;
  return Array.from(
    { length: IIDX_TICKER_LENGTH },
    (_, index) => sequence[(start + index) % sequence.length],
  ).join('');
}
