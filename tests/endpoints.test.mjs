import assert from 'node:assert/strict';
import test from 'node:test';

import {
  apiWebSocketUrl,
  compatibilityUrl,
  hostAuthority,
  isPrivateLanName,
  likelyNeedsHttpMode,
  streamUrl,
  targetAddressSpaceForUrl,
} from '../public/lib/endpoints.js';

const profile = {
  id: 'pc',
  name: 'PC',
  host: '192.168.1.20',
  apiPort: 1337,
  password: '',
  format: 'h264',
  screen: '1',
  fps: 60,
  quality: 80,
  viewMode: 'contain',
};

test('derives spice2x WebSocket and stream ports', () => {
  assert.equal(apiWebSocketUrl(profile), 'ws://192.168.1.20:1338');
  const url = new URL(streamUrl(profile, 'h264', 123));
  assert.equal(url.origin, 'http://192.168.1.20:1339');
  assert.equal(url.pathname, '/stream.h264');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    fps: '60',
    q: '80',
    _: '123',
    screen: '1',
  });
});

test('brackets IPv6 authorities', () => {
  assert.equal(hostAuthority('fd00::20'), '[fd00::20]');
});

test('distinguishes loopback from LAN fetch address-space hints', () => {
  assert.equal(targetAddressSpaceForUrl('http://127.0.0.1:1339/stream.h264'), 'loopback');
  assert.equal(targetAddressSpaceForUrl('http://[::1]:1339/stream.h264'), 'loopback');
  assert.equal(targetAddressSpaceForUrl('http://192.168.1.2:1339/stream.h264'), 'local');
  assert.equal(targetAddressSpaceForUrl('http://cabinet.local:1339/stream.h264'), 'local');
});

test('recognizes local names and private address ranges', () => {
  for (const host of ['pc.local', '10.1.2.3', '172.20.1.2', '192.168.0.2', 'fd00::2']) {
    assert.equal(isPrivateLanName(host), true, host);
  }
  for (const host of ['example.com', '172.32.0.1', '8.8.8.8']) {
    assert.equal(isPrivateLanName(host), false, host);
  }
});

test('marks Safari and Firefox for HTTP compatibility mode', () => {
  assert.equal(likelyNeedsHttpMode('Mozilla/5.0 Firefox/150.0'), true);
  assert.equal(likelyNeedsHttpMode('Mozilla/5.0 Version/26.0 Safari/605.1.15'), true);
  assert.equal(likelyNeedsHttpMode('Mozilla/5.0 Chrome/150.0.0.0 Safari/537.36'), false);
});

test('builds an HTTP compatibility URL with an importable profile fragment', () => {
  const result = new URL(compatibilityUrl(
    [profile],
    'https://client.example:443/app/?from=test',
    profile.id,
  ));
  assert.equal(result.protocol, 'http:');
  assert.equal(result.port, '');
  assert.equal(result.searchParams.get('compat'), '1');
  assert.match(result.hash, /^#spicefe-profile=/);
});
