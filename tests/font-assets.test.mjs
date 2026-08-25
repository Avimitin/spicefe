import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
const bitcount = readFileSync(
  new URL('../public/vendor/bitcount-single/fonts/BitcountSingle-Variable.woff2', import.meta.url),
);

test('vendors Bitcount Single as a WOFF2 variable font asset', () => {
  assert.equal(bitcount.subarray(0, 4).toString('ascii'), 'wOF2');
  assert.match(styles, /font-family: "Bitcount Single";/);
  assert.match(styles, /BitcountSingle-Variable\.woff2/);
  assert.match(styles, /font-weight: 100 900;/);
});

test('uses Bitcount only for displayed card numbers with a monospace fallback', () => {
  const numberRule = styles.match(/(?:^|\n)\.ea-card-number \{(?<body>[^}]+)\}/)?.groups?.body || '';
  assert.match(numberRule, /font-family: "Bitcount Single", ui-monospace,[^;]+monospace;/);
  assert.match(numberRule, /font-variation-settings:[^;]+"CRSV" 0[^;]+"wght" 500;/);
  assert.doesNotMatch(styles, /#card-name[^}]+Bitcount Single/s);
  assert.doesNotMatch(styles, /\.card-id-input input[^}]+Bitcount Single/s);
});
