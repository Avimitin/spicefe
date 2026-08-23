export const CUSTOM_ICON_STORAGE_KEY = 'spicefe.custom-icons.v1';
export const CUSTOM_ICON_DATA_URL_LIMIT = 420_000;
export const CUSTOM_ICON_LIMIT = 24;

const CUSTOM_ICON_ID_PATTERN = /^custom-icon-[A-Za-z0-9_-]{8,96}$/;
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

export class CustomIconStoreError extends Error {
  constructor(message, code = 'storage') {
    super(message);
    this.name = 'CustomIconStoreError';
    this.code = code;
  }
}

const createId = () => {
  if (globalThis.crypto?.randomUUID) {
    return `custom-icon-${globalThis.crypto.randomUUID()}`;
  }
  return `custom-icon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

function sanitizeLabel(value) {
  return String(value ?? '').trim().slice(0, 64) || 'Custom icon';
}

export function sanitizeCustomIcon(input = {}) {
  const id = String(input.id ?? '').trim();
  const src = typeof input.src === 'string' ? input.src : '';
  if (!CUSTOM_ICON_ID_PATTERN.test(id)) {
    throw new CustomIconStoreError('The custom icon ID is invalid', 'id');
  }
  if (src.length > CUSTOM_ICON_DATA_URL_LIMIT || !IMAGE_DATA_URL_PATTERN.test(src)) {
    throw new CustomIconStoreError('The custom icon image is invalid', 'image');
  }
  return {
    id,
    label: sanitizeLabel(input.label),
    src,
    custom: true,
  };
}

const cloneIcon = (icon) => ({ ...icon });

export class CustomIconStore {
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
    this.icons = [];
    this.load();
  }

  load() {
    let saved;
    try {
      saved = JSON.parse(this.storage?.getItem(CUSTOM_ICON_STORAGE_KEY) || 'null');
    } catch {
      saved = null;
    }

    this.icons = [];
    if (saved?.version === 1 && Array.isArray(saved.icons)) {
      for (const candidate of saved.icons.slice(0, CUSTOM_ICON_LIMIT)) {
        try {
          this.icons.push(sanitizeCustomIcon(candidate));
        } catch {
          // One damaged image must not hide the rest of the local icon library.
        }
      }
    }
    return this.list();
  }

  list() {
    return this.icons.map(cloneIcon);
  }

  get(id) {
    const icon = this.icons.find((candidate) => candidate.id === id);
    return icon ? cloneIcon(icon) : null;
  }

  create(candidate = {}) {
    if (this.icons.length >= CUSTOM_ICON_LIMIT) {
      throw new CustomIconStoreError('The custom icon library is full', 'limit');
    }
    const icon = sanitizeCustomIcon({ ...candidate, id: createId() });
    const previous = this.icons;
    this.icons = [icon, ...this.icons];
    if (!this.persist()) {
      this.icons = previous;
      throw new CustomIconStoreError('The custom icon could not be saved in this browser');
    }
    return cloneIcon(icon);
  }

  remove(id) {
    const position = this.icons.findIndex((icon) => icon.id === id);
    if (position < 0) {
      return false;
    }
    const previous = this.icons;
    this.icons = this.icons.filter((icon) => icon.id !== id);
    if (!this.persist()) {
      this.icons = previous;
      throw new CustomIconStoreError('The custom icon could not be removed from this browser');
    }
    return true;
  }

  persist() {
    try {
      this.storage?.setItem(CUSTOM_ICON_STORAGE_KEY, JSON.stringify({
        version: 1,
        icons: this.icons,
      }));
      return true;
    } catch {
      return false;
    }
  }
}
