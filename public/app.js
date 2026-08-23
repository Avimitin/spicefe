import { likelyNeedsBrowserSetup, plainHttpPageUrl } from './lib/endpoints.js';
import { cardImageDataUrl } from './lib/card-image.js';
import {
  CardStore,
  generateCardNumber,
  newCardDraft,
  normalizeCardNumberInput,
} from './lib/card-store.js';
import { createCreditCard, measureCreditCardNames } from './lib/credit-card.js';
import { CustomIconStore } from './lib/custom-icon-store.js';
import {
  customIconLabel,
  gameIconDataUrl,
} from './lib/game-icon-image.js';
import {
  DEFAULT_GAME_ICON_ID,
  GAME_ICON_GROUPS,
  gameIconById,
  setCustomGameIcons,
} from './lib/game-icons.js';
import { connectionPresentation } from './lib/connection-status.js';
import { createI18n, localizeError } from './lib/i18n.js';
import {
  iidxTickerDisplayGlyphs,
  iidxTickerPreviewFrame,
  IIDX_TICKER_LENGTH,
  IIDX_TICKER_PREVIEW_STEP_MS,
} from './lib/iidx-ticker.js';
import { configuredProfiles, mainView } from './lib/main-view.js';
import {
  newProfile,
  ProfileStore,
  sanitizeProfile,
} from './lib/profile-store.js';
import {
  deriveReachability,
  probeSpiceApi,
  probeSpiceTicker,
  probeSpiceVideo,
  REACHABILITY_INTERVAL_MS,
} from './lib/reachability.js';
import { SpiceSession } from './lib/spice-session.js';
import { TouchController } from './lib/touch-controller.js';

const element = (id) => document.getElementById(id);
const i18n = createI18n();
const t = (key, parameters) => i18n.t(key, parameters);
const customIconStore = new CustomIconStore();
setCustomGameIcons(customIconStore.list());
const store = new ProfileStore(undefined, {
  defaultProfileName: t('settings.profilePlaceholder'),
});
const cardStore = new CardStore();

const app = element('app');
const stage = element('stage');
const canvas = element('h264-view');
const video = element('mse-view');
const image = element('mjpeg-view');
const tickerView = element('ticker-view');
const tickerText = element('ticker-text');
const tickerPreviewDialog = element('ticker-preview-dialog');
const tickerPreviewInput = element('ticker-preview-input');
const tickerPreviewText = element('ticker-preview-text');
const settingsDialog = element('settings-dialog');
const iconDialog = element('icon-dialog');
const deleteDialog = element('delete-dialog');
const form = element('profile-form');
const streamSettings = element('stream-settings');
const iconGroups = element('game-icon-groups');
const customIconInput = element('custom-icon-upload');
const customIconStatus = element('custom-icon-status');
const pageNavigation = element('page-navigation');
const pageMenuButton = element('page-menu-button');
const pageMenu = element('page-menu');
const welcomePageLink = element('welcome-page-link');
const libraryPageLink = element('library-page-link');
const cardPageLink = element('card-page-link');
const browserSetupPageLink = element('browser-setup-page-link');
const usageGuidePageLink = element('usage-guide-page-link');
const brandIcon = element('brand-icon');
const settingsButton = element('settings-button');
const connectButton = element('connect-button');
const connectButtonLabel = element('connect-button-label');
const emptyState = element('empty-state');
const serverLibrary = element('server-library');
const browserSetup = element('browser-setup');
const usageGuidePage = element('usage-guide-page');
const selfHostGuide = element('self-host-guide');
const cardLibrary = element('card-library');
const serverList = element('server-list');
const cardList = element('card-list');
const cardEmpty = element('card-empty');
const cardForm = element('card-form');
const cardPreview = element('card-preview');
const cardControls = element('card-controls');
const cardMenuButton = element('card-menu-button');
const cardMenu = element('card-menu');
const cardMenuList = element('card-menu-list');
const cardMenuEmpty = element('card-menu-empty');
const cardMenuApiNote = element('card-menu-api-note');
const deleteCardDialog = element('delete-card-dialog');
const streamMessage = element('stream-message');
const stageHud = element('stage-hud');
const hudShowButton = element('hud-show-button');
const hudCloseButton = element('hud-close-button');

// Keep the long deployment guide next to the browser guide in source while
// presenting connection setup and self-hosting as one continuous usage page.
element('self-host-guide-slot').replaceWith(selfHostGuide);
selfHostGuide.hidden = false;
const activeServer = element('active-server');
const connectionStatuses = element('connection-statuses');
const apiStatus = element('api-status');
const videoStatus = element('video-status');
const displayStatusChannel = element('display-status-channel');
const apiWarning = element('api-warning');
const touchMarker = element('touch-marker');
const compatBanner = element('compat-banner');
const toast = element('toast');
const languageSelect = element('language-select');
const languagePicker = element('language-picker');

let toastTimer = null;
let currentMetric = null;
let lastMetricPaint = 0;
let bannerDismissed = false;
let hudDismissed = false;
let renderedMainView = null;
const reachability = new Map();
const reachabilityInFlight = new Map();
let serverNameMeasureFrame = null;
let editingCardId = null;
let cardDraft = null;
let selectedCardReader = 0;
let cardInsertPending = false;
let tickerPreviewOffset = 0;
let tickerPreviewTimer = null;
let editingProfile = null;
let editingProfileIsNew = false;

function syncServerNameOverflow(name) {
  const text = name.querySelector('.server-name-text');
  if (!text) {
    return;
  }
  const shift = Math.max(0, Math.ceil(text.scrollWidth - name.clientWidth));
  name.dataset.overflow = String(shift > 1);
  if (shift > 1) {
    name.style.setProperty('--server-name-shift', `${-shift}px`);
    name.style.setProperty('--server-name-duration', `${Math.min(12, 5 + shift / 24)}s`);
  } else {
    name.style.removeProperty('--server-name-shift');
    name.style.removeProperty('--server-name-duration');
  }
}

const serverNameResizeObserver = typeof ResizeObserver === 'function'
  ? new ResizeObserver((entries) => {
    for (const entry of entries) {
      syncServerNameOverflow(entry.target);
    }
  })
  : null;

function measureServerNames() {
  serverNameMeasureFrame = null;
  for (const name of serverList.querySelectorAll('.server-name')) {
    syncServerNameOverflow(name);
  }
}

function observeServerNames() {
  serverNameResizeObserver?.disconnect();
  for (const name of serverList.querySelectorAll('.server-name')) {
    serverNameResizeObserver?.observe(name);
  }
  if (serverNameMeasureFrame !== null) {
    cancelAnimationFrame(serverNameMeasureFrame);
  }
  serverNameMeasureFrame = requestAnimationFrame(measureServerNames);
}

function translationParameters(node) {
  const screen = node.getAttribute('data-i18n-screen');
  return screen === null ? {} : { screen };
}

function applyDocumentTranslations() {
  document.documentElement.lang = i18n.locale;
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n, translationParameters(node));
  }
  for (const attribute of ['aria-label', 'title', 'placeholder', 'alt']) {
    for (const node of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
      node.setAttribute(attribute, t(node.getAttribute(`data-i18n-${attribute}`)));
    }
  }
  languageSelect.value = i18n.locale;
}

function showToast(message, timeout = 4500) {
  toast.textContent = message;
  toast.dataset.theme = renderedMainView === 'stream' ? 'stream' : 'default';
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, timeout);
}

// Older releases put complete connection profiles in this fragment while
// changing schemes. Never import it; only remove it from legacy bookmarks.
if (new URLSearchParams(location.hash.slice(1)).has('spicefe-profile')) {
  history.replaceState(null, '', `${location.pathname}${location.search}`);
}

