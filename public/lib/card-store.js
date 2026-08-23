export const CARD_STORAGE_KEY = 'spicefe.cards.v1';
export const CARD_NUMBER_PATTERN = /^[0-9A-F]{16}$/;
export const CARD_NUMBER_PREFIX = 'E0040100';
export const CARD_NAME_LIMIT = 256;
export const CARD_IMAGE_DATA_URL_LIMIT = 1_600_000;

const APPEARANCES = new Set([
  'gray-light',
  'gray-dark',
  'solid',
  'transparent-gradient',
  'image',
]);
const COLOR_PATTERN = /^#[0-9A-F]{6}$/;
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

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
    ...overrides,
  });
}

export function newCardDraft(overrides = {}) {
  return {
    id: createId(),
    number: '',
    name: '',
    appearance: 'gray-light',
    color: '#667085',
    image: null,
    ...overrides,
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
