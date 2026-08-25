import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

import {
  CardCollection,
  CardImportOptions,
  CreditCard,
  GameIconGroups,
  ServerList,
  ShowcaseCarousel,
  StreamCardList,
} from './components';
import { Toggle } from './ui';
import {
  cardBackupAction,
  cardBackupArchiveName,
  createCardBackupArchive,
} from './card-backup';

import { likelyNeedsBrowserSetup, plainHttpPageUrl } from '../public/lib/endpoints.js';
import {
  fetchRemoteCards,
  prepareCardImportCandidates,
  selectedCardImportCandidates,
} from '../public/lib/card-import.js';
import { cardImageDataUrl } from '../public/lib/card-image.js';
import {
  CardStore,
  generateCardNumber,
  newCard,
  newCardDraft,
  normalizeCardNumberInput,
} from '../public/lib/card-store.js';
import { measureCreditCardNames } from '../public/lib/credit-card.js';
import { CustomIconStore } from '../public/lib/custom-icon-store.js';
import {
  customIconLabel,
  gameIconDataUrl,
} from '../public/lib/game-icon-image.js';
import {
  DEFAULT_GAME_ICON_ID,
  GAME_ICON_GROUPS,
  gameIconById,
  setCustomGameIcons,
} from '../public/lib/game-icons.js';
import { connectionPresentation } from '../public/lib/connection-status.js';
import { createI18n, localizeError } from '../public/lib/i18n.js';
import {
  iidxTickerDisplayGlyphs,
  iidxTickerPreviewFrame,
  IIDX_TICKER_LENGTH,
  IIDX_TICKER_PREVIEW_STEP_MS,
} from '../public/lib/iidx-ticker.js';
import { configuredProfiles, mainView } from '../public/lib/main-view.js';
import { memoryPresentation } from '../public/lib/memory-metric.js';
import {
  newProfile,
  ProfileStore,
  sanitizeProfile,
} from '../public/lib/profile-store.js';
import {
  extractSharedProfile,
  sharedProfileUrl,
} from '../public/lib/profile-share.js';
import { createQrCodeSvg } from '../public/lib/qr-code.js';
import {
  deriveReachability,
  probeSpiceApi,
  probeSpiceTicker,
  probeSpiceVideo,
  REACHABILITY_INTERVAL_MS,
} from '../public/lib/reachability.js';
import { SpiceSession } from '../public/lib/spice-session.js';
import { TouchController } from '../public/lib/touch-controller.js';

type Profile = ReturnType<typeof newProfile>;
type Card = ReturnType<typeof newCard>;
type CardDraft = ReturnType<typeof newCardDraft>;
type BrowsePage = 'welcome' | 'servers' | 'cards' | 'browser-setup' | 'guide' | undefined;
type MainView = Exclude<BrowsePage, undefined> | 'stream';
type CardImportView = 'loading' | 'message' | 'results';

interface StreamMetric {
  width: number;
  height: number;
  fps: number;
  decodedFrames: number;
}

interface HostMemoryMetric {
  totalBytes: number;
  usedBytes: number;
  processBytes: number;
}

interface MarkerPosition {
  visible: boolean;
  clientX: number;
  clientY: number;
}

interface ProbeChannel {
  state: string;
  responded: boolean;
  checkedAt: number | null;
  reason: string | null;
  message: string | null;
  status?: number;
}

interface SessionSnapshot {
  wanted: boolean;
  profile: Profile | null;
  videoState: string;
  apiState: string;
  videoResponded?: boolean;
  videoError?: any;
  apiError?: any;
  touchCanvas?: { width: number; height: number } | null;
  tickerText?: string;
}

const element = (id: string): any => document.getElementById(id);
const i18n: any = (createI18n as any)();
const t = (key: string, parameters?: Record<string, unknown>): string => (
  i18n.t(key, parameters)
);
const customIconStore = new CustomIconStore();
setCustomGameIcons(customIconStore.list());
const store: any = new (ProfileStore as any)(undefined, {
  defaultProfileName: t('settings.profilePlaceholder'),
});
const cardStore: any = new (CardStore as any)();

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
const profileShareDialog = element('profile-share-dialog');
const profileShareExport = element('profile-share-export');
const profileShareImport = element('profile-share-import');
const profileShareError = element('profile-share-error');
const profileShareRestore = element('profile-share-restore');
const iconDialog = element('icon-dialog');
const deleteDialog = element('delete-dialog');
const form = element('profile-form');
const streamSettings = element('stream-settings');
const tickerToggleRoot = element('ticker-toggle-root');
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
const cardEditorDialog = element('card-editor-dialog');
const cardForm = element('card-form');
const cardPreview = element('card-preview');
const importCardsButton = element('import-cards');
const exportCardsButton = element('export-cards');
const cardImportDialog = element('card-import-dialog');
const cardImportContent = element('card-import-content');
const cardImportLoading = element('card-import-loading');
const cardImportMessage = element('card-import-message');
const cardImportResults = element('card-import-results');
const cardImportList = element('card-import-list');
const cardImportFooter = element('card-import-footer');
const cardImportDismiss = element('card-import-dismiss');
const cardImportConfirm = element('card-import-confirm');
const cardControls = element('card-controls');
const cardMenuButton = element('card-menu-button');
const cardMenu = element('card-menu');
const cardMenuList = element('card-menu-list');
const cardMenuEmpty = element('card-menu-empty');
const cardMenuApiNote = element('card-menu-api-note');
const deleteCardDialog = element('delete-card-dialog');
const streamMessage = element('stream-message');
const streamMetric = element('stream-metric');
const showcaseStreamCarousel = element('showcase-stream-carousel');
const showcaseCardsCarousel = element('showcase-cards-carousel');

// Keep the long deployment guide next to the browser guide in source while
// presenting connection setup and self-hosting as one continuous usage page.
element('self-host-guide-slot').replaceWith(selfHostGuide);
selfHostGuide.hidden = false;
const activeServer = element('active-server');
const apiWarning = element('api-warning');
const touchMarker = element('touch-marker');
const compatBanner = element('compat-banner');
const toast = element('toast');
const languageSelect = element('language-select');
const languagePicker = element('language-picker');

