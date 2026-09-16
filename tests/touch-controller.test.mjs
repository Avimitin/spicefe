import assert from 'node:assert/strict';
import test from 'node:test';

import { mapClientPoint, renderedContentRect, TouchController } from '../public/lib/touch-controller.js';
import { SpiceApi } from '../public/lib/spice-api.js';

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

function touchHarness(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = new EventTarget();
  globalThis.document = new EventTarget();
  const stage = new EventTarget();
  let rect = { left: 0, top: 0, width: 100, height: 100 };
  let source = { width: 100, height: 100 };
  let reads = 0;
  stage.getBoundingClientRect = () => { reads += 1; return rect; };
  stage.setPointerCapture = () => {};
  const frames = new Map();
  const sends = [];
  const markers = [];
  let frameId = 0;
  const touch = new TouchController(stage, {
    activeView: () => stage,
    viewSize: () => source,
    requestAnimationFrameImpl: (callback) => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrameImpl: (id) => frames.delete(id),
    onmarker: (marker) => markers.push(marker),
  });
  touch.setApi({ connected: true, send: (...args) => { sends.push(args); return true; } });
  touch.setEnabled(true);
  markers.length = 0;
  t.after(() => {
    touch.releaseAll();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  });
  return {
    touch, sends, markers, frames,
    reads: () => reads,
    setRect: (next) => { rect = next; },
    setSource: (next) => { source = next; },
    frame: () => {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback());
    },
    event: (x, pointerId = 1) => ({
      clientX: x, clientY: 25, pointerId, pointerType: 'touch',
      target: { closest: () => null }, preventDefault() {},
    }),
  };
}

test('a tap between display refreshes sends its press before its release', (t) => {
  const h = touchHarness(t);
  h.touch.pointerDown(h.event(10));
  h.touch.pointerEnd(h.event(10));
  assert.deepEqual(h.sends, [
    ['touch', 'write', [[1, 10, 25]], null],
    ['touch', 'write_reset', [1]],
  ]);
  assert.equal(h.frames.size, 0);
  t.mock.timers.tick(100);
  assert.equal(h.sends.length, 2);
  assert.ok(h.markers.every((marker) => !marker.visible));
});

test('dragging batches marker and movement updates and postpones held-contact refreshes', (t) => {
  const h = touchHarness(t);
  h.touch.pointerDown(h.event(10));
  for (let x = 11; x <= 40; x += 1) h.touch.pointerMove(h.event(x));
  assert.equal(h.reads(), 1);
  assert.equal(h.sends.length, 1);
  assert.equal(h.markers.length, 0);
  t.mock.timers.tick(40);
  h.frame();
  assert.deepEqual(h.sends.at(-1), ['touch', 'write', [[1, 40, 25]], 'touch.write']);
  assert.equal(h.markers.length, 1);
  t.mock.timers.tick(49);
  assert.equal(h.sends.length, 2);
  t.mock.timers.tick(1);
  assert.equal(h.sends.length, 3);
});

test('a repeat firing before a pending display callback does not duplicate movement', (t) => {
  const h = touchHarness(t);
  h.touch.pointerDown(h.event(10));
  h.frame();
  h.touch.pointerMove(h.event(20));
  t.mock.timers.tick(50);
  assert.equal(h.sends.length, 2);
  assert.equal(h.frames.size, 1);
  h.touch.pointerMove(h.event(30));
  assert.equal(h.frames.size, 1);
  h.frame();
  assert.equal(h.sends.length, 3);
  assert.deepEqual(h.sends.at(-1)[2], [[1, 30, 25]]);
  h.frame();
  assert.equal(h.sends.length, 3);
});

test('ending a drag flushes its final pending position before releasing the contact', (t) => {
  const h = touchHarness(t);
  h.touch.pointerDown(h.event(10));
  h.touch.pointerMove(h.event(40));
  h.touch.pointerEnd(h.event(40));
  assert.deepEqual(h.sends, [
    ['touch', 'write', [[1, 10, 25]], null],
    ['touch', 'write', [[1, 40, 25]], 'touch.write'],
    ['touch', 'write_reset', [1]],
  ]);
  h.frame();
  assert.equal(h.sends.length, 3);
});

