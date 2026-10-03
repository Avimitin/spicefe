import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  decodeQrFrame,
  parseScannedProfile,
  profileFromScan,
  QrCameraScanner,
  QrScanError,
  QR_SCAN_FRAME_INTERVAL_MS,
} from '../public/lib/qr-scanner.js';
import { encodeSharedProfile } from '../public/lib/profile-share.js';
import { createQrCodeSvg } from '../public/lib/qr-code.js';

const profile = (overrides = {}) => ({
  id: 'local-only-id',
  name: 'IIDX cabinet',
  iconId: 'ac_iidx33',
  host: '192.168.8.20',
  apiPort: 55573,
  password: 'shared-secret',
  format: 'h264',
  screen: '1',
  fps: 60,
  quality: 82,
  viewMode: 'cover',
  tickerEnabled: true,
  keypadEnabled: false,
  ...overrides,
});

test('parses a scanned restore URL, query string, and bare payload', () => {
  const encoded = encodeSharedProfile(profile());

  const fromUrl = parseScannedProfile(
    `https://spicefe.example/?page=library&spicefe-profile=${encoded}`,
  );
  const fromQuery = parseScannedProfile(`spicefe-profile=${encoded}`);
  const fromBare = parseScannedProfile(encoded);

  assert.equal(fromUrl.host, '192.168.8.20');
  assert.equal(fromUrl.apiPort, 55573);
  assert.equal(fromUrl.password, 'shared-secret');
  assert.deepEqual(fromQuery, fromUrl);
  assert.deepEqual(fromBare, fromUrl);
});

test('returns null for QR text that is not a spicefe share code', () => {
  assert.equal(parseScannedProfile(''), null);
  assert.equal(parseScannedProfile('hello world'), null);
  assert.equal(parseScannedProfile('https://example.test/'), null);
  assert.equal(parseScannedProfile('https://example.test/?other=value'), null);
  assert.equal(parseScannedProfile('spicefe-profile='), null);
});

test('rejects damaged payloads with a typed error', () => {
  assert.throws(() => parseScannedProfile('https://x.test/?spicefe-profile=!!!'), (error) => {
    assert.ok(error instanceof QrScanError);
    assert.equal(error.code, 'encoding');
    return true;
  });
  assert.throws(() => parseScannedProfile('https://x.test/?spicefe-profile=AAAA'), (error) => {
    assert.ok(error instanceof QrScanError);
    return true;
  });
});

test('maps a decoded profile onto every wizard draft field', () => {
  const draft = profileFromScan(parseScannedProfile(encodeSharedProfile(profile())));
  assert.deepEqual(draft, {
    host: '192.168.8.20',
    apiPort: 55573,
    password: 'shared-secret',
    name: 'IIDX cabinet',
    iconId: 'ac_iidx33',
    style: 'ticker',
    format: 'h264',
    screen: '1',
    fps: 60,
    quality: 82,
  });
});

test('maps API-only and video connection styles from the shared flags', () => {
  const keypad = profileFromScan(parseScannedProfile(encodeSharedProfile(profile({
    tickerEnabled: false,
    keypadEnabled: true,
  }))));
  assert.equal(keypad.style, 'keypad');

  const video = profileFromScan(parseScannedProfile(encodeSharedProfile(profile({
    tickerEnabled: false,
    keypadEnabled: false,
  }))));
  assert.equal(video.style, 'video');
  assert.equal(video.format, 'h264');
  assert.equal(video.screen, '1');
  assert.equal(video.fps, 60);
  assert.equal(video.quality, 82);
});

test('normalizes bracketed IPv6 hosts and rejects invalid addresses', () => {
  const encoded = encodeSharedProfile(profile({ host: '[fe80::1]' }));
  assert.equal(profileFromScan(parseScannedProfile(encoded)).host, 'fe80::1');

  assert.throws(() => profileFromScan({ host: 'a/b' }), /path/);
  assert.throws(() => profileFromScan({ host: '' }), /no server address/);
  assert.throws(() => profileFromScan({ host: 'pc.local', apiPort: 0 }), /API port/);
  assert.throws(() => profileFromScan(null), /not a valid/);
});

test('decodes a generated QR code from a rendered frame', async () => {
  const encoded = encodeSharedProfile(profile());
  const link = `https://spicefe.example/?page=library&spicefe-profile=${encoded}`;

  // Build a synthetic RGBA frame from the QR matrix the generator produced.
  const qrcode = createQrCodeSvg(link);
  assert.match(qrcode, /^<svg /);

  // Re-import the generator directly to access the module matrix API.
  const { default: generate } = await import('../public/vendor/qrcode-generator/qrcode.js');
  const jsQR = (await import('../public/vendor/jsqr/jsQR.js')).default;
  const code = generate(0, 'M');
  code.addData(link, 'Byte');
  code.make();
  const count = code.getModuleCount();
  // Render at a size that stays within the decoder's bounded edge so the
  // fake canvas returns the frame without resampling.
  const scale = Math.max(1, Math.floor(480 / count));
  const size = count * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (!code.isDark(row, column)) {
        continue;
      }
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const index = ((row * scale + dy) * size + column * scale + dx) * 4;
          data[index] = 0;
          data[index + 1] = 0;
          data[index + 2] = 0;
        }
      }
    }
  }

  const fakeContext = {
    drawImage() {},
    getImageData: () => ({ data, width: size, height: size }),
  };
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => fakeContext,
  };
  const source = { videoWidth: size, videoHeight: size };

  // The frame is downsampled to the bounded edge before decoding.
  const frameScale = Math.min(1, 480 / size);
  const expectedWidth = Math.max(1, Math.round(size * frameScale));
  const expectedHeight = Math.max(1, Math.round(size * frameScale));

  const text = decodeQrFrame(source, {
    createCanvas: () => fakeCanvas,
    decodeImage: (frameData, width, height) => {
      assert.equal(width, expectedWidth);
      assert.equal(height, expectedHeight);
      return jsQR(frameData, width, height, { inversionAttempts: 'attemptBoth' });
    },
  });

  assert.equal(text, link);
  assert.equal(parseScannedProfile(text).host, '192.168.8.20');
});

