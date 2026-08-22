import { compatibilityUrl, isPrivateLanName, likelyNeedsHttpMode } from './lib/endpoints.js';
import { GAME_ICON_GROUPS, GAME_ICONS, gameIconById } from './lib/game-icons.js';
import { connectionPresentation } from './lib/connection-status.js';
import { createI18n, localizeError } from './lib/i18n.js';
import { configuredProfiles, mainView } from './lib/main-view.js';
import {
  decodeProfileTransfer,
  ProfileStore,
  PROFILE_TRANSFER_KEY,
  sanitizeProfile,
} from './lib/profile-store.js';
import {
  probeSpiceApi,
  REACHABILITY_INTERVAL_MS,
} from './lib/reachability.js';
import { SpiceSession } from './lib/spice-session.js';
import { TouchController } from './lib/touch-controller.js';

const element = (id) => document.getElementById(id);
const i18n = createI18n();
const t = (key, parameters) => i18n.t(key, parameters);
const store = new ProfileStore(undefined, {
  defaultProfileName: t('settings.profilePlaceholder'),
});

const stage = element('stage');
const canvas = element('h264-view');
const video = element('mse-view');
const image = element('mjpeg-view');
const settingsDialog = element('settings-dialog');
const iconDialog = element('icon-dialog');
const deleteDialog = element('delete-dialog');
const form = element('profile-form');
const profilePicker = element('profile-picker');
const iconGroups = element('game-icon-groups');
const iconSearch = element('game-icon-search');
const connectButton = element('connect-button');
const emptyState = element('empty-state');
const serverLibrary = element('server-library');
const serverList = element('server-list');
const streamMessage = element('stream-message');
const stageHud = element('stage-hud');
const hudShowButton = element('hud-show-button');
const hudCloseButton = element('hud-close-button');
const activeServer = element('active-server');
const connectionStatuses = element('connection-statuses');
const apiStatus = element('api-status');
const videoStatus = element('video-status');
const apiWarning = element('api-warning');
const resizeScene = element('resize-scene');
const touchMarker = element('touch-marker');
const compatBanner = element('compat-banner');
const toast = element('toast');
const languageSelect = element('language-select');

let toastTimer = null;
let currentMetric = null;
let lastMetricPaint = 0;
let bannerDismissed = false;
let hudDismissed = false;
let renderedMainView = null;
const reachability = new Map();
const reachabilityInFlight = new Map();

function translationParameters(node) {
  const parameters = {};
  for (const name of ['scene', 'screen']) {
    const value = node.getAttribute(`data-i18n-${name}`);
    if (value !== null) {
      parameters[name] = value;
    }
  }
  return parameters;
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
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, timeout);
}

function importTransferredProfile() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const transfer = hash.get(PROFILE_TRANSFER_KEY);
  if (!transfer) {
    return;
  }
  const profile = decodeProfileTransfer(transfer);
  if (profile) {
    store.replaceAll(profile.profiles, profile.selectedId);
  }
  history.replaceState(null, '', `${location.pathname}${location.search}`);
}

importTransferredProfile();

function setSelectOptions(select, profiles, selectedId) {
  select.replaceChildren(...profiles.map((profile) => {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.host ? `${profile.name} · ${profile.host}` : profile.name;
    option.selected = profile.id === selectedId;
    return option;
  }));
}

function setProfileIcon(imageElement, iconId) {
  const icon = gameIconById(iconId);
  imageElement.src = icon.src;
  imageElement.title = icon.label;
}

function renderSelectedProfileIcons(profile) {
  setProfileIcon(element('profile-picker-icon'), profile.iconId);
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
  return button;
}

function renderIconGroups(query = '') {
  const selectedId = element('game-icon-id').value;
  const needle = query.trim().toLocaleLowerCase();
  const matchingGroups = GAME_ICON_GROUPS.map((group) => ({
    group,
    groupLabel: t(`icon.group.${group.id}`),
    icons: group.icons.filter((icon) => !needle
      || group.label.toLocaleLowerCase().includes(needle)
      || t(`icon.group.${group.id}`).toLocaleLowerCase().includes(needle)
      || icon.label.toLocaleLowerCase().includes(needle)
      || icon.id.toLocaleLowerCase().includes(needle)),
  })).filter(({ icons }) => icons.length > 0);

  const sections = matchingGroups.map(({ group, groupLabel, icons }) => {
    const section = document.createElement('section');
    const heading = document.createElement('h3');
    const grid = document.createElement('div');
    const headingId = `game-icon-group-${group.id}`;

    section.className = 'icon-category';
    section.setAttribute('role', 'group');
    section.setAttribute('aria-labelledby', headingId);
    heading.id = headingId;
    heading.textContent = groupLabel;
    grid.className = 'icon-category-grid';
    grid.append(...icons.map((icon) => createIconOption(icon, selectedId)));
    section.append(heading, grid);
    return section;
  });

  if (sections.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'icon-empty';
    empty.textContent = t('icon.empty');
    sections.push(empty);
  }

  iconGroups.replaceChildren(...sections);

  const matchingCount = matchingGroups.reduce((count, { icons }) => count + icons.length, 0);
  const scope = matchingCount === GAME_ICONS.length
    ? t('icon.scopeAll', {
      count: matchingCount,
      categories: GAME_ICON_GROUPS.length,
    })
    : t('icon.scopeMatch', { count: matchingCount, total: GAME_ICONS.length });
  element('game-icon-results').textContent = scope;
}

