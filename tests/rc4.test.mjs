import assert from 'node:assert/strict';
import test from 'node:test';

import { RC4 } from '../public/lib/rc4.js';

const encoder = new TextEncoder();

test('RC4 matches a standard test vector', () => {
  const cipher = new RC4(encoder.encode('Key'));
  const encrypted = cipher.crypt(encoder.encode('Plaintext'));
  assert.equal(Buffer.from(encrypted).toString('hex').toUpperCase(), 'BBF316E8D940AF0AD3');
});

test('RC4 preserves its stream position across alternating chunks', () => {
  const whole = new RC4(encoder.encode('spice'));
  const expected = whole.crypt(encoder.encode('request-response'));

  const split = new RC4(encoder.encode('spice'));
  const first = split.crypt(encoder.encode('request-'));
  const second = split.crypt(encoder.encode('response'));

  assert.deepEqual(Buffer.concat([Buffer.from(first), Buffer.from(second)]), Buffer.from(expected));
});