const reactRoots = {
  cardImportList: createRoot(cardImportList),
  cardList: createRoot(cardList),
  cardMenuList: createRoot(cardMenuList),
  cardPreview: createRoot(cardPreview),
  iconGroups: createRoot(iconGroups),
  serverList: createRoot(serverList),
  showcaseCards: createRoot(showcaseCardsCarousel),
  showcaseStream: createRoot(showcaseStreamCarousel),
  tickerToggle: createRoot(tickerToggleRoot),
};

function renderReact(root: ReturnType<typeof createRoot>, content: React.ReactNode) {
  flushSync(() => root.render(content));
}

function renderShowcaseCarousels() {
  const labels = {
    previousLabel: t('showcase.carouselPrevious'),
    nextLabel: t('showcase.carouselNext'),
    slideLabel: (current: number, total: number) => t('showcase.carouselSlide', {
      current,
      total,
    }),
  };
  renderReact(reactRoots.showcaseStream, (
    <ShowcaseCarousel
      {...labels}
      variant="stream"
      label={t('showcase.streamCarouselAria')}
      slides={[
        {
          src: './assets/showcase/iidx-stream.png',
          alt: t('showcase.streamIidxAlt'),
        },
        {
          src: './assets/showcase/gitadora-stream.png',
          alt: t('showcase.streamGitadoraAlt'),
        },
      ]}
    />
  ));
  renderReact(reactRoots.showcaseCards, (
    <ShowcaseCarousel
      {...labels}
      variant="cards"
      label={t('showcase.cardsCarouselAria')}
      slides={[
        {
          src: './assets/showcase/card-create.png',
          alt: t('showcase.cardsCreateAlt'),
        },
        {
          src: './assets/showcase/card-library.png',
          alt: t('showcase.cardsLibraryAlt'),
        },
      ]}
    />
  ));
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let currentMetric: StreamMetric | null = null;
let currentHostMemory: HostMemoryMetric | null = null;
let videoMetricFallback: 'idle' | 'waiting' | 'ticker' = 'idle';
let lastMetricPaint = 0;
let bannerDismissed = false;
let renderedMainView: MainView | null = null;
const reachability = new Map();
const reachabilityInFlight = new Map();
let editingCardId: string | null = null;
let cardDraft: CardDraft | Card | null = null;
let cardBackupMode = false;
const selectedCardBackupIds = new Set<string>();
let selectedCardReader = 0;
let cardInsertPending = false;
let cardImportPending = false;
let cardImportController: AbortController | null = null;
let cardImportRun = 0;
let cardImportProfile: Profile | null = null;
let cardImportCandidates: any[] = [];
const selectedCardImportIds = new Set<string>();
let profileShareCandidate: any = null;
let profileShareExisting: Profile | null = null;
let tickerPreviewOffset = 0;
let tickerPreviewTimer: ReturnType<typeof setTimeout> | null = null;
let editingProfile: Profile | null = null;
let editingProfileIsNew = false;
let tickerEnabledDraft = false;

function translationParameters(node: HTMLElement) {
  const screen = node.getAttribute('data-i18n-screen');
  return screen === null ? {} : { screen };
}

function applyDocumentTranslations() {
  document.documentElement.lang = i18n.locale;
  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = node.dataset.i18n;
    if (key) {
      node.textContent = t(key, translationParameters(node));
    }
  }
  for (const attribute of ['aria-label', 'title', 'placeholder', 'alt']) {
    for (const node of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
      const key = node.getAttribute(`data-i18n-${attribute}`);
      if (key) {
        node.setAttribute(attribute, t(key));
      }
    }
  }
  languageSelect.value = i18n.locale;
}

function showToast(message: string, timeout = 4500) {
  toast.textContent = message;
  toast.dataset.theme = renderedMainView === 'stream' ? 'stream' : 'default';
  toast.hidden = false;
  if (toastTimer !== null) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, timeout);
}

// Older releases put complete connection profiles in this fragment while
// changing schemes. Never import it; only remove it from legacy bookmarks.
if (new URLSearchParams(location.hash.slice(1)).has('spicefe-profile')) {
  history.replaceState(null, '', `${location.pathname}${location.search}`);
}

