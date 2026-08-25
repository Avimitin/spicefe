import assert from 'node:assert/strict';
import test from 'node:test';

import { memoryPresentation } from '../public/lib/memory-metric.js';

const GIBIBYTE = 1024 ** 3;

test('formats host physical memory as a compact percentage with exact GiB details', () => {
  assert.deepEqual(memoryPresentation({
    totalBytes: 32 * GIBIBYTE,
    usedBytes: 12.25 * GIBIBYTE,
  }, 'en'), {
    percent: 38,
    used: '12.3 GiB',
    total: '32 GiB',
  });
});

test('rejects malformed host memory telemetry', () => {
  assert.equal(memoryPresentation(null), null);
  assert.equal(memoryPresentation({ totalBytes: 0, usedBytes: 0 }), null);
  assert.equal(memoryPresentation({ totalBytes: 10, usedBytes: 11 }), null);
});
