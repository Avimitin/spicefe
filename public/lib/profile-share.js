import {
  DEFAULT_GAME_ICON_ID,
  normalizeGameIconId,
} from './game-icons.js';
import { sanitizeProfile } from './profile-store.js';

export const PROFILE_SHARE_QUERY_PARAMETER = 'spicefe-profile';
export const PROFILE_SHARE_HOST_QUERY_PARAMETER = 'spicefe-host';
export const PROFILE_SHARE_PORT_QUERY_PARAMETER = 'spicefe-port';
export const PROFILE_SHARE_VERSION = 1;
export const PROFILE_SHARE_MAX_LENGTH = 8192;

const FORMATS = new Set(['auto', 'h264', 'mjpg']);
const SCREENS = new Set(['', '0', '1', '2', '3']);
const VIEW_MODES = new Set(['contain', 'cover', 'fill']);
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export class ProfileShareError extends Error {
  constructor(message, code = 'invalid') {
    super(message);
    this.name = 'ProfileShareError';
    this.code = code;
  }
}

function portableIconId(value) {
  const iconId = String(value ?? '');
  return iconId.startsWith('custom-icon-')
    ? DEFAULT_GAME_ICON_ID
    : normalizeGameIconId(iconId);
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

function base64UrlToBytes(value) {
  if (!value || value.length > PROFILE_SHARE_MAX_LENGTH || !BASE64URL_PATTERN.test(value)) {
    throw new ProfileShareError('Invalid shared profile encoding', 'encoding');
  }
  const remainder = value.length % 4;
  if (remainder === 1) {
    throw new ProfileShareError('Invalid shared profile encoding', 'encoding');
  }
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
    + '='.repeat((4 - remainder) % 4);
  let binary;
  try {
    binary = atob(normalized);
  } catch {
    throw new ProfileShareError('Invalid shared profile encoding', 'encoding');
  }
  if (binary.length > PROFILE_SHARE_MAX_LENGTH) {
    throw new ProfileShareError('Shared profile is too large', 'size');
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function expectString(value, limit, { empty = true } = {}) {
  return typeof value === 'string'
    && value.length <= limit
    && (empty || value.length > 0);
}

function expectInteger(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function decodePayload(encoded) {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(base64UrlToBytes(encoded));
  } catch (error) {
    if (error instanceof ProfileShareError) {
      throw error;
    }
    throw new ProfileShareError('Invalid shared profile text', 'encoding');
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ProfileShareError('Invalid shared profile data', 'invalid');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ProfileShareError('Invalid shared profile data', 'invalid');
  }
  if (payload.v !== PROFILE_SHARE_VERSION) {
    throw new ProfileShareError('Unsupported shared profile version', 'unsupported');
  }
  return payload;
}

function validatePayload(payload) {
  if (!expectString(payload.n, 48)
    || !expectString(payload.i, 128)
    || !expectString(payload.h, 255, { empty: false })
    || !expectInteger(payload.p, 1, 65533)
    || !expectString(payload.w, 1024)
    || !FORMATS.has(payload.f)
    || !SCREENS.has(payload.s)
    || !expectInteger(payload.r, 1, 60)
    || !expectInteger(payload.q, 1, 100)
    || !VIEW_MODES.has(payload.m)
    || (payload.t !== 0 && payload.t !== 1)
    || (payload.k !== undefined && payload.k !== 0 && payload.k !== 1)) {
    throw new ProfileShareError('Invalid shared profile fields', 'invalid');
  }
}

export function encodeSharedProfile(candidate) {
  let profile;
  try {
    profile = sanitizeProfile(candidate);
  } catch {
    throw new ProfileShareError('Invalid server profile', 'invalid');
  }
  if (!profile.host) {
    throw new ProfileShareError('A server address is required', 'host');
  }

  const payload = {
    v: PROFILE_SHARE_VERSION,
    n: profile.name,
    i: portableIconId(profile.iconId),
    h: profile.host,
    p: profile.apiPort,
    w: profile.password,
    f: profile.format,
    s: profile.screen,
    r: profile.fps,
    q: profile.quality,
    m: profile.viewMode,
    t: profile.tickerEnabled ? 1 : 0,
    k: profile.keypadEnabled ? 1 : 0,
  };
  const encoded = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  if (encoded.length > PROFILE_SHARE_MAX_LENGTH) {
    throw new ProfileShareError('Shared profile is too large', 'size');
  }
  return encoded;
}

export function decodeSharedProfile(encoded) {
  const payload = decodePayload(String(encoded ?? ''));
  validatePayload(payload);

  let profile;
  try {
    profile = sanitizeProfile({
      id: 'shared-profile',
      name: payload.n,
      iconId: portableIconId(payload.i),
      host: payload.h,
      apiPort: payload.p,
      password: payload.w,
      format: payload.f,
      screen: payload.s,
      fps: payload.r,
      quality: payload.q,
      viewMode: payload.m,
      tickerEnabled: payload.t === 1,
      keypadEnabled: payload.k === 1,
    });
  } catch {
    throw new ProfileShareError('Invalid shared profile address', 'invalid');
  }
  const { id: discardedId, ...portableProfile } = profile;
  void discardedId;
  return portableProfile;
}

export function sharedProfileUrl(profile, currentUrl) {
  const url = new URL(currentUrl);
  const encoded = encodeSharedProfile(profile);
  const portableProfile = decodeSharedProfile(encoded);
  url.search = '';
  url.hash = '';
  url.searchParams.set(PROFILE_SHARE_HOST_QUERY_PARAMETER, portableProfile.host);
  url.searchParams.set(
    PROFILE_SHARE_PORT_QUERY_PARAMETER,
    String(portableProfile.apiPort),
  );
  url.searchParams.set('page', 'library');
  url.searchParams.set(PROFILE_SHARE_QUERY_PARAMETER, encoded);
  return url.toString();
}

export function extractSharedProfile(currentUrl) {
  const url = new URL(currentUrl);
  const values = url.searchParams.getAll(PROFILE_SHARE_QUERY_PARAMETER);
  if (values.length === 0) {
    return {
      found: false,
      cleanPath: `${url.pathname}${url.search}${url.hash}`,
      profile: null,
      error: null,
    };
  }

  const hostHints = url.searchParams.getAll(PROFILE_SHARE_HOST_QUERY_PARAMETER);
  const portHints = url.searchParams.getAll(PROFILE_SHARE_PORT_QUERY_PARAMETER);
  url.searchParams.delete(PROFILE_SHARE_QUERY_PARAMETER);
  url.searchParams.delete(PROFILE_SHARE_HOST_QUERY_PARAMETER);
  url.searchParams.delete(PROFILE_SHARE_PORT_QUERY_PARAMETER);
  const result = {
    found: true,
    cleanPath: `${url.pathname}${url.search}${url.hash}`,
    profile: null,
    error: null,
  };
  try {
    if (values.length !== 1) {
      throw new ProfileShareError('More than one shared profile was provided', 'invalid');
    }
    result.profile = decodeSharedProfile(values[0]);
    const hasHints = hostHints.length > 0 || portHints.length > 0;
    if (hasHints && (hostHints.length !== 1
      || portHints.length !== 1
      || hostHints[0] !== result.profile.host
      || portHints[0] !== String(result.profile.apiPort))) {
      throw new ProfileShareError('Shared profile address does not match its link', 'invalid');
    }
  } catch (error) {
    result.profile = null;
    result.error = error instanceof ProfileShareError
      ? error
      : new ProfileShareError('Invalid shared profile', 'invalid');
  }
  return result;
}
