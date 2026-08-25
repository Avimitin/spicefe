import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decodeSharedProfile,
  encodeSharedProfile,
  extractSharedProfile,
  PROFILE_SHARE_HOST_QUERY_PARAMETER,
  PROFILE_SHARE_PORT_QUERY_PARAMETER,
  PROFILE_SHARE_QUERY_PARAMETER,
  ProfileShareError,
  sharedProfileUrl,
} from '../public/lib/profile-share.js';

const profile = (overrides = {}) => ({
  id: 'local-only-id',
  name: 'IIDX cabinet',
  iconId: 'ac_iidx33',
  host: '192.168.8.20',
  apiPort: 55573,
  password: '局域网-secret',
  format: 'h264',
  screen: '1',
  fps: 60,
  quality: 82,
  viewMode: 'cover',
  tickerEnabled: true,
  connected: true,
  ...overrides,
});

test('round-trips every portable connection field without local state or ID', () => {
  const restored = decodeSharedProfile(encodeSharedProfile(profile()));

  assert.deepEqual(restored, {
    name: 'IIDX cabinet',
    iconId: 'ac_iidx33',
    host: '192.168.8.20',
    apiPort: 55573,
    password: '局域网-secret',
    format: 'h264',
    screen: '1',
    fps: 60,
    quality: 82,
    viewMode: 'cover',
    tickerEnabled: true,
  });
  assert.equal('id' in restored, false);
  assert.equal('connected' in restored, false);
});

test('omits browser-local custom artwork from a portable connection', () => {
  const restored = decodeSharedProfile(encodeSharedProfile(profile({
    iconId: 'custom-icon-12345678',
  })));
  assert.equal(restored.iconId, 'spice2x');
});

test('builds a versioned query link and consumes it without leaving the secret parameter', () => {
  const link = sharedProfileUrl(
    profile(),
    'http://spice.nimabe.net/?page=welcome&compat=1#showcase',
  );
  const url = new URL(link);
  assert.equal(url.protocol, 'http:');
  assert.equal(url.searchParams.get('page'), 'library');
  assert.equal(url.searchParams.get(PROFILE_SHARE_HOST_QUERY_PARAMETER), '192.168.8.20');
  assert.equal(url.searchParams.get(PROFILE_SHARE_PORT_QUERY_PARAMETER), '55573');
  assert.ok(url.searchParams.has(PROFILE_SHARE_QUERY_PARAMETER));
  assert.match(
    link,
    /\?spicefe-host=192\.168\.8\.20&spicefe-port=55573&page=library&spicefe-profile=/,
  );
  assert.equal(link.includes('局域网-secret'), false);
  assert.equal(url.hash, '');

  const extracted = extractSharedProfile(link);
  assert.equal(extracted.found, true);
  assert.equal(extracted.error, null);
  assert.equal(extracted.profile.host, '192.168.8.20');
  assert.equal(extracted.profile.password, '局域网-secret');
  assert.equal(extracted.cleanPath, '/?page=library');
});

test('keeps older payload-only links compatible and rejects misleading address hints', () => {
  const encoded = encodeSharedProfile(profile());
  const legacy = extractSharedProfile(
    `https://example.test/?${PROFILE_SHARE_QUERY_PARAMETER}=${encoded}`,
  );
  assert.equal(legacy.error, null);
  assert.equal(legacy.profile.host, '192.168.8.20');

  const misleading = new URL(sharedProfileUrl(profile(), 'https://example.test/'));
  misleading.searchParams.set(PROFILE_SHARE_HOST_QUERY_PARAMETER, '192.168.8.99');
  const extracted = extractSharedProfile(misleading);
  assert.equal(extracted.profile, null);
  assert.equal(extracted.error.code, 'invalid');
  assert.equal(extracted.cleanPath, '/?page=library');
});

test('changes the readable address, payload, and complete link after an address edit', () => {
  const before = new URL(sharedProfileUrl(profile(), 'http://spicefe.local/'));
  const after = new URL(sharedProfileUrl(profile({
    host: '10.20.30.40',
    apiPort: 1337,
  }), 'http://spicefe.local/'));

  assert.equal(before.origin, after.origin);
  assert.equal(before.searchParams.get(PROFILE_SHARE_HOST_QUERY_PARAMETER), '192.168.8.20');
  assert.equal(after.searchParams.get(PROFILE_SHARE_HOST_QUERY_PARAMETER), '10.20.30.40');
  assert.notEqual(
    before.searchParams.get(PROFILE_SHARE_QUERY_PARAMETER),
    after.searchParams.get(PROFILE_SHARE_QUERY_PARAMETER),
  );
  assert.notEqual(before.toString(), after.toString());
});

test('returns a cleaned path and a typed error for malformed or duplicate payloads', () => {
  const malformed = extractSharedProfile(
    `https://example.test/?page=library&${PROFILE_SHARE_QUERY_PARAMETER}=not_valid%25`,
  );
  assert.equal(malformed.profile, null);
  assert.ok(malformed.error instanceof ProfileShareError);
  assert.equal(malformed.cleanPath, '/?page=library');

  const encoded = encodeSharedProfile(profile());
  const duplicate = extractSharedProfile(
    `https://example.test/?${PROFILE_SHARE_QUERY_PARAMETER}=${encoded}`
      + `&${PROFILE_SHARE_QUERY_PARAMETER}=${encoded}`,
  );
  assert.equal(duplicate.profile, null);
  assert.equal(duplicate.error.code, 'invalid');
  assert.equal(duplicate.cleanPath, '/');
});

test('rejects missing hosts and unsupported payload versions', () => {
  assert.throws(
    () => encodeSharedProfile(profile({ host: '' })),
    (error) => error.code === 'host',
  );

  const invalidVersion = btoa(JSON.stringify({ v: 99 }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
  assert.throws(
    () => decodeSharedProfile(invalidVersion),
    (error) => error.code === 'unsupported',
  );
});
