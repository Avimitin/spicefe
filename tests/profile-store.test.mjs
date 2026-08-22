import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cleanHost,
  ProfileStore,
  PROFILE_STORAGE_KEY,
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
    iconId: '../../not-an-icon',
    connected: true,
  });
  assert.equal(profile.name, 'PC');
  assert.equal(profile.apiPort, 65533);
  assert.equal(profile.fps, 1);
  assert.equal(profile.quality, 100);
  assert.equal(profile.iconId, 'spice2x');
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
    iconId: 'ac_iidx33',
  });
  const second = firstStore.create({
    name: 'SDVX cabinet',
    host: 'sdvx.local',
    iconId: 'ac_sdvx7',
  });
  firstStore.select(first.id);

  const reloaded = new ProfileStore(storage);
  assert.equal(reloaded.list().length, 2);
  assert.equal(reloaded.selected().id, first.id);
  assert.equal(reloaded.selected().password, 'local-secret');
  assert.equal(reloaded.selected().iconId, 'ac_iidx33');
  assert.equal(reloaded.get(second.id).host, 'sdvx.local');
  assert.equal(reloaded.get(second.id).iconId, 'ac_sdvx7');
  assert.equal('connected' in reloaded.selected(), false);
});

test('adds the spice2x icon when loading a profile saved before icon support', () => {
  const storage = new MemoryStorage();
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({
    version: 1,
    selectedId: 'legacy',
    profiles: [{ id: 'legacy', name: 'Legacy PC', host: '192.168.1.20' }],
  }));

  const store = new ProfileStore(storage);
  assert.equal(store.selected().iconId, 'spice2x');
});

test('supports a localized name for newly generated default profiles', () => {
  const storage = new MemoryStorage();
  const store = new ProfileStore(storage, { defaultProfileName: '游戏 PC' });
  assert.equal(store.selected().name, '游戏 PC');

  store.remove(store.selectedId);
  assert.equal(store.selected().name, '游戏 PC');
});
