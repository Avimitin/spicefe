import assert from 'node:assert/strict';
import test from 'node:test';

import {
  probeSpiceApi,
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
};

test('the background interval is exactly five minutes', () => {
  assert.equal(REACHABILITY_INTERVAL_MS, 300_000);
});

test('reachability sends the same read-only game-info query used by a session', async () => {
  let api;
  let request;
  const result = await probeSpiceApi(profile, {
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
  assert.deepEqual(result, {
    state: 'reachable',
    checkedAt: 1234,
    reason: null,
    message: null,
  });
  assert.equal(api.closed, true);
});

test('an API authentication response is reachable but retains its reason', async () => {
  const error = Object.assign(new Error('Wrong password'), { code: 'password' });
  const result = await probeSpiceApi(profile, {
    createApi: () => fakeApi({
      connect(api) {
        queueMicrotask(() => api.onstate('open'));
      },
      request: () => Promise.reject(error),
    }),
  });

  assert.equal(result.state, 'reachable');
  assert.equal(result.reason, 'password');
});

test('an unverified response still proves that the configured endpoint is reachable', async () => {
  const error = Object.assign(new Error('Malformed response'), { code: 'protocol' });
  const result = await probeSpiceApi(profile, {
    createApi: () => fakeApi({
      connect(api) {
        queueMicrotask(() => api.onstate('open'));
      },
      request: () => Promise.reject(error),
    }),
  });

  assert.equal(result.state, 'reachable');
  assert.equal(result.reason, 'protocol');
});

test('transport failure is reported as unreachable', async () => {
  const error = Object.assign(new Error('No route'), { code: 'transport' });
  const result = await probeSpiceApi(profile, {
    createApi: () => fakeApi({
      connect(api) {
        api.onerror(error);
        api.onstate('error');
      },
    }),
  });

  assert.equal(result.state, 'unreachable');
  assert.equal(result.reason, 'transport');
  assert.equal(result.message, 'No route');
});

test('a silent API is closed and reported as timed out', async () => {
  let api;
  const result = await probeSpiceApi(profile, {
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

  assert.equal(result.state, 'unreachable');
  assert.equal(result.reason, 'timeout');
  assert.equal(api.closed, true);
});
