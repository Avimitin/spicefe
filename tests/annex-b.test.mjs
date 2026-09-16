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

test('preserves payloads and header order at every possible chunk boundary', () => {
  const nals = [
    Uint8Array.of(0x67, 0x42, 0xc0, 0x1f),
    Uint8Array.of(0x68, 0xaa),
    Uint8Array.of(0x65, 0x80, 0x55),
    Uint8Array.of(0x41, 0x00, 0x7d, 0x20),
    Uint8Array.of(0x41, 0x80),
  ];
  const stream = joinAnnexB(nals);
  for (let split = 1; split < stream.length; split += 1) {
    const units = [];
    const headers = [];
    const parser = new AnnexBParser((nal) => units.push(nal), undefined,
      (type, first) => headers.push([type, first]));
    parser.push(stream.subarray(0, split));
    parser.push(stream.subarray(split));
    assert.deepEqual(units, nals.slice(0, -1), `payload split ${split}`);
    assert.deepEqual(headers, [[7, false], [8, false], [5, true], [1, false], [1, true]],
      `header split ${split}`);
    parser.push(joinAnnexB([Uint8Array.of(0x41, 0xff)]));
    assert.deepEqual(units, nals, 'retained payloads survive compaction and reuse');
  }
});

test('parses byte-sized chunks and reports slice headers before payload completion', () => {
  const order = [];
  const parser = new AnnexBParser((nal) => order.push(['nal', ...nal]), undefined,
    (type, first) => order.push(['header', type, first]));
  const bytes = joinAnnexB([Uint8Array.of(0x65, 0x80), Uint8Array.of(0x41, 0x80)]);
  for (const byte of bytes) parser.push(Uint8Array.of(byte));
  assert.deepEqual(order, [
    ['header', 5, true], ['nal', 0x65, 0x80], ['header', 1, true],
  ]);
});

test('bounds complete oversized NALs and permits large chunks of small NALs', () => {
  const parser = new AnnexBParser(() => {}, 8);
  assert.throws(() => parser.push(joinAnnexB([
    Uint8Array.of(0x65, 1, 2, 3, 4, 5), Uint8Array.of(0x41, 0x80),
  ])), /safety limit/);
  parser.reset();
  assert.doesNotThrow(() => parser.push(joinAnnexB(
    Array.from({ length: 100 }, () => Uint8Array.of(0x41, 0x80)),
  )));
});

test('a callback reset stops processing the rest of the old stream', () => {
  let count = 0;
  const parser = new AnnexBParser(() => { count += 1; parser.reset(); });
  parser.push(joinAnnexB(Array.from({ length: 4 }, () => Uint8Array.of(0x41, 0x80))));
  assert.equal(count, 1);
  assert.equal(parser.length, 0);
});

test('buffer growth and reuse preserve large fragmented NALs', () => {
  const large = new Uint8Array(256 * 1024).fill(0x55);
  large[0] = 0x65;
  const small = Uint8Array.of(0x41, 0x80);
  const stream = joinAnnexB([large, small, large, small]);
  const nals = [];
  const parser = new AnnexBParser((nal) => nals.push(nal));
  for (let offset = 0; offset < stream.length; offset += 1024) {
    parser.push(stream.subarray(offset, offset + 1024));
  }
  assert.deepEqual(nals, [large, small, large]);
  parser.reset();
  parser.push(joinAnnexB([small, small]));
  assert.deepEqual(nals, [large, small, large, small]);
});
