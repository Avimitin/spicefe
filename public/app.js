import { compatibilityUrl, isPrivateLanName, likelyNeedsHttpMode } from './lib/endpoints.js';
import { GAME_ICONS, gameIconById } from './lib/game-icons.js';
import {
  decodeProfileTransfer,
  newProfile,
  ProfileStore,
  PROFILE_TRANSFER_KEY,
  sanitizeProfile,
} from './lib/profile-store.js';
import { SpiceSession } from './lib/spice-session.js';
import { TouchController } from './lib/touch-controller.js';

const element = (id) => document.getElementById(id);
const store = new ProfileStore();

const stage = element('stage');
const canvas = element('h264-view');
const video = element('mse-view');
const image = element('mjpeg-view');
const settingsDialog = element('settings-dialog');
const iconDialog = element('icon-dialog');
const deleteDialog = element('delete-dialog');
const form = element('profile-form');
const quickProfile = element('quick-profile');
const profilePicker = element('profile-picker');
const iconGrid = element('game-icon-grid');
const iconSearch = element('game-icon-search');
const connectButton = element('connect-button');
const emptyState = element('empty-state');
const streamMessage = element('stream-message');
const stageHud = element('stage-hud');
const status = element('connection-status');
const statusLabel = element('status-label');
const resizeScene = element('resize-scene');
const touchMarker = element('touch-marker');
const compatBanner = element('compat-banner');
const toast = element('toast');

let toastTimer = null;
let currentMetric = null;
let lastMetricPaint = 0;
let bannerDismissed = false;
let visibleIconLimit = 30;

const ICON_PAGE_SIZE = 30;

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
  setProfileIcon(element('quick-profile-icon'), profile.iconId);
  setProfileIcon(element('profile-picker-icon'), profile.iconId);
}

function setFormGameIcon(iconId) {
  const icon = gameIconById(iconId);
  element('game-icon-id').value = icon.id;
  setProfileIcon(element('game-icon-preview'), icon.id);
  element('game-icon-label').textContent = icon.label;
}

function renderIconGrid(query = '') {
  const selectedId = element('game-icon-id').value;
  const needle = query.trim().toLocaleLowerCase();
  const matching = GAME_ICONS.filter((icon) => !needle
    || icon.label.toLocaleLowerCase().includes(needle)
    || icon.id.toLocaleLowerCase().includes(needle));

  const visible = matching.slice(0, visibleIconLimit);
  const choices = visible.map((icon) => {
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
  });

  if (visible.length < matching.length) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'game-icon-more';
    more.textContent = `Show ${Math.min(ICON_PAGE_SIZE, matching.length - visible.length)} more`;
    more.addEventListener('click', () => {
      visibleIconLimit += ICON_PAGE_SIZE;
      renderIconGrid(query);
    });
    choices.push(more);
  }

  iconGrid.replaceChildren(...choices);

  const scope = matching.length === GAME_ICONS.length
    ? `${matching.length} icons total`
    : `${matching.length} of ${GAME_ICONS.length} icons match`;
  element('game-icon-results').textContent = `Showing ${visible.length} · ${scope}`;
}

function renderProfileLists() {
  const profiles = store.list();
  setSelectOptions(quickProfile, profiles, store.selectedId);
  setSelectOptions(profilePicker, profiles, store.selectedId);
  renderSelectedProfileIcons(store.selected());
  renderConnectionButton();
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
      element('host').setCustomValidity('Enter the gaming PC address');
      element('host').reportValidity();
      element('host').setCustomValidity('');
      return null;
    }
  } catch (error) {
    element('host').setCustomValidity(error.message);
    element('host').reportValidity();
    element('host').setCustomValidity('');
    return null;
  }

  const stored = store.upsert(profile);
  renderProfileLists();
  fillForm(stored);
  element('save-status').textContent = 'Saved on this device';
  return stored;
}

function selectProfile(id) {
  const profile = store.select(id);
  if (!profile) {
    return;
  }
  quickProfile.value = id;
  profilePicker.value = id;
  fillForm(profile);
  renderConnectionButton();
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
session.onnotice = (message) => showToast(message);
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

function renderConnectionButton() {
  const selected = store.selected();
  if (!session?.wanted) {
    connectButton.textContent = 'Connect';
    return;
  }
  connectButton.textContent = session.profile?.id === selected.id ? 'Disconnect' : 'Switch';
}

function messageForSnapshot(snapshot) {
  if (!snapshot.wanted) {
    return null;
  }
  if (snapshot.videoState === 'error') {
    return {
      title: 'Video unavailable',
      copy: `${snapshot.videoError || 'Could not open the stream'} · retrying`,
    };
  }
  if (snapshot.videoState !== 'live') {
    return { title: 'Connecting', copy: 'Opening the video stream…' };
  }
  return null;
}

function renderSnapshot(snapshot) {
  renderConnectionButton();
  emptyState.hidden = snapshot.wanted;
  stageHud.hidden = snapshot.videoState !== 'live';
  resizeScene.disabled = snapshot.apiState !== 'live';
  touch.setEnabled(snapshot.videoState === 'live' && snapshot.apiState === 'live');
  touch.setCanvasSize(snapshot.touchCanvas);

  const message = messageForSnapshot(snapshot);
  streamMessage.hidden = !message;
  if (message) {
    element('stream-message-title').textContent = message.title;
    element('stream-message-copy').textContent = message.copy;
  }

  if (!snapshot.wanted) {
    status.dataset.state = 'idle';
    statusLabel.textContent = 'Ready';
  } else if (snapshot.connected) {
    status.dataset.state = 'connected';
    statusLabel.textContent = 'Connected';
  } else if (snapshot.videoState === 'live' && snapshot.apiState === 'error') {
    status.dataset.state = 'error';
    statusLabel.textContent = 'Video only';
  } else if (snapshot.videoState === 'error') {
    status.dataset.state = 'error';
    statusLabel.textContent = 'Retrying';
  } else {
    status.dataset.state = 'connecting';
    statusLabel.textContent = 'Connecting';
  }

  if (snapshot.apiError?.code === 'password') {
    showToast('The API password is incorrect. Update the saved instance and reconnect.', 7000);
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
    return;
  }

  currentMetric = null;
  lastMetricPaint = 0;
  element('video-metric').textContent = 'Waiting for frame';
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
    element('compat-title').textContent = 'This host forced HTTPS back on';
    element('compat-copy').textContent = 'Use a custom domain with Force HTTPS disabled, or open this site on EdgeOne over HTTP.';
  } else {
    element('compat-title').textContent = 'Browser compatibility mode needed';
    element('compat-copy').textContent = 'Safari and Firefox cannot open plain spice2x LAN connections from an HTTPS page.';
  }
}