function requestedBrowsePage() {
  const requested = new URLSearchParams(location.search).get('page');
  if (requested === 'welcome') {
    return 'welcome';
  }
  if (requested === 'library') {
    return 'servers';
  }
  if (requested === 'cards') {
    return 'cards';
  }
  if (requested === 'browser-setup') {
    return 'browser-setup';
  }
  if (requested === 'guide') {
    return 'guide';
  }
  if (requested === 'self-host') {
    return 'guide';
  }
  return undefined;
}

let browsePage = requestedBrowsePage();

function setProfileIcon(imageElement, iconId) {
  const icon = gameIconById(iconId);
  imageElement.src = icon.src;
  imageElement.title = icon.label;
}

function setFormGameIcon(iconId) {
  const icon = gameIconById(iconId);
  element('game-icon-id').value = icon.id;
  setProfileIcon(element('game-icon-preview'), icon.id);
  element('game-icon-label').textContent = icon.label;
}

function createIconOption(icon, selectedId) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'game-icon-option';
  button.dataset.iconId = icon.id;
  button.setAttribute('role', 'option');
  button.setAttribute('aria-selected', String(icon.id === selectedId));
  button.title = icon.label;

  const preview = document.createElement('img');
  preview.src = icon.src;
  preview.alt = '';
  preview.loading = 'lazy';
  preview.decoding = 'async';

  const label = document.createElement('span');
  label.textContent = icon.label;
  button.append(preview, label);
  button.addEventListener('click', () => {
    setFormGameIcon(icon.id);
    iconDialog.close();
  });

  if (!icon.custom) {
    return button;
  }

  const item = document.createElement('div');
  const remove = document.createElement('button');
  item.className = 'custom-game-icon-option';
  remove.type = 'button';
  remove.className = 'custom-game-icon-remove';
  remove.setAttribute('aria-label', t('icon.removeLabel', { name: icon.label }));
  remove.title = t('icon.remove');
  remove.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  remove.addEventListener('click', () => removeCustomGameIcon(icon));
  item.append(button, remove);
  return item;
}

function renderIconGroups() {
  const selectedId = element('game-icon-id').value;
  const customIcons = customIconStore.list();
  const groups = customIcons.length > 0
    ? [{ id: 'custom', icons: customIcons }, ...GAME_ICON_GROUPS]
    : GAME_ICON_GROUPS;
  const sections = groups.map((group) => {
    const section = document.createElement('section');
    const heading = document.createElement('h3');
    const grid = document.createElement('div');
    const headingId = `game-icon-group-${group.id}`;

    section.className = 'icon-category';
    section.setAttribute('role', 'group');
    section.setAttribute('aria-labelledby', headingId);
    heading.id = headingId;
    heading.textContent = t(`icon.group.${group.id}`);
    grid.className = 'icon-category-grid';
    grid.append(...group.icons.map((icon) => createIconOption(icon, selectedId)));
    section.append(heading, grid);
    return section;
  });
  iconGroups.replaceChildren(...sections);
}

function refreshCustomGameIcons() {
  setCustomGameIcons(customIconStore.list());
}

function removeCustomGameIcon(icon) {
  try {
    customIconStore.remove(icon.id);
    refreshCustomGameIcons();
    if (element('game-icon-id').value === icon.id) {
      setFormGameIcon(DEFAULT_GAME_ICON_ID);
    }
    renderIconGroups();
    renderProfileLists();
    showToast(t('toast.iconRemoved'));
  } catch {
    const message = t('icon.removeFailed');
    customIconStatus.textContent = message;
    showToast(message, 7000);
  }
}

function cardDisplayName(card) {
  return card.name || t('cards.unnamed');
}

function selectedCardAppearance() {
  return cardForm.querySelector('input[name="card-appearance"]:checked')?.value
    || 'gray-light';
}

function cardFromEditor() {
  return {
    ...cardDraft,
    name: element('card-name').value,
    number: normalizeCardNumberInput(element('card-number').value),
    appearance: selectedCardAppearance(),
    color: element('card-color').value.toUpperCase(),
  };
}

function renderCardAppearanceControls() {
  const appearance = selectedCardAppearance();
  element('card-solid-controls').hidden = appearance !== 'solid';
  element('card-image-controls').hidden = appearance !== 'image';
  element('remove-card-image').disabled = !cardDraft?.image;
  element('solid-color-swatch').style.background = element('card-color').value;
  element('card-color-value').textContent = element('card-color').value.toUpperCase();
}

function renderCardPreview() {
  if (!cardDraft) {
    return;
  }
  const candidate = cardFromEditor();
  const preview = createCreditCard(candidate, { unnamed: t('cards.unnamed') });
  preview.classList.add('ea-card-preview');
  cardPreview.replaceChildren(preview);
  renderCardAppearanceControls();
}

function fillCardEditor(card, existing = false) {
  cardDraft = { ...card };
  editingCardId = existing ? card.id : null;
  element('card-name').value = card.name;
  element('card-number').value = card.number;
  element('card-number').readOnly = existing;
  element('card-color').value = card.color.toLowerCase();
  const appearance = cardForm.querySelector(
    `input[name="card-appearance"][value="${card.appearance}"]`,
  ) || cardForm.querySelector('input[name="card-appearance"][value="gray-light"]');
  appearance.checked = true;
  element('card-editor-title').textContent = t(existing ? 'cards.editTitle' : 'cards.newTitle');
  element('generate-card-number').textContent = t(existing ? 'cards.copyId' : 'cards.generate');
  element('delete-card').hidden = !existing;
  element('card-save-status').textContent = '';
  element('card-image').value = '';
  renderCardPreview();
}

