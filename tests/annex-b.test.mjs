import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AnnexBParser,
  codecStringFromSps,
  firstMacroblockInSlice,
  joinAnnexB,
  startCodeLength,
} from '../public/lib/annex-b.js';

test('recognizes three- and four-byte Annex-B start codes', () => {
  assert.equal(startCodeLength(Uint8Array.from([0, 0, 1, 7]), 0), 3);
  assert.equal(startCodeLength(Uint8Array.from([0, 0, 0, 1, 7]), 0), 4);
  assert.equal(startCodeLength(Uint8Array.from([0, 1, 0, 1]), 0), 0);
});

test('parses NAL units when start codes are split across network chunks', () => {
  const units = [];
  const parser = new AnnexBParser((nal) => units.push(Array.from(nal)));
  const stream = Uint8Array.from([
    0, 0, 0, 1, 0x67, 0x42, 0xc0, 0x1f,
    0, 0, 1, 0x68, 0xaa,
    0, 0, 0, 1, 0x65, 1, 2, 3,
    0, 0, 1, 0x41, 4, 5,
    0, 0, 1, 0x41,
  ]);

  parser.push(stream.subarray(0, 2));
  parser.push(stream.subarray(2, 7));
  parser.push(stream.subarray(7, 12));
  parser.push(stream.subarray(12, 19));
  parser.push(stream.subarray(19, 25));
  parser.push(stream.subarray(25));

  assert.deepEqual(units, [
    [0x67, 0x42, 0xc0, 0x1f],
    [0x68, 0xaa],
    [0x65, 1, 2, 3],
    [0x41, 4, 5],
  ]);
});

test('builds the WebCodecs AVC codec string from an SPS', () => {
  assert.equal(codecStringFromSps(Uint8Array.from([0x67, 0x42, 0xc0, 0x1f])), 'avc1.42c01f');
});

test('reads first_mb_in_slice from H.264 slice headers', () => {
  assert.equal(firstMacroblockInSlice(Uint8Array.from([0x65, 0x80])), 0);
  assert.equal(firstMacroblockInSlice(Uint8Array.from([0x41, 0x00, 0x7d, 0x20])), 1000);
  assert.throws(
    () => firstMacroblockInSlice(Uint8Array.from([0x67, 0x80])),
    /slice NAL unit/,
  );
});

test('joins access units without changing their payload', () => {
  assert.deepEqual(
    Array.from(joinAnnexB([Uint8Array.from([0x67, 1]), Uint8Array.from([0x65, 2, 3])])),
    [0, 0, 0, 1, 0x67, 1, 0, 0, 0, 1, 0x65, 2, 3],
  );
});

test('bounds an unterminated NAL unit', () => {
  const parser = new AnnexBParser(() => {}, 8);
  assert.throws(() => parser.push(Uint8Array.from([0, 0, 1, 1, 2, 3, 4, 5, 6])), /safety limit/);
});