test('decodeQrFrame skips unusable sources without throwing', () => {
  const fakeCanvas = { width: 0, height: 0, getContext: () => null };
  assert.equal(decodeQrFrame(null, { createCanvas: () => fakeCanvas }), null);
  assert.equal(decodeQrFrame({}, { createCanvas: () => fakeCanvas }), null);
  assert.equal(decodeQrFrame({ videoWidth: 0, videoHeight: 0 }, { createCanvas: () => fakeCanvas }), null);
  assert.equal(
    decodeQrFrame({ videoWidth: 10, videoHeight: 10 }, { createCanvas: () => fakeCanvas }),
    null,
  );
});

class FakeTrack {
  constructor() {
    this.stopped = false;
  }

  stop() {
    this.stopped = true;
  }
}

class FakeStream {
  constructor() {
    this.tracks = [new FakeTrack(), new FakeTrack()];
  }

  getTracks() {
    return this.tracks;
  }
}

function scannerHarness(options = {}) {
  const calls = { timers: 0, scans: 0, errors: [] };
  const scanner = new QrCameraScanner({
    video: { readyState: 0, srcObject: null, autoplay: false, playsInline: false, play() {} },
    intervalMs: 5,
    setTimer: (callback, ms) => {
      assert.equal(ms, 5);
      calls.timers += 1;
      return `timer-${calls.timers}`;
    },
    clearTimer: (id) => {
      calls.cleared = id;
    },
    getUserMedia: options.getUserMedia ?? (async () => new FakeStream()),
    decodeFrame: options.decodeFrame ?? (() => null),
    ondecoded: options.ondecoded ?? (() => {}),
    onerror: (error) => calls.errors.push(error),
  });
  return { scanner, calls };
}

test('starts the camera, polls frames, and stops the stream cleanly', async () => {
  const { scanner, calls } = scannerHarness();
  await scanner.start();
  assert.equal(scanner.running, true);
  assert.equal(scanner.video.srcObject, scanner.stream);
  assert.equal(scanner.video.playsInline, true);
  assert.equal(calls.timers, 1);
  const tracks = scanner.stream.getTracks();

  scanner.video.readyState = 2;
  scanner.scan();
  assert.equal(calls.scans, 0);
  assert.equal(calls.timers, 2);

  scanner.stop();
  assert.equal(scanner.running, false);
  assert.equal(calls.cleared, 'timer-2');
  assert.ok(tracks.every((track) => track.stopped));
  assert.equal(scanner.video.srcObject, null);
  scanner.scan();
  assert.equal(calls.timers, 2);
});

test('reports a successful decode and stops polling', async () => {
  const decoded = [];
  const { scanner } = scannerHarness({
    decodeFrame: () => 'https://spicefe.example/?spicefe-profile=abc',
    ondecoded: (text) => decoded.push(text),
  });
  await scanner.start();
  scanner.video.readyState = 2;
  scanner.scan();
  assert.deepEqual(decoded, ['https://spicefe.example/?spicefe-profile=abc']);
  scanner.stop();
});

test('maps camera failures to typed errors', async () => {
  const denied = scannerHarness({
    getUserMedia: async () => {
      throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    },
  });
  await denied.scanner.start();
  assert.equal(denied.scanner.running, false);
  assert.equal(denied.calls.errors[0].code, 'denied');

  const missing = scannerHarness({
    getUserMedia: async () => {
      throw Object.assign(new Error('missing'), { name: 'NotFoundError' });
    },
  });
  await missing.scanner.start();
  assert.equal(missing.calls.errors[0].code, 'camera');
  assert.match(missing.calls.errors[0].message, /No camera/);

  const generic = scannerHarness({
    getUserMedia: async () => {
      throw new Error('boom');
    },
  });
  await generic.scanner.start();
  assert.equal(generic.calls.errors[0].code, 'camera');
  assert.equal(generic.calls.errors.length, 1);
});

test('a stop during camera startup releases the stream immediately', async () => {
  const { scanner } = scannerHarness();
  const pending = scanner.start();
  scanner.stop();
  await pending;
  assert.equal(scanner.running, false);
  assert.ok(scanner.stream === null);
  assert.ok(scanner.video.srcObject === null);
});

test('reports the default poll interval and ships the vendored decoder record', () => {
  assert.equal(QR_SCAN_FRAME_INTERVAL_MS, 200);

  const runtime = readFileSync(new URL('../public/lib/qr-scanner.js', import.meta.url), 'utf8');
  const license = readFileSync(
    new URL('../public/vendor/jsqr/LICENSE.Apache-2.0.txt', import.meta.url),
    'utf8',
  );
  const source = readFileSync(new URL('../public/vendor/jsqr/SOURCE.md', import.meta.url), 'utf8');
  const notices = readFileSync(new URL('../public/THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');
  const lock = readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8');

  assert.match(runtime, /vendor\/jsqr\/jsQR\.js/);
  assert.match(license, /Apache License[\s\S]*Version 2\.0/);
  assert.match(source, /jsqr/);
  assert.match(source, /1\.4\.0/);
  assert.match(notices, /## jsQR/);
  assert.match(lock, /"node_modules\/jsqr": \{[\s\S]*"version": "1\.4\.0"/);
});