function focusCardEditor() {
  element('card-name').focus({ preventScroll: true });
  if (matchMedia('(max-width: 820px)').matches) {
    element('card-editor-title').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

function startNewCard(focus = true) {
  fillCardEditor(newCardDraft(), false);
  if (focus) {
    requestAnimationFrame(focusCardEditor);
  }
}

function editCard(id, focus = true) {
  const card = cardStore.get(id);
  if (!card) {
    return;
  }
  fillCardEditor(card, true);
  renderCardCollection();
  if (focus) {
    requestAnimationFrame(focusCardEditor);
  }
}

function createManagedCard(card) {
  const item = document.createElement('article');
  const preview = createCreditCard(card, {
    unnamed: t('cards.unnamed'),
    label: t('cards.editLabel', { name: cardDisplayName(card) }),
    onactivate: () => editCard(card.id),
  });
  item.className = 'managed-card';
  item.dataset.selected = String(card.id === editingCardId);
  item.setAttribute('role', 'listitem');
  preview.classList.add('ea-card-library-preview');
  item.append(preview);
  return item;
}

function renderCardCollection() {
  const cards = cardStore.list();
  cardList.replaceChildren(...cards.map(createManagedCard));
  cardList.hidden = cards.length === 0;
  cardEmpty.hidden = cards.length !== 0;
  element('card-count').textContent = t('cards.count', { count: cards.length });
  requestAnimationFrame(() => measureCreditCardNames(cardLibrary));
}

function ensureCardEditor() {
  if (cardDraft) {
    return;
  }
  const first = cardStore.list()[0];
  if (first) {
    fillCardEditor(first, true);
  } else {
    startNewCard(false);
  }
}

function renderCardManager() {
  ensureCardEditor();
  renderCardCollection();
  renderCardPreview();
}

function setCardMenuOpen(open) {
  const expanded = Boolean(open) && renderedMainView === 'stream';
  cardMenu.hidden = !expanded;
  cardMenuButton.setAttribute('aria-expanded', String(expanded));
  if (expanded) {
    renderStreamCardMenu();
  }
}

function createStreamCard(card, apiReady) {
  const item = document.createElement('div');
  const preview = createCreditCard(card, {
    unnamed: t('cards.unnamed'),
    label: t('cardMenu.insertLabel', {
      name: cardDisplayName(card),
      player: selectedCardReader + 1,
    }),
    onactivate: () => insertStreamCard(card),
  });
  item.className = 'card-menu-item';
  item.setAttribute('role', 'listitem');
  preview.classList.add('ea-card-compact');
  preview.disabled = !apiReady || cardInsertPending;
  item.append(preview);
  return item;
}

function renderStreamCardMenu() {
  const cards = cardStore.list();
  const apiReady = session.snapshot.apiState === 'live' && Boolean(session.api?.connected);
  cardMenuApiNote.hidden = apiReady || cards.length === 0;
  cardMenuList.replaceChildren(...cards.map((card) => createStreamCard(card, apiReady)));
  cardMenuList.hidden = cards.length === 0;
  cardMenuEmpty.hidden = cards.length !== 0;
  cardMenuList.setAttribute('aria-busy', String(cardInsertPending));
  for (const button of cardMenu.querySelectorAll('.card-reader-option')) {
    button.setAttribute('aria-checked', String(Number(button.dataset.reader) === selectedCardReader));
  }
  requestAnimationFrame(() => measureCreditCardNames(cardMenu));
}

async function insertStreamCard(card) {
  const api = session.api;
  if (cardInsertPending || session.snapshot.apiState !== 'live' || !api?.connected) {
    showToast(t('toast.cardApiUnavailable'));
    return;
  }

  cardInsertPending = true;
  setCardMenuOpen(false);
  try {
    await api.insertCard(selectedCardReader, card.number);
    showToast(t('toast.cardInserted', {
      name: cardDisplayName(card),
      player: selectedCardReader + 1,
    }));
  } catch (error) {
    showToast(t('toast.cardInsertFailed', {
      error: localizeError(i18n.locale, error, 'status.apiDefaultError'),
    }), 7000);
  } finally {
    cardInsertPending = false;
  }
}

function renderProfileLists() {
  renderSnapshot(session.snapshot, false);
}

function fillForm(profile) {
  element('profile-name').value = profile.name;
  setFormGameIcon(profile.iconId);
  element('host').value = profile.host;
  element('api-port').value = String(profile.apiPort);
  element('password').value = profile.password;
  element('format').value = profile.format;
  element('screen').value = profile.screen;
  element('fps').value = String(profile.fps);
  element('quality').value = String(profile.quality);
  element('view-mode').value = profile.viewMode;
  element('ticker-enabled').checked = profile.tickerEnabled;
  syncTickerModeControls();
  element('view-mode-button').textContent = t(`display.${profile.viewMode}`);
  stage.dataset.viewMode = profile.viewMode;
  touch.setViewMode(profile.viewMode);
}

function profileFromForm() {
  const selected = editingProfile || store.selected();
  return sanitizeProfile({
    id: selected.id,
    name: element('profile-name').value,
    iconId: element('game-icon-id').value,
    host: element('host').value,
    apiPort: element('api-port').value,
    password: element('password').value,
    format: element('format').value,
    screen: element('screen').value,
    fps: element('fps').value,
    quality: element('quality').value,
    viewMode: element('view-mode').value,
    tickerEnabled: element('ticker-enabled').checked,
  });
}

function syncTickerModeControls() {
  const enabled = element('ticker-enabled').checked;
  streamSettings.hidden = enabled;
  if (enabled) {
    streamSettings.open = false;
  }
}

function syncProfileEditorMode() {
  element('delete-profile').hidden = editingProfileIsNew;
}

function renderTickerPreviewText() {
  const text = iidxTickerPreviewFrame(tickerPreviewInput.value, tickerPreviewOffset);
  const readable = text.trim();
  tickerPreviewText.textContent = iidxTickerDisplayGlyphs(text);
  element('ticker-preview-display').setAttribute('aria-label', readable
    ? t('ticker.previewAriaText', { text: readable })
    : t('ticker.previewAriaBlank'));
}

function stopTickerPreviewMarquee() {
  clearInterval(tickerPreviewTimer);
  tickerPreviewTimer = null;
}

function startTickerPreviewMarquee() {
  stopTickerPreviewMarquee();
  tickerPreviewOffset = 0;
  renderTickerPreviewText();
  if (Array.from(tickerPreviewInput.value).length <= IIDX_TICKER_LENGTH) {
    return;
  }
  tickerPreviewTimer = setInterval(() => {
    tickerPreviewOffset += 1;
    renderTickerPreviewText();
  }, IIDX_TICKER_PREVIEW_STEP_MS);
}

function setTickerPreviewClean(clean) {
  tickerPreviewDialog.dataset.clean = String(clean);
}

function openTickerPreview() {
  setTickerPreviewClean(false);
  settingsDialog.close();
  tickerPreviewDialog.showModal();
  startTickerPreviewMarquee();
  requestAnimationFrame(() => tickerPreviewInput.select());
}

function closeTickerPreview() {
  if (tickerPreviewDialog.open) {
    tickerPreviewDialog.close();
  }
}

function saveForm() {
  if (!form.reportValidity()) {
    return null;
  }
  let profile;
  try {
    profile = profileFromForm();
    if (!profile.host) {
      element('host').setCustomValidity(t('validation.hostRequired'));
      element('host').reportValidity();
      element('host').setCustomValidity('');
      return null;
    }
  } catch (error) {
    element('host').setCustomValidity(localizeError(i18n.locale, error));
    element('host').reportValidity();
    element('host').setCustomValidity('');
    return null;
  }

  const stored = store.upsert(profile);
  editingProfile = stored;
  editingProfileIsNew = false;
  syncProfileEditorMode();
  renderProfileLists();
  fillForm(stored);
  element('save-status').textContent = t('settings.saved');
  return stored;
}

function selectProfile(id) {
  const profile = store.select(id);
  if (!profile) {
    return;
  }
  fillForm(profile);
  renderSnapshot(session.snapshot, false);
  renderCompatibility();
}

const session = new SpiceSession(canvas, video, image);
const touch = new TouchController(stage, {
  activeView: () => {
    if (!canvas.hidden) return canvas;
    if (!video.hidden) return video;
    return image.hidden ? null : image;
  },
  viewSize: () => {
    if (!canvas.hidden) return { width: canvas.width, height: canvas.height };
    if (!video.hidden) return { width: video.videoWidth, height: video.videoHeight };
    return { width: image.naturalWidth, height: image.naturalHeight };
  },
  onmarker: ({ visible, clientX, clientY }) => {
    touchMarker.hidden = !visible;
    if (visible) {
      touchMarker.style.left = `${clientX}px`;
      touchMarker.style.top = `${clientY}px`;
    }
  },
});

session.onapi = (api) => touch.setApi(api);
session.onnotice = (key, parameters) => showToast(t(key, parameters));
session.onticker = (text) => {
  tickerText.textContent = iidxTickerDisplayGlyphs(text);
  const readable = text.trim();
  tickerView.setAttribute('aria-label', readable
    ? t('ticker.ariaText', { text: readable })
    : t('ticker.ariaBlank'));
};
session.onframe = (metric) => {
  currentMetric = metric;
  const now = performance.now();
  if (metric.decodedFrames > 1 && now - lastMetricPaint < 500) {
    return;
  }
  lastMetricPaint = now;
  const fps = metric.fps > 0 ? ` · ${metric.fps.toFixed(0)} fps` : '';
  element('video-metric').textContent = `${metric.width}×${metric.height}${fps}`;
};

function renderChannelStatus(node, label, presentation) {
  node.dataset.state = presentation.state;
  node.title = presentation.detail;
  node.setAttribute('aria-label', presentation.detail);
  label.textContent = presentation.label;
}

function createChannelStatus(channel, presentation) {
  const node = document.createElement('span');
  const dot = document.createElement('span');
  const copy = document.createElement('span');
  const channelLabel = document.createElement('span');
  const value = document.createElement('strong');

  node.className = 'connection-status';
  dot.className = 'status-dot';
  dot.setAttribute('aria-hidden', 'true');
  copy.className = 'status-copy';
  channelLabel.className = 'status-channel';
  channelLabel.textContent = channel === 'api'
    ? 'API'
    : t(channel === 'ticker' ? 'nav.ticker' : 'nav.video');
  value.className = 'status-value';
  copy.append(channelLabel, value);
  node.append(dot, copy);
  renderChannelStatus(node, value, presentation);
  return node;
}

function checkedTime(timestamp) {
  return new Intl.DateTimeFormat(i18n.locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function unknownProbeChannel() {
  return {
    state: 'unknown',
    responded: false,
    checkedAt: null,
    reason: null,
    message: null,
  };
}

function probeStatus(profile) {
  const saved = reachability.get(profile.id);
  if (!saved || saved.signature !== reachabilitySignature(profile)) {
    return {
      signature: reachabilitySignature(profile),
      api: unknownProbeChannel(),
      video: unknownProbeChannel(),
    };
  }
  return saved;
}

function probeError(channel, kind) {
  if (channel.reason === 'timeout') {
    return t('probe.timeout');
  }
  if (channel.reason === 'password') {
    return localizeError(i18n.locale, channel.message, 'error.wrongPassword');
  }
  if (kind === 'video' && channel.reason === 'http') {
    return t('probe.videoHttp', { status: channel.status ?? '—' });
  }
  return localizeError(
    i18n.locale,
    channel.message,
    kind === 'api'
      ? 'status.apiDefaultError'
      : kind === 'ticker' ? 'status.tickerDefaultError' : 'status.videoDefaultError',
  );
}

function probeChannelPresentation(channel, kind) {
  const key = kind === 'api'
    ? 'probe.api'
    : kind === 'ticker' ? 'probe.ticker' : 'probe.video';
  if (channel.state === 'checking') {
    return {
      state: 'connecting',
      label: t('status.checking'),
      detail: t(`${key}Checking`),
    };
  }
  if (channel.state === 'ready') {
    return {
      state: 'connected',
      label: t('status.ready'),
      detail: t(`${key}Ready`, { time: checkedTime(channel.checkedAt) }),
    };
  }
  if (channel.state === 'error') {
    return {
      state: 'error',
      label: t(channel.reason === 'password' ? 'status.authFailed' : 'status.disconnected'),
      detail: t(`${key}Failed`, {
        time: checkedTime(channel.checkedAt),
        error: probeError(channel, kind),
      }),
    };
  }
  return {
    state: 'idle',
    label: t('status.notChecked'),
    detail: t(`${key}Unknown`),
  };
}

function reachabilityPresentation(profile) {
  const saved = probeStatus(profile);
  const availability = deriveReachability(saved);
  if (availability.state === 'unknown') {
    return {
      state: 'unknown',
      label: t('reachability.unknown'),
      detail: t('reachability.unknownDetail'),
    };
  }
  if (availability.state === 'checking') {
    return {
      state: 'checking',
      label: t('reachability.checking'),
      detail: t(profile.tickerEnabled
        ? 'reachability.checkingTickerDetail'
        : 'reachability.checkingDetail'),
    };
  }

  const time = checkedTime(availability.checkedAt);
  if (availability.state === 'reachable') {
    return {
      state: 'reachable',
      label: t('reachability.reachable'),
      detail: t('reachability.reachableDetail', { time }),
    };
  }

  return {
    state: 'unreachable',
    label: t('reachability.noResponse'),
    detail: t(profile.tickerEnabled
      ? 'reachability.noResponseTickerDetail'
      : 'reachability.noResponseDetail', { time }),
  };
}

function createServerCard(profile, snapshot) {
  const active = snapshot.wanted && snapshot.profile?.id === profile.id;
  const saved = probeStatus(profile);
  const presentation = active
    ? connectionPresentation(snapshot, i18n.locale)
    : {
      api: probeChannelPresentation(saved.api, 'api'),
      video: probeChannelPresentation(saved.video, 'video'),
    };
  const availability = reachabilityPresentation(profile);
  const outputChannel = profile.tickerEnabled ? 'ticker' : 'video';
  const card = document.createElement('article');
  const artwork = document.createElement('div');
  const artworkImage = document.createElement('img');
  const details = document.createElement('div');
  const detailsBackdrop = document.createElement('img');
  const detailsSurface = document.createElement('div');
  const summary = document.createElement('div');
  const identity = document.createElement('div');
  const name = document.createElement('strong');
  const nameText = document.createElement('span');
  const address = document.createElement('span');
  const reachable = document.createElement('span');
  const reachableDot = document.createElement('span');
  const reachableLabel = document.createElement('span');
  const statuses = document.createElement('div');
  const actions = document.createElement('div');
  const editButton = document.createElement('button');
  const connectionButton = document.createElement('button');

  card.className = 'server-card';
  card.dataset.profileId = profile.id;
  card.dataset.active = String(active);
  card.setAttribute('role', 'listitem');

  artwork.className = 'server-card-artwork';
  artwork.setAttribute('aria-hidden', 'true');
  artworkImage.className = 'server-card-image';
  artworkImage.alt = '';
  artworkImage.loading = 'lazy';
  artworkImage.decoding = 'async';
  setProfileIcon(artworkImage, profile.iconId);
  artwork.append(artworkImage);

  details.className = 'server-card-details';
  detailsBackdrop.className = 'server-card-details-backdrop';
  detailsBackdrop.src = artworkImage.src;
  detailsBackdrop.alt = '';
  detailsBackdrop.loading = 'lazy';
  detailsBackdrop.decoding = 'async';
  detailsBackdrop.setAttribute('aria-hidden', 'true');
  detailsSurface.className = 'server-card-details-surface';
  summary.className = 'server-card-summary';

  identity.className = 'server-identity';
  name.className = 'server-name';
  name.title = profile.name;
  nameText.className = 'server-name-text';
  nameText.textContent = profile.name;
  name.append(nameText);
  address.className = 'server-address';
  address.textContent = t('library.address', {
    host: profile.host,
    port: profile.apiPort,
  });
  identity.append(name, address);

  reachable.className = 'server-reachability';
  reachable.dataset.state = availability.state;
  reachable.title = availability.detail;
  reachable.setAttribute('aria-label', availability.detail);
  reachableDot.className = 'status-dot';
  reachableDot.setAttribute('aria-hidden', 'true');
  reachableLabel.textContent = availability.label;
  reachable.append(reachableDot, reachableLabel);

  statuses.className = 'server-channel-statuses';
  statuses.setAttribute('aria-label', t('library.statusFor', { name: profile.name }));
  statuses.append(
    createChannelStatus('api', presentation.api),
    createChannelStatus(outputChannel, presentation.video),
  );

  actions.className = 'server-card-actions';
  editButton.type = 'button';
  editButton.className = 'secondary-button';
  editButton.textContent = t('button.edit');
  editButton.addEventListener('click', () => {
    selectProfile(profile.id);
    openSettings();
  });
  connectionButton.type = 'button';
  connectionButton.className = 'primary-button';
  connectionButton.textContent = t(
    active
      ? 'button.disconnect'
      : snapshot.wanted ? 'button.switch' : 'button.connect',
  );
  connectionButton.addEventListener('click', () => {
    selectProfile(profile.id);
    connectSelected();
  });
  actions.append(editButton, connectionButton);
  summary.append(identity, reachable);
  detailsSurface.append(summary, statuses, actions);

  if (active && presentation.streamMessage) {
    const diagnostic = document.createElement('p');
    const diagnosticTitle = document.createElement('strong');
    diagnostic.className = 'server-card-diagnostic';
    diagnostic.dataset.state = presentation.streamMessage.state;
    diagnosticTitle.textContent = presentation.streamMessage.title;
    diagnostic.append(diagnosticTitle, presentation.streamMessage.copy);
    detailsSurface.append(diagnostic);
  }
  details.append(detailsBackdrop, detailsSurface);
  card.append(artwork, details);
  return card;
}

function renderServerList(snapshot) {
  const profiles = configuredProfiles(store.list());
  serverList.replaceChildren(...profiles.map((profile) => createServerCard(profile, snapshot)));
  serverList.setAttribute('aria-busy', String(
    profiles.some((profile) => {
      const saved = probeStatus(profile);
      return saved.api.state === 'checking' || saved.video.state === 'checking';
    }),
  ));
  observeServerNames();
}

function browsePagePath(page) {
  const url = new URL(location.href);
  const pageName = page === 'servers' ? 'library' : page;
  url.searchParams.delete('compat');
  url.searchParams.set('page', pageName);
  url.hash = '';
  return `${url.pathname}${url.search}`;
}

function updateBrowsePageHistory(page, mode = 'push') {
  const target = browsePagePath(page);
  if (target === `${location.pathname}${location.search}`) {
    return;
  }
  history[mode === 'replace' ? 'replaceState' : 'pushState'](null, '', target);
}

function setPageMenuOpen(open) {
  const expanded = Boolean(open) && !pageMenuButton.hidden;
  pageMenu.hidden = !expanded;
  pageMenuButton.setAttribute('aria-expanded', String(expanded));
}

function renderPageNavigation(view) {
  const hasServers = configuredProfiles(store.list()).length > 0;
  welcomePageLink.href = browsePagePath('welcome');
  libraryPageLink.href = browsePagePath('servers');
  cardPageLink.href = browsePagePath('cards');
  browserSetupPageLink.href = browsePagePath('browser-setup');
  usageGuidePageLink.href = browsePagePath('guide');

  if (view === 'welcome') {
    welcomePageLink.setAttribute('aria-current', 'page');
  } else {
    welcomePageLink.removeAttribute('aria-current');
  }
  if (view === 'servers') {
    libraryPageLink.setAttribute('aria-current', 'page');
  } else {
    libraryPageLink.removeAttribute('aria-current');
  }
  if (view === 'cards') {
    cardPageLink.setAttribute('aria-current', 'page');
  } else {
    cardPageLink.removeAttribute('aria-current');
  }
  if (view === 'browser-setup') {
    browserSetupPageLink.setAttribute('aria-current', 'page');
  } else {
    browserSetupPageLink.removeAttribute('aria-current');
  }
  if (view === 'guide') {
    usageGuidePageLink.setAttribute('aria-current', 'page');
  } else {
    usageGuidePageLink.removeAttribute('aria-current');
  }

  libraryPageLink.setAttribute('aria-disabled', String(!hasServers));
  if (hasServers) {
    libraryPageLink.removeAttribute('tabindex');
  } else {
    libraryPageLink.tabIndex = -1;
  }
}

function navigateToBrowsePage(requestedPage) {
  browsePage = mainView(store.list(), { wanted: false }, requestedPage);
  updateBrowsePageHistory(browsePage);
  setPageMenuOpen(false);
  if (browsePage === 'guide') {
    usageGuidePage.scrollTop = 0;
  }
  if (session.wanted) {
    session.disconnect();
  } else {
    renderSnapshot(session.snapshot, false);
  }
}

function scrollWithinPage(container, target, { behavior = 'smooth', updateHash = false } = {}) {
  const top = target.getBoundingClientRect().top
    - container.getBoundingClientRect().top
    + container.scrollTop;
  container.scrollTo({ top: Math.max(0, top), behavior });
  if (updateHash && location.hash !== `#${target.id}`) {
    history.pushState(null, '', `${location.pathname}${location.search}#${target.id}`);
  }
}

function useLibraryPageForConnection() {
  browsePage = 'servers';
  updateBrowsePageHistory(browsePage, 'replace');
}

function renderMainView(snapshot) {
  const requestedPage = browsePage;
  const view = mainView(store.list(), snapshot, requestedPage);
  if (view !== 'stream') {
    browsePage = view;
    if (requestedPage !== undefined && requestedPage !== view) {
      updateBrowsePageHistory(view, 'replace');
    }
  }
  const previousView = renderedMainView;
  renderedMainView = view;
  toast.dataset.theme = view === 'stream' ? 'stream' : 'default';
  app.dataset.mainView = view;
  stage.dataset.mainView = view;
  emptyState.hidden = view !== 'welcome';
  serverLibrary.hidden = view !== 'servers';
  cardLibrary.hidden = view !== 'cards';
  browserSetup.hidden = view !== 'browser-setup';
  usageGuidePage.hidden = view !== 'guide';

  const streaming = view === 'stream';
  const tickerStreaming = streaming && snapshot.profile?.tickerEnabled;
  activeServer.hidden = !streaming;
  connectionStatuses.hidden = !streaming;
  languagePicker.hidden = streaming;
  settingsButton.hidden = streaming;
  connectButton.hidden = !streaming;
  cardControls.hidden = !streaming;
  pageMenuButton.hidden = streaming;
  brandIcon.hidden = !streaming;
  tickerView.hidden = !tickerStreaming;
  stage.dataset.outputMode = tickerStreaming ? 'ticker' : 'video';
  displayStatusChannel.textContent = t(snapshot.profile?.tickerEnabled
    ? 'nav.ticker'
    : 'nav.video');
  if (snapshot.profile?.tickerEnabled) {
    session.onticker(snapshot.tickerText);
  }
  setPageMenuOpen(false);
  if (!streaming) {
    setCardMenuOpen(false);
  }
  if (streaming && snapshot.profile) {
    setProfileIcon(brandIcon, snapshot.profile.iconId);
    element('active-server-name').textContent = snapshot.profile.name;
  }
  renderPageNavigation(view);
  renderCompatibility(false, view);
  if (view === 'servers' && previousView !== 'servers') {
    queueMicrotask(() => refreshReachability());
  }
  if (view === 'cards' && previousView !== 'cards') {
    queueMicrotask(() => renderCardManager());
  }
  if (streaming && !cardMenu.hidden) {
    renderStreamCardMenu();
  }
  return view;
}

function renderConnectionButton() {
  const selected = store.selected();
  const label = !session?.wanted
    ? t('button.connect')
    : t(session.profile?.id === selected.id ? 'button.disconnect' : 'button.switch');
  connectButtonLabel.textContent = label;
  connectButton.setAttribute('aria-label', label);
  connectButton.title = label;
}

function renderSnapshot(snapshot, announce = true) {
  recordSessionReachability(snapshot);
  renderConnectionButton();
  const view = renderMainView(snapshot);
  renderServerList(snapshot);
  const tickerMode = snapshot.profile?.tickerEnabled === true;
  const hudAvailable = snapshot.videoState === 'live' && !tickerMode;
  stageHud.hidden = !hudAvailable || hudDismissed;
  hudShowButton.hidden = !hudAvailable || !hudDismissed;
  touch.setEnabled(
    snapshot.videoState === 'live' && snapshot.apiState === 'live' && !tickerMode,
  );
  touch.setCanvasSize(snapshot.touchCanvas);

  if (!snapshot.wanted) {
    currentMetric = null;
    lastMetricPaint = 0;
    element('video-metric').textContent = '—';
    touchMarker.hidden = true;
  } else if (tickerMode) {
    element('video-metric').textContent = t('metric.ticker');
  } else if (snapshot.videoState === 'connecting' && currentMetric === null) {
    element('video-metric').textContent = t('metric.waiting');
  }

  const presentation = connectionPresentation(snapshot, i18n.locale);
  renderChannelStatus(apiStatus, element('api-status-label'), presentation.api);
  renderChannelStatus(videoStatus, element('video-status-label'), presentation.video);

  const message = presentation.streamMessage;
  streamMessage.hidden = view !== 'stream' || !message;
  if (message) {
    streamMessage.dataset.state = message.state;
    element('stream-message-title').textContent = message.title;
    element('stream-message-copy').textContent = message.copy;
  }

  apiWarning.hidden = !presentation.apiWarning;
  if (presentation.apiWarning) {
    element('api-warning-title').textContent = presentation.apiWarning.title;
    element('api-warning-copy').textContent = presentation.apiWarning.copy;
  }

  if (announce && snapshot.apiError?.code === 'password') {
    showToast(t('toast.password'), 7000);
  }
  if (location.protocol === 'https:'
    && (snapshot.apiError?.code === 'transport'
      || (!snapshot.profile?.tickerEnabled && snapshot.videoError))) {
    bannerDismissed = false;
    renderCompatibility(true);
  }
}

session.onstate = renderSnapshot;

function connectSelected() {
  const profile = store.selected();
  if (!profile.host) {
    openSettings();
    element('host').focus();
    return;
  }

  if (session.wanted && session.profile?.id === profile.id) {
    useLibraryPageForConnection();
    session.disconnect();
    refreshReachability();
    return;
  }

  currentMetric = null;
  lastMetricPaint = 0;
  element('video-metric').textContent = t(
    profile.tickerEnabled ? 'metric.ticker' : 'metric.waiting',
  );
  stage.dataset.viewMode = profile.viewMode;
  touch.setViewMode(profile.viewMode);
  useLibraryPageForConnection();
  session.connect(profile);
}

function openSettings(profile = store.selected(), options = {}) {
  editingProfile = { ...profile };
  editingProfileIsNew = options.isNew ?? !profile.host;
  fillForm(editingProfile);
  syncProfileEditorMode();
  element('save-status').textContent = '';
  if (!settingsDialog.open) {
    streamSettings.open = false;
    settingsDialog.showModal();
  }
}

function closeSettings() {
  if (settingsDialog.open) {
    settingsDialog.close();
  }
  editingProfile = null;
  editingProfileIsNew = false;
}

function renderCompatibility(force = false, view = renderedMainView) {
  const isHttps = location.protocol === 'https:';
  const recommended = isHttps && likelyNeedsBrowserSetup();
  compatBanner.hidden = view === 'browser-setup'
    || view === 'guide'
    || view === 'cards'
    || bannerDismissed
    || (!force && !recommended);
  element('compat-title').textContent = t('compat.title');
  element('compat-copy').textContent = t('compat.copy');
}

function reachabilitySignature(profile) {
  return `${profile.host}\u0000${profile.apiPort}\u0000${profile.password}\u0000${profile.format}`
    + `\u0000${profile.tickerEnabled}`;
}

function sessionProbeChannel(state, error, kind, responseObserved = false) {
  if (state === 'connecting' || state === 'checking') {
    const responded = responseObserved || (kind === 'api' && state === 'checking');
    return {
      ...unknownProbeChannel(),
      state: 'checking',
      responded,
      checkedAt: responded ? Date.now() : null,
    };
  }
  if (state === 'live') {
    return {
      ...unknownProbeChannel(),
      state: 'ready',
      responded: true,
      checkedAt: Date.now(),
    };
  }
  if (state === 'error') {
    const reason = error?.code || null;
    return {
      ...unknownProbeChannel(),
      state: 'error',
      responded: responseObserved
        || ((kind === 'api' || kind === 'ticker')
          && ['password', 'protocol', 'remote'].includes(reason)),
      checkedAt: Date.now(),
      reason,
      message: error?.message || String(error || ''),
      status: error?.status,
    };
  }
  return unknownProbeChannel();
}

function recordSessionReachability(snapshot) {
  const profile = snapshot.profile;
  if (!snapshot.wanted || !profile?.host) {
    return;
  }

  const signature = reachabilitySignature(profile);
  // The active session is a fresher source than a background probe. Invalidate
  // the probe token so a late result cannot overwrite live connection state.
  reachabilityInFlight.delete(profile.id);
  reachability.set(profile.id, {
    signature,
    api: sessionProbeChannel(snapshot.apiState, snapshot.apiError, 'api'),
    video: sessionProbeChannel(
      snapshot.videoState,
      snapshot.videoError,
      profile.tickerEnabled ? 'ticker' : 'video',
      snapshot.videoResponded,
    ),
  });
}

async function probeProfileReachability(profile, force = false) {
  const signature = reachabilitySignature(profile);
  const running = reachabilityInFlight.get(profile.id);
  if (running?.signature === signature) {
    return running.promise;
  }

  const saved = reachability.get(profile.id);
  const checkedAt = saved?.api?.checkedAt && saved?.video?.checkedAt
    ? Math.min(saved.api.checkedAt, saved.video.checkedAt)
    : null;
  if (!force
    && saved?.signature === signature
    && checkedAt
    && Date.now() - checkedAt < REACHABILITY_INTERVAL_MS) {
    return null;
  }

  const token = {};
  reachability.set(profile.id, {
    signature,
    api: { ...unknownProbeChannel(), state: 'checking' },
    video: { ...unknownProbeChannel(), state: 'checking' },
  });
  renderServerList(session.snapshot);

  const updateChannel = (channel, probe) => {
    if (reachabilityInFlight.get(profile.id)?.token !== token) {
      return probe;
    }
    const current = store.get(profile.id);
    if (current?.host && reachabilitySignature(current) === signature) {
      const currentStatus = probeStatus(profile);
      reachability.set(profile.id, {
        ...currentStatus,
        signature,
        [channel]: probe,
      });
      renderServerList(session.snapshot);
    }
    return probe;
  };

  const apiPromise = probeSpiceApi(profile).then(
    (probe) => updateChannel('api', probe),
  );
  const videoPromise = profile.tickerEnabled
    ? apiPromise.then((apiProbe) => {
      if (apiProbe.state !== 'ready') {
        return updateChannel('video', { ...apiProbe });
      }
      return probeSpiceTicker(profile).then(
        (probe) => updateChannel('video', probe),
      );
    })
    : probeSpiceVideo(profile).then(
      (probe) => updateChannel('video', probe),
    );
  const promise = Promise.all([apiPromise, videoPromise]).finally(() => {
    if (reachabilityInFlight.get(profile.id)?.token === token) {
      reachabilityInFlight.delete(profile.id);
    }
  });
  reachabilityInFlight.set(profile.id, { promise, signature, token });
  return promise;
}

function refreshReachability(force = false) {
  if (document.hidden
    || mainView(store.list(), session.snapshot, browsePage) !== 'servers') {
    return;
  }

  const profiles = configuredProfiles(store.list());
  const ids = new Set(profiles.map((profile) => profile.id));
  for (const id of reachability.keys()) {
    if (!ids.has(id)) {
      reachability.delete(id);
    }
  }
  for (const profile of profiles) {
    if (session.wanted && session.profile?.id === profile.id) {
      continue;
    }
    void probeProfileReachability(profile, force);
  }
}

function createProfileAndEdit() {
  const profiles = store.list();
  const configuredCount = configuredProfiles(profiles).length;
  const reusableDraft = profiles.find((profile) => !profile.host);
  const profile = reusableDraft || newProfile({
    name: t('settings.profilePlaceholder'),
  });
  if (configuredCount > 0) {
    profile.name = t('profile.newName', { number: configuredCount + 1 });
  }
  openSettings(profile, { isNew: true });
  element('profile-name').select();
}

pageMenuButton.addEventListener('click', () => {
  setPageMenuOpen(pageMenu.hidden);
});

welcomePageLink.addEventListener('click', (event) => {
  event.preventDefault();
  navigateToBrowsePage('welcome');
});

libraryPageLink.addEventListener('click', (event) => {
  event.preventDefault();
  if (libraryPageLink.getAttribute('aria-disabled') !== 'true') {
    navigateToBrowsePage('servers');
  }
});

cardPageLink.addEventListener('click', (event) => {
  event.preventDefault();
  navigateToBrowsePage('cards');
});

browserSetupPageLink.addEventListener('click', (event) => {
  event.preventDefault();
  navigateToBrowsePage('browser-setup');
});

element('library-connection-help').addEventListener('click', (event) => {
  event.preventDefault();
  navigateToBrowsePage('browser-setup');
});

usageGuidePageLink.addEventListener('click', (event) => {
  event.preventDefault();
  navigateToBrowsePage('guide');
});

document.addEventListener('pointerdown', (event) => {
  if (!pageMenu.hidden && !pageNavigation.contains(event.target)) {
    setPageMenuOpen(false);
  }
  if (!cardMenu.hidden && !cardControls.contains(event.target)) {
    setCardMenuOpen(false);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }
  if (!cardMenu.hidden) {
    setCardMenuOpen(false);
    cardMenuButton.focus();
  } else if (!pageMenu.hidden) {
    setPageMenuOpen(false);
    pageMenuButton.focus();
  }
});

cardMenuButton.addEventListener('click', () => {
  setCardMenuOpen(cardMenu.hidden);
});

element('card-menu-close').addEventListener('click', () => {
  setCardMenuOpen(false);
  cardMenuButton.focus();
});

for (const button of cardMenu.querySelectorAll('.card-reader-option')) {
  button.addEventListener('click', () => {
    selectedCardReader = Number(button.dataset.reader);
    renderStreamCardMenu();
  });
}

element('card-menu-manage').addEventListener('click', () => {
  setCardMenuOpen(false);
  navigateToBrowsePage('cards');
});

settingsButton.addEventListener('click', () => openSettings());
element('settings-guide-link').addEventListener('click', (event) => {
  event.preventDefault();
  closeSettings();
  navigateToBrowsePage('guide');
});
element('empty-configure').addEventListener('click', createProfileAndEdit);
element('empty-create-card').addEventListener('click', () => {
  navigateToBrowsePage('cards');
  startNewCard();
  renderCardCollection();
});
element('showcase-scroll-link').addEventListener('click', (event) => {
  event.preventDefault();
  scrollWithinPage(emptyState, element('showcase'), { updateHash: true });
});
element('showcase-guide-link').addEventListener('click', (event) => {
  event.preventDefault();
  navigateToBrowsePage('guide');
});
element('guide-self-host').addEventListener('click', (event) => {
  event.preventDefault();
  scrollWithinPage(usageGuidePage, selfHostGuide, { updateHash: true });
});
element('add-server').addEventListener('click', createProfileAndEdit);
element('add-card').addEventListener('click', () => startNewCard());
element('close-settings').addEventListener('click', closeSettings);
connectButton.addEventListener('click', connectSelected);

hudCloseButton.addEventListener('click', () => {
  hudDismissed = true;
  renderSnapshot(session.snapshot, false);
  hudShowButton.focus();
});

hudShowButton.addEventListener('click', () => {
  hudDismissed = false;
  renderSnapshot(session.snapshot, false);
  hudCloseButton.focus();
});

element('delete-profile').addEventListener('click', () => {
  if (!editingProfile || editingProfileIsNew) {
    return;
  }
  const profile = editingProfile;
  element('delete-copy').textContent = t('delete.copy', { name: profile.name });
  deleteDialog.returnValue = '';
  deleteDialog.showModal();
});

deleteDialog.addEventListener('close', () => {
  if (deleteDialog.returnValue !== 'confirm') {
    return;
  }
  const deleting = editingProfile?.id;
  if (!deleting) {
    return;
  }
  reachability.delete(deleting);
  reachabilityInFlight.delete(deleting);
  if (session.wanted && session.profile?.id === deleting) {
    session.disconnect();
  }
  store.remove(deleting);
  closeSettings();
  renderProfileLists();
});

function cardImageErrorMessage(error) {
  const key = {
    type: 'cards.imageTypeError',
    size: 'cards.imageSizeError',
    decode: 'cards.imageDecodeError',
    'storage-size': 'cards.imageStorageError',
  }[error?.code] || 'cards.imageGenericError';
  return t(key);
}

cardForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const numberInput = element('card-number');
  numberInput.value = normalizeCardNumberInput(numberInput.value);
  numberInput.setCustomValidity('');
  if (!cardForm.reportValidity()) {
    return;
  }

  const candidate = cardFromEditor();
  if (candidate.appearance === 'image' && !candidate.image) {
    element('card-image').setCustomValidity(t('cards.imageRequired'));
    element('card-image').reportValidity();
    element('card-image').setCustomValidity('');
    return;
  }

  try {
    const saved = cardStore.upsert(candidate);
    fillCardEditor(saved, true);
    renderCardCollection();
    if (!cardMenu.hidden) {
      renderStreamCardMenu();
    }
    element('card-save-status').textContent = t('cards.saved');
    showToast(t('toast.cardSaved'));
  } catch {
    element('card-save-status').textContent = t('cards.saveFailed');
    showToast(t('cards.saveFailed'), 7000);
  }
});

for (const id of ['card-name', 'card-number']) {
  element(id).addEventListener('input', () => {
    if (id === 'card-number') {
      element(id).value = normalizeCardNumberInput(element(id).value);
      element(id).setCustomValidity('');
    }
    renderCardPreview();
  });
}

for (const input of cardForm.querySelectorAll('input[name="card-appearance"]')) {
  input.addEventListener('change', renderCardPreview);
}

element('card-color').addEventListener('input', renderCardPreview);

element('generate-card-number').addEventListener('click', async () => {
  const input = element('card-number');
  if (!editingCardId) {
    input.value = generateCardNumber();
    input.setCustomValidity('');
    renderCardPreview();
    input.focus();
    input.select();
    return;
  }

  let copied = false;
  try {
    await navigator.clipboard.writeText(input.value);
    copied = true;
  } catch {
    input.select();
    copied = document.execCommand?.('copy') || false;
  }
  showToast(t(copied ? 'cards.idCopied' : 'cards.idCopyFailed'));
});

element('card-image').addEventListener('change', async () => {
  const input = element('card-image');
  const file = input.files?.[0];
  if (!file) {
    return;
  }
  element('card-save-status').textContent = t('cards.processingImage');
  try {
    cardDraft.image = await cardImageDataUrl(file);
    cardForm.querySelector('input[name="card-appearance"][value="image"]').checked = true;
    element('card-save-status').textContent = t('cards.imageReady');
    renderCardPreview();
  } catch (error) {
    const message = cardImageErrorMessage(error);
    element('card-save-status').textContent = message;
    showToast(message, 7000);
  } finally {
    input.value = '';
  }
});

element('remove-card-image').addEventListener('click', () => {
  cardDraft.image = null;
  element('card-save-status').textContent = t('cards.imageRemoved');
  renderCardPreview();
});

element('cancel-card').addEventListener('click', () => {
  const existing = editingCardId && cardStore.get(editingCardId);
  const first = cardStore.list()[0];
  if (existing) {
    fillCardEditor(existing, true);
  } else if (first) {
    fillCardEditor(first, true);
  } else {
    startNewCard(false);
  }
  renderCardCollection();
});

element('delete-card').addEventListener('click', () => {
  const card = editingCardId && cardStore.get(editingCardId);
  if (!card) {
    return;
  }
  element('delete-card-copy').textContent = t('cards.deleteCopy', {
    name: cardDisplayName(card),
  });
  deleteCardDialog.showModal();
});

deleteCardDialog.addEventListener('close', () => {
  if (deleteCardDialog.returnValue !== 'confirm' || !editingCardId) {
    return;
  }
  try {
    cardStore.remove(editingCardId);
    const first = cardStore.list()[0];
    if (first) {
      fillCardEditor(first, true);
    } else {
      startNewCard(false);
    }
    renderCardCollection();
    showToast(t('toast.cardDeleted'));
  } catch {
    showToast(t('cards.deleteFailed'), 7000);
  }
});

element('save-profile').addEventListener('click', () => {
  const profile = saveForm();
  if (profile) {
    void probeProfileReachability(profile, true);
    showToast(t('toast.profileSaved'));
  }
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const profile = saveForm();
  if (!profile) {
    return;
  }
  closeSettings();
  currentMetric = null;
  lastMetricPaint = 0;
  element('video-metric').textContent = t(
    profile.tickerEnabled ? 'metric.ticker' : 'metric.waiting',
  );
  useLibraryPageForConnection();
  session.connect(profile);
});

element('show-password').addEventListener('click', () => {
  const password = element('password');
  const showing = password.type === 'text';
  password.type = showing ? 'password' : 'text';
  element('show-password').textContent = t(showing ? 'button.show' : 'button.hide');
});

element('ticker-enabled').addEventListener('change', syncTickerModeControls);

element('ticker-preview-button').addEventListener('click', openTickerPreview);
tickerPreviewInput.addEventListener('input', startTickerPreviewMarquee);
element('ticker-preview-clean').addEventListener('click', (event) => {
  event.stopPropagation();
  setTickerPreviewClean(true);
  element('ticker-preview-stage').focus({ preventScroll: true });
});
element('ticker-preview-close').addEventListener('click', closeTickerPreview);
element('ticker-preview-stage').addEventListener('click', () => {
  if (tickerPreviewDialog.dataset.clean === 'true') {
    setTickerPreviewClean(false);
    tickerPreviewInput.focus({ preventScroll: true });
  }
});
tickerPreviewDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  if (tickerPreviewDialog.dataset.clean === 'true') {
    setTickerPreviewClean(false);
    tickerPreviewInput.focus({ preventScroll: true });
  } else {
    closeTickerPreview();
  }
});
tickerPreviewDialog.addEventListener('close', () => {
  stopTickerPreviewMarquee();
  setTickerPreviewClean(false);
  if (!settingsDialog.open) {
    settingsDialog.showModal();
  }
  requestAnimationFrame(() => element('ticker-preview-button').focus());
});

