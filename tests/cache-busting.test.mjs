import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  contentVersion,
  stampAssetUrls,
  VERSIONED_ASSETS,
} from '../tools/stamp-assets.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url));

test('content-versions every executable or stylesheet entry point', () => {
  const markup = read('../public/index.html').toString('utf8');
  for (const { url, path } of VERSIONED_ASSETS) {
    const version = contentVersion(read(`../${path}`));
    assert.match(markup, new RegExp(`${url.replaceAll('.', '\\.')}\\?v=${version}`));
  }
});

test('asset stamping is deterministic and replaces a previous version', () => {
  const versions = [{ url: './app.js', version: '0123456789ab' }];
  const expected = '<script src="./app.js?v=0123456789ab"></script>';

  assert.equal(stampAssetUrls('<script src="./app.js"></script>', versions), expected);
  assert.equal(stampAssetUrls('<script src="./app.js?v=deadbeef"></script>', versions), expected);
  assert.equal(stampAssetUrls(expected, versions), expected);
});

test('asset stamping rejects missing or ambiguous entry points', () => {
  const versions = [{ url: './app.js', version: '0123456789ab' }];

  assert.throws(() => stampAssetUrls('<main></main>', versions), /found 0/);
  assert.throws(
    () => stampAssetUrls('<script src="./app.js"></script><a href="./app.js">source</a>', versions),
    /found 2/,
  );
});
