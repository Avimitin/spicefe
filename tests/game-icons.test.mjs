import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  DEFAULT_GAME_ICON_ID,
  GAME_ICONS,
  gameIconById,
  normalizeGameIconId,
} from '../public/lib/game-icons.js';

test('catalog covers every vendored BEMANI web icon exactly once', () => {
  const directory = new URL('../public/vendor/bemani-fan-site-icons/img/', import.meta.url);
  const vendoredFiles = readdirSync(directory).sort();
  const catalogFiles = GAME_ICONS.slice(1).map((icon) => icon.file).sort();

  assert.equal(vendoredFiles.length, 111);
  assert.deepEqual(catalogFiles, vendoredFiles);
  assert.equal(new Set(GAME_ICONS.map((icon) => icon.id)).size, GAME_ICONS.length);
});

test('catalog entries resolve to local static assets and readable labels', () => {
  for (const icon of GAME_ICONS) {
    assert.ok(icon.label.length > 0, icon.id);
    assert.ok(statSync(fileURLToPath(icon.src)).isFile(), icon.src);
  }
  assert.match(gameIconById('ac_iidx33').label, /IIDX 33/);
  assert.match(gameIconById('ac_ddr_world').label, /DanceDanceRevolution World/);
});

test('unknown or malicious icon ids fall back to the official spice2x icon', () => {
  assert.equal(normalizeGameIconId('ac_iidx33'), 'ac_iidx33');
  assert.equal(normalizeGameIconId('../../secret'), DEFAULT_GAME_ICON_ID);
  assert.equal(gameIconById(null).id, DEFAULT_GAME_ICON_ID);
});