element('game-icon-button').addEventListener('click', () => {
  customIconStatus.textContent = '';
  renderIconGroups();
  iconDialog.showModal();
});

function gameIconImageErrorMessage(error) {
  const key = {
    type: 'icon.imageTypeError',
    size: 'icon.imageSizeError',
    decode: 'icon.imageDecodeError',
    processing: 'icon.imageProcessingError',
    'storage-size': 'icon.imageStorageError',
    limit: 'icon.libraryFull',
  }[error?.code] || 'icon.saveFailed';
  return t(key);
}

customIconInput.addEventListener('change', async () => {
  const file = customIconInput.files?.[0];
  if (!file) {
    return;
  }
  customIconInput.disabled = true;
  customIconStatus.textContent = t('icon.processing');
  try {
    const src = await gameIconDataUrl(file);
    const icon = customIconStore.create({
      label: customIconLabel(file.name),
      src,
    });
    refreshCustomGameIcons();
    setFormGameIcon(icon.id);
    renderIconGroups();
    customIconStatus.textContent = t('icon.uploadReady');
    showToast(t('toast.iconSaved'));
  } catch (error) {
    const message = gameIconImageErrorMessage(error);
    customIconStatus.textContent = message;
    showToast(message, 7000);
  } finally {
    customIconInput.disabled = false;
    customIconInput.value = '';
  }
});

