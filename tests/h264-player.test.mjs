import assert from 'node:assert/strict';
import test from 'node:test';

import { H264Player } from '../public/lib/h264-player.js';
import { joinAnnexB } from '../public/lib/annex-b.js';

class FakeFrame {
  constructor(name, width = 1280, height = 720) {
    this.name = name;
    this.displayWidth = width;
    this.displayHeight = height;
    this.closed = false;
  }

  close() {
    this.closed = true;
  }
}

function fakeCanvas(draws) {
  return {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: (...arguments_) => draws.push(arguments_),
    }),
  };
}

function unsignedExpGolomb(value) {
  const codeNumber = value + 1;
  const suffix = codeNumber.toString(2);
  const bits = `${'0'.repeat(suffix.length - 1)}${suffix}`;
  const padded = bits.padEnd(Math.ceil(bits.length / 8) * 8, '0');
  return Uint8Array.from(
    Array.from({ length: padded.length / 8 }, (_, index) => (
      Number.parseInt(padded.slice(index * 8, (index + 1) * 8), 2)
    )),
  );
}

function slice(type, firstMacroblock) {
  const header = type === 5 ? 0x65 : 0x41;
  return Uint8Array.from([header, ...unsignedExpGolomb(firstMacroblock)]);
}

test('submits one complete access unit for each sliced-thread picture', () => {
  const decoded = [];
  class FakeDecoder {
    constructor() {
      this.decodeQueueSize = 0;
    }

    configure() {}

    decode(chunk) {
      decoded.push(chunk);
    }

    close() {}

    reset() {}
  }
  class FakeChunk {
    constructor(init) {
      Object.assign(this, init);
    }
  }

  const player = new H264Player(fakeCanvas([]), {
    fetchImpl: async () => {},
    VideoDecoderImpl: FakeDecoder,
    EncodedVideoChunkImpl: FakeChunk,
  });
  player.controller = { abort() {} };

  const sps = Uint8Array.from([0x67, 0x42, 0xc0, 0x20]);
  const pps = Uint8Array.from([0x68, 0x01]);
  const keySlices = [0, 1000, 2000, 3000].map((offset) => slice(5, offset));
  const deltaSlices = [0, 1000, 2000, 3000].map((offset) => slice(1, offset));

  player.pushNal(sps);
  player.pushNal(pps);
  keySlices.forEach((nal) => player.pushNal(nal));
  assert.equal(decoded.length, 0);

  player.pushNal(deltaSlices[0]);
  assert.equal(decoded.length, 1);
  assert.equal(decoded[0].type, 'key');
  assert.deepEqual(decoded[0].data, joinAnnexB([sps, pps, ...keySlices]));

  deltaSlices.slice(1).forEach((nal) => player.pushNal(nal));
  player.pushNal(sps);
  assert.equal(decoded.length, 2);
  assert.equal(decoded[1].type, 'delta');
  assert.deepEqual(decoded[1].data, joinAnnexB(deltaSlices));

  player.stop();
});

test('coalesces bursty decoder output into the freshest animation frame', () => {
  const draws = [];
  const metrics = [];
  let scheduled = null;
  let scheduleCount = 0;
  const player = new H264Player(fakeCanvas(draws), {
    fetchImpl: async () => {},
    requestAnimationFrameImpl: (callback) => {
      scheduled = callback;
      scheduleCount += 1;
      return 41;
    },
    cancelAnimationFrameImpl: () => {},
  });
  player.controller = { abort() {} };
  player.onframe = (metric) => metrics.push(metric);

  const stale = new FakeFrame('stale');
  const fresh = new FakeFrame('fresh');
  player.draw(stale);
  player.draw(fresh);

  assert.equal(scheduleCount, 1);
  assert.equal(stale.closed, true);
  assert.equal(fresh.closed, false);
  assert.equal(player.droppedFrames, 1);
  assert.equal(draws.length, 0);

  scheduled();

  assert.equal(draws.length, 1);
  assert.equal(draws[0][0], fresh);
  assert.equal(fresh.closed, true);
  assert.deepEqual(metrics[0], {
    width: 1280,
    height: 720,
    fps: 0,
    decodedFrames: 2,
    droppedFrames: 1,
  });

  player.stop();
});

test('stop cancels a pending canvas paint and releases its VideoFrame', () => {
  const draws = [];
  const cancelled = [];
  let aborted = false;
  const player = new H264Player(fakeCanvas(draws), {
    fetchImpl: async () => {},
    requestAnimationFrameImpl: () => 73,
    cancelAnimationFrameImpl: (id) => cancelled.push(id),
  });
  player.controller = { abort: () => { aborted = true; } };

  const frame = new FakeFrame('pending');
  player.draw(frame);
  player.stop();

  assert.equal(aborted, true);
  assert.deepEqual(cancelled, [73]);
  assert.equal(frame.closed, true);
  assert.equal(draws.length, 0);
  assert.equal(player.pendingFrame, null);
});

