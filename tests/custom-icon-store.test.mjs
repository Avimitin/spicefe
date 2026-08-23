import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CustomIconStore,
  CUSTOM_ICON_LIMIT,
  CUSTOM_ICON_STORAGE_KEY,
  sanitizeCustomIcon,
} from '../public/lib/custom-icon-store.js';

class MemoryStorage {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

const image = 'data:image/webp;base64,UklGRgAAAAA=';

test('persists several browser-local custom icons', () => {
  const storage = new MemoryStorage();
  const store = new CustomIconStore(storage);
  const first = store.create({ label: 'My IIDX icon', src: image });
  const second = store.create({ label: '自定义图标', src: image });

  assert.match(first.id, /^custom-icon-/);
  assert.equal(store.list()[0].id, second.id);
  assert.equal(JSON.parse(storage.getItem(CUSTOM_ICON_STORAGE_KEY)).icons.length, 2);
  assert.deepEqual(new CustomIconStore(storage).get(first.id), first);
  assert.equal(store.remove(first.id), true);
  assert.equal(store.get(first.id), null);
  assert.equal(new CustomIconStore(storage).list().length, 1);
});

test('rejects remote and malformed icon images', () => {
  assert.throws(() => sanitizeCustomIcon({
    id: 'custom-icon-12345678',
    label: 'Remote',
    src: 'https://example.com/icon.png',
  }), /image is invalid/);
  assert.throws(() => sanitizeCustomIcon({
    id: '../../secret',
    label: 'Unsafe',
    src: image,
  }), /ID is invalid/);
});

test('drops damaged saved entries without hiding valid icons', () => {
  const storage = new MemoryStorage({
    [CUSTOM_ICON_STORAGE_KEY]: JSON.stringify({
      version: 1,
      icons: [
        { id: 'broken', label: 'Broken', src: image },
        { id: 'custom-icon-12345678', label: 'Good', src: image },
      ],
    }),
  });
  assert.deepEqual(new CustomIconStore(storage).list().map((icon) => icon.label), ['Good']);
});

test('bounds the local library and rolls back when storage is full', () => {
  const storage = new MemoryStorage();
  const store = new CustomIconStore(storage);
  for (let index = 0; index < CUSTOM_ICON_LIMIT; index += 1) {
    store.create({ label: `Icon ${index}`, src: image });
  }
  assert.throws(() => store.create({ label: 'One too many', src: image }), /library is full/);

  const failingStorage = new MemoryStorage();
  const failingStore = new CustomIconStore(failingStorage);
  failingStorage.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  assert.throws(() => failingStore.create({ label: 'Too large', src: image }), /could not be saved/);
  assert.deepEqual(failingStore.list(), []);
});
