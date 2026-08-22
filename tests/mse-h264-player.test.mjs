import assert from 'node:assert/strict';
import test from 'node:test';

import { MseH264Player } from '../public/lib/mse-h264-player.js';

class FakeVideo {
  constructor() {
    this.readyState = 2;
    this.videoWidth = 1280;
    this.videoHeight = 720;
    this.paused = true;
    this.listeners = new Map();
    this.frameCallback = null;
    this.cancelledFrame = null;
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  requestVideoFrameCallback(callback) {
    this.frameCallback = callback;
    return 17;
  }

  cancelVideoFrameCallback(id) {
    this.cancelledFrame = id;
  }

  addEventListener(name, callback) {
    this.listeners.set(name, callback);
  }

  removeEventListener(name) {
    this.listeners.delete(name);
  }

  getVideoPlaybackQuality() {
    return { totalVideoFrames: 1, droppedVideoFrames: 0 };
  }

  removeAttribute() {}

  querySelectorAll() {
    return [];
  }

  load() {}
}

class FakeMuxer {
  static instances = [];

  constructor(options) {
    this.options = options;
    this.fed = [];
    this.destroyed = false;
    this.kfPosition = [];
    FakeMuxer.instances.push(this);
    queueMicrotask(() => options.onReady());
  }

  feed(data) {
    this.fed.push(data);
  }

  destroy() {
    this.destroyed = true;
  }
}

function streamingResponse(chunk = Uint8Array.of(0, 0, 1, 0x67)) {
  let first = true;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: () => {
          if (first) {
            first = false;
            return Promise.resolve({ value: chunk, done: false });
          }
          return new Promise(() => {});
        },
      }),
    },
  };
}

async function turn() {
  await new Promise((resolve) => setImmediate(resolve));
}

test('feeds the response to a low-latency video-only MSE muxer', async () => {
  FakeMuxer.instances = [];
  const video = new FakeVideo();
  const responses = [];
  const frames = [];
  const player = new MseH264Player(video, {
    JMuxerImpl: FakeMuxer,
    fetchImpl: async () => streamingResponse(),
  });
  player.onresponse = (response) => responses.push(response);
  player.onframe = (metric) => frames.push(metric);

  player.start('http://192.168.1.2:1339/stream.h264', 60);
  await turn();
  await turn();

  const muxer = FakeMuxer.instances[0];
  assert.equal(muxer.options.mode, 'video');
  assert.equal(muxer.options.live, true);
  assert.equal(muxer.options.fps, 60);
  assert.equal(muxer.options.flushingTime, 0);
  assert.equal(muxer.options.maxDelay, 100);
  assert.equal(responses.length, 1);
  assert.deepEqual(muxer.fed[0].video, Uint8Array.of(0, 0, 1, 0x67));

  video.frameCallback(0, { presentedFrames: 1 });
  assert.deepEqual(frames[0], {
    width: 1280,
    height: 720,
    fps: 0,
    decodedFrames: 1,
    droppedFrames: 0,
  });

  player.stop();
  assert.equal(muxer.destroyed, true);
  assert.equal(video.cancelledFrame, 17);
});

test('reports an unsupported MSE codec and tears down playback', async () => {
  FakeMuxer.instances = [];
  const video = new FakeVideo();
  const errors = [];
  const player = new MseH264Player(video, {
    JMuxerImpl: FakeMuxer,
    fetchImpl: async () => streamingResponse(),
  });
  player.onerror = (error) => errors.push(error);

  player.start('http://192.168.1.2:1339/stream.h264', 30);
  await turn();
  const muxer = FakeMuxer.instances[0];
  muxer.options.onUnsupportedCodec('avc1.640028');

  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'unsupported-codec');
  assert.equal(muxer.destroyed, true);
});
