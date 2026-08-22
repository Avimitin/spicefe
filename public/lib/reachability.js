import { streamUrl, targetAddressSpaceForUrl } from './endpoints.js';
import { SpiceApi } from './spice-api.js';

export const REACHABILITY_INTERVAL_MS = 60 * 1000;
export const REACHABILITY_TIMEOUT_MS = 5000;

function responseError(error) {
  return error?.code === 'password'
    || error?.code === 'protocol'
    || error?.code === 'remote';
}

function result(state, responded, error, now, extras = {}) {
  return {
    state,
    responded,
    checkedAt: now(),
    reason: error?.code || null,
    message: error?.message || null,
    ...extras,
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
    let serverResponded = false;
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
      resolve(result(state, serverResponded || responseError(error), error, now));
    };

    try {
      api = createApi(profile);
    } catch (error) {
      finish('error', error);
      return;
    }

    timer = setTimer(() => {
      const error = new Error('The API status check timed out');
      error.code = 'timeout';
      finish('error', error);
    }, timeoutMs);

    api.onerror = (error) => {
      lastError = error;
      serverResponded ||= responseError(error);
    };
    api.onstate = (state) => {
      if (state === 'open' && !queryStarted) {
        queryStarted = true;
        serverResponded = true;
        api.request('info', 'avs', []).then(
          () => finish('ready', null),
          (error) => finish('error', error),
        );
        return;
      }
      if (state === 'error' || state === 'closed') {
        finish('error');
      }
    };

    if (!api.connect()) {
      finish('error');
    }
  });
}

export async function probeSpiceVideo(profile, options = {}) {
  const timeoutMs = options.timeoutMs ?? REACHABILITY_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const AbortControllerImpl = options.AbortControllerImpl ?? globalThis.AbortController;
  const setTimer = options.setTimeout ?? globalThis.setTimeout;
  const clearTimer = options.clearTimeout ?? globalThis.clearTimeout;
  const format = profile.format === 'mjpg' ? 'mjpg' : 'h264';
  const url = streamUrl(profile, format, now());

  if (!fetchImpl || !AbortControllerImpl) {
    const error = new Error('This browser cannot check the video server');
    error.code = 'unsupported';
    return result('error', false, error, now);
  }

  const controller = new AbortControllerImpl();
  let timedOut = false;
  const timer = setTimer(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
      mode: 'cors',
      referrerPolicy: 'no-referrer',
      targetAddressSpace: targetAddressSpaceForUrl(url),
    });

    // spice2x deliberately accepts only GET for a real stream. Its small, CORS-enabled
    // 405 response proves that the listener is ready without claiming a capture screen.
    if (response.status === 405) {
      return result('ready', true, null, now, { status: response.status });
    }

    const error = new Error(`Unexpected video status response (HTTP ${response.status})`);
    error.code = 'http';
    return result('error', true, error, now, { status: response.status });
  } catch (cause) {
    const error = new Error(
      timedOut ? 'The video status check timed out' : 'Could not reach the video server',
      cause ? { cause } : undefined,
    );
    error.code = timedOut ? 'timeout' : 'transport';
    return result('error', false, error, now);
  } finally {
    clearTimer(timer);
  }
}

export function deriveReachability(channels = {}) {
  const states = [channels.api, channels.video].filter(Boolean);
  const checkedAt = Math.max(0, ...states.map((channel) => channel.checkedAt || 0)) || null;

  // Browser JavaScript cannot send ICMP or probe arbitrary TCP ports. A service response
  // positively confirms the route; two failures only mean that neither service answered.
  if (states.some((channel) => channel.responded)) {
    return { state: 'reachable', checkedAt };
  }
  if (states.some((channel) => channel.state === 'checking')) {
    return { state: 'checking', checkedAt: null };
  }
  if (states.length === 2 && states.every((channel) => channel.state === 'error')) {
    return { state: 'no-response', checkedAt };
  }
  return { state: 'unknown', checkedAt: null };
}
