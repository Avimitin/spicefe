import React, { useCallback, useEffect, useRef, useState } from 'react';

type ControlKey = 'start' | 'help' | 'test' | 'service';

interface KeypadApi {
  writeKeypad: (keypad: number, key: string) => Promise<unknown>;
  setButton: (name: string, pressed: boolean) => Promise<unknown>;
}

interface KeypadLabels {
  aria: string;
  numberPad: string;
  cabinetControls: string;
  start: string;
  help: string;
  test: string;
  service: string;
  unavailable: string;
}

interface ArcadeKeypadProps {
  api: KeypadApi | null;
  buttonNames: Record<ControlKey, string | null> | null;
  enabled: boolean;
  labels: KeypadLabels;
  onError: (error: unknown) => void;
}

interface KeyProps {
  code: string;
  label: string;
  disabled: boolean;
  unavailableLabel?: string;
  pressed: boolean;
  kind: 'digit' | ControlKey;
  onBegin: (code: string, source: string) => void;
  onEnd: (code: string, source: string) => void;
}

const DIGITS = Object.freeze(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
const CONTROLS: readonly ControlKey[] = Object.freeze(['start', 'help', 'test', 'service']);

function ArcadeKey({
  code,
  label,
  disabled,
  unavailableLabel,
  pressed,
  kind,
  onBegin,
  onEnd,
}: KeyProps) {
  const pointerSource = (pointerId: number) => `pointer:${pointerId}`;
  const keyboardSource = 'keyboard';

  return (
    <button
      type="button"
      className="arcade-keypad-key"
      data-key={code}
      data-kind={kind}
      data-pressed={String(pressed)}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      title={disabled ? unavailableLabel : undefined}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) {
          return;
        }
        event.preventDefault();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Pointer capture is an enhancement; release handlers still cover normal taps.
        }
        onBegin(code, pointerSource(event.pointerId));
      }}
      onPointerUp={(event) => onEnd(code, pointerSource(event.pointerId))}
      onPointerCancel={(event) => onEnd(code, pointerSource(event.pointerId))}
      onLostPointerCapture={(event) => onEnd(code, pointerSource(event.pointerId))}
      onKeyDown={(event) => {
        if (event.key !== ' ' && event.key !== 'Enter') {
          return;
        }
        event.preventDefault();
        if (!event.repeat) {
          onBegin(code, keyboardSource);
        }
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          onEnd(code, keyboardSource);
        }
      }}
      onBlur={() => onEnd(code, keyboardSource)}
    >
      <span className="arcade-keypad-key-highlight" aria-hidden="true" />
      <span className="arcade-keypad-key-label">{label}</span>
    </button>
  );
}

export function ArcadeKeypad({
  api,
  buttonNames,
  enabled,
  labels,
  onError,
}: ArcadeKeypadProps) {
  const [pressed, setPressed] = useState<Set<string>>(() => new Set());
  const activeSources = useRef(new Map<string, string>());
  const pressedRef = useRef(pressed);
  pressedRef.current = pressed;

  const report = useCallback((operation: Promise<unknown>) => {
    void operation.catch(onError);
  }, [onError]);

  const end = useCallback((code: string, source: string, quiet = false) => {
    if (activeSources.current.get(code) !== source) {
      return;
    }
    activeSources.current.delete(code);
    setPressed((current) => {
      const next = new Set(current);
      next.delete(code);
      return next;
    });
    if (!CONTROLS.includes(code as ControlKey) || !api) {
      return;
    }
    const name = buttonNames?.[code as ControlKey];
    if (!name) {
      return;
    }
    const operation = api.setButton(name, false);
    if (quiet) {
      void operation.catch(() => {});
    } else {
      report(operation);
    }
  }, [api, buttonNames, report]);

  const releaseAll = useCallback((quiet = false) => {
    for (const [code, source] of activeSources.current) {
      end(code, source, quiet);
    }
  }, [end]);

  const begin = useCallback((code: string, source: string) => {
    if (!enabled || !api || activeSources.current.has(code)) {
      return;
    }
    activeSources.current.set(code, source);
    setPressed((current) => new Set(current).add(code));

    if (/^\d$/u.test(code)) {
      report(api.writeKeypad(0, code));
      return;
    }

    const name = buttonNames?.[code as ControlKey];
    if (name) {
      report(api.setButton(name, true));
    }
  }, [api, buttonNames, enabled, report]);

  useEffect(() => {
    if (!enabled) {
      releaseAll(true);
    }
  }, [enabled, releaseAll]);

  useEffect(() => {
    const releaseForInterruption = () => {
      if (document.hidden || !document.hasFocus()) {
        releaseAll(true);
      }
    };
    const releasePointer = (event: PointerEvent) => {
      const source = `pointer:${event.pointerId}`;
      for (const [code, activeSource] of activeSources.current) {
        if (activeSource === source) {
          end(code, source);
        }
      }
    };
    window.addEventListener('blur', releaseForInterruption);
    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);
    document.addEventListener('visibilitychange', releaseForInterruption);
    return () => {
      window.removeEventListener('blur', releaseForInterruption);
      window.removeEventListener('pointerup', releasePointer);
      window.removeEventListener('pointercancel', releasePointer);
      document.removeEventListener('visibilitychange', releaseForInterruption);
      releaseAll(true);
    };
  }, [end, releaseAll]);

  return (
    <section className="arcade-keypad" aria-label={labels.aria}>
      <div className="arcade-keypad-deck">
        <div className="arcade-keypad-number-section" role="group" aria-label={labels.numberPad}>
          <div className="arcade-keypad-number-grid">
            {DIGITS.map((digit) => (
              <ArcadeKey
                key={digit}
                code={digit}
                label={digit}
                kind="digit"
                disabled={!enabled}
                pressed={pressed.has(digit)}
                onBegin={begin}
                onEnd={end}
              />
            ))}
          </div>
        </div>

        <div className="arcade-keypad-control-section" role="group" aria-label={labels.cabinetControls}>
          {CONTROLS.map((control) => {
            const available = Boolean(buttonNames?.[control]);
            return (
              <ArcadeKey
                key={control}
                code={control}
                label={labels[control]}
                kind={control}
                disabled={!enabled || !available}
                unavailableLabel={!available ? labels.unavailable : undefined}
                pressed={pressed.has(control)}
                onBegin={begin}
                onEnd={end}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
