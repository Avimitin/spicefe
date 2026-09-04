const CONTROL_MATCHERS = Object.freeze({
  start: Object.freeze([
    /^Start$/iu,
    /^P1 Start$/iu,
    /^Guitar P1 Start$/iu,
    /^Drum Start$/iu,
    /(?:^| )P1 Start$/iu,
    /(?:^| )Start$/iu,
  ]),
  help: Object.freeze([
    /^Help$/iu,
    /^P1 Help$/iu,
    /^Guitar P1 Help$/iu,
    /^Drum Help$/iu,
    /(?:^| )P1 Help(?: \(DX\))?$/iu,
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

export function resolveKeypadButtons(values) {
  const names = cleanButtonNames(values);
  return Object.fromEntries(Object.entries(CONTROL_MATCHERS)
    .map(([control, matchers]) => [control, firstMatch(names, matchers)]));
}

export function resolvedKeypadButtonNames(buttons = {}) {
  return [...new Set(Object.values(buttons ?? {}).filter((name) => typeof name === 'string'))];
}