const incomingProfileShare = extractSharedProfile(location.href);
if (incomingProfileShare.found) {
  history.replaceState(null, '', incomingProfileShare.cleanPath);
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

let browsePage: BrowsePage = requestedBrowsePage();

function setProfileIcon(imageElement: HTMLImageElement, iconId: string) {
  const icon = gameIconById(iconId);
  imageElement.src = icon.src;
  imageElement.title = icon.label;
}

function setFormGameIcon(iconId: string) {
  const icon = gameIconById(iconId);
  element('game-icon-id').value = icon.id;
  setProfileIcon(element('game-icon-preview'), icon.id);
  element('game-icon-label').textContent = icon.label;
}

function renderIconGroups() {
  const selectedId = element('game-icon-id').value;
  const customIcons = customIconStore.list();
  const groups = customIcons.length > 0
    ? [{ id: 'custom', icons: customIcons }, ...GAME_ICON_GROUPS]
    : GAME_ICON_GROUPS;
  renderReact(reactRoots.iconGroups, (
    <GameIconGroups
      groups={groups}
      selectedId={selectedId}
      t={t}
      onSelect={(iconId) => {
        setFormGameIcon(iconId);
        iconDialog.close();
      }}
      onRemove={removeCustomGameIcon}
    />
  ));
}

function refreshCustomGameIcons() {
  setCustomGameIcons(customIconStore.list());
}

function removeCustomGameIcon(icon: any) {
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

function cardDisplayName(card: Card) {
  return card.name || t('cards.unnamed');
}

function selectedCardAppearance() {
  return cardForm.querySelector('input[name="card-appearance"]:checked')?.value
    || 'gray-light';
}

function cardFromEditor() {
  if (!cardDraft) {
    throw new Error('The card editor is not ready');
  }
  return {
    ...cardDraft,
    name: element('card-name').value,
    number: normalizeCardNumberInput(element('card-number').value),
    appearance: selectedCardAppearance(),
    color: element('card-color').value.toUpperCase(),
    eAmusementPosition: element('card-eamusement-position').value,
    konmaiPosition: element('card-konmai-position').value,
    cardIdPosition: element('card-id-position').value,
    namePosition: element('card-name-position').value,
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
  renderReact(reactRoots.cardPreview, (
    <CreditCard
      card={candidate}
      unnamed={t('cards.unnamed')}
      className="ea-card-preview"
    />
  ));
  renderCardAppearanceControls();
}

function fillCardEditor(card: Card | CardDraft, existing = false) {
  cardDraft = { ...card };
  editingCardId = existing ? card.id : null;
  element('card-name').value = card.name;
  element('card-number').value = card.number;
  element('card-number').readOnly = existing;
  element('card-color').value = card.color.toLowerCase();
  element('card-eamusement-position').value = card.eAmusementPosition;
  element('card-konmai-position').value = card.konmaiPosition;
  element('card-id-position').value = card.cardIdPosition;
  element('card-name-position').value = card.namePosition;
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
}

function showCardEditor(focus = true) {
  if (!cardEditorDialog.open) {
    cardEditorDialog.showModal();
  }
  renderCardCollection();
  if (focus) {
    requestAnimationFrame(focusCardEditor);
  }
}

function closeCardEditor() {
  if (cardEditorDialog.open) {
    cardEditorDialog.close();
  }
}

function startNewCard(focus = true) {
  fillCardEditor(newCardDraft(), false);
  showCardEditor(focus);
}

function editCard(id: string, focus = true) {
  const card = cardStore.get(id);
  if (!card) {
    return;
  }
  fillCardEditor(card, true);
  showCardEditor(focus);
}

function updateCardBackupControls(cards: Card[]) {
  const savedIds = new Set(cards.map((card) => card.id));
  for (const id of selectedCardBackupIds) {
    if (!savedIds.has(id)) {
      selectedCardBackupIds.delete(id);
    }
  }
  if (cards.length === 0) {
    cardBackupMode = false;
    selectedCardBackupIds.clear();
  }
  const count = selectedCardBackupIds.size;
  const action = cardBackupAction(cardBackupMode, count);
  const labelKey = action === 'start'
    ? 'cards.export'
    : action === 'cancel'
      ? 'cards.cancelBackup'
      : 'cards.downloadBackup';
  exportCardsButton.disabled = cards.length === 0;
  exportCardsButton.textContent = t(labelKey, { count });
  exportCardsButton.classList.toggle('primary-button', action === 'download');
  exportCardsButton.classList.toggle('secondary-button', action !== 'download');
  exportCardsButton.setAttribute('aria-pressed', String(cardBackupMode));
}

function setCardBackupSelection(id: string, selected: boolean) {
  if (!cardBackupMode) {
    return;
  }
  if (selected) {
    selectedCardBackupIds.add(id);
  } else {
    selectedCardBackupIds.delete(id);
  }
  renderCardCollection();
}

function renderCardCollection() {
  const cards = cardStore.list();
  updateCardBackupControls(cards);
  renderReact(reactRoots.cardList, (
    <CardCollection
      cards={cards}
      editingCardId={editingCardId}
      backupMode={cardBackupMode}
      backupSelection={selectedCardBackupIds}
      t={t}
      onEdit={editCard}
      onBackupSelectionChange={setCardBackupSelection}
    />
  ));
  cardList.hidden = cards.length === 0;
  cardEmpty.hidden = cards.length !== 0;
  element('card-count').textContent = t('cards.count', { count: cards.length });
  requestAnimationFrame(() => measureCreditCardNames(cardLibrary));
}

function exportSelectedCards() {
  const cards = cardStore.list().filter((card: Card) => selectedCardBackupIds.has(card.id));
  if (cards.length === 0) {
    updateCardBackupControls(cardStore.list());
    return;
  }

  try {
    const createdAt = new Date();
    const archive = createCardBackupArchive(cards, createdAt);
    const url = URL.createObjectURL(new Blob([archive], { type: 'application/zip' }));
    const download = document.createElement('a');
    download.href = url;
    download.download = cardBackupArchiveName(createdAt);
    download.hidden = true;
    document.body.append(download);
    download.click();
    download.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    showToast(t('cards.exported', { count: cards.length }));
    cardBackupMode = false;
    selectedCardBackupIds.clear();
    renderCardCollection();
  } catch {
    showToast(t('cards.exportFailed'), 7000);
  }
}

function handleCardBackupAction() {
  const action = cardBackupAction(cardBackupMode, selectedCardBackupIds.size);
  if (action === 'start') {
    cardBackupMode = true;
    selectedCardBackupIds.clear();
    renderCardCollection();
    return;
  }
  if (action === 'cancel') {
    cardBackupMode = false;
    selectedCardBackupIds.clear();
    renderCardCollection();
    return;
  }
  exportSelectedCards();
}

function renderCardManager() {
  renderCardCollection();
}

function setCardImportPending(pending: boolean) {
  cardImportPending = pending;
  importCardsButton.disabled = pending;
  cardImportContent.setAttribute('aria-busy', String(pending));
}

function setCardImportView(view: CardImportView) {
  cardImportLoading.hidden = view !== 'loading';
  cardImportMessage.hidden = view !== 'message';
  cardImportResults.hidden = view !== 'results';
}

function setCardImportMessage(kind: string, title: string, copy: string) {
  setCardImportView('message');
  cardImportMessage.dataset.kind = kind;
  element('card-import-message-icon').dataset.kind = kind;
  element('card-import-message-title').textContent = title;
  element('card-import-message-copy').textContent = copy;
  element('card-import-selection').hidden = true;
  cardImportConfirm.hidden = true;
  cardImportDismiss.textContent = t('cards.importCloseButton');
  cardImportFooter.hidden = false;
}

function cardImportErrorPresentation(error: any) {
  if (error?.code === 'password-required') {
    return {
      title: t('cards.importPasswordTitle'),
      copy: t('cards.importPasswordRequired'),
    };
  }
  if (error?.code === 'remote' && error?.message === 'Unknown function.') {
    return {
      title: t('cards.importUnsupportedTitle'),
      copy: t('cards.importUnsupported'),
    };
  }
  if (error?.code === 'timeout') {
    return {
      title: t('cards.importTimeoutTitle'),
      copy: t('cards.importTimeout'),
    };
  }
  return {
    title: t('cards.importFailedTitle'),
    copy: t('cards.importFailed', {
      error: (localizeError as any)(i18n.locale, error, 'status.apiDefaultError'),
    }),
  };
}

function updateCardImportSelection() {
  const selected = selectedCardImportIds.size;
  const available = cardImportCandidates.filter((candidate) => !candidate.saved).length;
  element('card-import-selection').textContent = available === 0
    ? t('cards.importAllSaved')
    : t('cards.importSelection', { selected, available });
  cardImportConfirm.disabled = selected === 0;
}

function renderCardImportOptions() {
  renderReact(reactRoots.cardImportList, (
    <CardImportOptions
      candidates={cardImportCandidates}
      selection={selectedCardImportIds}
      t={t}
      onSelectionChange={(id, selected) => {
        if (selected) {
          selectedCardImportIds.add(id);
        } else {
          selectedCardImportIds.delete(id);
        }
        renderCardImportOptions();
        updateCardImportSelection();
      }}
    />
  ));
}

function setCardImportResults(profile: Profile, remoteCards: any[]) {
  cardImportCandidates = prepareCardImportCandidates(
    remoteCards,
    cardStore.list().map((card: Card) => card.number),
  );
  selectedCardImportIds.clear();

  setCardImportView('results');
  element('card-import-found-copy').textContent = t('cards.importFoundCopy', {
    name: profile.name,
  });
  renderCardImportOptions();
  element('card-import-selection').hidden = false;
  cardImportConfirm.hidden = false;
  cardImportDismiss.textContent = t('cards.importCloseButton');
  cardImportFooter.hidden = false;
  updateCardImportSelection();
}

function stopCardImportScan() {
  cardImportRun += 1;
  cardImportController?.abort();
  cardImportController = null;
  setCardImportPending(false);
}

function closeCardImportDialog() {
  stopCardImportScan();
  if (cardImportDialog.open) {
    cardImportDialog.close();
  }
}

async function importRemoteCards() {
  if (cardImportPending || cardImportDialog.open) {
    return;
  }

  cardImportCandidates = [];
  selectedCardImportIds.clear();
  cardImportProfile = store.selected();
  cardImportFooter.hidden = true;
  setCardImportPending(false);
  cardImportDialog.showModal();

  if (!cardImportProfile?.host) {
    setCardImportMessage(
      'info',
      t('cards.importNoServerTitle'),
      t('cards.importNoServer'),
    );
    return;
  }

  const controller = new AbortController();
  const run = cardImportRun + 1;
  cardImportRun = run;
  cardImportController = controller;
  setCardImportView('loading');
  element('card-import-scanning-copy').textContent = t('cards.importScanningCopy', {
    name: cardImportProfile.name,
  });

  setCardImportPending(true);
  try {
    const remoteCards = await fetchRemoteCards(cardImportProfile, {
      signal: controller.signal,
    });
    if (run !== cardImportRun || controller.signal.aborted || !cardImportDialog.open) {
      return;
    }
    if (remoteCards.length === 0) {
      setCardImportMessage(
        'info',
        t('cards.importNoneTitle'),
        t('cards.importNone', { name: cardImportProfile.name }),
      );
      return;
    }
    setCardImportResults(cardImportProfile, remoteCards);
  } catch (error) {
    if (run !== cardImportRun || controller.signal.aborted || error?.code === 'aborted') {
      return;
    }
    const presentation = cardImportErrorPresentation(error);
    setCardImportMessage('error', presentation.title, presentation.copy);
  } finally {
    if (run === cardImportRun) {
      cardImportController = null;
      setCardImportPending(false);
    }
  }
}

function importSelectedRemoteCards() {
  const selected = selectedCardImportCandidates(cardImportCandidates, selectedCardImportIds);
  if (selected.length === 0) {
    updateCardImportSelection();
    return;
  }

  try {
    const imported = cardStore.importCards(selected.map((card: any) => newCard({
      number: card.cardId,
      name: card.fileName,
    })));
    renderCardCollection();
    if (!cardMenu.hidden) {
      renderStreamCardMenu();
    }
    setCardImportMessage(
      imported.length > 0 ? 'success' : 'info',
      t(imported.length > 0 ? 'cards.importCompleteTitle' : 'cards.importExistingTitle'),
      t(imported.length > 0 ? 'cards.imported' : 'cards.importExisting', {
        count: imported.length,
        name: cardImportProfile?.name ?? '',
      }),
    );
  } catch {
    setCardImportMessage(
      'error',
      t('cards.importSaveFailedTitle'),
      t('cards.importSaveFailed'),
    );
  }
}

function setCardMenuOpen(open: boolean) {
  const expanded = Boolean(open) && renderedMainView === 'stream';
  cardMenu.hidden = !expanded;
  cardMenuButton.setAttribute('aria-expanded', String(expanded));
  if (expanded) {
    renderStreamCardMenu();
  }
}

function renderStreamCardMenu() {
  const cards = cardStore.list();
  const apiReady = session.snapshot.apiState === 'live' && Boolean(session.api?.connected);
  cardMenuApiNote.hidden = apiReady || cards.length === 0;
  renderReact(reactRoots.cardMenuList, (
    <StreamCardList
      cards={cards}
      apiReady={apiReady}
      pending={cardInsertPending}
      player={selectedCardReader + 1}
      t={t}
      onInsert={insertStreamCard}
    />
  ));
  cardMenuList.hidden = cards.length === 0;
  cardMenuEmpty.hidden = cards.length !== 0;
  cardMenuList.setAttribute('aria-busy', String(cardInsertPending));
  for (const button of cardMenu.querySelectorAll('.card-reader-option')) {
    button.setAttribute('aria-checked', String(Number(button.dataset.reader) === selectedCardReader));
  }
  requestAnimationFrame(() => measureCreditCardNames(cardMenu));
}

async function insertStreamCard(card: Card) {
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
      error: (localizeError as any)(i18n.locale, error, 'status.apiDefaultError'),
    }), 7000);
  } finally {
    cardInsertPending = false;
  }
}

