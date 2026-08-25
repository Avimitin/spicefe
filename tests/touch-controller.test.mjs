import assert from 'node:assert/strict';
import test from 'node:test';

import { mapClientPoint, renderedContentRect } from '../public/lib/touch-controller.js';

const elementRect = { left: 10, top: 20, width: 200, height: 100 };
const portrait = { width: 100, height: 200 };

test('computes aspect-preserving fit geometry for touch mapping', () => {
  assert.deepEqual(renderedContentRect(elementRect, portrait), {
    left: 85,
    top: 20,
    width: 50,
    height: 100,
  });
});

test('maps and clamps client positions into the game canvas', () => {
  const rect = { left: 50, top: 25, width: 100, height: 50 };
  const canvas = { width: 1280, height: 720 };
  assert.deepEqual(mapClientPoint(100, 50, rect, canvas), { x: 640, y: 360 });
  assert.equal(mapClientPoint(20, 50, rect, canvas, true), null);
  assert.deepEqual(mapClientPoint(20, 50, rect, canvas, false), { x: 0, y: 360 });
});
