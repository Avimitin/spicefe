import assert from 'node:assert/strict';
import test from 'node:test';

import { formatCardNumber } from '../public/lib/credit-card.js';

test('groups the 16-character card ID into the native four-digit display', () => {
  assert.equal(formatCardNumber('e00401001234abcd'), 'E004 0100 1234 ABCD');
  assert.equal(formatCardNumber('E004 0100'), 'E004 0100');
});
