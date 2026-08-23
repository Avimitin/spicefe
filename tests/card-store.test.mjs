import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CardStore,
  CARD_STORAGE_KEY,
  generateCardNumber,
  isValidCardNumber,
  newCard,
  newCardDraft,
  normalizeCardNumberInput,
  sanitizeCard,
} from '../public/lib/card-store.js';

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

test('uses the same 16-character hexadecimal card rule as spice2x', () => {
  assert.equal(normalizeCardNumberInput('e004-0100-abcd-1234-extra'), 'E0040100ABCD1234');
  assert.equal(isValidCardNumber('E0040100ABCD1234'), true);
  assert.equal(isValidCardNumber('E0040100ABCD123'), false);
  assert.throws(() => sanitizeCard({ number: 'not-a-card' }), /16 hexadecimal/);
});

test('generates the native E0040100 prefix plus eight random hex digits', () => {
  assert.equal(
    generateCardNumber(Uint8Array.from([0x00, 0x12, 0xab, 0xff])),
    'E00401000012ABFF',
  );
});

test('starts a new editor draft without generating a card ID', () => {
  const draft = newCardDraft();
  assert.equal(draft.number, '');
  assert.equal(draft.appearance, 'gray-light');
});

test('persists named card appearance and local image data', () => {
  const storage = new MemoryStorage();
  const store = new CardStore(storage);
  const image = 'data:image/png;base64,iVBORw0KGgo=';
  const saved = store.upsert(newCard({
    id: 'main',
    number: 'e00401001234abcd',
    name: '主卡 / Main card ✨',
    appearance: 'image',
    image,
  }));

  assert.equal(saved.number, 'E00401001234ABCD');
  assert.equal(saved.name, '主卡 / Main card ✨');
  assert.equal(JSON.parse(storage.getItem(CARD_STORAGE_KEY)).cards.length, 1);

  const reloaded = new CardStore(storage);
  assert.deepEqual(reloaded.get('main'), saved);
  assert.equal(reloaded.remove('main'), true);
  assert.deepEqual(reloaded.list(), []);
});

test('falls back to gray light when an image appearance has no safe local image', () => {
  const card = sanitizeCard({
    number: 'E004010000000001',
    appearance: 'image',
    image: 'https://example.com/not-local.png',
  });
  assert.equal(card.appearance, 'gray-light');
  assert.equal(card.image, null);
});

test('accepts and preserves the gray dark card appearance', () => {
  const card = sanitizeCard({
    number: 'E004010000000002',
    appearance: 'gray-dark',
  });
  assert.equal(card.appearance, 'gray-dark');
});

test('rolls back an update when browser storage is full', () => {
  const storage = new MemoryStorage();
  const store = new CardStore(storage);
  storage.setItem = () => {
    throw new Error('QuotaExceededError');
  };

  assert.throws(() => store.upsert(newCard({ id: 'too-large' })), /could not be saved/);
  assert.deepEqual(store.list(), []);
});
