import assert from 'node:assert/strict';
import test from 'node:test';

import { connectionPresentation } from '../public/lib/connection-status.js';

function snapshot(overrides = {}) {
  return {
    wanted: true,
    profile: { apiPort: 1337 },
    apiState: 'connecting',
    videoState: 'connecting',
    apiError: null,
    videoError: null,
    ...overrides,
  };
}

test('shows API and video as independent channels', () => {
  const result = connectionPresentation(snapshot({
    apiState: 'live',
    videoState: 'error',
    videoError: 'No video frames arrived',
  }));

  assert.deepEqual(result.api, {
    state: 'connected',
    label: 'Connected',
    detail: 'Control API connected on port 1338',
  });
  assert.deepEqual(result.video, {
    state: 'error',
    label: 'Failed',
    detail: 'Video failed on port 1339: No video frames arrived',
  });
  assert.equal(result.streamMessage.title, 'Video stream failed');
  assert.match(result.streamMessage.copy, /API connected on port 1338/);
  assert.match(result.streamMessage.copy, /video endpoint is port 1339/);
});

test('keeps live video visible while reporting a failed control API', () => {
  const result = connectionPresentation(snapshot({
    apiState: 'error',
    apiError: { code: 'transport', message: 'Could not reach the input socket' },
    videoState: 'live',
  }));

  assert.equal(result.api.state, 'error');
  assert.equal(result.video.state, 'connected');
  assert.equal(result.video.label, 'Live');
  assert.equal(result.streamMessage, null);
  assert.equal(result.apiWarning.title, 'Video is live; control is unavailable');
  assert.match(result.apiWarning.copy, /port 1338/);
  assert.match(result.apiWarning.copy, /Touch and resize are disabled/);
});

test('identifies an API authentication failure separately', () => {
  const result = connectionPresentation(snapshot({
    apiState: 'error',
    apiError: { code: 'password', message: 'Wrong API password' },
  }));

  assert.equal(result.api.label, 'Auth failed');
  assert.equal(result.video.label, 'Opening');
  assert.equal(result.streamMessage.title, 'API connection failed');
  assert.match(result.streamMessage.copy, /Wrong API password/);
  assert.match(result.streamMessage.copy, /Video is still opening on port 1339/);
});

test('explains that a bad API password does not affect live video', () => {
  const result = connectionPresentation(snapshot({
    apiState: 'error',
    apiError: { code: 'password', message: 'Wrong API password' },
    videoState: 'live',
  }));

  assert.match(result.apiWarning.copy, /Update the saved password and reconnect/);
  assert.match(result.apiWarning.copy, /video does not use that password/);
});

test('reports both failures and their distinct ports', () => {
  const result = connectionPresentation(snapshot({
    apiState: 'error',
    apiError: { code: 'transport', message: 'WebSocket blocked' },
    videoState: 'error',
    videoError: 'HTTP 404',
  }));

  assert.equal(result.streamMessage.title, 'API and video failed');
  assert.match(result.streamMessage.copy, /API port 1338: WebSocket blocked/);
  assert.match(result.streamMessage.copy, /Video port 1339: HTTP 404/);
});

test('resets both channels to idle after disconnect', () => {
  const result = connectionPresentation(snapshot({
    wanted: false,
    apiState: 'idle',
    videoState: 'idle',
  }));

  assert.equal(result.api.label, 'Idle');
  assert.equal(result.video.label, 'Idle');
  assert.equal(result.streamMessage, null);
  assert.equal(result.apiWarning, null);
});
