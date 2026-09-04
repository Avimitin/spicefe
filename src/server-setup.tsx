import React, { useMemo, useRef, useState } from 'react';

import {
  nextServerSetupStep,
  previousServerSetupStep,
  serverSetupSequence,
} from '../public/lib/server-setup.js';

type SetupStep = 'address' | 'icon' | 'style' | 'stream' | 'name';
export type ServerSetupStyle = 'video' | 'ticker' | 'keypad';

type Translate = (key: string, parameters?: Record<string, unknown>) => string;

interface SetupProfile {
  host: string;
  apiPort: number;
  password: string;
  iconId: string;
  name: string;
  format: string;
  screen: string;
  fps: number;
  quality: number;
  tickerEnabled: boolean;
  keypadEnabled: boolean;
}

interface SetupIcon {
  id: string;
  label: string;
  src: string;
}

interface SetupIconGroup {
  id: string;
  icons: readonly SetupIcon[];
}

export interface ServerSetupDraft {
  host: string;
  apiPort: number;
  password: string;
  iconId: string;
  style: ServerSetupStyle;
  format: string;
  screen: string;
  fps: number;
  quality: number;
  name: string;
  apiVerified: boolean;
}

interface AddressCheckResult {
  ok: boolean;
  message?: string;
}

interface ServerSetupProps {
  initialProfile: SetupProfile;
  iconGroups: readonly SetupIconGroup[];
  t: Translate;
  onCheckAddress: (address: { host: string; apiPort: number; password: string }) => Promise<AddressCheckResult>;
  onComplete: (draft: ServerSetupDraft) => void;
  onCancel: () => void;
}

const OUTPUT_STYLE_KEYS = Object.freeze({
  video: Object.freeze({
    title: 'setup.styleVideoTitle',
    copy: 'setup.styleVideoCopy',
  }),
  ticker: Object.freeze({
    title: 'setup.styleTickerTitle',
    copy: 'setup.styleTickerCopy',
  }),
  keypad: Object.freeze({
    title: 'setup.styleKeypadTitle',
    copy: 'setup.styleKeypadCopy',
  }),
});

function ArrowLeft() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m15 18-6-6 6-6M9 12h10" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m5 5 14 14M19 5 5 19" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m5 12 4.2 4.2L19 6.5" />
    </svg>
  );
}

function OutputIcon({ style }: { style: ServerSetupStyle }) {
  if (style === 'ticker') {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32">
        <rect x="3.5" y="7" width="25" height="18" rx="3" />
        <path d="M8 12h3M13 12h3M18 12h3M23 12h1M8 16h3M13 16h3M18 16h3M23 16h1M8 20h3M13 20h3M18 20h3M23 20h1" />
      </svg>
    );
  }
  if (style === 'keypad') {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32">
        <rect x="5" y="3.5" width="22" height="25" rx="4" />
        <path d="M10 9h3M15 9h3M20 9h3M10 14h3M15 14h3M20 14h3M10 19h3M15 19h3M20 19h3M15 24h3" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32">
      <rect x="3.5" y="5" width="25" height="18" rx="3" />
      <path d="M11 27h10M16 23v4M9 11h14M9 15h9" />
    </svg>
  );
}

function WizardHeader({
  step,
  style,
  title,
  t,
  onBack,
  onCancel,
}: {
  step: SetupStep;
  style: ServerSetupStyle;
  title: string;
  t: Translate;
  onBack: () => void;
  onCancel: () => void;
}) {
  const sequence = serverSetupSequence(style);
  const position = Math.max(0, sequence.indexOf(step)) + 1;
  return (
    <header className="server-setup-header">
      <button className="server-setup-back" type="button" onClick={onBack}>
        <ArrowLeft />
        <span>{t('setup.back')}</span>
      </button>
      <div className="server-setup-heading">
        <span>{t('setup.progress', { current: position, total: sequence.length })}</span>
        <h2 id="server-setup-title">{title}</h2>
      </div>
      <button
        className="icon-button"
        type="button"
        aria-label={t('setup.close')}
        onClick={onCancel}
      >
        <CloseIcon />
      </button>
    </header>
  );
}