element('settings-button').addEventListener('click', openSettings);
element('empty-configure').addEventListener('click', openSettings);
element('close-settings').addEventListener('click', closeSettings);
connectButton.addEventListener('click', connectSelected);

quickProfile.addEventListener('change', () => selectProfile(quickProfile.value));
profilePicker.addEventListener('change', () => selectProfile(profilePicker.value));

element('new-profile').addEventListener('click', () => {
  const profile = store.create(newProfile({ name: `Gaming PC ${store.list().length + 1}` }));
  renderProfileLists();
  selectProfile(profile.id);
  element('profile-name').select();
});

element('delete-profile').addEventListener('click', () => {
  const profile = store.selected();
  element('delete-copy').textContent = `“${profile.name}” and its saved connection information will be removed from this device.`;
  deleteDialog.showModal();
});

deleteDialog.addEventListener('close', () => {
  if (deleteDialog.returnValue !== 'confirm') {
    return;
  }
  const deleting = store.selectedId;
  if (session.wanted && session.profile?.id === deleting) {
    session.disconnect();
  }
  const next = store.remove(deleting);
  renderProfileLists();
  selectProfile(next.id);
});

element('save-profile').addEventListener('click', () => {
  if (saveForm()) {
    showToast('Connection profile saved');
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
  element('video-metric').textContent = 'Waiting for frame';
  resizeScene.value = '';
  session.connect(profile);
});

element('show-password').addEventListener('click', () => {
  const password = element('password');
  const showing = password.type === 'text';
  password.type = showing ? 'password' : 'text';
  element('show-password').textContent = showing ? 'Show' : 'Hide';
});

element('game-icon-button').addEventListener('click', () => {
  iconSearch.value = '';
  visibleIconLimit = ICON_PAGE_SIZE;
  renderIconGrid();
  iconDialog.showModal();
  iconSearch.focus();
});

iconSearch.addEventListener('input', () => {
  visibleIconLimit = ICON_PAGE_SIZE;
  renderIconGrid(iconSearch.value);
});

element('view-mode').addEventListener('change', () => {
  stage.dataset.viewMode = element('view-mode').value;
  touch.setViewMode(element('view-mode').value);
});

const VIEW_MODES = [
  { value: 'contain', label: 'Fit' },
  { value: 'cover', label: 'Fill' },
  { value: 'fill', label: 'Stretch' },
];

element('view-mode-button').addEventListener('click', () => {
  const current = stage.dataset.viewMode || 'contain';
  const next = VIEW_MODES[(VIEW_MODES.findIndex((mode) => mode.value === current) + 1)
    % VIEW_MODES.length];
  stage.dataset.viewMode = next.value;
  touch.setViewMode(next.value);
  element('view-mode').value = next.value;
  element('view-mode-button').textContent = next.label;
  const profile = store.selected();
  store.upsert({ ...profile, viewMode: next.value });
});

resizeScene.addEventListener('change', async () => {
  if (resizeScene.value === '') {
    return;
  }
  try {
    await session.setResizeScene(resizeScene.value);
    showToast(resizeScene.value === '0'
      ? 'Game screen resize disabled'
      : `Game screen resize scene ${resizeScene.value} selected`);
  } catch (error) {
    showToast(`Resize: ${error.message}`);
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

// WebKit emits separate gesture events even with touch-action: none.
for (const eventName of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(eventName, (event) => event.preventDefault(), { passive: false });
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && session.wanted) {
    session.restartVideo();
  }
});

window.addEventListener('online', () => {
  if (session.wanted && session.videoState === 'error') {
    session.restartVideo();
  }
});

if (location.protocol === 'https:' && !isPrivateLanName(store.selected().host || '192.168.0.1')) {
  // Public-looking names need targetAddressSpace support and may not work for WebSockets.
  element('transport-note').querySelector('p').append(
    ' A literal private IP is the most compatible choice on HTTPS.',
  );
}

renderProfileLists();
fillForm(store.selected());
renderCompatibility();
renderSnapshot(session.snapshot);

if (store.selected().host === '') {
  openSettings();
}