streamSettings.addEventListener('toggle', () => {
  if (streamSettings.open) {
    requestAnimationFrame(() => streamSettings.scrollIntoView({ block: 'nearest' }));
  }
});

element('view-mode').addEventListener('change', () => {
  const mode = element('view-mode').value;
  stage.dataset.viewMode = mode;
  touch.setViewMode(mode);
  element('view-mode-button').textContent = t(`display.${mode}`);
});

const VIEW_MODES = ['contain', 'cover', 'fill'];

element('view-mode-button').addEventListener('click', () => {
  const current = stage.dataset.viewMode || 'contain';
  const next = VIEW_MODES[(VIEW_MODES.indexOf(current) + 1)
    % VIEW_MODES.length];
  stage.dataset.viewMode = next;
  touch.setViewMode(next);
  element('view-mode').value = next;
  element('view-mode-button').textContent = t(`display.${next}`);
  const profile = store.selected();
  store.upsert({ ...profile, viewMode: next });
});

const fullscreen = document.documentElement.requestFullscreen
  || document.documentElement.webkitRequestFullscreen;
if (!fullscreen || navigator.standalone) {
  element('fullscreen-button').hidden = true;
} else {
  element('fullscreen-button').addEventListener('click', () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return;
    }
    const result = fullscreen.call(document.documentElement);
    result?.catch?.(() => {});
  });
}

