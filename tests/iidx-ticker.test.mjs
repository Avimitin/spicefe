import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

import {
  BLANK_IIDX_TICKER,
  iidxTickerDisplayGlyphs,
  iidxTickerPreviewFrame,
  IIDX_TICKER_LENGTH,
  IIDX_TICKER_PREVIEW_STEP_MS,
  normalizeIidxTickerText,
} from '../public/lib/iidx-ticker.js';

test('normalizes the cabinet ticker to exactly nine display characters', () => {
  assert.equal(IIDX_TICKER_LENGTH, 9);
  assert.equal(BLANK_IIDX_TICKER, '         ');
  assert.equal(normalizeIidxTickerText('ABCDEFGHIJK'), 'ABCDEFGHI');
  assert.equal(normalizeIidxTickerText('IIDX\0 18'), 'IIDX  18 ');
  assert.equal(Array.from(normalizeIidxTickerText('A😀BC')).length, 9);
});

test('scrolls long preview text through a nine-character window every half-second', () => {
  assert.equal(IIDX_TICKER_PREVIEW_STEP_MS, 500);
  assert.equal(iidxTickerPreviewFrame('WELCOME', 100), 'WELCOME  ');
  assert.equal(iidxTickerPreviewFrame('ABCDEFGHIJK', 0), 'ABCDEFGHI');
  assert.equal(iidxTickerPreviewFrame('ABCDEFGHIJK', 1), 'BCDEFGHIJ');
  assert.equal(iidxTickerPreviewFrame('ABCDEFGHIJK', 2), 'CDEFGHIJK');
  assert.equal(iidxTickerPreviewFrame('ABCDEFGHIJK', 11), '         ');
  assert.equal(iidxTickerPreviewFrame('ABCDEFGHIJK', 12), '        A');
  assert.equal(iidxTickerPreviewFrame('ABCDEFGHIJK', 20), 'ABCDEFGHI');
});

test('maps blank cells to the font full-width all-off glyph for rendering', () => {
  assert.equal(iidxTickerDisplayGlyphs('A B'), 'A°B°°°°°°');
  assert.equal(iidxTickerDisplayGlyphs('         '), '°°°°°°°°°');
});

test('vendors the attributed display font and applies the red-on-black cabinet treatment', () => {
  const font = new URL(
    '../public/vendor/sixteen-font/fonts/Sixteen-Mono.woff2',
    import.meta.url,
  );
  const bytes = readFileSync(font);
  const styles = readFileSync(
    new URL('../public/assets/styles.css', import.meta.url),
    'utf8',
  );
  const source = readFileSync(
    new URL('../public/vendor/sixteen-font/SOURCE.md', import.meta.url),
    'utf8',
  );

  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'wOF2');
  assert.ok(statSync(font).size < 4 * 1024);
  assert.match(styles, /font-family:\s*"Sixteen Mono"/);
  assert.match(styles, /\.ticker-display-panel\s*\{[\s\S]*?aspect-ratio:\s*27\s*\/\s*5/);
  assert.match(styles, /\.ticker-display-panel\s*\{[\s\S]*?background:\s*#000000/);
  assert.match(styles, /\.ticker-text\s*\{[\s\S]*?color:\s*#ff0000/);
  assert.match(styles, /\.ticker-text\s*\{[\s\S]*?monospace/);
  assert.match(styles, /\.ticker-text::before\s*\{[\s\S]*?content:\s*";;;;;;;;;"/);
  assert.match(styles, /\.ticker-text::before\s*\{[\s\S]*?color:\s*#12120f/);
  assert.match(source, /Sixteen by Jack Sivak/i);
  assert.match(source, /SIL Open Font License 1\.1/);
});

test('offers a connection-free display preview with a clean screenshot view', () => {
  const markup = readFileSync(
    new URL('../public/index.html', import.meta.url),
    'utf8',
  );
  const styles = readFileSync(
    new URL('../public/assets/styles.css', import.meta.url),
    'utf8',
  );
  const logo = new URL(
    '../public/vendor/iidx-dj-logo/iidx-dj-logo.png',
    import.meta.url,
  );
  const caption = new URL(
    '../public/vendor/iidx-caption/iidx-caption.png',
    import.meta.url,
  );
  const logoBytes = readFileSync(logo);
  const captionBytes = readFileSync(caption);

  assert.match(markup, /id="ticker-preview-button"/);
  assert.match(markup, /id="ticker-preview-input"/);
  assert.doesNotMatch(markup, /id="ticker-preview-input"[^>]*maxlength=/);
  assert.match(markup, /id="ticker-preview-clean"/);
  assert.match(markup, /class="ticker-view ticker-preview-display"/);
  assert.equal((markup.match(/class="ticker-caption"/g) || []).length, 2);
  assert.equal((markup.match(/class="ticker-caption-image"/g) || []).length, 2);
  assert.equal((markup.match(/class="ticker-logo"/g) || []).length, 2);
  assert.doesNotMatch(markup, /ticker-caption-(?:title|copy|rule)/);
  assert.equal(logoBytes.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(logoBytes.readUInt32BE(16), 512);
  assert.equal(logoBytes.readUInt32BE(20), 512);
  assert.ok(statSync(logo).size < 20 * 1024);
  assert.equal(captionBytes.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(captionBytes.readUInt32BE(16), 278);
  assert.equal(captionBytes.readUInt32BE(20), 61);
  assert.equal(statSync(caption).size, 4237);
  assert.match(styles, /\.ticker-view\s*\{[\s\S]*?aspect-ratio:\s*301\s*\/\s*80/);
  assert.match(styles, /\.ticker-view\s*\{[\s\S]*?border-radius:\s*0/);
  assert.match(styles, /\.ticker-view\s*\{[\s\S]*?rgba\(0, 0, 0, 0\.4\)/);
  assert.match(styles, /\.ticker-view\s*\{[\s\S]*?radial-gradient/);
  assert.doesNotMatch(styles, /\.ticker-view\s*\{[\s\S]*?repeating-linear-gradient/);
  assert.match(styles, /\.ticker-hardware\s*\{[\s\S]*?inset:\s*6\.644518cqi 1\.66113cqi/);
  assert.match(styles, /\.ticker-hardware\s*\{[\s\S]*?column-gap:\s*1\.66113cqi/);
  assert.match(styles, /\.ticker-hardware\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 20fr\) minmax\(0, 123fr\)/);
  assert.match(styles, /\.ticker-info-panel\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 15fr\) minmax\(0, 108fr\)/);
  assert.doesNotMatch(styles, /\.ticker-logo-panel\s*\{[\s\S]*?border-right/);
  assert.match(styles, /\.ticker-logo-panel::after,\s*\n\.ticker-info-panel::after\s*\{[\s\S]*?inset 0 0/);
  assert.match(styles, /\.ticker-caption\s*\{[\s\S]*?padding-left:\s*1\.66113cqi/);
  assert.match(styles, /\.ticker-caption-image\s*\{[\s\S]*?object-fit:\s*contain/);
  assert.doesNotMatch(styles, /\.ticker-caption-(?:title|copy|rule)\s*\{/);
  assert.match(
    styles,
    /\.ticker-preview-dialog\[data-clean="true"\] \.ticker-preview-toolbar\s*\{\s*display:\s*none/,
  );
});
