import React, { useLayoutEffect, useRef } from 'react';

import {
  formatCardNumber,
  syncCreditCardName,
} from '../public/lib/credit-card.js';
import { gameIconById } from '../public/lib/game-icons.js';
import {
  Button,
  Carousel,
  Checkbox,
  StatusBadge,
  type CarouselApi,
  type StatusTone,
} from './ui';

type Translate = (key: string, parameters?: Record<string, unknown>) => string;

interface Card {
  id: string;
  name: string;
  number: string;
  appearance: string;
  color: string;
  image: string | null;
  eAmusementPosition: string;
  konmaiPosition: string;
  cardIdPosition: string;
  namePosition: string;
}

interface GameIcon {
  id: string;
  label: string;
  src: string;
  custom?: boolean;
}

interface GameIconGroup {
  id: string;
  icons: readonly GameIcon[];
}

interface CardImportCandidate {
  cardId: string;
  fileName: string;
  players: number[];
  source: string;
  saved: boolean;
}

interface Profile {
  id: string;
  name: string;
  iconId: string;
  host: string;
  apiPort: number;
  tickerEnabled: boolean;
  keypadEnabled: boolean;
}

interface SessionSnapshot {
  wanted?: boolean;
  profile?: Profile | null;
}

interface ChannelPresentation {
  state: string;
  detail: string;
  label: string;
}

interface StreamMessage {
  state: string;
  title: string;
  copy: string;
}

interface ShowcaseSlide {
  src: string;
  alt: string;
}

interface ProfilePresentation {
  presentation: {
    api: ChannelPresentation;
    video: ChannelPresentation;
    streamMessage?: StreamMessage | null;
  };
  availability: {
    state: string;
    detail: string;
    label: string;
  };
}

const EA_LOGO_SOURCE = './vendor/e-amusement/ea_logo.png';
const KONMAI_LOGO_SOURCE = './vendor/frankerfacez/konmai.png';

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function solidColorTone(color: string) {
  const match = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(color || '');
  if (!match) {
    return 'light';
  }
  const [red, green, blue] = match.slice(1)
    .map((channel) => Number.parseInt(channel, 16));
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? 'dark' : 'light';
}

function creditCardPresentation(card: Card): {
  style: React.CSSProperties | undefined;
  tone: string;
} {
  if (card.appearance === 'solid') {
    return {
      style: { '--ea-card-color': card.color } as React.CSSProperties,
      tone: solidColorTone(card.color),
    };
  }
  if (card.appearance === 'image' && card.image) {
    return {
      style: { backgroundImage: `url("${card.image}")` },
      tone: 'light',
    };
  }
  if (card.appearance === 'transparent-gradient' || card.appearance === 'gray-dark') {
    return { style: undefined, tone: 'light' };
  }
  return { style: undefined, tone: 'dark' };
}

export function CreditCard({
  card,
  unnamed,
  label,
  onActivate,
  className,
  disabled = false,
}: {
  card: Card;
  unnamed?: string;
  label?: string;
  onActivate?: (card: Card) => void;
  className?: string;
  disabled?: boolean;
}) {
  const nameRef = useRef<HTMLSpanElement>(null);
  const interactive = typeof onActivate === 'function';
  const displayName = card.name || unnamed || 'Unnamed card';
  const presentation = creditCardPresentation(card);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => syncCreditCardName(nameRef.current));
    return () => cancelAnimationFrame(frame);
  }, [displayName]);

  const content = (
    <>
      <span
        className="ea-card-brand ea-card-positioned"
        data-position={card.eAmusementPosition}
      >
        <img src={EA_LOGO_SOURCE} alt="" decoding="async" />
      </span>
      <span
        ref={nameRef}
        className="ea-card-name"
        data-position={card.namePosition}
        title={displayName}
      >
        <span className="ea-card-name-text">{displayName}</span>
      </span>
      <span
        className="ea-card-number ea-card-positioned"
        data-position={card.cardIdPosition}
      >
        {formatCardNumber(card.number)}
      </span>
      <span
        className="ea-card-logo ea-card-positioned"
        data-position={card.konmaiPosition}
      >
        <img src={KONMAI_LOGO_SOURCE} alt="" decoding="async" />
      </span>
    </>
  );

  const common = {
    className: joinClasses('ea-card', interactive && 'ea-card-button', className),
    'data-appearance': card.appearance,
    'data-tone': presentation.tone,
    style: presentation.style,
  };

  if (interactive) {
    return (
      <button
        {...common}
        type="button"
        disabled={disabled}
        aria-label={label || `${displayName}, ${formatCardNumber(card.number)}`}
        onClick={() => onActivate(card)}
      >
        {content}
      </button>
    );
  }

  return <div {...common}>{content}</div>;
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function ShowcaseArrow({ direction }: { direction: 'previous' | 'next' }) {
  return (
    <svg data-icon aria-hidden="true" viewBox="0 0 24 24">
      <path d={direction === 'previous' ? 'm15 18-6-6 6-6' : 'm9 6 6 6-6 6'} />
    </svg>
  );
}

