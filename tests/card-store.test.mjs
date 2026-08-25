import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CARD_ELEMENT_POSITIONS,
  CARD_NAME_POSITIONS,
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
  assert.equal(draft.eAmusementPosition, 'top-left');
  assert.equal(draft.konmaiPosition, 'bottom-right');
  assert.equal(draft.cardIdPosition, 'bottom-left');
  assert.equal(draft.namePosition, 'bottom-left');
});

test('sanitizes and persists independent card element positions', () => {
  assert.deepEqual(CARD_ELEMENT_POSITIONS, [
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ]);
  assert.deepEqual(CARD_NAME_POSITIONS, [
    'top-left',
    'top-center',
    'top-right',
    'center-left',
    'center',
    'center-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ]);

  const customized = sanitizeCard({
    number: 'E004010000000003',
    eAmusementPosition: 'bottom-center',
    konmaiPosition: 'top-right',
    cardIdPosition: 'top-left',
    namePosition: 'center-right',
  });
  assert.equal(customized.eAmusementPosition, 'bottom-center');
  assert.equal(customized.konmaiPosition, 'top-right');
  assert.equal(customized.cardIdPosition, 'top-left');
  assert.equal(customized.namePosition, 'center-right');

  const fallback = sanitizeCard({
    number: 'E004010000000004',
    eAmusementPosition: 'outside',
    konmaiPosition: '<script>',
    cardIdPosition: '',
    namePosition: 'outside',
  });
  assert.equal(fallback.eAmusementPosition, 'top-left');
  assert.equal(fallback.konmaiPosition, 'bottom-right');
  assert.equal(fallback.cardIdPosition, 'bottom-left');
  assert.equal(fallback.namePosition, 'bottom-left');
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
    eAmusementPosition: 'bottom-center',
    konmaiPosition: 'top-right',
    cardIdPosition: 'top-left',
    namePosition: 'center',
  }));

  assert.equal(saved.number, 'E00401001234ABCD');
  assert.equal(saved.name, '主卡 / Main card ✨');
  assert.equal(saved.eAmusementPosition, 'bottom-center');
  assert.equal(saved.konmaiPosition, 'top-right');
  assert.equal(saved.cardIdPosition, 'top-left');
  assert.equal(saved.namePosition, 'center');
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

test('imports new card IDs atomically and preserves existing cards', () => {
  const storage = new MemoryStorage();
  const store = new CardStore(storage);
  store.upsert(newCard({
    id: 'existing',
    number: 'E004010000000001',
    name: 'Customized name',
    appearance: 'gray-dark',
  }));

  const imported = store.importCards([
    newCard({ number: 'E004010000000001', name: 'card0.txt' }),
    newCard({ number: 'E004010000000002', name: 'second.txt' }),
    newCard({ number: 'E004010000000002', name: 'duplicate.txt' }),
  ]);

  assert.equal(imported.length, 1);
  assert.equal(imported[0].number, 'E004010000000002');
  assert.equal(imported[0].name, 'second.txt');
  assert.equal(store.list().length, 2);
  assert.equal(store.get('existing').name, 'Customized name');
  assert.equal(store.get('existing').appearance, 'gray-dark');
});

test('rolls back a batch import when browser storage is full', () => {
  const storage = new MemoryStorage();
  const store = new CardStore(storage);
  storage.setItem = () => {
    throw new Error('QuotaExceededError');
  };

  assert.throws(() => store.importCards([
    newCard({ number: 'E004010000000003' }),
    newCard({ number: 'E004010000000004' }),
  ]), /could not be saved/);
  assert.deepEqual(store.list(), []);
});
