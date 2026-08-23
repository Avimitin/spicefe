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
    detail: 'Control API connected',
  });
  assert.deepEqual(result.video, {
    state: 'error',
    label: 'Failed',
    detail: 'Video stream failed: No video frames arrived',
  });
  assert.equal(result.streamMessage.title, 'Video stream failed');
  assert.match(result.streamMessage.copy, /Control API is connected/);
  assert.doesNotMatch(result.streamMessage.copy, /port/i);
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
  assert.match(result.apiWarning.copy, /Could not reach the input socket/);
  assert.match(result.apiWarning.copy, /Touch input is disabled/);
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
  assert.match(result.streamMessage.copy, /video stream is still opening/i);
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

test('reports both failures without exposing internal port arithmetic', () => {
  const result = connectionPresentation(snapshot({
    apiState: 'error',
    apiError: { code: 'transport', message: 'WebSocket blocked' },
    videoState: 'error',
    videoError: 'HTTP 404',
  }));

  assert.equal(result.streamMessage.title, 'API and video failed');
  assert.match(result.streamMessage.copy, /Control API: WebSocket blocked/);
  assert.match(result.streamMessage.copy, /Video stream: HTTP 404/);
  assert.doesNotMatch(result.streamMessage.copy, /1338|1339/);
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

test('renders independent connection diagnostics in Simplified Chinese', () => {
  const result = connectionPresentation(snapshot({
    apiState: 'live',
    videoState: 'error',
    videoError: 'No video frames arrived from that screen',
  }), 'zh-CN');

  assert.equal(result.api.label, '已连接');
  assert.equal(result.video.label, '失败');
  assert.equal(result.streamMessage.title, '视频流连接失败');
  assert.match(result.streamMessage.copy, /控制 API 已连接/);
  assert.match(result.streamMessage.copy, /未从该画面收到视频帧/);
});

test('presents ticker failures as a display issue instead of a video issue', () => {
  const result = connectionPresentation(snapshot({
    profile: { apiPort: 1337, tickerEnabled: true },
    apiState: 'live',
    videoState: 'error',
    videoError: { code: 'remote', message: 'unknown function ticker_get' },
  }));

  assert.equal(result.video.label, 'Failed');
  assert.match(result.video.detail, /16-segment display failed/i);
  assert.equal(result.streamMessage.title, '16-segment display unavailable');
  assert.match(result.streamMessage.copy, /older|supports|release/i);
  assert.doesNotMatch(result.streamMessage.copy, /video/i);
  assert.equal(result.apiWarning, null);
});

test('localizes live ticker status in Simplified Chinese', () => {
  const result = connectionPresentation(snapshot({
    profile: { apiPort: 1337, tickerEnabled: true },
    apiState: 'live',
    videoState: 'live',
  }), 'zh-CN');

  assert.equal(result.video.label, '实时');
  assert.equal(result.video.detail, '正在更新米字屏');
  assert.equal(result.streamMessage, null);
});
