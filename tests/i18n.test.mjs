import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  createI18n,
  LOCALE_STORAGE_KEY,
  resolveLocale,
  TRANSLATIONS,
  translate,
} from '../public/lib/i18n.js';

class MemoryStorage {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

test('English and Simplified Chinese catalogs have the same complete key set', () => {
  assert.deepEqual(
    Object.keys(TRANSLATIONS['zh-CN']).sort(),
    Object.keys(TRANSLATIONS.en).sort(),
  );

  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const keyPattern = /data-i18n(?:-(?:aria-label|title|placeholder|alt))?="([^"]+)"/g;
  const referencedKeys = [...html.matchAll(keyPattern)].map((match) => match[1]);
  assert.ok(referencedKeys.length > 0);
  for (const key of referencedKeys) {
    assert.ok(Object.hasOwn(TRANSLATIONS.en, key), `missing English key ${key}`);
    assert.ok(Object.hasOwn(TRANSLATIONS['zh-CN'], key), `missing Chinese key ${key}`);
  }

  const source = readFileSync(new URL('../public/lib/i18n.js', import.meta.url), 'utf8');
  const sourceKeys = [...source.matchAll(/^\s+'([^']+)':/gm)]
    .map((match) => match[1])
    .filter((key) => key.includes('.'));
  const keyCounts = new Map();
  for (const key of sourceKeys) {
    keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
  }
  for (const [key, count] of keyCounts) {
    assert.equal(count, 2, `translation key ${key} must occur once per locale`);
  }
});

test('locale resolution uses a saved choice before browser preferences', () => {
  assert.equal(resolveLocale(null, ['zh-CN', 'en-US']), 'zh-CN');
  assert.equal(resolveLocale('en', ['zh-CN']), 'en');
  assert.equal(resolveLocale(null, ['fr-FR']), 'en');
});

test('the language choice persists and translations interpolate values', () => {
  const storage = new MemoryStorage();
  const i18n = createI18n({ storage, languages: ['zh-Hans-CN'] });
  assert.equal(i18n.locale, 'zh-CN');
  assert.equal(i18n.t('button.disconnect'), '断开');
  assert.equal(i18n.t('settings.screenNumber', { screen: 3 }), '画面 3');

  i18n.setLocale('en-US');
  assert.equal(i18n.locale, 'en');
  assert.equal(storage.getItem(LOCALE_STORAGE_KEY), 'en');
  assert.equal(
    translate('en', 'library.address', { host: 'pc.local', port: 1337 }),
    'pc.local:1337',
  );
});
