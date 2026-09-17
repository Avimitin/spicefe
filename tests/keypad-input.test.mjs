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

test('resolves each player independently for two-player cabinets', () => {
  for (const prefix of ['', 'Guitar ', 'HD ']) {
    const names = [
      `${prefix}P2 Start`, `${prefix}P2 Help (DX)`,
      `${prefix}P1 Start`, `${prefix}P1 Help (DX)`,
      'Start', 'Help', 'Test', 'Service',
    ];
    for (const keypad of [0, 1]) {
      assert.deepEqual(resolveKeypadButtons(names, keypad), {
        start: `${prefix}P${keypad + 1} Start`,
        help: `${prefix}P${keypad + 1} Help (DX)`,
        test: 'Test',
        service: 'Service',
      });
    }
  }
});

test('never falls back to another player or single-player controls for Player 2', () => {
  const onlyP1 = ['P1 Start', 'P1 Help', 'Start', 'Help', 'Drum Start', 'Drum Help'];
  assert.deepEqual(resolveKeypadButtons(onlyP1, 1), {
    start: null, help: null, test: null, service: null,
  });
  assert.deepEqual(resolveKeypadButtons(['P2 Start', 'Guitar P2 Help'], 0), {
    start: null, help: null, test: null, service: null,
  });
  assert.deepEqual(resolveKeypadButtons(['Drum Start', 'Drum Help'], 0), {
    start: 'Drum Start', help: 'Drum Help', test: null, service: null,
  });
});

test('collects both players for release while deduplicating shared service controls', () => {
  const names = ['P1 Start', 'P2 Start', 'Test', 'Service'];
  assert.deepEqual(resolvedKeypadButtonNames(
    resolveKeypadButtons(names, 0),
    resolveKeypadButtons(names, 1),
  ), ['P1 Start', 'Test', 'Service', 'P2 Start']);
  assert.deepEqual(resolvedKeypadButtonNames(null), []);
});
