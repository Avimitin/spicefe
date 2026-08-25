import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const VERSIONED_ASSETS = Object.freeze([
  Object.freeze({ url: './assets/styles.css', path: 'public/assets/styles.css' }),
  Object.freeze({ url: './vendor/jmuxer.min.js', path: 'public/vendor/jmuxer.min.js' }),
  Object.freeze({ url: './app.js', path: 'public/app.js' }),
]);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function contentVersion(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

export function stampAssetUrls(markup, versions) {
  let stamped = markup;
  for (const { url, version } of versions) {
    const expression = new RegExp(`${escapeRegExp(url)}(?:\\?v=[a-f0-9]+)?`, 'g');
    const matches = stamped.match(expression) || [];
    if (matches.length !== 1) {
      throw new Error(`Expected exactly one reference to ${url}, found ${matches.length}`);
    }
    stamped = stamped.replace(expression, `${url}?v=${version}`);
  }
  return stamped;
}

export function stampPublicAssets(root = projectRoot) {
  const versions = VERSIONED_ASSETS.map(({ url, path }) => ({
    url,
    version: contentVersion(readFileSync(resolve(root, path))),
  }));
  const indexPath = resolve(root, 'public/index.html');
  const current = readFileSync(indexPath, 'utf8');
  const stamped = stampAssetUrls(current, versions);
  if (stamped !== current) {
    writeFileSync(indexPath, stamped);
  }
  return versions;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const { url, version } of stampPublicAssets()) {
    process.stdout.write(`${url}?v=${version}\n`);
  }
}
