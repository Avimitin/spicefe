import React, { useLayoutEffect, useRef } from 'react';

import {
  formatCardNumber,
  syncCreditCardName,
} from '../public/lib/credit-card.js';
import { gameIconById } from '../public/lib/game-icons.js';

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
      <button
        type="button"
        className="custom-game-icon-remove"
        aria-label={t('icon.removeLabel', { name: icon.label })}
        title={t('icon.remove')}
        onClick={() => onRemove(icon)}
      >
        <CloseIcon />
      </button>
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
          <label className="managed-card-backup-select">
            <input
              type="checkbox"
              checked={selectedForBackup}
              aria-label={t('cards.backupSelectLabel', { name: displayName })}
              onChange={(event) => onBackupSelectionChange(card.id, event.currentTarget.checked)}
            />
            <span>{t('cards.backupSelect')}</span>
          </label>
        ) : null}
      </article>
    );
  });
}

export function CardImportOptions({ candidates, t, onSelectionChange }: {
  candidates: CardImportCandidate[];
  t: Translate;
  onSelectionChange: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return candidates.map((candidate) => {
    const players = candidate.players
      .map((player) => t('cards.importPlayer', { player }))
      .join(' · ');
    return (
      <label
        key={candidate.cardId}
        className="card-import-option"
        data-saved={candidate.saved}
        role="listitem"
      >
        <input
          type="checkbox"
          value={candidate.cardId}
          disabled={candidate.saved}
          aria-label={t('cards.importSelectLabel', {
            name: candidate.fileName,
            number: formatCardNumber(candidate.cardId),
          })}
          onChange={onSelectionChange}
        />
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
      </label>
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
  return (
    <span
      className="connection-status"
      data-state={presentation.state}
      title={presentation.detail}
      aria-label={presentation.detail}
    >
      <span className="status-dot" aria-hidden="true" />
      <span className="status-copy">
        <span className="status-channel">{channel}</span>
        <strong className="status-value">{presentation.label}</strong>
      </span>
    </span>
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
  const outputChannel = profile.tickerEnabled ? 'ticker' : 'video';

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
      <button
        type="button"
        className="server-share-button"
        aria-label={t('profileShare.openLabel', { name: profile.name })}
        title={t('profileShare.openLabel', { name: profile.name })}
        onClick={() => onShare(profile.id)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-6v-2h4z" />
        </svg>
      </button>
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
              <span className="server-address">
                {t('library.address', { host: profile.host, port: profile.apiPort })}
              </span>
            </div>
            <span
              className="server-reachability"
              data-state={availability.state}
              title={availability.detail}
              aria-label={availability.detail}
            >
              <span className="status-dot" aria-hidden="true" />
              <span>{availability.label}</span>
            </span>
          </div>
          <div
            className="server-channel-statuses"
            aria-label={t('library.statusFor', { name: profile.name })}
          >
            <ChannelStatus channel="API" presentation={presentation.api} />
            <ChannelStatus
              channel={outputChannel === 'ticker' ? t('nav.ticker') : t('nav.video')}
              presentation={presentation.video}
            />
          </div>
          <div className="server-card-actions">
            <button className="secondary-button" type="button" onClick={() => onEdit(profile.id)}>
              {t('button.edit')}
            </button>
            <button className="primary-button" type="button" onClick={() => onConnect(profile.id)}>
              {t(active ? 'button.disconnect' : snapshot.wanted ? 'button.switch' : 'button.connect')}
            </button>
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
