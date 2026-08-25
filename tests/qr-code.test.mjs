import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createQrCodeSvg } from '../public/lib/qr-code.js';

test('renders a self-contained scalable QR SVG from the vendored generator', () => {
  const svg = createQrCodeSvg('http://example.test/?spicefe-profile=test', {
    title: 'Shared server connection',
    alt: 'Scan to restore the server',
  });
  assert.match(svg, /^<svg /);
  assert.match(svg, /viewBox="0 0 \d+ \d+"/);
  assert.match(svg, /<title[^>]*>Shared server connection<\/title>/);
  assert.match(svg, /<path d="M/);
  assert.doesNotMatch(svg, /<script/i);
});

test('ships the pinned QR generator license and source record', () => {
  const runtime = readFileSync(
    new URL('../public/lib/qr-code.js', import.meta.url),
    'utf8',
  );
  const license = readFileSync(
    new URL('../public/vendor/qrcode-generator/LICENSE.MIT.txt', import.meta.url),
    'utf8',
  );
  const source = readFileSync(
    new URL('../public/vendor/qrcode-generator/SOURCE.md', import.meta.url),
    'utf8',
  );
  assert.match(license, /Copyright \(c\) 2009 Kazuhiko Arase/);
  assert.match(source, /qrcode-generator/);
  assert.match(source, /2\.0\.4/);
  assert.match(runtime, /qrcode-generator\/qrcode\.js/);
  assert.doesNotMatch(runtime, /qrcode-generator\/qrcode\.mjs/);
});
