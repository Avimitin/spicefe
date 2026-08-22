import { SpiceApi } from './spice-api.js';

export const REACHABILITY_INTERVAL_MS = 5 * 60 * 1000;
export const REACHABILITY_TIMEOUT_MS = 5000;

function reachableError(error) {
  return error?.code === 'password'
    || error?.code === 'protocol'
    || error?.code === 'remote';
}

function result(state, error, now) {
  return {
    state,
    checkedAt: now(),
    reason: error?.code || null,
    message: error?.message || null,
  };
}

export function probeSpiceApi(profile, options = {}) {
  const timeoutMs = options.timeoutMs ?? REACHABILITY_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const createApi = options.createApi
    ?? ((candidate) => new SpiceApi(candidate, {
      requestTimeout: Math.min(SpiceApi.REQUEST_TIMEOUT_MS, timeoutMs),
    }));
  const setTimer = options.setTimeout ?? globalThis.setTimeout;
  const clearTimer = options.clearTimeout ?? globalThis.clearTimeout;

  return new Promise((resolve) => {
    let api;
    let timer;
    let settled = false;
    let queryStarted = false;
    let lastError = null;

    const finish = (state, error = lastError) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimer(timer);
      if (api) {
        api.onstate = () => {};
        api.onerror = () => {};
        api.close();
      }
      resolve(result(state, error, now));
    };

    try {
      api = createApi(profile);
    } catch (error) {
      finish('unreachable', error);
      return;
    }

    timer = setTimer(() => {
      const error = new Error('The reachability check timed out');
      error.code = 'timeout';
      finish('unreachable', error);
    }, timeoutMs);

    api.onerror = (error) => {
      lastError = error;
    };
    api.onstate = (state) => {
      if (state === 'open' && !queryStarted) {
        queryStarted = true;
        api.request('info', 'avs', []).then(
          () => finish('reachable', null),
          (error) => finish(reachableError(error) ? 'reachable' : 'unreachable', error),
        );
        return;
      }
      if (state === 'error' || state === 'closed') {
        finish(reachableError(lastError) ? 'reachable' : 'unreachable');
      }
    };

    if (!api.connect()) {
      finish('unreachable');
    }
  });
}