element('compat-button').addEventListener('click', () => {
  navigateToBrowsePage('browser-setup');
});
element('compat-dismiss').addEventListener('click', () => {
  bannerDismissed = true;
  compatBanner.hidden = true;
});

const httpModeAddress = plainHttpPageUrl(location.href);
element('http-mode-url').textContent = httpModeAddress;

element('copy-http-url').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(httpModeAddress);
    showToast(t('browserSetup.copied'));
  } catch {
    showToast(t('browserSetup.copyFailed'));
  }
});

element('browser-setup-done').addEventListener('click', () => {
  const destination = configuredProfiles(store.list()).length > 0 ? 'servers' : 'welcome';
  navigateToBrowsePage(destination);
});

element('browser-deployment-link').addEventListener('click', (event) => {
  event.preventDefault();
  navigateToBrowsePage('guide');
  requestAnimationFrame(() => scrollWithinPage(usageGuidePage, selfHostGuide));
});

element('self-host-done').addEventListener('click', () => {
  const destination = configuredProfiles(store.list()).length > 0 ? 'servers' : 'welcome';
  navigateToBrowsePage(destination);
});

function renderLocalizedUi() {
  applyDocumentTranslations();
  renderTickerPreviewText();
  renderConnectionButton();
  renderCompatibility();
  renderSnapshot(session.snapshot, false);
  element('view-mode-button').textContent = t(`display.${stage.dataset.viewMode || 'contain'}`);
  element('show-password').textContent = t(
    element('password').type === 'text' ? 'button.hide' : 'button.show',
  );
  if (element('save-status').textContent) {
    element('save-status').textContent = t('settings.saved');
  }
  if (iconDialog.open) {
    renderIconGroups();
  }
  if (cardDraft) {
    element('card-editor-title').textContent = t(editingCardId ? 'cards.editTitle' : 'cards.newTitle');
    element('generate-card-number').textContent = t(editingCardId ? 'cards.copyId' : 'cards.generate');
    renderCardCollection();
    renderCardPreview();
  }
  if (!cardMenu.hidden) {
    renderStreamCardMenu();
  }
}