function renderProfileLists() {
  renderSnapshot(session.snapshot, false);
}

function renderTickerModeToggle() {
  renderReact(reactRoots.tickerToggle, (
    <Toggle
      id="ticker-enabled"
      name="ticker-enabled"
      size="sm"
      className="w-full"
      isSelected={tickerEnabledDraft}
      label={t('settings.tickerEnabled')}
      hint={t('settings.tickerHelp')}
      onChange={(isSelected) => {
        tickerEnabledDraft = isSelected;
        renderTickerModeToggle();
        syncTickerModeControls();
      }}
    />
  ));
}

function setTickerModeEnabled(enabled: boolean) {
  tickerEnabledDraft = enabled;
  renderTickerModeToggle();
}

function fillForm(profile: Profile) {
  element('profile-name').value = profile.name;
  setFormGameIcon(profile.iconId);
  element('host').value = profile.host;
  element('api-port').value = String(profile.apiPort);
  element('password').value = profile.password;
  element('format').value = profile.format;
  element('screen').value = profile.screen;
  element('fps').value = String(profile.fps);
  element('quality').value = String(profile.quality);
  setTickerModeEnabled(profile.tickerEnabled);
  syncTickerModeControls();
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
    tickerEnabled: tickerEnabledDraft,
  });
}

