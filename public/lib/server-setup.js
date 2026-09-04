export const SERVER_SETUP_STYLES = Object.freeze(['video', 'ticker', 'keypad']);

const COMMON_STEPS = Object.freeze(['address', 'icon', 'style']);

export function normalizeServerSetupStyle(value) {
  return SERVER_SETUP_STYLES.includes(value) ? value : 'video';
}

export function serverSetupSequence(style) {
  const selectedStyle = normalizeServerSetupStyle(style);
  return selectedStyle === 'video'
    ? [...COMMON_STEPS, 'stream', 'name']
    : [...COMMON_STEPS, 'name'];
}

export function nextServerSetupStep(step, style) {
  const sequence = serverSetupSequence(style);
  const position = sequence.indexOf(step);
  return position >= 0 && position < sequence.length - 1
    ? sequence[position + 1]
    : null;
}

export function previousServerSetupStep(step, style) {
  const sequence = serverSetupSequence(style);
  const position = sequence.indexOf(step);
  return position > 0 ? sequence[position - 1] : null;
}

export function serverSetupModeFields(style) {
  const selectedStyle = normalizeServerSetupStyle(style);
  return {
    tickerEnabled: selectedStyle === 'ticker',
    keypadEnabled: selectedStyle === 'keypad',
  };
}
