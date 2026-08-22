import { DEFAULT_GAME_ICON_ID, normalizeGameIconId } from './game-icons.js';

export const PROFILE_STORAGE_KEY = 'spicefe.connections.v1';
export const PROFILE_TRANSFER_KEY = 'spicefe-profile';

const FORMATS = new Set(['auto', 'h264', 'mjpg']);
const SCREENS = new Set(['', '0', '1', '2', '3']);
const VIEW_MODES = new Set(['contain', 'cover', 'fill']);

const clampInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, minimum), maximum)
    : fallback;
};

const createId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

export function cleanHost(value) {
  let host = String(value ?? '').trim();
  if (!host) {
    return '';
  }

  if (/^https?:\/\//i.test(host)) {
    const url = new URL(host);
    host = url.hostname;
  }

  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }

  if (/[/\\?#@\s]/.test(host)) {
    throw new Error('Enter a host name or IP address without a path');
  }

  // A single colon is most likely an accidentally included port. IPv6 contains several.
  if ((host.match(/:/g) || []).length === 1 && /:\d+$/.test(host)) {
    throw new Error('Put the API port in the separate port field');
  }

  return host;
}

export function newProfile(overrides = {}) {
  return sanitizeProfile({
    id: createId(),
    name: 'Gaming PC',
    iconId: DEFAULT_GAME_ICON_ID,
    host: '',
    apiPort: 1337,
    password: '',
    format: 'auto',
    screen: '',
    fps: 30,
    quality: 70,
    viewMode: 'contain',
    ...overrides,
  });
}

export function sanitizeProfile(input = {}) {
  const host = cleanHost(input.host);
  const name = String(input.name ?? '').trim().slice(0, 48) || host || 'Spice instance';
  const id = String(input.id ?? '').trim().slice(0, 96) || createId();
  const format = FORMATS.has(String(input.format)) ? String(input.format) : 'auto';
  const screen = SCREENS.has(String(input.screen ?? '')) ? String(input.screen ?? '') : '';
  const viewMode = VIEW_MODES.has(String(input.viewMode))
    ? String(input.viewMode)
    : 'contain';

  return {
    id,
    name,
    iconId: normalizeGameIconId(input.iconId),
    host,
    apiPort: clampInteger(input.apiPort, 1337, 1, 65533),
    password: String(input.password ?? '').slice(0, 1024),
    format,
    screen,
    fps: clampInteger(input.fps, 30, 1, 60),
    quality: clampInteger(input.quality, 70, 1, 100),
    viewMode,
  };
}

export class ProfileStore {
  constructor(storage, options = {}) {
    if (arguments.length > 0 && storage !== undefined) {
      this.storage = storage;
    } else {
      try {
        this.storage = globalThis.localStorage;
      } catch {
        this.storage = null;
      }
    }
    this.defaultProfileName = String(options.defaultProfileName ?? '').trim().slice(0, 48)
      || 'Gaming PC';
    this.profiles = [];
    this.selectedId = null;
    this.load();
  }

  load() {
    let saved;
    try {
      saved = JSON.parse(this.storage?.getItem(PROFILE_STORAGE_KEY) || 'null');
    } catch {
      saved = null;
    }

    if (saved?.version === 1 && Array.isArray(saved.profiles)) {
      for (const candidate of saved.profiles) {
        try {
          this.profiles.push(sanitizeProfile(candidate));
        } catch {
          // One malformed profile must not make every saved instance disappear.
        }
      }
      this.selectedId = String(saved.selectedId ?? '');
    }

    if (this.profiles.length === 0) {
      const initial = newProfile({ name: this.defaultProfileName });
      this.profiles = [initial];
      this.selectedId = initial.id;
      this.persist();
    } else if (!this.profiles.some((profile) => profile.id === this.selectedId)) {
      this.selectedId = this.profiles[0].id;
    }

    return this.list();
  }

  list() {
    return this.profiles.map((profile) => ({ ...profile }));
  }

  selected() {
    return this.get(this.selectedId) || this.list()[0];
  }

  get(id) {
    const profile = this.profiles.find((candidate) => candidate.id === id);
    return profile ? { ...profile } : null;
  }

  select(id) {
    if (!this.profiles.some((profile) => profile.id === id)) {
      return null;
    }
    this.selectedId = id;
    this.persist();
    return this.get(id);
  }

  upsert(candidate) {
    const profile = sanitizeProfile(candidate);
    const position = this.profiles.findIndex((saved) => saved.id === profile.id);
    if (position < 0) {
      this.profiles.push(profile);
    } else {
      this.profiles[position] = profile;
    }
    this.selectedId = profile.id;
    this.persist();
    return { ...profile };
  }

  create(overrides = {}) {
    const profile = newProfile({ name: this.defaultProfileName, ...overrides });
    this.profiles.push(profile);
    this.selectedId = profile.id;
    this.persist();
    return { ...profile };
  }

  remove(id) {
    const position = this.profiles.findIndex((profile) => profile.id === id);
    if (position < 0) {
      return this.selected();
    }

    this.profiles.splice(position, 1);
    if (this.profiles.length === 0) {
      this.profiles.push(newProfile({ name: this.defaultProfileName }));
    }

    if (this.selectedId === id) {
      const nextPosition = Math.min(position, this.profiles.length - 1);
      this.selectedId = this.profiles[nextPosition].id;
    }
    this.persist();
    return this.selected();
  }

  replaceAll(candidates, selectedId) {
    const unique = new Map();
    for (const candidate of Array.isArray(candidates) ? candidates : []) {
      try {
        const profile = sanitizeProfile(candidate);
        unique.set(profile.id, profile);
      } catch {
        // Ignore malformed entries while retaining the rest of the transfer.
      }
    }
    this.profiles = [...unique.values()];
    if (this.profiles.length === 0) {
      this.profiles = [newProfile({ name: this.defaultProfileName })];
    }
    const requested = String(selectedId ?? '');
    this.selectedId = this.profiles.some((profile) => profile.id === requested)
      ? requested
      : this.profiles[0].id;
    this.persist();
    return this.list();
  }

  persist() {
    try {
      this.storage?.setItem(PROFILE_STORAGE_KEY, JSON.stringify({
        version: 1,
        selectedId: this.selectedId,
        profiles: this.profiles,
      }));
      return true;
    } catch {
      return false;
    }
  }
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlToBytes(value) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encodeProfileTransfer(profiles, selectedId) {
  const candidates = Array.isArray(profiles) ? profiles : [profiles];
  const sanitized = candidates.slice(0, 64).map((profile) => sanitizeProfile(profile));
  const selected = sanitized.some((profile) => profile.id === selectedId)
    ? selectedId
    : sanitized[0]?.id;
  const payload = JSON.stringify({ version: 2, profiles: sanitized, selectedId: selected });
  return bytesToBase64Url(new TextEncoder().encode(payload));
}

export function decodeProfileTransfer(value) {
  try {
    const decoded = new TextDecoder().decode(base64UrlToBytes(value));
    const payload = JSON.parse(decoded);
    if (payload?.version === 1) {
      const profile = sanitizeProfile(payload.profile);
      return { profiles: [profile], selectedId: profile.id };
    }
    if (payload?.version !== 2 || !Array.isArray(payload.profiles)) {
      return null;
    }
    const profiles = payload.profiles.slice(0, 64).map((profile) => sanitizeProfile(profile));
    if (profiles.length === 0) {
      return null;
    }
    const selectedId = profiles.some((profile) => profile.id === payload.selectedId)
      ? payload.selectedId
      : profiles[0].id;
    return { profiles, selectedId };
  } catch {
    return null;
  }
}