export function ShowcaseCarousel({
  slides,
  variant,
  label,
  previousLabel,
  nextLabel,
  slideLabel,
  onApi,
}: {
  slides: readonly ShowcaseSlide[];
  variant: 'stream' | 'cards';
  label: string;
  previousLabel: string;
  nextLabel: string;
  slideLabel: (current: number, total: number) => string;
  onApi?: (api: CarouselApi) => void;
}) {
  return (
    <Carousel.Root
      className={joinClasses('showcase-carousel', `showcase-carousel-${variant}`)}
      aria-label={label}
      opts={{ align: 'start', containScroll: 'trimSnaps' }}
      setApi={onApi}
    >
      <Carousel.PrevTrigger>
        {({ isDisabled, onClick }) => (
          <button
            className="showcase-carousel-button showcase-carousel-previous"
            type="button"
            aria-label={previousLabel}
            disabled={isDisabled}
            onClick={onClick}
          >
            <ShowcaseArrow direction="previous" />
          </button>
        )}
      </Carousel.PrevTrigger>
      <Carousel.NextTrigger>
        {({ isDisabled, onClick }) => (
          <button
            className="showcase-carousel-button showcase-carousel-next"
            type="button"
            aria-label={nextLabel}
            disabled={isDisabled}
            onClick={onClick}
          >
            <ShowcaseArrow direction="next" />
          </button>
        )}
      </Carousel.NextTrigger>

      <Carousel.IndicatorGroup className="showcase-carousel-indicators" aria-label={label}>
        {({ index }) => (
          <Carousel.Indicator key={index} index={index}>
            {({ isSelected, onClick }) => (
              <button
                className="showcase-carousel-indicator"
                type="button"
                aria-label={slideLabel(index + 1, slides.length)}
                aria-current={isSelected ? 'true' : undefined}
                onClick={onClick}
              />
            )}
          </Carousel.Indicator>
        )}
      </Carousel.IndicatorGroup>

      <Carousel.Content className="showcase-carousel-track">
        {slides.map((slide, index) => (
          <Carousel.Item
            key={slide.src}
            className="showcase-carousel-slide"
            aria-label={slideLabel(index + 1, slides.length)}
          >
            <img
              src={slide.src}
              alt={slide.alt}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </Carousel.Item>
        ))}
      </Carousel.Content>
    </Carousel.Root>
  );
}

function GameIconOption({ icon, selectedId, t, onSelect, onRemove }: {
  icon: GameIcon;
  selectedId: string;
  t: Translate;
  onSelect: (id: string) => void;
  onRemove: (icon: GameIcon) => void;
}) {
  const option = (
    <button
      type="button"
      className="game-icon-option"
      data-icon-id={icon.id}
      role="option"
      aria-selected={icon.id === selectedId}
      title={icon.label}
      onClick={() => onSelect(icon.id)}
    >
      <img src={icon.src} alt="" loading="lazy" decoding="async" />
      <span>{icon.label}</span>
    </button>
  );

  if (!icon.custom) {
    return option;
  }

  return (
    <div className="custom-game-icon-option">
      {option}
      <Button
        color="tertiary"
        size="xs"
        className="custom-game-icon-remove"
        aria-label={t('icon.removeLabel', { name: icon.label })}
        title={t('icon.remove')}
        onClick={() => onRemove(icon)}
      >
        <CloseIcon />
      </Button>
    </div>
  );
}

export function GameIconGroups({ groups, selectedId, t, onSelect, onRemove }: {
  groups: readonly GameIconGroup[];
  selectedId: string;
  t: Translate;
  onSelect: (id: string) => void;
  onRemove: (icon: GameIcon) => void;
}) {
  return groups.map((group) => {
    const headingId = `game-icon-group-${group.id}`;
    return (
      <section key={group.id} className="icon-category" role="group" aria-labelledby={headingId}>
        <h3 id={headingId}>{t(`icon.group.${group.id}`)}</h3>
        <div className="icon-category-grid">
          {group.icons.map((icon) => (
            <GameIconOption
              key={icon.id}
              icon={icon}
              selectedId={selectedId}
              t={t}
              onSelect={onSelect}
              onRemove={onRemove}
            />
          ))}
        </div>
      </section>
    );
  });
}

