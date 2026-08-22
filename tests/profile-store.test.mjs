import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cleanHost,
  decodeProfileTransfer,
  encodeProfileTransfer,
  ProfileStore,
  sanitizeProfile,
} from '../public/lib/profile-store.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

test('normalizes and validates host input', () => {
  assert.equal(cleanHost(' https://192.168.1.42:1337/path '), '192.168.1.42');
  assert.equal(cleanHost('[fd00::42]'), 'fd00::42');
  assert.throws(() => cleanHost('pc.local:1337'), /separate port/);
  assert.throws(() => cleanHost('pc.local/path'), /without a path/);
});

test('sanitizes profile ranges and drops connection state', () => {
  const profile = sanitizeProfile({
    id: 'one',
    name: ' PC ',
    host: 'pc.local',
    apiPort: 70000,
    fps: 0,
    quality: 500,
    connected: true,
  });
  assert.equal(profile.name, 'PC');
  assert.equal(profile.apiPort, 65533);
  assert.equal(profile.fps, 1);
  assert.equal(profile.quality, 100);
  assert.equal('connected' in profile, false);
});

test('persists several instances and their connection information only', () => {
  const storage = new MemoryStorage();
  const firstStore = new ProfileStore(storage);
  const first = firstStore.upsert({
    ...firstStore.selected(),
    name: 'IIDX cabinet',
    host: '192.168.8.10',
    password: 'local-secret',
  });
  const second = firstStore.create({ name: 'SDVX cabinet', host: 'sdvx.local' });
  firstStore.select(first.id);

  const reloaded = new ProfileStore(storage);
  assert.equal(reloaded.list().length, 2);
  assert.equal(reloaded.selected().id, first.id);
  assert.equal(reloaded.selected().password, 'local-secret');
  assert.equal(reloaded.get(second.id).host, 'sdvx.local');
  assert.equal('connected' in reloaded.selected(), false);
});

test('profile transfer preserves multiple instances, unicode, and passwords across schemes', () => {
  const first = sanitizeProfile({
    id: 'portable',
    name: '音游 PC',
    host: '192.168.1.5',
    password: '鍵🔑',
  });
  const second = sanitizeProfile({ id: 'other', name: 'Other PC', host: 'pc.local' });
  assert.deepEqual(
    decodeProfileTransfer(encodeProfileTransfer([first, second], second.id)),
    { profiles: [first, second], selectedId: second.id },
  );
});

test('replaces the destination scheme library during profile transfer', () => {
  const storage = new MemoryStorage();
  const store = new ProfileStore(storage);
  const first = sanitizeProfile({ id: 'one', host: '192.168.1.10' });
  const second = sanitizeProfile({ id: 'two', host: '192.168.1.11' });
  store.replaceAll([first, second], second.id);

  assert.deepEqual(store.list(), [first, second]);
  assert.equal(store.selected().id, second.id);
});
