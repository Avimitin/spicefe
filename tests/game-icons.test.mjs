import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  DEFAULT_GAME_ICON_ID,
  GAME_ICON_GROUPS,
  GAME_ICONS,
  gameIconById,
  normalizeGameIconId,
} from '../public/lib/game-icons.js';

const EXPECTED_GROUPS = [
  ['default', ['spice2x']],
  ['iidx', [
    'ac_iidx27',
    'ac_iidx28',
    'ac_iidx29',
    'ac_iidx30',
    'ac_iidx31',
    'ac_iidx32',
    'ac_iidx33',
  ]],
  ['gitadora', ['ac_gitadora_gw_delta']],
  ['sdvx', ['ac_sdvx6', 'ac_sdvx7']],
  ['popn', ['ac_popn_highcheers']],
];

test('catalog contains only the subscreen whitelist and groups it by game', () => {
  const directory = new URL('../public/vendor/bemani-fan-site-icons/img/', import.meta.url);
  const vendoredFiles = readdirSync(directory).sort();
  const catalogFiles = GAME_ICONS.slice(1).map((icon) => icon.file).sort();

  assert.equal(vendoredFiles.length, 11);
  assert.deepEqual(catalogFiles, vendoredFiles);
  assert.deepEqual(
    GAME_ICON_GROUPS.map((group) => [group.id, group.icons.map((icon) => icon.id)]),
    EXPECTED_GROUPS,
  );
  assert.equal(new Set(GAME_ICONS.map((icon) => icon.id)).size, GAME_ICONS.length);
});

test('catalog entries resolve to local static assets and readable labels', () => {
  for (const icon of GAME_ICONS) {
    assert.ok(icon.label.length > 0, icon.id);
    assert.ok(statSync(fileURLToPath(icon.src)).isFile(), icon.src);
  }
  assert.match(gameIconById('ac_iidx33').label, /IIDX 33/);
  assert.match(gameIconById('ac_gitadora_gw_delta').label, /GALAXY WAVE DELTA/);
  assert.match(gameIconById('ac_popn_highcheers').label, /High Cheer/);
});

test('unknown, unsupported, or malicious icon ids fall back to spice2x', () => {
  assert.equal(normalizeGameIconId('ac_iidx33'), 'ac_iidx33');
  assert.equal(normalizeGameIconId('ac_ddr_world'), DEFAULT_GAME_ICON_ID);
  assert.equal(normalizeGameIconId('../../secret'), DEFAULT_GAME_ICON_ID);
  assert.equal(gameIconById(null).id, DEFAULT_GAME_ICON_ID);
});
