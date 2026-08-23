import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { browseView, configuredProfiles, mainView } from '../public/lib/main-view.js';

const blank = { id: 'draft', host: '' };
const saved = { id: 'saved', host: '192.168.1.20' };

test('a blank first-run draft does not count as a configured server', () => {
  assert.deepEqual(configuredProfiles([blank]), []);
  assert.equal(mainView([blank], { wanted: false }), 'welcome');
});

test('returning and disconnected users see their configured servers', () => {
  assert.deepEqual(configuredProfiles([blank, saved]), [saved]);
  assert.equal(mainView([blank, saved], { wanted: false }), 'servers');
});

test('welcome and server library remain separate browsable pages', () => {
  assert.equal(browseView([saved], 'welcome'), 'welcome');
  assert.equal(browseView([saved], 'servers'), 'servers');
  assert.equal(mainView([saved], { wanted: false }, 'welcome'), 'welcome');
  assert.equal(mainView([saved], { wanted: false }, 'servers'), 'servers');
  assert.equal(mainView([blank], { wanted: false }, 'servers'), 'welcome');
});

test('browser setup remains available with or without saved servers', () => {
  assert.equal(browseView([saved], 'browser-setup'), 'browser-setup');
  assert.equal(mainView([saved], { wanted: false }, 'browser-setup'), 'browser-setup');
  assert.equal(mainView([blank], { wanted: false }, 'browser-setup'), 'browser-setup');
});

test('self-hosting guide remains available with or without saved servers', () => {
  assert.equal(browseView([saved], 'self-host'), 'self-host');
  assert.equal(mainView([saved], { wanted: false }, 'self-host'), 'self-host');
  assert.equal(mainView([blank], { wanted: false }, 'self-host'), 'self-host');
});

test('card management remains available with or without saved servers', () => {
  assert.equal(browseView([saved], 'cards'), 'cards');
  assert.equal(mainView([saved], { wanted: false }, 'cards'), 'cards');
  assert.equal(mainView([blank], { wanted: false }, 'cards'), 'cards');
});

test('connection diagnostics remain on the server list until video is live', () => {
  assert.equal(mainView([saved], {
    wanted: true,
    videoState: 'connecting',
  }, 'servers'), 'servers');
  assert.equal(mainView([saved], {
    wanted: true,
    videoState: 'error',
  }, 'servers'), 'servers');
  assert.equal(mainView([saved], {
    wanted: true,
    videoState: 'live',
  }, 'servers'), 'stream');
  assert.equal(mainView([saved], {
    wanted: true,
    videoState: 'live',
  }, 'welcome'), 'stream');
});

test('ticker profiles remain in the library until their first display value arrives', () => {
  const ticker = { ...saved, tickerEnabled: true };
  assert.equal(mainView([ticker], {
    wanted: true,
    profile: ticker,
    videoState: 'connecting',
  }, 'servers'), 'servers');
  assert.equal(mainView([ticker], {
    wanted: true,
    profile: ticker,
    videoState: 'live',
  }, 'servers'), 'stream');
});

test('the connection editor leaves server selection to the library', () => {
  const markup = readFileSync(
    new URL('../public/index.html', import.meta.url),
    'utf8',
  );
  const script = readFileSync(
    new URL('../public/app.js', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(markup, /id="profile-picker"/);
  assert.doesNotMatch(markup, /id="new-profile"/);
  assert.match(
    markup,
    /<footer class="dialog-footer">[\s\S]*id="delete-profile"[^>]*hidden[\s\S]*id="save-profile"/,
  );
  assert.match(script, /delete-profile'\)\.hidden = editingProfileIsNew/);
});