test('geometry refreshes on a new frame, scrolling, resizing and source changes', (t) => {
  const h = touchHarness(t);
  h.touch.pointerDown(h.event(20));
  h.frame();
  h.setRect({ left: 10, top: 0, width: 100, height: 100 });
  h.touch.pointerMove(h.event(30));
  assert.equal(h.reads(), 2);
  h.setRect({ left: 20, top: 0, width: 100, height: 100 });
  window.dispatchEvent(new Event('scroll'));
  h.touch.pointerMove(h.event(50));
  assert.equal(h.touch.pointers.get(1).x, 30);
  h.setRect({ left: 0, top: 0, width: 200, height: 200 });
  window.dispatchEvent(new Event('resize'));
  h.touch.pointerMove(h.event(100));
  assert.equal(h.touch.pointers.get(1).x, 50);
  h.setSource({ width: 200, height: 200 });
  h.touch.pointerMove(h.event(100));
  assert.equal(h.touch.pointers.get(1).x, 100);
  assert.equal(h.reads(), 5);
});

test('queued contact transitions cannot be replaced by later movement', (t) => {
  const h = touchHarness(t);
  const api = new SpiceApi({}, { WebSocketImpl: { OPEN: 1 } });
  api.socket = { readyState: 1, close() {} };
  api.outstanding = {}; // Hold the transport busy while the gesture completes.
  h.touch.setApi(api);
  t.after(() => api.close());
  h.touch.pointerDown(h.event(10));
  h.touch.pointerMove(h.event(20));
  h.frame();
  h.touch.pointerDown(h.event(30, 2));
  h.touch.pointerEnd(h.event(20));
  h.touch.pointerMove(h.event(40, 2));
  h.frame();
  h.touch.pointerEnd(h.event(40, 2));
  assert.deepEqual(api.queue.map(({ func, params }) => [func, params]), [
    ['write', [[1, 10, 25]]],
    ['write', [[1, 20, 25]]],
    ['write', [[1, 20, 25], [2, 30, 25]]],
    ['write_reset', [1]],
    ['write', [[2, 30, 25]]],
    ['write', [[2, 40, 25]]],
    ['write_reset', [2]],
  ]);
});

test('losing visibility releases touches and cancels deferred movement and markers', (t) => {
  const h = touchHarness(t);
  h.touch.pointerDown(h.event(10));
  h.touch.pointerMove(h.event(20));
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  h.frame();
  t.mock.timers.tick(100);
  assert.deepEqual(h.sends.map((entry) => entry[1]), ['write', 'write_reset']);
  assert.equal(h.frames.size, 0);
  assert.equal(h.touch.repeatTimer, null);
  assert.equal(h.markers.at(-1).visible, false);
});

test('a release rejected by a full API queue is retried', (t) => {
  const h = touchHarness(t);
  h.touch.pointerDown(h.event(10));
  const send = h.touch.api.send;
  h.touch.api.send = () => false;
  h.touch.pointerEnd(h.event(10));
  h.touch.api.send = send;
  t.mock.timers.tick(50);
  assert.deepEqual(h.sends.at(-1), ['touch', 'write_reset', [1]]);
  assert.equal(h.touch.repeatTimer, null);
});

test('maps and clamps client positions into the game canvas', () => {
  const rect = { left: 50, top: 25, width: 100, height: 50 };
  const canvas = { width: 1280, height: 720 };
  assert.deepEqual(mapClientPoint(100, 50, rect, canvas), { x: 640, y: 360 });
  assert.equal(mapClientPoint(20, 50, rect, canvas, true), null);
  assert.deepEqual(mapClientPoint(20, 50, rect, canvas, false), { x: 0, y: 360 });
});