export function CardCollection({
  cards,
  editingCardId,
  backupMode,
  backupSelection,
  t,
  onEdit,
  onBackupSelectionChange,
}: {
  cards: Card[];
  editingCardId: string | null;
  backupMode: boolean;
  backupSelection: ReadonlySet<string>;
  t: Translate;
  onEdit: (id: string) => void;
  onBackupSelectionChange: (id: string, selected: boolean) => void;
}) {
  return cards.map((card) => {
    const displayName = card.name || t('cards.unnamed');
    const selectedForBackup = backupSelection.has(card.id);
    return (
      <article
        key={card.id}
        className="managed-card"
        data-selected={card.id === editingCardId}
        data-backup-selected={selectedForBackup}
        role="listitem"
      >
        <CreditCard
          card={card}
          unnamed={t('cards.unnamed')}
          label={t('cards.editLabel', { name: displayName })}
          onActivate={() => onEdit(card.id)}
          className="ea-card-library-preview"
        />
        {backupMode ? (
          <Checkbox
            className="managed-card-backup-select"
            isSelected={selectedForBackup}
            aria-label={t('cards.backupSelectLabel', { name: displayName })}
            label={t('cards.backupSelect')}
            onChange={(selected) => onBackupSelectionChange(card.id, selected)}
          />
        ) : null}
      </article>
    );
  });
}

export function CardImportOptions({ candidates, selection, t, onSelectionChange }: {
  candidates: CardImportCandidate[];
  selection: ReadonlySet<string>;
  t: Translate;
  onSelectionChange: (id: string, selected: boolean) => void;
}) {
  return candidates.map((candidate) => {
    const players = candidate.players
      .map((player) => t('cards.importPlayer', { player }))
      .join(' · ');
    return (
      <div key={candidate.cardId} role="listitem">
        <Checkbox
          className="card-import-option"
          data-saved={candidate.saved}
          value={candidate.cardId}
          isDisabled={candidate.saved}
          isSelected={selection.has(candidate.cardId)}
          aria-label={t('cards.importSelectLabel', {
            name: candidate.fileName,
            number: formatCardNumber(candidate.cardId),
          })}
          onChange={(selected) => onSelectionChange(candidate.cardId, selected)}
        >
          <span className="card-import-option-copy">
            <strong>{candidate.fileName}</strong>
            <code>{formatCardNumber(candidate.cardId)}</code>
            <span>
              {players}
              {' · '}
              {t(candidate.source === 'override' ? 'cards.importOverride' : 'cards.importFile')}
            </span>
          </span>
          <span className="card-import-option-badge">
            {t(candidate.saved ? 'cards.importAlreadySaved' : 'cards.importAvailable')}
          </span>
        </Checkbox>
      </div>
    );
  });
}

export function StreamCardList({
  cards,
  apiReady,
  pending,
  player,
  t,
  onInsert,
}: {
  cards: Card[];
  apiReady: boolean;
  pending: boolean;
  player: number;
  t: Translate;
  onInsert: (card: Card) => void;
}) {
  return cards.map((card) => {
    const displayName = card.name || t('cards.unnamed');
    return (
      <div key={card.id} className="card-menu-item" role="listitem">
        <CreditCard
          card={card}
          unnamed={t('cards.unnamed')}
          label={t('cardMenu.insertLabel', { name: displayName, player })}
          onActivate={() => onInsert(card)}
          className="ea-card-compact"
          disabled={!apiReady || pending}
        />
      </div>
    );
  });
}

function ChannelStatus({ channel, presentation }: {
  channel: string;
  presentation: ChannelPresentation;
}) {
  const tone: StatusTone = presentation.state === 'connected'
    ? 'success'
    : presentation.state === 'connecting'
      ? 'warning'
      : presentation.state === 'error'
        ? 'error'
        : 'gray';
  return (
    <StatusBadge
      tone={tone}
      pulse={presentation.state === 'connecting'}
      className="server-status-tag"
      title={presentation.detail}
      aria-label={`${channel}: ${presentation.label}. ${presentation.detail}`}
    >
      <span className="server-status-tag-label">{channel}</span>
    </StatusBadge>
  );
}

