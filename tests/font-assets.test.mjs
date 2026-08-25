import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
const bitcount = readFileSync(
  new URL('../public/vendor/bitcount-single/fonts/BitcountSingle-Variable.woff2', import.meta.url),
);
const inter = readFileSync(
  new URL('../public/vendor/inter/fonts/Inter-Bold.woff2', import.meta.url),
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
  assert.match(numberRule, /font-size:\s*17px;/);
  assert.match(numberRule, /font-weight:\s*300;/);
  assert.match(numberRule, /font-variation-settings:[^;]+"CRSV" 0[^;]+"wght" 300;/);
  assert.doesNotMatch(styles, /#card-name[^}]+Bitcount Single/s);
  assert.doesNotMatch(styles, /\.card-id-input input[^}]+Bitcount Single/s);
});

test('vendors Inter Bold for displayed card names', () => {
  const nameRule = styles.match(/(?:^|\n)\.ea-card-name \{(?<body>[^}]+)\}/)?.groups?.body || '';
  assert.equal(inter.subarray(0, 4).toString('ascii'), 'wOF2');
  assert.match(styles, /font-family:\s*"Inter";/);
  assert.match(styles, /Inter-Bold\.woff2/);
  assert.match(nameRule, /font-family:\s*"Inter",[^;]+sans-serif;/);
  assert.match(nameRule, /font-weight:\s*700;/);
});