languageSelect.addEventListener('change', () => {
  i18n.setLocale(languageSelect.value);
  clearTimeout(toastTimer);
  toast.hidden = true;
  renderLocalizedUi();
});

// WebKit emits separate gesture events even with touch-action: none.
for (const eventName of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(eventName, (event) => event.preventDefault(), { passive: false });
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    refreshReachability();
    if (session.wanted) {
      session.restartVideo();
    }
  }
});

window.addEventListener('online', () => {
  refreshReachability(true);
  if (session.wanted && session.videoState === 'error') {
    session.restartVideo();
  }
});

window.addEventListener('popstate', () => {
  browsePage = requestedBrowsePage();
  setPageMenuOpen(false);
  if (session.wanted) {
    session.disconnect();
  } else {
    renderSnapshot(session.snapshot, false);
  }
});

window.addEventListener('resize', () => {
  measureCreditCardNames();
});

setInterval(() => refreshReachability(true), REACHABILITY_INTERVAL_MS);

applyDocumentTranslations();
renderProfileLists();
fillForm(store.selected());
renderCompatibility();
renderSnapshot(session.snapshot);
if (browsePage === 'welcome' && location.hash === '#showcase') {
  requestAnimationFrame(() => scrollWithinPage(emptyState, element('showcase'), { behavior: 'auto' }));
} else if (browsePage === 'guide' && location.hash === '#self-host-guide') {
  requestAnimationFrame(() => scrollWithinPage(usageGuidePage, selfHostGuide, { behavior: 'auto' }));
}
document.fonts?.ready?.then(() => measureServerNames());
document.fonts?.ready?.then(() => measureCreditCardNames());
