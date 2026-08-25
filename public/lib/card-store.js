export const CARD_STORAGE_KEY = 'spicefe.cards.v1';
export const CARD_NUMBER_PATTERN = /^[0-9A-F]{16}$/;
export const CARD_NUMBER_PREFIX = 'E0040100';
export const CARD_NAME_LIMIT = 256;
export const CARD_IMAGE_DATA_URL_LIMIT = 1_600_000;
export const CARD_ELEMENT_POSITIONS = Object.freeze([
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]);
export const CARD_NAME_POSITIONS = Object.freeze([
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

export const DEFAULT_CARD_ELEMENT_POSITIONS = Object.freeze({
  eAmusementPosition: 'top-left',
  konmaiPosition: 'bottom-right',
  cardIdPosition: 'bottom-left',
  namePosition: 'bottom-left',
});

const APPEARANCES = new Set([
  'gray-light',
  'gray-dark',
  'solid',
  'transparent-gradient',
  'image',
]);
const COLOR_PATTERN = /^#[0-9A-F]{6}$/;
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const CARD_ELEMENT_POSITION_SET = new Set(CARD_ELEMENT_POSITIONS);
const CARD_NAME_POSITION_SET = new Set(CARD_NAME_POSITIONS);

export class CardStoreError extends Error {
  constructor(message, code = 'storage') {
    super(message);
    this.name = 'CardStoreError';
    this.code = code;
  }
}

const createId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const randomBytes = (length) => {
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
};

export function normalizeCardNumberInput(value) {
  return String(value ?? '')
    .replace(/[^0-9a-f]/gi, '')
    .toUpperCase()
    .slice(0, 16);
}

export function isValidCardNumber(value) {
  return CARD_NUMBER_PATTERN.test(String(value ?? '').toUpperCase());
}

export function generateCardNumber(bytes = randomBytes(4)) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 4) {
    throw new TypeError('Four random bytes are required');
  }
  return CARD_NUMBER_PREFIX + [...bytes.subarray(0, 4)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function sanitizeColor(value) {
  const color = String(value ?? '').trim().toUpperCase();
  return COLOR_PATTERN.test(color) ? color : '#667085';
}

function sanitizeImage(value) {
  const image = typeof value === 'string' ? value : '';
  return image.length <= CARD_IMAGE_DATA_URL_LIMIT && IMAGE_DATA_URL_PATTERN.test(image)
    ? image
    : null;
}

function sanitizeCardElementPosition(value, fallback) {
  const position = String(value ?? '');
  return CARD_ELEMENT_POSITION_SET.has(position) ? position : fallback;
}

function sanitizeCardNamePosition(value) {
  const position = String(value ?? '');
  return CARD_NAME_POSITION_SET.has(position)
    ? position
    : DEFAULT_CARD_ELEMENT_POSITIONS.namePosition;
}

export function sanitizeCard(input = {}) {
  const number = normalizeCardNumberInput(input.number);
  if (!isValidCardNumber(number)) {
    throw new CardStoreError('Card ID must contain exactly 16 hexadecimal characters', 'card-number');
  }

  const id = String(input.id ?? '').trim().slice(0, 96) || createId();
  const image = sanitizeImage(input.image);
  let appearance = APPEARANCES.has(String(input.appearance))
    ? String(input.appearance)
    : 'gray-light';
  if (appearance === 'image' && !image) {
    appearance = 'gray-light';
  }

  return {
    id,
    number,
    name: String(input.name ?? '').trim().slice(0, CARD_NAME_LIMIT),
    appearance,
    color: sanitizeColor(input.color),
    image,
    eAmusementPosition: sanitizeCardElementPosition(
      input.eAmusementPosition,
      DEFAULT_CARD_ELEMENT_POSITIONS.eAmusementPosition,
    ),
    konmaiPosition: sanitizeCardElementPosition(
      input.konmaiPosition,
      DEFAULT_CARD_ELEMENT_POSITIONS.konmaiPosition,
    ),
    cardIdPosition: sanitizeCardElementPosition(
      input.cardIdPosition,
      DEFAULT_CARD_ELEMENT_POSITIONS.cardIdPosition,
    ),
    namePosition: sanitizeCardNamePosition(input.namePosition),
  };
}

export function newCard(overrides = {}) {
  return sanitizeCard({
    id: createId(),
    number: generateCardNumber(),
    name: '',
    appearance: 'gray-light',
    color: '#667085',
    image: null,
    ...DEFAULT_CARD_ELEMENT_POSITIONS,
    ...overrides,
  });
}

export function newCardDraft(overrides = {}) {
  const draft = {
    id: createId(),
    number: '',
    name: '',
    appearance: 'gray-light',
    color: '#667085',
    image: null,
    ...DEFAULT_CARD_ELEMENT_POSITIONS,
    ...overrides,
  };
  return {
    ...draft,
    eAmusementPosition: sanitizeCardElementPosition(
      draft.eAmusementPosition,
      DEFAULT_CARD_ELEMENT_POSITIONS.eAmusementPosition,
    ),
    konmaiPosition: sanitizeCardElementPosition(
      draft.konmaiPosition,
      DEFAULT_CARD_ELEMENT_POSITIONS.konmaiPosition,
    ),
    cardIdPosition: sanitizeCardElementPosition(
      draft.cardIdPosition,
      DEFAULT_CARD_ELEMENT_POSITIONS.cardIdPosition,
    ),
    namePosition: sanitizeCardNamePosition(draft.namePosition),
  };
}

const cloneCard = (card) => ({ ...card });

export class CardStore {
  constructor(storage) {
    if (arguments.length > 0) {
      this.storage = storage;
    } else {
      try {
        this.storage = globalThis.localStorage;
      } catch {
        this.storage = null;
      }
    }
    this.cards = [];
    this.load();
  }

  load() {
    let saved;
    try {
      saved = JSON.parse(this.storage?.getItem(CARD_STORAGE_KEY) || 'null');
    } catch {
      saved = null;
    }

    if (saved?.version === 1 && Array.isArray(saved.cards)) {
      for (const candidate of saved.cards) {
        try {
          this.cards.push(sanitizeCard(candidate));
        } catch {
          // A malformed entry must not hide the rest of the card library.
        }
      }
    }
    return this.list();
  }

  list() {
    return this.cards.map(cloneCard);
  }

  get(id) {
    const card = this.cards.find((candidate) => candidate.id === id);
    return card ? cloneCard(card) : null;
  }

  upsert(candidate) {
    const card = sanitizeCard(candidate);
    const previous = this.cards;
    const next = this.list();
    const position = next.findIndex((saved) => saved.id === card.id);
    if (position < 0) {
      next.push(card);
    } else {
      next[position] = card;
    }
    this.cards = next;
    if (!this.persist()) {
      this.cards = previous;
      throw new CardStoreError('The card could not be saved in this browser');
    }
    return cloneCard(card);
  }

  importCards(candidates) {
    if (!Array.isArray(candidates)) {
      throw new TypeError('Cards must be provided as an array');
    }

    const previous = this.cards;
    const next = this.list();
    const numbers = new Set(next.map((card) => card.number));
    const imported = [];
    for (const candidate of candidates) {
      const card = sanitizeCard(candidate);
      if (numbers.has(card.number)) {
        continue;
      }
      numbers.add(card.number);
      next.push(card);
      imported.push(card);
    }

    if (imported.length === 0) {
      return [];
    }

    this.cards = next;
    if (!this.persist()) {
      this.cards = previous;
      throw new CardStoreError('The cards could not be saved in this browser');
    }
    return imported.map(cloneCard);
  }

  remove(id) {
    const position = this.cards.findIndex((card) => card.id === id);
    if (position < 0) {
      return false;
    }
    const previous = this.cards;
    this.cards = this.cards.filter((card) => card.id !== id);
    if (!this.persist()) {
      this.cards = previous;
      throw new CardStoreError('The card could not be removed from this browser');
    }
    return true;
  }

  persist() {
    try {
      this.storage?.setItem(CARD_STORAGE_KEY, JSON.stringify({
        version: 1,
        cards: this.cards,
      }));
      return true;
    } catch {
      return false;
    }
  }
}
