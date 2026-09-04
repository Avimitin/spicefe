import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  nextServerSetupStep,
  previousServerSetupStep,
  serverSetupModeFields,
  serverSetupSequence,
} from '../public/lib/server-setup.js';

test('routes video setup through stream quality before the final name', () => {
  assert.deepEqual(serverSetupSequence('video'), [
    'address',
    'icon',
    'style',
    'stream',
    'name',
  ]);
  assert.equal(nextServerSetupStep('style', 'video'), 'stream');
  assert.equal(previousServerSetupStep('name', 'video'), 'stream');
});

test('routes API-only display styles directly from style to name', () => {
  for (const style of ['ticker', 'keypad']) {
    assert.deepEqual(serverSetupSequence(style), ['address', 'icon', 'style', 'name']);
    assert.equal(nextServerSetupStep('style', style), 'name');
    assert.equal(previousServerSetupStep('name', style), 'style');
  }
});

test('maps each setup style to mutually exclusive profile flags', () => {
  assert.deepEqual(serverSetupModeFields('video'), {
    tickerEnabled: false,
    keypadEnabled: false,
  });
  assert.deepEqual(serverSetupModeFields('ticker'), {
    tickerEnabled: true,
    keypadEnabled: false,
  });
  assert.deepEqual(serverSetupModeFields('keypad'), {
    tickerEnabled: false,
    keypadEnabled: true,
  });
});

test('the creation wizard exposes address validation, force-save, and every requested page', () => {
  const component = readFileSync(new URL('../src/server-setup.tsx', import.meta.url), 'utf8');
  const markup = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/app.tsx', import.meta.url), 'utf8');

  assert.match(markup, /id="server-setup-dialog"/);
  assert.match(component, /connectionState === 'failed'/);
  assert.match(component, /setup\.forceSave/);
  assert.match(app, /if \(draft\.apiVerified\)/);
  assert.match(component, /setup\.styleVideoTitle/);
  assert.match(component, /setup\.styleTickerTitle/);
  assert.match(component, /setup\.styleKeypadTitle/);
  assert.match(component, /nextServerSetupStep\('style', nextStyle\)/);
  assert.match(app, /probeSpiceApi\(candidate\)/);
  assert.match(app, /createProfileAndEdit[\s\S]*openServerSetup/);
});
