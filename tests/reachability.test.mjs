import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveReachability,
  probeSpiceApi,
  probeSpiceTicker,
  probeSpiceVideo,
  REACHABILITY_INTERVAL_MS,
} from '../public/lib/reachability.js';

function fakeApi(behavior) {
  return {
    closed: false,
    onstate: () => {},
    onerror: () => {},
    connect() {
      behavior.connect?.(this);
      return behavior.accepted ?? true;
    },
    request(module, func, params) {
      behavior.requested?.(module, func, params);
      return behavior.request?.() ?? Promise.resolve([]);
    },
    close() {
      this.closed = true;
    },
  };
}

const profile = {
  host: '192.168.1.20',
  apiPort: 1337,
  password: '',
  format: 'auto',
  screen: '',
  fps: 30,
  quality: 70,
};

test('background service checks run once a minute while the library is visible', () => {
  assert.equal(REACHABILITY_INTERVAL_MS, 60_000);
});

test('API probe sends the same read-only game-info query used by a session', async () => {
  let api;
  let request;
  const probe = await probeSpiceApi(profile, {
    now: () => 1234,
    createApi: () => {
      api = fakeApi({
        connect(instance) {
          queueMicrotask(() => instance.onstate('open'));
        },
        requested(module, func, params) {
          request = { module, func, params };
        },
      });
      return api;
    },
  });

  assert.deepEqual(request, { module: 'info', func: 'avs', params: [] });
  assert.deepEqual(probe, {
    state: 'ready',
    responded: true,
    checkedAt: 1234,
    reason: null,
    message: null,
  });
  assert.equal(api.closed, true);
});

test('ticker probe checks the read-only IIDX display function instead of video', async () => {
  let request;
  const probe = await probeSpiceTicker(profile, {
    now: () => 5678,
    createApi: () => fakeApi({
      connect(api) {
        queueMicrotask(() => api.onstate('open'));
      },
      requested(module, func, params) {
        request = { module, func, params };
      },
    }),
  });

  assert.deepEqual(request, { module: 'iidx', func: 'ticker_get', params: [] });
  assert.equal(probe.state, 'ready');
  assert.equal(probe.responded, true);
  assert.equal(probe.checkedAt, 5678);
});

test('API authentication failure marks the channel failed but confirms the host response', async () => {
  const error = Object.assign(new Error('Wrong password'), { code: 'password' });
  const probe = await probeSpiceApi(profile, {
    createApi: () => fakeApi({
      connect(api) {
        queueMicrotask(() => api.onstate('open'));
      },
      request: () => Promise.reject(error),
    }),
  });

  assert.equal(probe.state, 'error');
  assert.equal(probe.responded, true);
  assert.equal(probe.reason, 'password');
});

test('an invalid API response still confirms the host but is not API-ready', async () => {
  const error = Object.assign(new Error('Malformed response'), { code: 'protocol' });
  const probe = await probeSpiceApi(profile, {
    createApi: () => fakeApi({
      connect(api) {
        queueMicrotask(() => api.onstate('open'));
      },
      request: () => Promise.reject(error),
    }),
  });

  assert.equal(probe.state, 'error');
  assert.equal(probe.responded, true);
  assert.equal(probe.reason, 'protocol');
});

test('API transport failure does not claim that the host responded', async () => {
  const error = Object.assign(new Error('No route'), { code: 'transport' });
  const probe = await probeSpiceApi(profile, {
    createApi: () => fakeApi({
      connect(api) {
        api.onerror(error);
        api.onstate('error');
      },
    }),
  });

  assert.equal(probe.state, 'error');
  assert.equal(probe.responded, false);
  assert.equal(probe.reason, 'transport');
  assert.equal(probe.message, 'No route');
});

test('a silent API is closed and reported as timed out', async () => {
  let api;
  const probe = await probeSpiceApi(profile, {
    createApi: () => {
      api = fakeApi({});
      return api;
    },
    setTimeout(callback) {
      queueMicrotask(callback);
      return 1;
    },
    clearTimeout() {},
  });

  assert.equal(probe.state, 'error');
  assert.equal(probe.responded, false);
  assert.equal(probe.reason, 'timeout');
  assert.equal(api.closed, true);
});

test('video probe uses a safe HEAD request and recognizes the spice2x 405 response', async () => {
  let request;
  const probe = await probeSpiceVideo(profile, {
    now: () => 2468,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { status: 405 };
    },
  });

  assert.match(request.url, /^http:\/\/192\.168\.1\.20:1339\/stream\.h264\?/);
  assert.equal(request.options.method, 'HEAD');
  assert.equal(request.options.mode, 'cors');
  assert.equal(request.options.cache, 'no-store');
  assert.equal(request.options.credentials, 'omit');
  assert.equal(request.options.targetAddressSpace, 'local');
  assert.equal(probe.state, 'ready');
  assert.equal(probe.responded, true);
  assert.equal(probe.status, 405);
});

test('an unexpected video HTTP response confirms the host but fails readiness', async () => {
  const probe = await probeSpiceVideo(profile, {
    fetchImpl: async () => ({ status: 404 }),
  });

  assert.equal(probe.state, 'error');
  assert.equal(probe.responded, true);
  assert.equal(probe.reason, 'http');
  assert.equal(probe.status, 404);
});

test('video transport failure does not claim that the host responded', async () => {
  const probe = await probeSpiceVideo(profile, {
    fetchImpl: async () => {
      throw new TypeError('Failed to fetch');
    },
  });

  assert.equal(probe.state, 'error');
  assert.equal(probe.responded, false);
  assert.equal(probe.reason, 'transport');
});

test('video timeout aborts its request', async () => {
  let signal;
  const probe = await probeSpiceVideo(profile, {
    fetchImpl: (url, options) => {
      signal = options.signal;
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    },
    setTimeout(callback) {
      queueMicrotask(callback);
      return 1;
    },
    clearTimeout() {},
  });

  assert.equal(signal.aborted, true);
  assert.equal(probe.state, 'error');
  assert.equal(probe.responded, false);
  assert.equal(probe.reason, 'timeout');
});

test('host reachability is derived from either independent service response', () => {
  const checking = { state: 'checking', responded: false, checkedAt: null };
  const failed = { state: 'error', responded: false, checkedAt: 100 };
  const authFailed = { state: 'error', responded: true, checkedAt: 200 };
  const ready = { state: 'ready', responded: true, checkedAt: 300 };

  assert.deepEqual(
    deriveReachability({ api: checking, video: checking }),
    { state: 'checking', checkedAt: null },
  );
  assert.deepEqual(
    deriveReachability({ api: authFailed, video: failed }),
    { state: 'reachable', checkedAt: 200 },
  );
  assert.deepEqual(
    deriveReachability({ api: failed, video: ready }),
    { state: 'reachable', checkedAt: 300 },
  );
  assert.deepEqual(
    deriveReachability({ api: failed, video: failed }),
    { state: 'no-response', checkedAt: 100 },
  );
});
