import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MINIMUM_SPICE2X_BUILD,
  spice2xBuildDate,
  spice2xCompatibility,
} from '../public/lib/spice-version.js';

test('extracts release dates from launcher and tag version formats', () => {
  assert.equal(spice2xBuildDate('1.0-V-2026-09-01T12:34:56'), '2026-09-01');
  assert.equal(spice2xBuildDate('26-12-17'), '2026-12-17');
  assert.equal(spice2xBuildDate('not-a-build'), null);
  assert.equal(spice2xBuildDate('1.0-V-2026-02-31T00:00:00'), null);
});

test('requires the 2026-09-01 spice2x build or newer', () => {
  assert.equal(MINIMUM_SPICE2X_BUILD, '2026-09-01');
  assert.equal(spice2xCompatibility('1.0-V-2026-08-28T12:00:00').supported, false);
  assert.equal(spice2xCompatibility('1.0-V-2026-09-01T00:00:00').supported, true);
  assert.equal(spice2xCompatibility('1.0-V-2027-01-02T00:00:00').supported, true);
  assert.equal(spice2xCompatibility('unknown').supported, false);
});
