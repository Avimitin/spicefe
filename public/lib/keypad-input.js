const CONTROL_MATCHERS = Object.freeze({
  start: Object.freeze([
    /^Start$/iu,
    /^P[12] Start$/iu,
    /^Guitar P[12] Start$/iu,
    /^Drum Start$/iu,
    /(?:^| )P[12] Start$/iu,
    /(?:^| )Start$/iu,
  ]),
  help: Object.freeze([
    /^Help$/iu,
    /^P[12] Help$/iu,
    /^Guitar P[12] Help$/iu,
    /^Drum Help$/iu,
    /(?:^| )P[12] Help(?: \(DX\))?$/iu,
    /(?:^| )Help(?: \(DX\))?$/iu,
  ]),
  test: Object.freeze([/^Test$/iu]),
  service: Object.freeze([/^Service$/iu]),
});

function cleanButtonNames(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(values
    .map((value) => String(value ?? '').trim())
    .filter(Boolean))];
}

function firstMatch(names, matchers) {
  for (const matcher of matchers) {
    const match = names.find((name) => matcher.test(name));
    if (match) {
      return match;
    }
  }
  return null;
}

export function resolveKeypadButtons(values, keypad = 0) {
  const names = cleanButtonNames(values);
  const player = new RegExp(`(?:^| )P${keypad + 1}(?: |$)`, 'iu');
  const playerNames = names.filter((name) => player.test(name));
  // Unqualified controls belong to single-player cabinets. Never use another
  // player's controls (or a generic Start/Help) as a fallback for Player 2.
  const genericNames = keypad === 0
    ? names.filter((name) => !/(?:^| )P[12](?: |$)/iu.test(name))
    : [];
  return Object.fromEntries(Object.entries(CONTROL_MATCHERS)
    .map(([control, matchers]) => [control, control === 'test' || control === 'service'
      ? firstMatch(names, matchers)
      : firstMatch(playerNames, matchers) ?? firstMatch(genericNames, matchers)]));
}

export function resolvedKeypadButtonNames(...buttons) {
  return [...new Set(buttons.flatMap((mapping) => Object.values(mapping ?? {}))
    .filter((name) => typeof name === 'string'))];
}
