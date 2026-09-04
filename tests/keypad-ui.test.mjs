import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync(new URL('../src/keypad.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app.tsx', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

test('renders only the requested keypad and cabinet input buttons', () => {
  assert.match(component, /\['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'\]/);
  assert.match(component, /\['start', 'help', 'test', 'service'\]/);
  assert.match(markup, /id="keypad-view"[^>]*hidden/);
  assert.match(markup, /id="keypad-toggle-root"/);
  assert.match(app, /label=\{t\('settings\.keypadEnabled'\)\}/);
});

test('uses an API-only keypad mode with physical press travel and reduced-motion support', () => {
  assert.match(app, /profileUsesApiOnlyDisplay/);
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
