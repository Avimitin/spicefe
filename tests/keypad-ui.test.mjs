import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync(new URL('../src/keypad.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app.tsx', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

test('separates the numeric keypad from guarded system controls', () => {
  assert.match(component, /\{ code: 'A', label: '00' \}/);
  assert.match(component, /KEYPAD_CONTROLS[\s\S]*?\['start', 'help'\]/);
  assert.match(component, /SERVICE_CONTROLS[\s\S]*?\['test', 'service'\]/);
  assert.match(component, /export function ServiceKeypad/);
  assert.doesNotMatch(markup, /id="keypad-view"/);
  assert.match(markup, /id="keypad-menu-button"[\s\S]*?id="keypad-menu"[^>]*hidden/);
  assert.match(markup, /id="service-menu-button"[\s\S]*?id="service-menu"[^>]*hidden/);
  assert.match(markup, /id="keypad-toggle-root"/);
  assert.match(app, /label=\{t\('settings\.keypadEnabled'\)\}/);
  assert.match(app, /keypadControls\.hidden = !apiOnlyStreaming/);
  assert.match(app, /serviceControls\.hidden = !streaming/);
  assert.match(app, /setKeypadMenuOpen\(false\)[\s\S]*?setServiceMenuOpen\(false\)/);
});

test('uses popup keypads with physical press travel and reduced-motion support', () => {
  assert.match(app, /profileUsesApiOnlyDisplay/);
  assert.match(styles, /\.card-menu\.control-popup/);
  assert.match(styles, /\.service-keypad-deck/);
  assert.match(styles, /data-key="A"/);
  assert.match(styles, /\.arcade-keypad-key\[data-pressed="true"\]/);
  assert.match(styles, /transform:\s*translateY\(clamp\(/);
  assert.match(styles, /box-shadow:[\s\S]*?var\(--key-edge\)/);
  assert.match(styles, /prefers-reduced-motion:[\s\S]*?\.arcade-keypad-key/);
});

test('offers a launcher-version warning with the official latest-release link', () => {
  assert.match(markup, /id="version-warning-dialog"/);
  assert.match(markup, /github\.com\/spice2x\/spice2x\.github\.io\/releases\/latest/);
  assert.match(app, /snapshot\.versionCompatibility/);
});
