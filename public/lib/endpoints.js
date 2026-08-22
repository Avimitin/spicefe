import { encodeProfileTransfer, PROFILE_TRANSFER_KEY } from './profile-store.js';

export function hostAuthority(host) {
  const value = String(host);
  return value.includes(':') && !value.startsWith('[') ? `[${value}]` : value;
}

export function apiWebSocketUrl(profile) {
  return `ws://${hostAuthority(profile.host)}:${profile.apiPort + 1}`;
}

export function streamUrl(profile, format, cacheBuster = Date.now()) {
  const extension = format === 'mjpg' ? 'mjpg' : 'h264';
  const query = new URLSearchParams({
    fps: String(profile.fps),
    q: String(profile.quality),
    _: String(cacheBuster),
  });
  if (profile.screen !== '') {
    query.set('screen', profile.screen);
  }

  return `http://${hostAuthority(profile.host)}:${profile.apiPort + 2}/stream.${extension}?${query}`;
}

export function targetAddressSpaceForUrl(value) {
  const host = new URL(value).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host.endsWith('.localhost')
    || /^127\./.test(host) || host === '::1'
    ? 'loopback'
    : 'local';
}

export function isPrivateLanName(host) {
  const value = String(host).toLowerCase().replace(/^\[|\]$/g, '');
  if (value === 'localhost' || value.endsWith('.localhost') || value.endsWith('.local')) {
    return true;
  }
  if (/^127\./.test(value) || value === '::1') {
    return true;
  }
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (match) {
    const octets = match.slice(1).map(Number);
    return octets.every((octet) => octet >= 0 && octet <= 255)
      && (octets[0] === 10
        || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
        || (octets[0] === 192 && octets[1] === 168)
        || (octets[0] === 169 && octets[1] === 254));
  }
  return /^(fc|fd|fe8|fe9|fea|feb)/.test(value);
}

export function likelyNeedsHttpMode(userAgent = globalThis.navigator?.userAgent || '') {
  const ua = String(userAgent);
  const appleMobile = /iPad|iPhone|iPod/.test(ua)
    || (/Macintosh/.test(ua) && (globalThis.navigator?.maxTouchPoints || 0) > 1);
  const firefox = /Firefox|FxiOS/.test(ua);
  const safari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR/.test(ua);
  return appleMobile || firefox || safari;
}

export function compatibilityUrl(
  profiles,
  currentUrl = globalThis.location?.href,
  selectedId = Array.isArray(profiles) ? profiles[0]?.id : profiles?.id,
) {
  const url = new URL(currentUrl);
  url.protocol = 'http:';
  if (url.port === '443') {
    url.port = '';
  }
  url.searchParams.set('compat', '1');
  url.hash = `${PROFILE_TRANSFER_KEY}=${encodeProfileTransfer(profiles, selectedId)}`;
  return url.toString();
}

export function secureModeUrl(currentUrl = globalThis.location?.href) {
  const url = new URL(currentUrl);
  url.protocol = 'https:';
  if (url.port === '80') {
    url.port = '';
  }
  url.searchParams.delete('compat');
  url.hash = '';
  return url.toString();
}