function BackButton({ t, onBack }: { t: Translate; onBack: () => void }) {
  return (
    <button className="secondary-button" type="button" onClick={onBack}>
      <ArrowLeft />
      {t('setup.back')}
    </button>
  );
}

export function ServerSetupWizard({
  initialProfile,
  iconGroups,
  t,
  onCheckAddress,
  onComplete,
  onCancel,
}: ServerSetupProps) {
  const initialStyle: ServerSetupStyle = initialProfile.keypadEnabled
    ? 'keypad'
    : initialProfile.tickerEnabled ? 'ticker' : 'video';
  const [step, setStep] = useState<SetupStep>('address');
  const [host, setHost] = useState(initialProfile.host);
  const [apiPort, setApiPort] = useState(String(initialProfile.apiPort));
  const [password, setPassword] = useState(initialProfile.password);
  const [iconId, setIconId] = useState(initialProfile.iconId);
  const [style, setStyle] = useState<ServerSetupStyle>(initialStyle);
  const [format, setFormat] = useState(initialProfile.format);
  const [screen, setScreen] = useState(initialProfile.screen);
  const [fps, setFps] = useState(String(initialProfile.fps));
  const [quality, setQuality] = useState(String(initialProfile.quality));
  const [name, setName] = useState(initialProfile.name);
  const [connectionState, setConnectionState] = useState<'idle' | 'checking' | 'failed'>('idle');
  const [connectionError, setConnectionError] = useState('');
  const [apiVerified, setApiVerified] = useState(false);
  const checkAttempt = useRef(0);
  const nameInput = useRef<HTMLInputElement>(null);

  const allIcons = useMemo(
    () => iconGroups.flatMap((group) => group.icons),
    [iconGroups],
  );
  const selectedIcon = allIcons.find((icon) => icon.id === iconId) ?? allIcons[0];

  const stepTitles: Record<SetupStep, string> = {
    address: t('setup.addressTitle'),
    icon: t('setup.iconTitle'),
    style: t('setup.styleTitle'),
    stream: t('setup.streamTitle'),
    name: t('setup.nameTitle'),
  };

  const cancel = () => {
    checkAttempt.current += 1;
    onCancel();
  };

  const goBack = () => {
    checkAttempt.current += 1;
    const previous = previousServerSetupStep(step, style) as SetupStep | null;
    if (previous) {
      setStep(previous);
    } else {
      onCancel();
    }
  };

  const testAddress = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) {
      return;
    }
    const attempt = checkAttempt.current + 1;
    checkAttempt.current = attempt;
    setConnectionState('checking');
    setConnectionError('');
    let result: AddressCheckResult;
    try {
      result = await onCheckAddress({
        host: host.trim(),
        apiPort: Number(apiPort),
        password,
      });
    } catch {
      result = { ok: false, message: t('setup.connectionFailedCopy') };
    }
    if (checkAttempt.current !== attempt) {
      return;
    }
    if (result.ok) {
      setApiVerified(true);
      setConnectionState('idle');
      setStep('icon');
      return;
    }
    setConnectionState('failed');
    setApiVerified(false);
    setConnectionError(result.message || t('setup.connectionFailedCopy'));
  };

  const chooseStyle = (nextStyle: ServerSetupStyle) => {
    setStyle(nextStyle);
    const next = nextServerSetupStep('style', nextStyle) as SetupStep | null;
    if (next) {
      setStep(next);
    }
  };

  const finish = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    nameInput.current?.setCustomValidity(name.trim() ? '' : t('setup.nameRequired'));
    if (!event.currentTarget.reportValidity()) {
      return;
    }
    onComplete({
      host: host.trim(),
      apiPort: Number(apiPort),
      password,
      iconId,
      style,
      format,
      screen,
      fps: Number(fps),
      quality: Number(quality),
      name: name.trim(),
      apiVerified,
    });
  };

  return (
    <div className="server-setup-wizard" data-step={step}>
      <WizardHeader
        step={step}
        style={style}
        title={stepTitles[step]}
        t={t}
        onBack={goBack}
        onCancel={cancel}
      />

      {step === 'address' && (
        <form
          className="server-setup-form"
          aria-busy={connectionState === 'checking'}
          onSubmit={testAddress}
        >
          <div className="server-setup-body server-setup-address-body">
            <p className="server-setup-intro">{t('setup.addressCopy')}</p>
            <div className="server-setup-address-grid">
              <label className="field server-setup-host-field">
                <span>{t('settings.host')}</span>
                <input
                  value={host}
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  autoFocus
                  disabled={connectionState === 'checking'}
                  placeholder="192.168.1.100"
                  onChange={(event) => {
                    setHost(event.target.value);
                    setApiVerified(false);
                  }}
                />
                <small>{t('settings.hostHelp')}</small>
              </label>
              <label className="field server-setup-port-field">
                <span>{t('settings.apiPort')}</span>
                <input
                  value={apiPort}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="65533"
                  required
                  disabled={connectionState === 'checking'}
                  onChange={(event) => {
                    setApiPort(event.target.value);
                    setApiVerified(false);
                  }}
                />
              </label>
              <label className="field server-setup-password-field">
                <span>{t('settings.password')}</span>
                <input
                  value={password}
                  type="password"
                  autoComplete="off"
                  disabled={connectionState === 'checking'}
                  placeholder={t('settings.passwordPlaceholder')}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setApiVerified(false);
                  }}
                />
                <small>{t('setup.passwordHelp')}</small>
              </label>
            </div>
            {connectionState === 'failed' && (
              <div className="server-setup-error" role="alert">
                <span className="server-setup-error-icon" aria-hidden="true">!</span>
                <div>
                  <strong>{t('setup.connectionFailedTitle')}</strong>
                  <p>{connectionError}</p>
                </div>
              </div>
            )}
          </div>
          <footer className="server-setup-footer">
            <button className="secondary-button" type="button" onClick={cancel}>
              {t('button.cancel')}
            </button>
            <div className="server-setup-footer-actions">
              {connectionState === 'failed' && (
                <button className="secondary-button" type="button" onClick={() => setStep('icon')}>
                  {t('setup.forceSave')}
                </button>
              )}
              <button className="primary-button" type="submit" disabled={connectionState === 'checking'}>
                {connectionState === 'checking' && <span className="button-spinner" aria-hidden="true" />}
                {t(connectionState === 'checking' ? 'setup.testing' : connectionState === 'failed'
                  ? 'setup.tryAgain'
                  : 'setup.testConnection')}
              </button>
            </div>
          </footer>
        </form>
      )}

      {step === 'icon' && (
        <form
          className="server-setup-form"
          onSubmit={(event) => {
            event.preventDefault();
            setStep('style');
          }}
        >
          <div className="server-setup-body server-setup-icon-body">
            <p className="server-setup-intro">{t('setup.iconCopy')}</p>
            <div className="server-setup-icon-groups" role="listbox" aria-label={t('icon.groupsAria')}>
              {iconGroups.map((group) => (
                <section className="server-setup-icon-category" key={group.id} role="group" aria-labelledby={`setup-icon-${group.id}`}>
                  <h3 id={`setup-icon-${group.id}`}>{t(`icon.group.${group.id}`)}</h3>
                  <div className="server-setup-icon-grid">
                    {group.icons.map((icon) => (
                      <button
                        className="server-setup-icon-option"
                        type="button"
                        key={icon.id}
                        role="option"
                        aria-selected={icon.id === iconId}
                        title={icon.label}
                        onClick={() => setIconId(icon.id)}
                      >
                        <img src={icon.src} alt="" loading="lazy" decoding="async" />
                        <span>{icon.label}</span>
                        <span className="server-setup-icon-check" aria-hidden="true"><CheckIcon /></span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
          <footer className="server-setup-footer">
            <BackButton t={t} onBack={goBack} />
            <button className="primary-button" type="submit">{t('setup.continue')}</button>
          </footer>
        </form>
      )}

      {step === 'style' && (
        <div className="server-setup-form">
          <div className="server-setup-body server-setup-style-body">
            <p className="server-setup-intro">{t('setup.styleCopy')}</p>
            <div className="server-setup-style-grid" role="radiogroup" aria-label={t('setup.styleTitle')}>
              {(['video', 'ticker', 'keypad'] as const).map((outputStyle) => (
                <button
                  key={outputStyle}
                  className="server-setup-style-option"
                  type="button"
                  role="radio"
                  aria-checked={style === outputStyle}
                  data-style={outputStyle}
                  onClick={() => chooseStyle(outputStyle)}
                >
                  <span className="server-setup-style-icon"><OutputIcon style={outputStyle} /></span>
                  <strong>{t(OUTPUT_STYLE_KEYS[outputStyle].title)}</strong>
                  <span>{t(OUTPUT_STYLE_KEYS[outputStyle].copy)}</span>
                  <span className="server-setup-style-arrow" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </div>
          <footer className="server-setup-footer">
            <BackButton t={t} onBack={goBack} />
            <span className="server-setup-selection-hint">{t('setup.styleHint')}</span>
          </footer>
        </div>
      )}

      {step === 'stream' && (
        <form
          className="server-setup-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (event.currentTarget.reportValidity()) {
              setStep('name');
            }
          }}
        >
          <div className="server-setup-body">
            <p className="server-setup-intro">{t('setup.streamCopy')}</p>
            <div className="server-setup-stream-grid">
              <label className="field">
                <span>{t('settings.format')}</span>
                <select value={format} onChange={(event) => setFormat(event.target.value)} autoFocus>
                  <option value="auto">{t('settings.formatAuto')}</option>
                  <option value="h264">{t('settings.formatH264')}</option>
                  <option value="mjpg">MJPEG</option>
                </select>
              </label>
              <label className="field">
                <span>{t('settings.screen')}</span>
                <select value={screen} onChange={(event) => setScreen(event.target.value)}>
                  <option value="">{t('settings.screenAuto')}</option>
                  {[0, 1, 2, 3].map((number) => (
                    <option key={number} value={number}>{t('settings.screenNumber', { screen: number })}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t('settings.fps')}</span>
                <input value={fps} type="number" inputMode="numeric" min="1" max="60" required onChange={(event) => setFps(event.target.value)} />
              </label>
              <label className="field">
                <span>{t('settings.quality')}</span>
                <input value={quality} type="number" inputMode="numeric" min="1" max="100" required onChange={(event) => setQuality(event.target.value)} />
              </label>
            </div>
          </div>
          <footer className="server-setup-footer">
            <BackButton t={t} onBack={goBack} />
            <button className="primary-button" type="submit">{t('setup.continue')}</button>
          </footer>
        </form>
      )}

      {step === 'name' && (
        <form className="server-setup-form" onSubmit={finish}>
          <div className="server-setup-body server-setup-name-body">
            <p className="server-setup-intro">{t('setup.nameCopy')}</p>
            <div className="server-setup-summary" aria-label={t('setup.summary')}>
              {selectedIcon && <img src={selectedIcon.src} alt="" />}
              <div>
                <strong>{host}</strong>
                <span>{t(OUTPUT_STYLE_KEYS[style].title)}</span>
              </div>
            </div>
            <label className="field server-setup-name-field">
              <span>{t('setup.serverName')}</span>
              <input
                ref={nameInput}
                value={name}
                type="text"
                maxLength={48}
                required
                autoFocus
                placeholder={t('settings.profilePlaceholder')}
                onChange={(event) => {
                  nameInput.current?.setCustomValidity('');
                  setName(event.target.value);
                }}
              />
            </label>
          </div>
          <footer className="server-setup-footer">
            <BackButton t={t} onBack={goBack} />
            <button className="primary-button" type="submit">{t('setup.saveServer')}</button>
          </footer>
        </form>
      )}
    </div>
  );
}
