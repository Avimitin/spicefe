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

test('video heartbeats extend one stall watchdog without replacing its timer', () => {
  const session = new SpiceSession(new FakeCanvas(), new FakeVideo(), new FakeImage());
  session.wanted = true;
  session.videoFormat = 'h264';
  session.videoBackend = 'webcodecs';
  session.videoState = 'connecting';

  session.videoFrame({ decodedFrames: 1 }, 'webcodecs');
  const firstTimer = session.stallTimer;
  const firstDeadline = session.stallDeadline;
  session.videoFrame({ decodedFrames: 2 }, 'webcodecs');

  assert.ok(firstTimer);
  assert.equal(session.stallTimer, firstTimer);
  assert.ok(session.stallDeadline >= firstDeadline);

  session.disconnect();
});

test('video response headers confirm server reachability before the first frame', () => {
  const session = new SpiceSession(new FakeCanvas(), new FakeVideo(), new FakeImage());
  session.wanted = true;
  session.videoFormat = 'h264';
  session.videoBackend = 'webcodecs';
  session.videoState = 'connecting';

  session.videoResponse('webcodecs');

  assert.equal(session.snapshot.videoResponded, true);
  assert.equal(session.snapshot.videoState, 'connecting');
  session.disconnect();
  assert.equal(session.snapshot.videoResponded, false);
});

test('a WebCodecs decoder error advances to the alternate H.264 backend', () => {
  const session = new SpiceSession(new FakeCanvas(), new FakeVideo(), new FakeImage());
  const notices = [];
  let starts = 0;
  let stops = 0;
  session.wanted = true;
  session.profile = { format: 'auto' };
  session.videoFormat = 'h264';
  session.videoBackend = 'webcodecs';
  session.onnotice = (notice) => notices.push(notice);
  session.stopH264 = () => { stops += 1; };
  session.nextH264Backend = () => 'mse';
  session.startVideo = () => { starts += 1; };

  session.videoFailed(Object.assign(new Error('decoder rejected a slice'), { code: 'decoder' }));

  assert.deepEqual([...session.failedH264Backends], ['webcodecs']);
  assert.deepEqual(notices, ['notice.h264Alternate']);
  assert.equal(stops, 1);
  assert.equal(starts, 1);
});

test('decoder errors fall back to MJPEG after all H.264 backends fail', () => {
  const session = new SpiceSession(new FakeCanvas(), new FakeVideo(), new FakeImage());
  const notices = [];
  let starts = 0;
  session.wanted = true;
  session.profile = { format: 'auto' };
  session.videoFormat = 'h264';
  session.videoBackend = 'mse';
  session.onnotice = (notice) => notices.push(notice);
  session.stopH264 = () => {};
  session.nextH264Backend = () => null;
  session.startVideo = () => { starts += 1; };

  session.videoFailed(Object.assign(new Error('media buffer failed'), { code: 'mse-buffer' }));

  assert.deepEqual([...session.failedH264Backends], ['mse']);
  assert.deepEqual(notices, ['notice.h264DecodeMjpeg']);
  assert.equal(session.fellBackToMjpeg, true);
  assert.equal(starts, 1);
});

test('ticker mode opens only the API and never starts a video stream', () => {
  const session = new SpiceSession(new FakeCanvas(), new FakeVideo(), new FakeImage());
  let videoStarts = 0;
  let apiStarts = 0;
  session.startVideo = () => { videoStarts += 1; };
  session.startApi = () => { apiStarts += 1; };

  session.connect({ tickerEnabled: true });

  assert.equal(videoStarts, 0);
  assert.equal(apiStarts, 1);
  assert.equal(session.snapshot.displayMode, 'ticker');
  assert.equal(session.snapshot.videoFormat, 'ticker');
  session.disconnect();
});

test('ticker mode continuously polls the native API and clears the display on disconnect', async () => {
  const session = new SpiceSession(new FakeCanvas(), new FakeVideo(), new FakeImage());
  const values = [];
  let calls = 0;
  let thirdPoll;
  const reachedThirdPoll = new Promise((resolve) => { thirdPoll = resolve; });
  const api = {
    connected: true,
    tickerGet: async () => {
      calls += 1;
      if (calls === 3) {
        thirdPoll();
      }
      return `FRAME${String(calls).padStart(4, '0')}`;
    },
    close() {},
  };
  session.profile = { tickerEnabled: true };
  session.wanted = true;
  session.apiState = 'live';
  session.api = api;
  session.onticker = (value) => values.push(value);

  const originalPollMs = SpiceSession.TICKER_POLL_MS;
  let pollTimeout;
  SpiceSession.TICKER_POLL_MS = 2;
  try {
    session.startTicker(api);
    await Promise.race([
      reachedThirdPoll,
      new Promise((_, reject) => {
        pollTimeout = setTimeout(
          () => reject(new Error('ticker polling did not repeat')),
          250,
        );
      }),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 5));
  } finally {
    clearTimeout(pollTimeout);
    SpiceSession.TICKER_POLL_MS = originalPollMs;
  }

  assert.equal(session.snapshot.videoState, 'live');
  assert.equal(session.snapshot.videoResponded, true);
  assert.ok(calls >= 3);
  assert.match(session.snapshot.tickerText, /^FRAME\d{4}$/);
  assert.ok(values.length >= 3);

  const callsBeforeDisconnect = calls;
  session.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(calls, callsBeforeDisconnect);
  assert.equal(session.snapshot.tickerText, '         ');
  assert.equal(values.at(-1), '         ');
});

test('polls host memory on the live API and clears telemetry on disconnect', async () => {
  const session = new SpiceSession(new FakeCanvas(), new FakeVideo(), new FakeImage());
  const values = [];
  let calls = 0;
  let reachedSecondPoll;
  const secondPoll = new Promise((resolve) => { reachedSecondPoll = resolve; });
  const memory = { totalBytes: 32, usedBytes: 12, processBytes: 2 };
  const api = {
    connected: true,
    getMemoryInfo: async () => {
      calls += 1;
      if (calls === 2) {
        reachedSecondPoll();
      }
      return memory;
    },
    close() {},
  };
  session.profile = { tickerEnabled: false };
  session.wanted = true;
  session.api = api;
  session.onmemory = (value) => values.push(value);

  const originalPollMs = SpiceSession.MEMORY_POLL_MS;
  let pollTimeout;
  SpiceSession.MEMORY_POLL_MS = 2;
  try {
    session.startMemoryPolling(api);
    await Promise.race([
      secondPoll,
      new Promise((_, reject) => {
        pollTimeout = setTimeout(() => reject(new Error('memory polling did not repeat')), 250);
      }),
    ]);
  } finally {
    clearTimeout(pollTimeout);
    SpiceSession.MEMORY_POLL_MS = originalPollMs;
  }

  assert.ok(calls >= 2);
  assert.deepEqual(values.at(-1), memory);
  const callsBeforeDisconnect = calls;
  session.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(calls, callsBeforeDisconnect);
  assert.equal(values.at(-1), null);
});
