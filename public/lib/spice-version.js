export const MINIMUM_SPICE2X_BUILD = '2026-09-01';
export const LATEST_SPICE2X_RELEASE_URL = 'https://github.com/spice2x/spice2x.github.io/releases/latest';

function validBuildDate(year, month, day) {
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function spice2xBuildDate(version) {
  const text = String(version ?? '').trim();
  const match = /(?:^|\D)(\d{2}|\d{4})-(\d{2})-(\d{2})(?=T|\D|$)/u.exec(text);
  if (!match) {
    return null;
  }
  const year = Number(match[1].length === 2 ? `20${match[1]}` : match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!validBuildDate(year, month, day)) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${match[2]}-${match[3]}`;
}

export function spice2xCompatibility(version) {
  const buildDate = spice2xBuildDate(version);
  return {
    version: String(version ?? '').trim(),
    buildDate,
    minimumBuild: MINIMUM_SPICE2X_BUILD,
    supported: buildDate !== null && buildDate >= MINIMUM_SPICE2X_BUILD,
  };
}
