import assert from 'node:assert/strict';
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
