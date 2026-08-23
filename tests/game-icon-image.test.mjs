import assert from 'node:assert/strict';
import test from 'node:test';

import {
  centeredSquareCrop,
  customIconLabel,
} from '../public/lib/game-icon-image.js';

test('takes a centered square from landscape, portrait, and square images', () => {
  assert.deepEqual(centeredSquareCrop(1600, 900), { x: 350, y: 0, size: 900 });
  assert.deepEqual(centeredSquareCrop(800, 1200), { x: 0, y: 200, size: 800 });
  assert.deepEqual(centeredSquareCrop(512, 512), { x: 0, y: 0, size: 512 });
  assert.throws(() => centeredSquareCrop(0, 500), /usable dimensions/);
});

test('uses a compact filename as the custom icon label', () => {
  assert.equal(customIconLabel('GITADORA GALAXY WAVE.png'), 'GITADORA GALAXY WAVE');
  assert.equal(customIconLabel(' icon.with.dots.webp '), 'icon.with.dots');
  assert.equal(customIconLabel(''), 'Custom icon');
});