function renderProfileLists() {
  const profiles = store.list();
  setSelectOptions(profilePicker, profiles, store.selectedId);
  renderSelectedProfileIcons(store.selected());
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
  element('view-mode-button').textContent = t(`display.${profile.viewMode}`);
  renderSelectedProfileIcons(profile);
  stage.dataset.viewMode = profile.viewMode;
  touch.setViewMode(profile.viewMode);
}

function profileFromForm() {
  const selected = store.get(profilePicker.value) || store.selected();
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
  });
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
  profilePicker.value = id;
  fillForm(profile);
  renderSnapshot(session.snapshot, false);
  renderCompatibility();
  renderTransportNote();
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

function disconnectedSnapshot(profile) {
  return {
    wanted: false,
    profile,
    apiState: 'idle',
    videoState: 'idle',
    apiError: null,
    videoError: null,
  };
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
  channelLabel.textContent = channel === 'api' ? 'API' : t('nav.video');
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

function reachabilityPresentation(profile) {
  const saved = reachability.get(profile.id);
  if (!saved || saved.signature !== reachabilitySignature(profile)) {
    return {
      state: 'unknown',
      label: t('reachability.unknown'),
      detail: t('reachability.unknownDetail'),
    };
  }
  if (saved.state === 'checking') {
    return {
      state: 'checking',
      label: t('reachability.checking'),
      detail: t('reachability.checkingDetail'),
    };
  }

  const time = checkedTime(saved.checkedAt);
  if (saved.state === 'reachable') {
    return {
      state: 'reachable',
      label: t('reachability.reachable'),
      detail: t(
        (saved.reason === 'password' || saved.reason === 'protocol')
          ? 'reachability.reachableAuthDetail'
          : 'reachability.reachableDetail',
        { time },
      ),
    };
  }

  const error = saved.reason === 'timeout'
    ? t('reachability.timeout')
    : localizeError(i18n.locale, saved.message, 'status.apiDefaultError');
  return {
    state: 'unreachable',
    label: t('reachability.unreachable'),
    detail: t('reachability.unreachableDetail', {
      time,
      error,
    }),
  };
}

function createServerCard(profile, snapshot) {
  const active = snapshot.wanted && snapshot.profile?.id === profile.id;
  const cardSnapshot = active ? snapshot : disconnectedSnapshot(profile);
  const presentation = connectionPresentation(cardSnapshot, i18n.locale);
  const availability = reachabilityPresentation(profile);
  const card = document.createElement('article');
  const identity = document.createElement('div');
  const icon = document.createElement('img');
  const identityCopy = document.createElement('div');
  const name = document.createElement('strong');
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

  identity.className = 'server-identity';
  icon.className = 'profile-icon';
  icon.alt = '';
  icon.loading = 'lazy';
  icon.decoding = 'async';
  setProfileIcon(icon, profile.iconId);
  name.className = 'server-name';
  name.textContent = profile.name;
  address.className = 'server-address';
  address.textContent = t('library.address', {
    host: profile.host,
    port: profile.apiPort,
  });
  identityCopy.append(name, address);
  identity.append(icon, identityCopy);

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
    createChannelStatus('video', presentation.video),
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
  card.append(identity, reachable, statuses, actions);

  if (active && presentation.streamMessage) {
    const diagnostic = document.createElement('p');
    const diagnosticTitle = document.createElement('strong');
    diagnostic.className = 'server-card-diagnostic';
    diagnostic.dataset.state = presentation.streamMessage.state;
    diagnosticTitle.textContent = presentation.streamMessage.title;
    diagnostic.append(diagnosticTitle, presentation.streamMessage.copy);
    card.append(diagnostic);
  }
  return card;
}

function renderServerList(snapshot) {
  const profiles = configuredProfiles(store.list());
  serverList.replaceChildren(...profiles.map((profile) => createServerCard(profile, snapshot)));
  serverList.setAttribute('aria-busy', String(
    profiles.some((profile) => reachability.get(profile.id)?.state === 'checking'),
  ));
}

function renderMainView(snapshot) {
  const view = mainView(store.list(), snapshot);
  const previousView = renderedMainView;
  renderedMainView = view;
  stage.dataset.mainView = view;
  emptyState.hidden = view !== 'welcome';
  serverLibrary.hidden = view !== 'servers';

  const streaming = view === 'stream';
  activeServer.hidden = !streaming;
  connectionStatuses.hidden = !streaming;
  connectButton.hidden = !streaming;
  if (streaming && snapshot.profile) {
    setProfileIcon(element('active-server-icon'), snapshot.profile.iconId);
    element('active-server-name').textContent = snapshot.profile.name;
  }
  if (view === 'servers' && previousView !== 'servers') {
    queueMicrotask(() => refreshReachability());
  }
  return view;
}

function renderConnectionButton() {
  const selected = store.selected();
  if (!session?.wanted) {
    connectButton.textContent = t('button.connect');
    return;
  }
  connectButton.textContent = t(
    session.profile?.id === selected.id ? 'button.disconnect' : 'button.switch',
  );
}

function renderSnapshot(snapshot, announce = true) {
  recordSessionReachability(snapshot);
  renderConnectionButton();
  const view = renderMainView(snapshot);
  renderServerList(snapshot);
  const hudAvailable = snapshot.videoState === 'live';
  stageHud.hidden = !hudAvailable || hudDismissed;
  hudShowButton.hidden = !hudAvailable || !hudDismissed;
  resizeScene.disabled = snapshot.apiState !== 'live';
  touch.setEnabled(snapshot.videoState === 'live' && snapshot.apiState === 'live');
  touch.setCanvasSize(snapshot.touchCanvas);

  if (!snapshot.wanted) {
    currentMetric = null;
    lastMetricPaint = 0;
    element('video-metric').textContent = '—';
    resizeScene.value = '';
    touchMarker.hidden = true;
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
    && (snapshot.videoError || snapshot.apiError?.code === 'transport')) {
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
    session.disconnect();
    refreshReachability();
    return;
  }

  currentMetric = null;
  lastMetricPaint = 0;
  element('video-metric').textContent = t('metric.waiting');
  resizeScene.value = '';
  stage.dataset.viewMode = profile.viewMode;
  touch.setViewMode(profile.viewMode);
  session.connect(profile);
}

function openSettings() {
  fillForm(store.selected());
  profilePicker.value = store.selectedId;
  element('save-status').textContent = '';
  if (!settingsDialog.open) {
    settingsDialog.showModal();
  }
}

function closeSettings() {
  if (settingsDialog.open) {
    settingsDialog.close();
  }
}

function openCompatibilityMode() {
  const profile = (() => {
    try {
      return profileFromForm();
    } catch {
      return store.selected();
    }
  })();
  const profiles = store.list();
  const position = profiles.findIndex((saved) => saved.id === profile.id);
  if (position < 0) {
    profiles.push(profile);
  } else {
    profiles[position] = profile;
  }
  location.href = compatibilityUrl(profiles, location.href, profile.id);
}

function renderCompatibility(force = false) {
  const isHttps = location.protocol === 'https:';
  const wasForcedBack = isHttps && new URLSearchParams(location.search).has('compat');
  const recommended = isHttps && likelyNeedsHttpMode();
  compatBanner.hidden = bannerDismissed || (!force && !recommended && !wasForcedBack);
  element('dialog-compat-button').hidden = !isHttps;
  if (wasForcedBack) {
    element('compat-title').textContent = t('compat.forcedTitle');
    element('compat-copy').textContent = t('compat.forcedCopy');
  } else {
    element('compat-title').textContent = t('compat.title');
    element('compat-copy').textContent = t('compat.copy');
  }
}

function renderTransportNote() {
  const host = store.selected().host || '192.168.0.1';
  const publicLooking = location.protocol === 'https:' && !isPrivateLanName(host);
  element('transport-copy').textContent = t(
    publicLooking ? 'settings.directCopyPublic' : 'settings.directCopy',
  );
}

function reachabilitySignature(profile) {
  return `${profile.host}\u0000${profile.apiPort}\u0000${profile.password}`;
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
  if (snapshot.apiState === 'connecting' || snapshot.apiState === 'checking') {
    reachability.set(profile.id, { state: 'checking', signature });
    return;
  }
  if (snapshot.apiState === 'live') {
    reachability.set(profile.id, {
      state: 'reachable',
      signature,
      checkedAt: Date.now(),
      reason: null,
      message: null,
    });
    return;
  }
  if (snapshot.apiState === 'error') {
    reachability.set(profile.id, {
      state: snapshot.apiError?.code === 'password' ? 'reachable' : 'unreachable',
      signature,
      checkedAt: Date.now(),
      reason: snapshot.apiError?.code || null,
      message: snapshot.apiError?.message || null,
    });
  }
}

async function probeProfileReachability(profile, force = false) {
  const signature = reachabilitySignature(profile);
  const running = reachabilityInFlight.get(profile.id);
  if (running?.signature === signature) {
    return running.promise;
  }

  const saved = reachability.get(profile.id);
  if (!force
    && saved?.signature === signature
    && saved.checkedAt
    && Date.now() - saved.checkedAt < REACHABILITY_INTERVAL_MS) {
    return null;
  }

  const token = {};
  reachability.set(profile.id, { state: 'checking', signature });
  renderServerList(session.snapshot);
  const promise = probeSpiceApi(profile).then((probe) => {
    if (reachabilityInFlight.get(profile.id)?.token !== token) {
      return probe;
    }
    const current = store.get(profile.id);
    if (current?.host && reachabilitySignature(current) === signature) {
      reachability.set(profile.id, { ...probe, signature });
      renderServerList(session.snapshot);
    }
    return probe;
  }).finally(() => {
    if (reachabilityInFlight.get(profile.id)?.token === token) {
      reachabilityInFlight.delete(profile.id);
    }
  });
  reachabilityInFlight.set(profile.id, { promise, signature, token });
  return promise;
}

function refreshReachability(force = false) {
  if (document.hidden || mainView(store.list(), session.snapshot) !== 'servers') {
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
  const profile = store.create({
    name: t('profile.newName', { number: store.list().length + 1 }),
  });
  renderProfileLists();
  selectProfile(profile.id);
  openSettings();
  element('profile-name').select();
}

element('settings-button').addEventListener('click', openSettings);
element('empty-configure').addEventListener('click', openSettings);
element('add-server').addEventListener('click', createProfileAndEdit);
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

profilePicker.addEventListener('change', () => selectProfile(profilePicker.value));

element('new-profile').addEventListener('click', createProfileAndEdit);

element('delete-profile').addEventListener('click', () => {
  const profile = store.selected();
  element('delete-copy').textContent = t('delete.copy', { name: profile.name });
  deleteDialog.showModal();
});

deleteDialog.addEventListener('close', () => {
  if (deleteDialog.returnValue !== 'confirm') {
    return;
  }
  const deleting = store.selectedId;
  reachability.delete(deleting);
  reachabilityInFlight.delete(deleting);
  if (session.wanted && session.profile?.id === deleting) {
    session.disconnect();
  }
  const next = store.remove(deleting);
  renderProfileLists();
  selectProfile(next.id);
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
  element('video-metric').textContent = t('metric.waiting');
  resizeScene.value = '';
  session.connect(profile);
});

element('show-password').addEventListener('click', () => {
  const password = element('password');
  const showing = password.type === 'text';
  password.type = showing ? 'password' : 'text';
  element('show-password').textContent = t(showing ? 'button.show' : 'button.hide');
});

element('game-icon-button').addEventListener('click', () => {
  iconSearch.value = '';
  renderIconGroups();
  iconDialog.showModal();
  iconSearch.focus();
});

iconSearch.addEventListener('input', () => {
  renderIconGroups(iconSearch.value);
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

resizeScene.addEventListener('change', async () => {
  if (resizeScene.value === '') {
    return;
  }
  try {
    await session.setResizeScene(resizeScene.value);
    showToast(resizeScene.value === '0'
      ? t('toast.resizeOff')
      : t('toast.resizeScene', { scene: resizeScene.value }));
  } catch (error) {
    showToast(t('toast.resizeError', {
      message: localizeError(i18n.locale, error),
    }));
    resizeScene.value = '';
  }
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

element('compat-button').addEventListener('click', openCompatibilityMode);
element('dialog-compat-button').addEventListener('click', openCompatibilityMode);
element('compat-dismiss').addEventListener('click', () => {
  bannerDismissed = true;
  compatBanner.hidden = true;
});

function renderLocalizedUi() {
  applyDocumentTranslations();
  renderConnectionButton();
  renderCompatibility();
  renderTransportNote();
  renderSnapshot(session.snapshot, false);
  element('view-mode-button').textContent = t(`display.${stage.dataset.viewMode || 'contain'}`);
  element('show-password').textContent = t(
    element('password').type === 'text' ? 'button.hide' : 'button.show',
  );
  if (element('save-status').textContent) {
    element('save-status').textContent = t('settings.saved');
  }
  if (iconDialog.open) {
    renderIconGroups(iconSearch.value);
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

setInterval(() => refreshReachability(true), REACHABILITY_INTERVAL_MS);

applyDocumentTranslations();
renderProfileLists();
fillForm(store.selected());
renderCompatibility();
renderTransportNote();
renderSnapshot(session.snapshot);
