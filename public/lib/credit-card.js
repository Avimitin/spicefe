const EA_LOGO_SOURCE = './vendor/e-amusement/ea_logo.png';
const KONMAI_LOGO_SOURCE = './vendor/frankerfacez/konmai.png';

function solidColorTone(color) {
  const match = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(color || '');
  if (!match) {
    return 'light';
  }
  const [red, green, blue] = match.slice(1).map((channel) => Number.parseInt(channel, 16));
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? 'dark' : 'light';
}

export function formatCardNumber(value) {
  const compact = String(value ?? '').replace(/\s/g, '').toUpperCase();
  return compact.match(/.{1,4}/g)?.join(' ') || '';
}

export function syncCreditCardName(viewport) {
  const text = viewport?.querySelector('.ea-card-name-text');
  if (!text) {
    return;
  }
  const shift = Math.max(0, Math.ceil(text.scrollWidth - viewport.clientWidth));
  viewport.dataset.overflow = String(shift > 1);
  if (shift > 1) {
    viewport.style.setProperty('--ea-card-name-shift', `${-shift}px`);
    viewport.style.setProperty('--ea-card-name-duration', `${Math.min(14, 5 + shift / 22)}s`);
  } else {
    viewport.style.removeProperty('--ea-card-name-shift');
    viewport.style.removeProperty('--ea-card-name-duration');
  }
}

export function measureCreditCardNames(root = globalThis.document) {
  for (const viewport of root?.querySelectorAll?.('.ea-card-name') || []) {
    syncCreditCardName(viewport);
  }
}

function scheduleNameMeasurement(viewport) {
  const schedule = globalThis.requestAnimationFrame || ((callback) => setTimeout(callback, 0));
  schedule(() => syncCreditCardName(viewport));
}

export function createCreditCard(card, options = {}) {
  const interactive = typeof options.onactivate === 'function';
  const root = document.createElement(interactive ? 'button' : 'div');
  const name = document.createElement('span');
  const nameText = document.createElement('span');
  const brand = document.createElement('span');
  const footer = document.createElement('span');
  const number = document.createElement('span');
  const logoWrap = document.createElement('span');
  const logo = document.createElement('img');
  const brandLogo = document.createElement('img');

  root.className = `ea-card${interactive ? ' ea-card-button' : ''}`;
  root.dataset.appearance = card.appearance;
  if (card.appearance === 'solid') {
    root.style.setProperty('--ea-card-color', card.color);
    root.dataset.tone = solidColorTone(card.color);
  } else if (card.appearance === 'image' && card.image) {
    root.style.backgroundImage = `url("${card.image}")`;
    root.dataset.tone = 'light';
  } else if (card.appearance === 'transparent-gradient' || card.appearance === 'gray-dark') {
    root.dataset.tone = 'light';
  } else {
    root.dataset.tone = 'dark';
  }

  if (interactive) {
    root.type = 'button';
    root.addEventListener('click', () => options.onactivate(card));
    root.setAttribute('aria-label', options.label || `${card.name || options.unnamed || 'Unnamed card'}, ${formatCardNumber(card.number)}`);
  }

  brand.className = 'ea-card-brand';
  brandLogo.src = EA_LOGO_SOURCE;
  brandLogo.alt = '';
  brandLogo.decoding = 'async';
  brand.append(brandLogo);

  name.className = 'ea-card-name';
  name.title = card.name || options.unnamed || 'Unnamed card';
  nameText.className = 'ea-card-name-text';
  nameText.textContent = card.name || options.unnamed || 'Unnamed card';
  name.append(nameText);

  footer.className = 'ea-card-footer';
  number.className = 'ea-card-number';
  number.textContent = formatCardNumber(card.number);

  logoWrap.className = 'ea-card-logo';
  logo.src = KONMAI_LOGO_SOURCE;
  logo.alt = '';
  logo.decoding = 'async';
  logoWrap.append(logo);
  footer.append(number, logoWrap);
  root.append(brand, name, footer);
  scheduleNameMeasurement(name);
  return root;
}
