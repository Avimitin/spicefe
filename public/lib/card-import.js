import { SpiceApi, SpiceApiError } from './spice-api.js';

export const CARD_IMPORT_TIMEOUT_MS = 5000;

export function prepareCardImportCandidates(remoteCards, savedCardNumbers = []) {
  const savedNumbers = new Set(savedCardNumbers);
  const byNumber = new Map();
  for (const card of remoteCards) {
    const existing = byNumber.get(card.cardId);
    if (existing) {
      existing.players.push(card.index + 1);
      continue;
    }
    byNumber.set(card.cardId, {
      ...card,
      players: [card.index + 1],
      saved: savedNumbers.has(card.cardId),
    });
  }
  return [...byNumber.values()];
}

export function selectedCardImportCandidates(candidates, selectedNumbers) {
  const selected = new Set(selectedNumbers);
  return candidates.filter(
    (candidate) => selected.has(candidate.cardId) && !candidate.saved,
  );
}

export function fetchRemoteCards(profile, options = {}) {
  if (!profile?.password) {
    return Promise.reject(new SpiceApiError(
      'Set an API password on this spice2x instance before importing cards',
      'password-required',
    ));
  }

  const timeoutMs = options.timeoutMs ?? CARD_IMPORT_TIMEOUT_MS;
  const createApi = options.createApi
    ?? ((candidate) => new SpiceApi(candidate, {
      requestTimeout: Math.min(SpiceApi.REQUEST_TIMEOUT_MS, timeoutMs),
    }));
  const setTimer = options.setTimeout ?? globalThis.setTimeout;
  const clearTimer = options.clearTimeout ?? globalThis.clearTimeout;
  const signal = options.signal;

  if (signal?.aborted) {
    return Promise.reject(new SpiceApiError('Card scan cancelled', 'aborted'));
  }

  return new Promise((resolve, reject) => {
    let api;
    let timer;
    let settled = false;
    let requestStarted = false;
    let lastError = null;
    const abort = () => {
      finish(new SpiceApiError('Card scan cancelled', 'aborted'));
    };

    const finish = (error, cards = []) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimer(timer);
      signal?.removeEventListener('abort', abort);
      if (api) {
        api.onstate = () => {};
        api.onerror = () => {};
        api.close();
      }
      if (error) {
        reject(error);
      } else {
        resolve(cards);
      }
    };

    signal?.addEventListener('abort', abort, { once: true });

    try {
      api = createApi(profile);
    } catch (error) {
      finish(error);
      return;
    }

    timer = setTimer(() => {
      finish(new SpiceApiError('Card import timed out', 'timeout'));
    }, timeoutMs);

    api.onerror = (error) => {
      lastError = error;
    };
    api.onstate = (state) => {
      if (state === 'open' && !requestStarted) {
        requestStarted = true;
        api.getCards().then(
          (cards) => finish(null, cards),
          (error) => finish(error),
        );
        return;
      }
      if (state === 'error' || state === 'closed') {
        finish(lastError || new SpiceApiError('Connection closed', 'closed'));
      }
    };

    if (!api.connect()) {
      finish(lastError || new SpiceApiError(
        'Could not reach the spice2x input socket',
        'transport',
      ));
    }
  });
}
