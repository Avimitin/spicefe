import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { ScreenWakeLock } from '../public/lib/screen-wake-lock.js';
import { SpiceSession } from '../public/lib/spice-session.js';

const settle = () => new Promise((resolve) => setImmediate(resolve));
const live = { wanted: true, videoState: 'live' };
const idle = { wanted: false, videoState: 'idle' };

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class FakeSentinel extends EventTarget {
  released = false;
  releaseCount = 0;

  async release() {
    this.releaseCount += 1;
    this.released = true;
    this.dispatchEvent(new Event('release'));
  }
}

class FakeVideo extends EventTarget {
  paused = true;
  playCount = 0;
  children = [];
  attributes = {};

  setAttribute(name, value) { this.attributes[name] = value; }
  appendChild(child) { this.children.push(child); }
  removeAttribute() {}
  querySelectorAll() { return []; }
  load() {}
  pause() { this.paused = true; }
  async play() {
    this.playCount += 1;
    this.paused = false;
  }
}

class FakeDocument extends EventTarget {
  visibilityState = 'visible';
  videos = [];

  createElement(tag) {
    if (tag !== 'video') return {};
    const video = new FakeVideo();
    this.videos.push(video);
    return video;
  }

  visibility(state) {
    this.visibilityState = state;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

function harness(t, { native = true, request } = {}) {
  const document = new FakeDocument();
  const window = new EventTarget();
  const sentinels = [];
  const requests = [];
  const navigator = native ? { wakeLock: {
    request(type) {
      requests.push(type);
      if (request) return request();
      const sentinel = new FakeSentinel();
      sentinels.push(sentinel);
      return Promise.resolve(sentinel);
    },
  } } : {};
  const controller = new ScreenWakeLock({ document, window, navigator });
  t.after(() => controller.destroy());
  return { controller, document, window, sentinels, requests };
}

test('connect, live, error, retry, and disconnect follow the stream lifecycle', async (t) => {
  const { controller, sentinels, requests } = harness(t);
  controller.update(idle);
  assert.equal(requests.length, 0);
  controller.update({ wanted: true, videoState: 'connecting' });
  controller.update(live);
  controller.update({ ...live, apiState: 'error' });
  await settle();
  assert.deepEqual(requests, ['screen']);

  controller.update({ wanted: true, videoState: 'error' });
  assert.equal(sentinels[0].released, true);
  controller.update({ wanted: true, videoState: 'connecting' });
  await settle();
  assert.equal(requests.length, 2);
  controller.update(idle);
  assert.equal(sentinels[1].released, true);
});

test('hidden pages wait, then reacquire only while the session is active', async (t) => {
  const { controller, document, sentinels, requests } = harness(t);
  document.visibility('hidden');
  controller.update(live);
  assert.equal(requests.length, 0);
  document.visibility('visible');
  await settle();
  document.visibility('hidden');
  assert.equal(sentinels[0].released, true);
  document.visibility('visible');
  await settle();
  assert.equal(requests.length, 2);
  controller.update(idle);
  document.visibility('hidden');
  document.visibility('visible');
  assert.equal(requests.length, 2);
});

test('a pending lock is released if disconnect or backgrounding wins the race', async (t) => {
  for (const interrupt of [
    ({ controller }) => controller.update(idle),
    ({ document }) => document.visibility('hidden'),
    ({ window }) => window.dispatchEvent(new Event('pagehide')),
    ({ controller }) => controller.destroy(),
  ]) {
    const pending = deferred();
    const state = harness(t, { request: () => pending.promise });
    state.controller.update(live);
    interrupt(state);
    const sentinel = new FakeSentinel();
    pending.resolve(sentinel);
    await settle();
    assert.equal(sentinel.releaseCount, 1);
  }
});

test('an old request cannot replace or release the new session lock', async (t) => {
  const first = deferred();
  const second = deferred();
  const pending = [first, second];
  const { controller, requests } = harness(t, { request: () => pending.shift().promise });
  controller.update(live);
  controller.update(idle);
  controller.update(live);
  const current = new FakeSentinel();
  second.resolve(current);
  await settle();
  const stale = new FakeSentinel();
  first.resolve(stale);
  await settle();
  assert.equal(stale.released, true);
  assert.equal(current.released, false);
  controller.update(live);
  assert.equal(requests.length, 2);
  controller.update(idle);
  assert.equal(current.released, true);
});

test('OS revocation waits for visibility or interaction instead of retrying in a loop', async (t) => {
  const { controller, document, sentinels, requests } = harness(t);
  controller.update(live);
  await settle();
  await sentinels[0].release();
  controller.update(live);
  await settle();
  assert.equal(requests.length, 1);
  document.dispatchEvent(new Event('click'));
  await settle();
  assert.equal(requests.length, 2);
  controller.update(idle);
  assert.equal(sentinels[1].released, true);
});

test('denied requests and rejected releases do not interrupt the session', async (t) => {
  const { controller, document, requests } = harness(t, {
    request: () => Promise.reject(new Error('Permission denied')),
  });
  controller.update(live);
  await settle();
  controller.update(live);
  assert.equal(requests.length, 1);
  assert.equal(document.videos.length, 0);
  document.dispatchEvent(new Event('click'));
  await settle();
  assert.equal(requests.length, 2);
  controller.update(idle);

  const sentinel = new FakeSentinel();
  sentinel.release = async () => { throw new Error('Already revoked'); };
  const other = harness(t, { request: async () => sentinel });
  other.controller.update(live);
  await settle();
  other.controller.update(idle);
  await settle();
});

test('HTTP fallback plays local inline media and stops on hide or disconnect', async (t) => {
  const { controller, document, window } = harness(t, { native: false });
  assert.equal(document.videos.length, 0);
  controller.update({ wanted: true, videoState: 'connecting' });
  const [video] = document.videos;
  assert.equal(video.playCount, 1, 'play starts synchronously during Connect');
  assert.equal(video.attributes.playsinline, '');
  assert.equal(video.disablePictureInPicture, true);
  assert.equal(video.disableRemotePlayback, true);
  assert.deepEqual(video.children, [
    { src: './vendor/nosleep/wake-lock.webm', type: 'video/webm' },
    { src: './vendor/nosleep/wake-lock.mp4', type: 'video/mp4' },
  ]);
  await settle();
  controller.update(live);
  document.dispatchEvent(new Event('click'));
  assert.equal(video.playCount, 1);
  window.dispatchEvent(new Event('pagehide'));
  assert.equal(video.paused, true);
  document.dispatchEvent(new Event('click'));
  assert.equal(video.playCount, 1);
  window.dispatchEvent(new Event('pageshow'));
  await settle();
  assert.equal(video.playCount, 2);
  document.visibility('hidden');
  assert.equal(video.paused, true);
  document.visibility('visible');
  await settle();
  assert.equal(video.playCount, 3);
  controller.update(idle);
  assert.equal(video.paused, true);
  assert.equal(document.videos.length, 1);
});

test('autoplay denial retries on a gesture and late playback cannot survive disconnect', async (t) => {
  const { controller, document } = harness(t, { native: false });
  const video = new FakeVideo();
  const pending = deferred();
  let calls = 0;
  video.play = () => {
    calls += 1;
    return calls === 1 ? Promise.reject(new Error('Autoplay denied')) : pending.promise;
  };
  document.createElement = (tag) => tag === 'video' ? video : {};
  controller.update(live);
  await settle();
  document.dispatchEvent(new Event('click'));
  assert.equal(calls, 2);
  controller.update(idle);
  video.paused = false;
  pending.resolve();
  await settle();
  assert.equal(video.paused, true);
});

test('destroy removes lifecycle and interaction listeners', async (t) => {
  const { controller, document, window, sentinels, requests } = harness(t);
  controller.update(live);
  await settle();
  controller.destroy();
  assert.equal(sentinels[0].released, true);
  for (const type of ['visibilitychange', 'fullscreenchange', 'click', 'pointerup', 'keydown']) {
    document.dispatchEvent(new Event(type));
  }
  window.dispatchEvent(new Event('pagehide'));
  window.dispatchEvent(new Event('pageshow'));
  assert.equal(requests.length, 1);
});

test('all stream backends release their lock on failure and disconnect', async (t) => {
  for (const backend of ['webcodecs', 'mse', 'mjpg', 'ticker', 'keypad']) {
    const { controller, sentinels, requests } = harness(t);
    const image = new EventTarget();
    image.src = 'data:image/gif;base64,';
    const canvas = { getContext: () => ({ drawImage() {} }) };
    const session = new SpiceSession(canvas, new FakeVideo(), image);
    t.after(() => session.disconnect());
    session.onstate = (snapshot) => controller.update(snapshot);
    session.startApi = () => {};
    session.nextH264Backend = () => ['webcodecs', 'mse'].includes(backend) ? backend : null;
    session.webCodecsPlayer.start = () => {};
    session.msePlayer.start = () => {};
    session.connect({
      host: '192.168.1.2', apiPort: 1337, format: backend === 'mjpg' ? 'mjpg' : 'auto',
      tickerEnabled: backend === 'ticker', keypadEnabled: backend === 'keypad',
    });
    await settle();
    assert.equal(requests.length, 1, backend);
    if (backend === 'mjpg') {
      session.mjpegLoaded();
    } else if (['webcodecs', 'mse'].includes(backend)) {
      session.videoFrame({ decodedFrames: 1 }, backend);
    } else {
      const api = { connected: true, tickerGet: async () => 'SPICEFE' };
      session.api = api;
      if (backend === 'ticker') {
        await session.pollTicker(api);
      } else {
        session.videoState = 'live';
        session.emitState();
      }
      session.apiChanged(api, 'error');
      session.api = null;
    }
    if (['webcodecs', 'mse', 'mjpg'].includes(backend)) {
      session.videoFailed(new Error('Stream ended'));
    }
    assert.equal(sentinels[0].released, true, backend);
    session.disconnect();
    assert.equal(requests.length, 1, backend);
  }
});

test('vendored fallback media matches the recorded upstream bytes', () => {
  for (const [format, hash] of Object.entries({
    webm: '6d36944202af83661c4d57c5394aeb4f2609fb48ef6a56ba78233188d12561d3',
    mp4: 'a27edba0e34b2648a90a800ae94fdef3e39016d1b9bd6e54a31ede1f1cddfed0',
  })) {
    const data = readFileSync(new URL(`../public/vendor/nosleep/wake-lock.${format}`, import.meta.url));
    assert.equal(createHash('sha256').update(data).digest('hex'), hash);
  }
});
