import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchRemoteCards,
  prepareCardImportCandidates,
  selectedCardImportCandidates,
} from '../public/lib/card-import.js';

const profile = (password = 'cabinet') => ({
  host: '192.168.1.2',
  apiPort: 1337,
  password,
});

function fakeApi(behavior = {}) {
  return {
    closed: false,
    onstate: () => {},
    onerror: () => {},
    connect() {
      behavior.connect?.(this);
      return behavior.accepted ?? true;
    },
    getCards() {
      return behavior.getCards?.() ?? Promise.resolve([]);
    },
    close() {
      this.closed = true;
    },
  };
}

test('keeps scanned cards unselected, merges duplicate readers, and marks saved IDs', () => {
  const candidates = prepareCardImportCandidates([
    {
      index: 0,
      cardId: 'E00401001234ABCD',
      source: 'file',
      fileName: 'card0.txt',
    },
    {
      index: 1,
      cardId: 'E00401001234ABCD',
      source: 'override',
      fileName: 'card1',
    },
    {
      index: 1,
      cardId: 'E0040100DEADBEEF',
      source: 'file',
      fileName: 'rival.txt',
    },
  ], ['E0040100DEADBEEF']);

  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates[0].players, [1, 2]);
  assert.equal(candidates[0].saved, false);
  assert.equal(candidates[1].saved, true);
  assert.deepEqual(selectedCardImportCandidates(candidates, []), []);
  assert.deepEqual(
    selectedCardImportCandidates(candidates, [
      'E00401001234ABCD',
      'E0040100DEADBEEF',
    ]).map((card) => card.cardId),
    ['E00401001234ABCD'],
  );
});

test('requires a saved API password before opening a card import connection', async () => {
  let created = false;
  await assert.rejects(fetchRemoteCards(profile(''), {
    createApi: () => {
      created = true;
      return fakeApi();
    },
  }), /Set an API password/);
  assert.equal(created, false);
});

test('fetches cards over a short-lived API connection', async () => {
  let api;
  const cards = [{ index: 0, cardId: 'E00401001234ABCD', fileName: 'card0.txt' }];
  const imported = await fetchRemoteCards(profile(), {
    createApi: () => {
      api = fakeApi({
        connect(instance) {
          queueMicrotask(() => instance.onstate('open'));
        },
        getCards: () => Promise.resolve(cards),
      });
      return api;
    },
  });

  assert.deepEqual(imported, cards);
  assert.equal(api.closed, true);
});

test('closes the temporary API after a remote error', async () => {
  let api;
  const error = Object.assign(new Error('Unknown function.'), { code: 'remote' });
  await assert.rejects(fetchRemoteCards(profile(), {
    createApi: () => {
      api = fakeApi({
        connect(instance) {
          queueMicrotask(() => instance.onstate('open'));
        },
        getCards: () => Promise.reject(error),
      });
      return api;
    },
  }), /Unknown function/);
  assert.equal(api.closed, true);
});

test('times out and closes a silent card import connection', async () => {
  let api;
  await assert.rejects(fetchRemoteCards(profile(), {
    createApi: () => {
      api = fakeApi();
      return api;
    },
    setTimeout(callback) {
      queueMicrotask(callback);
      return 1;
    },
    clearTimeout() {},
  }), /timed out/);
  assert.equal(api.closed, true);
});

test('rejects an already-cancelled card scan without opening a connection', async () => {
  const controller = new AbortController();
  controller.abort();
  let created = false;

  await assert.rejects(fetchRemoteCards(profile(), {
    signal: controller.signal,
    createApi: () => {
      created = true;
      return fakeApi();
    },
  }), (error) => error.code === 'aborted');
  assert.equal(created, false);
});

test('closing a card scan aborts and closes its temporary API connection', async () => {
  const controller = new AbortController();
  let api;
  const pending = fetchRemoteCards(profile(), {
    signal: controller.signal,
    createApi: () => {
      api = fakeApi();
      return api;
    },
  });

  controller.abort();

  await assert.rejects(pending, (error) => error.code === 'aborted');
  assert.equal(api.closed, true);
});