function syncTickerModeControls() {
  const enabled = tickerEnabledDraft;
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
  if (tickerPreviewTimer !== null) {
    clearInterval(tickerPreviewTimer);
  }
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

function setTickerPreviewClean(clean: boolean) {
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

function selectProfile(id: string) {
  const profile = store.select(id);
  if (!profile) {
    return;
  }
  fillForm(profile);
  renderSnapshot(session.snapshot, false);
  renderCompatibility();
}

const session: any = new (SpiceSession as any)(canvas, video, image);
const touch: any = new (TouchController as any)(stage, {
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
  onmarker: ({ visible, clientX, clientY }: MarkerPosition) => {
    touchMarker.hidden = !visible;
    if (visible) {
      touchMarker.style.left = `${clientX}px`;
      touchMarker.style.top = `${clientY}px`;
    }
  },
});

session.onapi = (api: any) => touch.setApi(api);
session.onnotice = (key: string, parameters?: Record<string, unknown>) => showToast(t(key, parameters));
session.onticker = (text: string) => {
  tickerText.textContent = iidxTickerDisplayGlyphs(text);
  const readable = text.trim();
  tickerView.setAttribute('aria-label', readable
    ? t('ticker.ariaText', { text: readable })
    : t('ticker.ariaBlank'));
};

function renderVideoMetric() {
  let value: string;
  if (currentMetric) {
    const fps = currentMetric.fps > 0 ? ` · ${currentMetric.fps.toFixed(0)} fps` : '';
    value = `${currentMetric.width}×${currentMetric.height}${fps}`;
  } else if (videoMetricFallback === 'waiting') {
    value = t('metric.waiting');
  } else if (videoMetricFallback === 'ticker') {
    value = t('metric.ticker');
  } else {
    value = '—';
  }

  const memory = memoryPresentation(currentHostMemory, i18n.locale);
  if (memory) {
    value += ` · ${t('metric.memory', { percent: memory.percent })}`;
  }
  const metric = element('video-metric');
  metric.textContent = value;
  metric.title = memory
    ? t('metric.memoryTitle', { used: memory.used, total: memory.total })
    : t('hud.video');
}

session.onmemory = (memory: HostMemoryMetric | null) => {
  currentHostMemory = memory;
  renderVideoMetric();
};
session.onframe = (metric: StreamMetric) => {
  currentMetric = metric;
  const now = performance.now();
  if (metric.decodedFrames > 1 && now - lastMetricPaint < 500) {
    return;
  }
  lastMetricPaint = now;
  renderVideoMetric();
};

function checkedTime(timestamp: number | null) {
  if (timestamp === null) {
    return '—';
  }
  return new Intl.DateTimeFormat(i18n.locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function unknownProbeChannel(): ProbeChannel {
  return {
    state: 'unknown',
    responded: false,
    checkedAt: null,
    reason: null,
    message: null,
  };
}

function probeStatus(profile: Profile) {
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

function probeError(channel: ProbeChannel, kind: string) {
  if (channel.reason === 'timeout') {
    return t('probe.timeout');
  }
  if (channel.reason === 'password') {
    return (localizeError as any)(i18n.locale, channel.message, 'error.wrongPassword');
  }
  if (kind === 'video' && channel.reason === 'http') {
    return t('probe.videoHttp', { status: channel.status ?? '—' });
  }
  return (localizeError as any)(
    i18n.locale,
    channel.message,
    kind === 'api'
      ? 'status.apiDefaultError'
      : kind === 'ticker' ? 'status.tickerDefaultError' : 'status.videoDefaultError',
  );
}

function probeChannelPresentation(channel: ProbeChannel, kind: string) {
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

function reachabilityPresentation(profile: Profile) {
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

function setProfileShareHeader(eyebrowKey: string, titleKey: string) {
  const eyebrow = element('profile-share-eyebrow');
  const title = element('profile-share-title');
  eyebrow.dataset.i18n = eyebrowKey;
  eyebrow.textContent = t(eyebrowKey);
  title.dataset.i18n = titleKey;
  title.textContent = t(titleKey);
}

function setProfileShareView(view: 'export' | 'import' | 'error') {
  profileShareExport.hidden = view !== 'export';
  profileShareImport.hidden = view !== 'import';
  profileShareError.hidden = view !== 'error';
  profileShareRestore.hidden = view !== 'import';
  element('profile-share-status').textContent = '';
}

function profileShareAddress(profile: Profile) {
  return t('library.address', {
    host: profile.host,
    port: profile.apiPort,
  });
}

function profileShareFormat(profile: Profile) {
  const formats: Record<string, string> = {
    auto: t('settings.formatAuto'),
    h264: t('settings.formatH264'),
    mjpg: 'MJPEG',
  };
  const format = formats[profile.format];
  return t('profileShare.streamSummary', {
    format,
    fps: profile.fps,
    quality: profile.quality,
  });
}

function profileShareOutput(profile: Profile) {
  if (profile.tickerEnabled) {
    return t('profileShare.outputTicker');
  }
  const screen = profile.screen
    ? t('profileShare.screenNumber', { screen: profile.screen })
    : t('profileShare.screenAuto');
  return t('profileShare.outputVideo', { screen });
}

function showProfileShareDialog() {
  if (!profileShareDialog.open) {
    profileShareDialog.showModal();
  }
}

function showProfileShareError(error: any) {
  profileShareCandidate = null;
  profileShareExisting = null;
  setProfileShareHeader('profileShare.importEyebrow', 'profileShare.invalidTitle');
  setProfileShareView('error');
  element('profile-share-error-copy').textContent = t(
    error?.code === 'unsupported'
      ? 'profileShare.unsupportedCopy'
      : 'profileShare.invalidCopy',
  );
  showProfileShareDialog();
}

function openProfileShare(profile: Profile) {
  let link;
  try {
    link = sharedProfileUrl(profile, location.href);
  } catch (error) {
    showProfileShareError(error);
    return;
  }

  profileShareCandidate = null;
  profileShareExisting = null;
  setProfileShareHeader('profileShare.exportEyebrow', 'profileShare.exportTitle');
  setProfileShareView('export');
  setProfileIcon(element('profile-share-export-icon'), profile.iconId);
  element('profile-share-export-name').textContent = profile.name;
  element('profile-share-export-address').textContent = profileShareAddress(profile);
  element('profile-share-security-copy').textContent = t(profile.password
    ? 'profileShare.securityPassword'
    : 'profileShare.securityNoPassword');
  element('profile-share-link').value = link;

  const qr = element('profile-share-qr');
  const qrError = element('profile-share-qr-error');
  qr.hidden = false;
  qrError.hidden = true;
  qr.replaceChildren();
  try {
    qr.innerHTML = createQrCodeSvg(link, {
      title: t('profileShare.exportTitle'),
      alt: t('profileShare.qrAria'),
    });
  } catch {
    qr.hidden = true;
    qrError.textContent = t('profileShare.qrTooLarge');
    qrError.hidden = false;
  }
  showProfileShareDialog();
}

function matchingSharedProfile(candidate: any): Profile | null {
  const host = candidate.host.toLowerCase();
  return configuredProfiles(store.list()).find((profile) => (
    profile.host.toLowerCase() === host && profile.apiPort === candidate.apiPort
  )) || null;
}

function showProfileRestore(candidate: any) {
  profileShareCandidate = { ...candidate };
  profileShareExisting = matchingSharedProfile(candidate);
  setProfileShareHeader('profileShare.importEyebrow', 'profileShare.importTitle');
  setProfileShareView('import');
  setProfileIcon(element('profile-share-import-icon'), candidate.iconId);
  element('profile-share-import-name').textContent = candidate.name;
  element('profile-share-import-address').textContent = profileShareAddress(candidate);
  element('profile-share-import-output').textContent = profileShareOutput(candidate);
  element('profile-share-import-password').textContent = t(candidate.password
    ? 'profileShare.passwordIncluded'
    : 'profileShare.passwordNone');
  element('profile-share-import-stream').textContent = profileShareFormat(candidate);
  element('profile-share-import-action').textContent = profileShareExisting
    ? t('profileShare.replaceCopy', { name: profileShareExisting.name })
    : t('profileShare.addCopy');
  showProfileShareDialog();
}

function closeProfileShareDialog() {
  if (profileShareDialog.open) {
    profileShareDialog.close();
  }
}

async function copyProfileShareLink() {
  const input = element('profile-share-link');
  let copied = false;
  try {
    await navigator.clipboard.writeText(input.value);
    copied = true;
  } catch {
    input.focus();
    input.select();
    copied = document.execCommand?.('copy') || false;
  }
  element('profile-share-status').textContent = t(copied
    ? 'profileShare.copied'
    : 'profileShare.copyFailed');
}

function restoreSharedProfile() {
  if (!profileShareCandidate) {
    return;
  }
  const candidate = profileShareCandidate;
  const reusableDraft = store.list().find((profile: Profile) => !profile.host);
  const base = profileShareExisting || reusableDraft || newProfile();
  const restored = store.upsert({
    ...base,
    ...candidate,
    id: base.id,
  });

  closeProfileShareDialog();
  browsePage = 'servers';
  updateBrowsePageHistory('servers', 'replace');
  fillForm(restored);
  renderProfileLists();
  void probeProfileReachability(restored, true);
  showToast(t('profileShare.restored'));
}

function renderServerList(snapshot: SessionSnapshot) {
  const profiles = configuredProfiles(store.list());
  const presentations = new Map(profiles.map((profile) => {
    const active = snapshot.wanted && snapshot.profile?.id === profile.id;
    const saved = probeStatus(profile);
    const presentation: any = active
      ? connectionPresentation(snapshot, i18n.locale)
      : {
        api: probeChannelPresentation(saved.api, 'api'),
        video: probeChannelPresentation(saved.video, 'video'),
      };
    return [profile.id, {
      presentation,
      availability: reachabilityPresentation(profile),
    }];
  }));
  renderReact(reactRoots.serverList, (
    <ServerList
      profiles={profiles}
      snapshot={snapshot}
      presentations={presentations}
      t={t}
      onShare={(id) => {
        const latestProfile = store.get(id);
        if (latestProfile) {
          openProfileShare(latestProfile);
        }
      }}
      onEdit={(id) => {
        selectProfile(id);
        openSettings();
      }}
      onConnect={(id) => {
        selectProfile(id);
        connectSelected();
      }}
    />
  ));
  serverList.setAttribute('aria-busy', String(
    profiles.some((profile) => {
      const saved = probeStatus(profile);
      return saved.api.state === 'checking' || saved.video.state === 'checking';
    }),
  ));
}

function browsePagePath(page: Exclude<BrowsePage, undefined>) {
  const url = new URL(location.href);
  const pageName = page === 'servers' ? 'library' : page;
  url.searchParams.delete('compat');
  url.searchParams.set('page', pageName);
  url.hash = '';
  return `${url.pathname}${url.search}`;
}

function updateBrowsePageHistory(
  page: Exclude<BrowsePage, undefined>,
  mode: 'push' | 'replace' = 'push',
) {
  const target = browsePagePath(page);
  if (target === `${location.pathname}${location.search}`) {
    return;
  }
  history[mode === 'replace' ? 'replaceState' : 'pushState'](null, '', target);
}

function setPageMenuOpen(open: boolean) {
  const expanded = Boolean(open) && !pageMenuButton.hidden;
  pageMenu.hidden = !expanded;
  pageMenuButton.setAttribute('aria-expanded', String(expanded));
}

function renderPageNavigation(view: MainView) {
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

function navigateToBrowsePage(requestedPage: Exclude<BrowsePage, undefined>) {
  browsePage = mainView(
    store.list(),
    { wanted: false },
    requestedPage,
  ) as Exclude<BrowsePage, undefined>;
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

function scrollWithinPage(
  container: HTMLElement,
  target: HTMLElement,
  { behavior = 'smooth', updateHash = false }: {
    behavior?: ScrollBehavior;
    updateHash?: boolean;
  } = {},
) {
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

function renderMainView(snapshot: SessionSnapshot): MainView {
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
  if (view !== 'cards') {
    closeCardEditor();
  }

  const streaming = view === 'stream';
  const tickerStreaming = streaming && snapshot.profile?.tickerEnabled;
  activeServer.hidden = !streaming;
  streamMetric.hidden = !streaming || tickerStreaming;
  languagePicker.hidden = streaming;
  settingsButton.hidden = streaming;
  connectButton.hidden = !streaming;
  cardControls.hidden = !streaming;
  pageMenuButton.hidden = streaming;
  brandIcon.hidden = !streaming;
  tickerView.hidden = !tickerStreaming;
  stage.dataset.outputMode = tickerStreaming ? 'ticker' : 'video';
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

function renderSnapshot(snapshot: SessionSnapshot, announce = true) {
  recordSessionReachability(snapshot);
  renderConnectionButton();
  const view = renderMainView(snapshot);
  renderServerList(snapshot);
  const tickerMode = snapshot.profile?.tickerEnabled === true;
  touch.setEnabled(
    snapshot.videoState === 'live' && snapshot.apiState === 'live' && !tickerMode,
  );
  touch.setCanvasSize(snapshot.touchCanvas);

  if (!snapshot.wanted) {
    currentMetric = null;
    currentHostMemory = null;
    videoMetricFallback = 'idle';
    lastMetricPaint = 0;
    renderVideoMetric();
    touchMarker.hidden = true;
  } else if (tickerMode) {
    videoMetricFallback = 'ticker';
    renderVideoMetric();
  } else if (snapshot.videoState === 'connecting' && currentMetric === null) {
    videoMetricFallback = 'waiting';
    renderVideoMetric();
  }

  const presentation = connectionPresentation(snapshot, i18n.locale);

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
  currentHostMemory = null;
  videoMetricFallback = profile.tickerEnabled ? 'ticker' : 'waiting';
  lastMetricPaint = 0;
  renderVideoMetric();
  useLibraryPageForConnection();
  session.connect(profile);
}

function openSettings(profile = store.selected(), options: { isNew?: boolean } = {}) {
  editingProfile = { ...profile };
  editingProfileIsNew = options.isNew ?? !profile.host;
  fillForm(editingProfile!);
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

function renderCompatibility(force = false, view: MainView | null = renderedMainView) {
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

function reachabilitySignature(profile: Profile) {
  return `${profile.host}\u0000${profile.apiPort}\u0000${profile.password}\u0000${profile.format}`
    + `\u0000${profile.tickerEnabled}`;
}

function sessionProbeChannel(
  state: string,
  error: any,
  kind: string,
  responseObserved = false,
): ProbeChannel {
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

function recordSessionReachability(snapshot: SessionSnapshot) {
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

async function probeProfileReachability(profile: Profile, force = false) {
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

  const updateChannel = (channel: 'api' | 'video', probe: ProbeChannel) => {
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
  const reusableDraft = profiles.find((profile: Profile) => !profile.host);
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

welcomePageLink.addEventListener('click', (event: Event) => {
  event.preventDefault();
  navigateToBrowsePage('welcome');
});

libraryPageLink.addEventListener('click', (event: Event) => {
  event.preventDefault();
  if (libraryPageLink.getAttribute('aria-disabled') !== 'true') {
    navigateToBrowsePage('servers');
  }
});

cardPageLink.addEventListener('click', (event: Event) => {
  event.preventDefault();
  navigateToBrowsePage('cards');
});

browserSetupPageLink.addEventListener('click', (event: Event) => {
  event.preventDefault();
  navigateToBrowsePage('browser-setup');
});

element('library-connection-help').addEventListener('click', (event: Event) => {
  event.preventDefault();
  navigateToBrowsePage('browser-setup');
});

usageGuidePageLink.addEventListener('click', (event: Event) => {
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
element('settings-guide-link').addEventListener('click', (event: Event) => {
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
element('showcase-scroll-link').addEventListener('click', (event: Event) => {
  event.preventDefault();
  scrollWithinPage(emptyState, element('showcase'), { updateHash: true });
});
element('showcase-guide-link').addEventListener('click', (event: Event) => {
  event.preventDefault();
  navigateToBrowsePage('guide');
});
element('guide-self-host').addEventListener('click', (event: Event) => {
  event.preventDefault();
  scrollWithinPage(usageGuidePage, selfHostGuide, { updateHash: true });
});
element('add-server').addEventListener('click', createProfileAndEdit);
element('add-card').addEventListener('click', () => startNewCard());
exportCardsButton.addEventListener('click', handleCardBackupAction);
importCardsButton.addEventListener('click', importRemoteCards);
element('card-import-close').addEventListener('click', closeCardImportDialog);
cardImportDismiss.addEventListener('click', closeCardImportDialog);
cardImportConfirm.addEventListener('click', importSelectedRemoteCards);
cardImportDialog.addEventListener('cancel', (event: Event) => {
  event.preventDefault();
  closeCardImportDialog();
});
cardImportDialog.addEventListener('close', stopCardImportScan);
element('profile-share-close').addEventListener('click', closeProfileShareDialog);
element('profile-share-dismiss').addEventListener('click', closeProfileShareDialog);
element('profile-share-copy').addEventListener('click', copyProfileShareLink);
profileShareRestore.addEventListener('click', restoreSharedProfile);
profileShareDialog.addEventListener('cancel', (event: Event) => {
  event.preventDefault();
  closeProfileShareDialog();
});
profileShareDialog.addEventListener('close', () => {
  profileShareCandidate = null;
  profileShareExisting = null;
  element('profile-share-qr').replaceChildren();
  element('profile-share-link').value = '';
  element('profile-share-status').textContent = '';
});
element('close-settings').addEventListener('click', closeSettings);
connectButton.addEventListener('click', connectSelected);

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

function cardImageErrorMessage(error: any) {
  const keys: Record<string, string> = {
    type: 'cards.imageTypeError',
    size: 'cards.imageSizeError',
    decode: 'cards.imageDecodeError',
    'storage-size': 'cards.imageStorageError',
  };
  const key = keys[String(error?.code || '')] || 'cards.imageGenericError';
  return t(key);
}

cardForm.addEventListener('submit', (event: Event) => {
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
    cardStore.upsert(candidate);
    renderCardCollection();
    if (!cardMenu.hidden) {
      renderStreamCardMenu();
    }
    closeCardEditor();
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

for (const id of [
  'card-eamusement-position',
  'card-konmai-position',
  'card-id-position',
  'card-name-position',
]) {
  element(id).addEventListener('change', renderCardPreview);
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
  if (!file || !cardDraft) {
    return;
  }
  const draft = cardDraft;
  element('card-save-status').textContent = t('cards.processingImage');
  try {
    const image = await cardImageDataUrl(file);
    if (cardDraft !== draft || !cardEditorDialog.open) {
      return;
    }
    draft.image = image;
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
  if (!cardDraft) {
    return;
  }
  cardDraft.image = null;
  element('card-save-status').textContent = t('cards.imageRemoved');
  renderCardPreview();
});

element('close-card-editor').addEventListener('click', closeCardEditor);
element('cancel-card').addEventListener('click', closeCardEditor);
cardEditorDialog.addEventListener('cancel', (event: Event) => {
  event.preventDefault();
  closeCardEditor();
});
cardEditorDialog.addEventListener('close', () => {
  cardDraft = null;
  editingCardId = null;
  renderReact(reactRoots.cardPreview, null);
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
    renderCardCollection();
    closeCardEditor();
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

form.addEventListener('submit', (event: Event) => {
  event.preventDefault();
  const profile = saveForm();
  if (!profile) {
    return;
  }
  closeSettings();
  currentMetric = null;
  currentHostMemory = null;
  videoMetricFallback = profile.tickerEnabled ? 'ticker' : 'waiting';
  lastMetricPaint = 0;
  renderVideoMetric();
  useLibraryPageForConnection();
  session.connect(profile);
});

element('show-password').addEventListener('click', () => {
  const password = element('password');
  const showing = password.type === 'text';
  password.type = showing ? 'password' : 'text';
  element('show-password').textContent = t(showing ? 'button.show' : 'button.hide');
});

element('ticker-preview-button').addEventListener('click', openTickerPreview);
tickerPreviewInput.addEventListener('input', startTickerPreviewMarquee);
element('ticker-preview-clean').addEventListener('click', (event: Event) => {
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
tickerPreviewDialog.addEventListener('cancel', (event: Event) => {
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

function gameIconImageErrorMessage(error: any) {
  const keys: Record<string, string> = {
    type: 'icon.imageTypeError',
    size: 'icon.imageSizeError',
    decode: 'icon.imageDecodeError',
    processing: 'icon.imageProcessingError',
    'storage-size': 'icon.imageStorageError',
    limit: 'icon.libraryFull',
  };
  const key = keys[String(error?.code || '')] || 'icon.saveFailed';
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

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const fullscreenDocument = document as FullscreenDocument;
const fullscreenElement = document.documentElement as FullscreenElement;
const fullscreen = fullscreenElement.requestFullscreen
  || fullscreenElement.webkitRequestFullscreen;
if (!fullscreen || (navigator as Navigator & { standalone?: boolean }).standalone) {
  element('fullscreen-button').hidden = true;
} else {
  element('fullscreen-button').addEventListener('click', () => {
    if (fullscreenDocument.fullscreenElement || fullscreenDocument.webkitFullscreenElement) {
      (fullscreenDocument.exitFullscreen || fullscreenDocument.webkitExitFullscreen)?.call(document);
      return;
    }
    const result = fullscreen.call(fullscreenElement);
    Promise.resolve(result).catch(() => {});
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

element('browser-deployment-link').addEventListener('click', (event: Event) => {
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
  renderShowcaseCarousels();
  renderTickerModeToggle();
  renderTickerPreviewText();
  renderConnectionButton();
  renderCompatibility();
  renderSnapshot(session.snapshot, false);
  renderVideoMetric();
  element('show-password').textContent = t(
    element('password').type === 'text' ? 'button.hide' : 'button.show',
  );
  if (element('save-status').textContent) {
    element('save-status').textContent = t('settings.saved');
  }
  if (iconDialog.open) {
    renderIconGroups();
  }
  if (cardEditorDialog.open && cardDraft) {
    element('card-editor-title').textContent = t(editingCardId ? 'cards.editTitle' : 'cards.newTitle');
    element('generate-card-number').textContent = t(editingCardId ? 'cards.copyId' : 'cards.generate');
    renderCardPreview();
  }
  if (renderedMainView === 'cards') {
    renderCardCollection();
  }
  if (!cardMenu.hidden) {
    renderStreamCardMenu();
  }
}

languageSelect.addEventListener('change', () => {
  i18n.setLocale(languageSelect.value);
  if (toastTimer !== null) {
    clearTimeout(toastTimer);
  }
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
renderShowcaseCarousels();
renderProfileLists();
fillForm(store.selected());
renderCompatibility();
renderSnapshot(session.snapshot);
if (incomingProfileShare.found) {
  if (incomingProfileShare.profile) {
    showProfileRestore(incomingProfileShare.profile);
  } else {
    showProfileShareError(incomingProfileShare.error);
  }
}
if (browsePage === 'welcome' && location.hash === '#showcase') {
  requestAnimationFrame(() => scrollWithinPage(emptyState, element('showcase'), { behavior: 'auto' }));
} else if (browsePage === 'guide' && location.hash === '#self-host-guide') {
  requestAnimationFrame(() => scrollWithinPage(usageGuidePage, selfHostGuide, { behavior: 'auto' }));
}
document.fonts?.ready?.then(() => measureCreditCardNames());