function decodingHarness(t) {
  class Decoder {
    constructor() {
      this.state = 'unconfigured';
      this.decodeQueueSize = 0;
      this.chunks = [];
      this.configurations = [];
    }

    configure(config) { this.configurations.push(config); this.state = 'configured'; }
    reset() { this.state = 'unconfigured'; this.decodeQueueSize = 0; }
    close() { this.state = 'closed'; }
    decode(chunk) {
      if (this.state !== 'configured') throw new DOMException('Unconfigured', 'InvalidStateError');
      this.chunks.push(chunk);
    }
  }
  class Chunk {
    constructor(init) { Object.assign(this, init); }
  }
  const errors = [];
  const player = new H264Player(fakeCanvas([]), {
    VideoDecoderImpl: Decoder, EncodedVideoChunkImpl: Chunk,
  });
  player.controller = { abort() {} };
  player.onerror = (error) => errors.push(error);
  t.after(() => player.stop());
  return { player, errors };
}

const sps = Uint8Array.of(0x67, 0x42, 0xc0, 0x20);
const pps = Uint8Array.of(0x68, 0x01);

test('overload reconfigures the decoder and restores parameters on the next IDR', (t) => {
  const { player, errors } = decodingHarness(t);
  [sps, pps, slice(5, 0), slice(1, 0)].forEach((nal) => player.pushNal(nal));
  const decoder = player.decoder;
  assert.equal(decoder.chunks.length, 1);
  const stale = new FakeFrame('before reset');
  player.draw(stale);
  decoder.decodeQueueSize = 7;
  player.pushNal(slice(1, 0));
  assert.equal(player.resyncing, true);
  assert.equal(stale.closed, true);
  assert.equal(player.paintRequest, null);
  player.pushNal(slice(5, 0));
  assert.equal(decoder.chunks.length, 1);
  player.pushNal(slice(1, 0));
  assert.equal(decoder.chunks.length, 2);
  assert.equal(decoder.chunks[1].type, 'key');
  assert.deepEqual(decoder.chunks[1].data, joinAnnexB([sps, pps, slice(5, 0)]));
  assert.deepEqual(decoder.configurations, [
    { codec: 'avc1.42c020', optimizeForLatency: true },
    { codec: 'avc1.42c020', optimizeForLatency: true },
  ]);
  assert.deepEqual(errors, []);
});

test('overload at an IDR resumes immediately without duplicate parameter sets', (t) => {
  const { player, errors } = decodingHarness(t);
  [sps, pps, slice(5, 0)].forEach((nal) => player.pushNal(nal));
  const decoder = player.decoder;
  decoder.decodeQueueSize = 7;
  player.pushNal(slice(1, 0));
  assert.deepEqual(errors, []);
  assert.deepEqual(decoder.chunks[0].data, joinAnnexB([sps, pps, slice(5, 0)]));
});

test('a single-slice picture decodes as soon as the next slice header arrives', (t) => {
  const { player } = decodingHarness(t);
  player.parser.push(joinAnnexB([sps, pps, slice(5, 0)]));
  assert.equal(player.decoder.chunks.length, 0);
  const next = joinAnnexB([slice(1, 0)]);
  player.parser.push(next.subarray(0, 5)); // Start code and NAL type, but no slice header.
  assert.equal(player.decoder.chunks.length, 0);
  player.parser.push(next.subarray(5));
  assert.equal(player.decoder.chunks.length, 1);
  assert.deepEqual(player.decoder.chunks[0].data, joinAnnexB([sps, pps, slice(5, 0)]));
});

test('early headers preserve sliced-thread pictures under byte-sized network chunks', (t) => {
  const { player } = decodingHarness(t);
  const keySlices = [0, 1000, 2000, 3000].map((offset) => slice(5, offset));
  const deltaSlices = [0, 1000, 2000, 3000].map((offset) => slice(1, offset));
  const stream = joinAnnexB([sps, pps, ...keySlices, ...deltaSlices, slice(1, 0)]);
  for (const byte of stream) player.parser.push(Uint8Array.of(byte));
  assert.equal(player.decoder.chunks.length, 2);
  assert.deepEqual(player.decoder.chunks[0].data, joinAnnexB([sps, pps, ...keySlices]));
  assert.deepEqual(player.decoder.chunks[1].data, joinAnnexB(deltaSlices));
});
