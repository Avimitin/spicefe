import assert from 'node:assert/strict';
import test from 'node:test';

import { SpiceSession } from '../public/lib/spice-session.js';

class FakeCanvas {
  constructor() {
    this.hidden = false;
    this.width = 1280;
    this.height = 720;
  }

  getContext() {
    return { drawImage() {} };
  }
}

class FakeVideo {
  constructor() {
    this.hidden = false;
    this.loadCount = 0;
  }

  pause() {}

  removeAttribute() {}

  querySelectorAll() {
    return [];
  }

  load() {
    this.loadCount += 1;
  }
}

class FakeImage {
  constructor() {
    this.hidden = false;
    this.src = 'http://192.168.1.2:1339/stream.mjpg';
  }

  addEventListener() {}
}

test('disconnect removes the final frame from every video backend', () => {
  const canvas = new FakeCanvas();
  const video = new FakeVideo();
  const image = new FakeImage();
  const session = new SpiceSession(canvas, video, image);
  let closed = false;
  let activeApi = 'unchanged';

  session.wanted = true;
  session.videoState = 'live';
  session.apiState = 'live';
  session.mjpegActive = true;
  session.api = { close: () => { closed = true; } };
  session.onapi = (api) => { activeApi = api; };
  session.disconnect();

  assert.equal(closed, true);
  assert.equal(activeApi, null);
  assert.equal(canvas.hidden, true);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
  assert.equal(video.hidden, true);
  assert.equal(video.loadCount, 1);
  assert.equal(image.hidden, true);
  assert.match(image.src, /^data:image\/gif;base64,/);
  assert.equal(session.snapshot.wanted, false);
  assert.equal(session.snapshot.videoState, 'idle');
});
