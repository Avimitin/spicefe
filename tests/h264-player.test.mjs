import assert from 'node:assert/strict';
import test from 'node:test';

import { H264Player } from '../public/lib/h264-player.js';

class FakeFrame {
  constructor(name, width = 1280, height = 720) {
    this.name = name;
    this.displayWidth = width;
    this.displayHeight = height;
    this.closed = false;
  }

  close() {
    this.closed = true;
  }
}

function fakeCanvas(draws) {
  return {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: (...arguments_) => draws.push(arguments_),
    }),
  };
}

test('coalesces bursty decoder output into the freshest animation frame', () => {
  const draws = [];
  const metrics = [];
  let scheduled = null;
  let scheduleCount = 0;
  const player = new H264Player(fakeCanvas(draws), {
    fetchImpl: async () => {},
    requestAnimationFrameImpl: (callback) => {
      scheduled = callback;
      scheduleCount += 1;
      return 41;
    },
    cancelAnimationFrameImpl: () => {},
  });
  player.controller = { abort() {} };
  player.onframe = (metric) => metrics.push(metric);

  const stale = new FakeFrame('stale');
  const fresh = new FakeFrame('fresh');
  player.draw(stale);
  player.draw(fresh);

  assert.equal(scheduleCount, 1);
  assert.equal(stale.closed, true);
  assert.equal(fresh.closed, false);
  assert.equal(player.droppedFrames, 1);
  assert.equal(draws.length, 0);

  scheduled();

  assert.equal(draws.length, 1);
  assert.equal(draws[0][0], fresh);
  assert.equal(fresh.closed, true);
  assert.deepEqual(metrics[0], {
    width: 1280,
    height: 720,
    fps: 0,
    decodedFrames: 2,
    droppedFrames: 1,
  });

  player.stop();
});

test('stop cancels a pending canvas paint and releases its VideoFrame', () => {
  const draws = [];
  const cancelled = [];
  let aborted = false;
  const player = new H264Player(fakeCanvas(draws), {
    fetchImpl: async () => {},
    requestAnimationFrameImpl: () => 73,
    cancelAnimationFrameImpl: (id) => cancelled.push(id),
  });
  player.controller = { abort: () => { aborted = true; } };

  const frame = new FakeFrame('pending');
  player.draw(frame);
  player.stop();

  assert.equal(aborted, true);
  assert.deepEqual(cancelled, [73]);
  assert.equal(frame.closed, true);
  assert.equal(draws.length, 0);
  assert.equal(player.pendingFrame, null);
});