function ServerCard({
  profile,
  snapshot,
  presentation,
  availability,
  t,
  onShare,
  onEdit,
  onConnect,
}: {
  profile: Profile;
  snapshot: SessionSnapshot;
  presentation: ProfilePresentation['presentation'];
  availability: ProfilePresentation['availability'];
  t: Translate;
  onShare: (id: string) => void;
  onEdit: (id: string) => void;
  onConnect: (id: string) => void;
}) {
  const nameRef = useRef<HTMLElement>(null);
  const active = snapshot.wanted && snapshot.profile?.id === profile.id;
  const icon = gameIconById(profile.iconId);
  const outputChannel = profile.keypadEnabled
    ? 'keypad'
    : profile.tickerEnabled ? 'ticker' : 'video';
  const availabilityTone: StatusTone = availability.state === 'reachable'
    ? 'success'
    : availability.state === 'checking'
      ? 'warning'
      : availability.state === 'unreachable'
        ? 'error'
        : 'gray';

  useLayoutEffect(() => {
    const name = nameRef.current;
    if (!name) {
      return undefined;
    }
    const text = name.querySelector<HTMLElement>('.server-name-text');
    if (!text) {
      return undefined;
    }
    const measure = () => {
      const shift = Math.max(0, Math.ceil(text.scrollWidth - name.clientWidth));
      name.dataset.overflow = String(shift > 1);
      if (shift > 1) {
        name.style.setProperty('--server-name-shift', `${-shift}px`);
        name.style.setProperty('--server-name-duration', `${Math.min(12, 5 + shift / 24)}s`);
      } else {
        name.style.removeProperty('--server-name-shift');
        name.style.removeProperty('--server-name-duration');
      }
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(name);
    return () => observer?.disconnect();
  }, [profile.name]);

  return (
    <article
      className="server-card"
      data-profile-id={profile.id}
      data-active={active}
      role="listitem"
    >
      <div className="server-card-artwork" aria-hidden="true">
        <img
          className="server-card-image"
          src={icon.src}
          title={icon.label}
          alt=""
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="server-card-details">
        <img
          className="server-card-details-backdrop"
          src={icon.src}
          alt=""
          loading="lazy"
          decoding="async"
          aria-hidden="true"
        />
        <div className="server-card-details-surface">
          <div className="server-card-summary">
            <div className="server-identity">
              <strong ref={nameRef} className="server-name" title={profile.name}>
                <span className="server-name-text">{profile.name}</span>
              </strong>
              <span
                className="server-address"
                tabIndex={0}
                title={t('library.addressReveal')}
              >
                <span className="server-address-prefix">IP:</span>
                <span className="server-address-value">
                  {t('library.address', { host: profile.host, port: profile.apiPort })}
                </span>
              </span>
            </div>
          </div>
          <div
            className="server-status-tags"
            aria-label={t('library.statusFor', { name: profile.name })}
          >
            <StatusBadge
              tone={availabilityTone}
              pulse={availability.state === 'checking'}
              className="server-status-tag"
              title={availability.detail}
              aria-label={`${availability.label}. ${availability.detail}`}
            >
              <span className="server-status-tag-label">{availability.label}</span>
            </StatusBadge>
            <ChannelStatus channel="API" presentation={presentation.api} />
            <ChannelStatus
              channel={t(`nav.${outputChannel}`)}
              presentation={presentation.video}
            />
          </div>
          <div className="server-card-actions">
            <Button
              size="xs"
              className="w-full bg-white/95 text-neutral-800 ring-white hover:bg-white"
              onPress={() => onConnect(profile.id)}
            >
              {t(active ? 'button.disconnect' : snapshot.wanted ? 'button.switch' : 'button.connect')}
            </Button>
            <Button
              color="secondary"
              size="xs"
              className="server-card-icon-button server-edit-button"
              aria-label={`${t('button.edit')}: ${profile.name}`}
              title={t('button.edit')}
              onPress={() => onEdit(profile.id)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M13.5 6.5 17.5 10.5M4 20l4.25-1 10.4-10.4a2.83 2.83 0 0 0-4-4L4.25 15 4 20Z" />
              </svg>
            </Button>
            <Button
              color="secondary"
              size="xs"
              className="server-card-icon-button server-share-button"
              aria-label={t('profileShare.openLabel', { name: profile.name })}
              title={t('profileShare.openLabel', { name: profile.name })}
              onPress={() => onShare(profile.id)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-6v-2h4z" />
              </svg>
            </Button>
          </div>
          {active && presentation.streamMessage ? (
            <p className="server-card-diagnostic" data-state={presentation.streamMessage.state}>
              <strong>{presentation.streamMessage.title}</strong>
              {presentation.streamMessage.copy}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ServerList({
  profiles,
  snapshot,
  presentations,
  t,
  onShare,
  onEdit,
  onConnect,
}: {
  profiles: Profile[];
  snapshot: SessionSnapshot;
  presentations: Map<string, ProfilePresentation>;
  t: Translate;
  onShare: (id: string) => void;
  onEdit: (id: string) => void;
  onConnect: (id: string) => void;
}) {
  return profiles.map((profile) => {
    const status = presentations.get(profile.id);
    if (!status) {
      return null;
    }
    return (
      <ServerCard
        key={profile.id}
        profile={profile}
        snapshot={snapshot}
        presentation={status.presentation}
        availability={status.availability}
        t={t}
        onShare={onShare}
        onEdit={onEdit}
        onConnect={onConnect}
      />
    );
  });
}
