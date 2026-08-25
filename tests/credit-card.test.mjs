import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { formatCardNumber } from '../public/lib/credit-card.js';

const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

test('groups the 16-character card ID into the native four-digit display', () => {
  assert.equal(formatCardNumber('e00401001234abcd'), 'E004 0100 1234 ABCD');
  assert.equal(formatCardNumber('E004 0100'), 'E004 0100');
});

test('constrains movable card names to the safe band between edge rows', () => {
  assert.match(styles, /--ea-card-name-top:\s*40px/);
  assert.match(styles, /--ea-card-name-bottom:\s*40px/);
  assert.match(
    styles,
    /\.ea-card-name\[data-position="top-left"\]\s*\{[\s\S]*?top:\s*var\(--ea-card-name-top\)/,
  );
  assert.match(
    styles,
    /\.ea-card-name\[data-position="bottom-left"\]\s*\{[\s\S]*?bottom:\s*var\(--ea-card-name-bottom\)/,
  );
  assert.match(styles, /\.ea-card-name\[data-position="center"\]/);
});

test('keeps card names and IDs compact, weighted, and shadowed', () => {
  const nameRule = styles.match(/(?:^|\n)\.ea-card-name \{(?<body>[^}]+)\}/)?.groups?.body || '';
  const numberRule = styles.match(/(?:^|\n)\.ea-card-number \{(?<body>[^}]+)\}/)?.groups?.body || '';

  assert.match(nameRule, /font-family:\s*"Inter",[^;]+sans-serif;/);
  assert.match(nameRule, /font-weight:\s*700;/);
  assert.match(nameRule, /text-shadow:/);
  assert.match(numberRule, /font-size:\s*17px;/);
  assert.match(numberRule, /font-weight:\s*300;/);
  assert.match(numberRule, /text-shadow:/);
});

test('keeps saved cards at the canonical 316 by 190 size', () => {
  assert.match(
    styles,
    /\.card-list\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fill, 322px\)[\s\S]*?justify-content:\s*center/,
  );
  assert.match(
    styles,
    /\.ea-card\s*\{[\s\S]*?width:\s*316px[\s\S]*?aspect-ratio:\s*316\s*\/\s*190/,
  );
  assert.match(styles, /\.ea-card-library-preview\s*\{\s*width:\s*316px/);
  assert.match(
    styles,
    /@media \(max-width: 520px\)[\s\S]*?\.card-list\s*\{[\s\S]*?grid-template-columns:\s*1fr/,
  );
});
