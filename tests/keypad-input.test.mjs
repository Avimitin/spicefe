import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveKeypadButtons,
  resolvedKeypadButtonNames,
} from '../public/lib/keypad-input.js';

test('resolves generic cabinet controls from the running game button list', () => {
  const buttons = resolveKeypadButtons(['Service', 'Test', 'Start', 'Help']);
  assert.deepEqual(buttons, {
    start: 'Start',
    help: 'Help',
    test: 'Test',
    service: 'Service',
  });
});

test('prefers Player 1 GITADORA controls and leaves unavailable controls disabled', () => {
  const buttons = resolveKeypadButtons([
    'Service',
    'Test',
    'Guitar P2 Start',
    'Guitar P2 Help',
    'Guitar P1 Start',
    'Guitar P1 Help',
    'Drum Start',
    'Drum Help',
  ]);
  assert.deepEqual(buttons, {
    start: 'Guitar P1 Start',
    help: 'Guitar P1 Help',
    test: 'Test',
    service: 'Service',
  });
  assert.deepEqual(resolvedKeypadButtonNames(buttons), [
    'Guitar P1 Start',
    'Guitar P1 Help',
    'Test',
    'Service',
  ]);

  assert.equal(resolveKeypadButtons(['P1 Start']).help, null);
});
