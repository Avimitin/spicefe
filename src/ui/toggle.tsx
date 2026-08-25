import type { ReactNode } from 'react';
import {
  Switch as AriaSwitch,
  type SwitchProps as AriaSwitchProps,
} from 'react-aria-components';

import { cx } from './cx';

export type ToggleSize = 'sm' | 'md';

interface ToggleBaseProps {
  className?: string;
  isDisabled?: boolean;
  isFocusVisible?: boolean;
  isHovered?: boolean;
  isSelected?: boolean;
  size?: ToggleSize;
  slim?: boolean;
}

export function ToggleBase({
  className,
  isDisabled,
  isFocusVisible,
  isHovered,
  isSelected,
  size = 'sm',
  slim = false,
}: ToggleBaseProps) {
  const dimensions = slim
    ? {
        sm: { root: 'h-4 w-8', thumb: cx('size-4', isSelected && 'translate-x-4') },
        md: { root: 'h-5 w-10', thumb: cx('size-5', isSelected && 'translate-x-5') },
      }
    : {
        sm: { root: 'h-5 w-9 p-0.5', thumb: cx('size-4', isSelected && 'translate-x-4') },
        md: { root: 'h-6 w-11 p-0.5', thumb: cx('size-5', isSelected && 'translate-x-5') },
      };
  const classes = dimensions[size];

  return (
    <div
      aria-hidden="true"
      className={cx(
        'shrink-0 cursor-pointer rounded-full bg-neutral-200 ring-[0.5px] ring-neutral-300',
        'outline-brand-500 transition duration-150 ease-linear ring-inset',
        isSelected && 'bg-brand-600 ring-brand-600',
        isSelected && isHovered && 'bg-brand-700 ring-brand-700',
        isDisabled && 'cursor-not-allowed opacity-50',
        isFocusVisible && 'outline-2 outline-offset-2',
        slim && 'ring-1',
        classes.root,
        className,
      )}
    >
      <div
        className={cx(
          'block rounded-full bg-white shadow-sm transition-transform duration-150 ease-in-out',
          slim && 'border border-neutral-300 shadow-xs',
          slim && isSelected && 'border-brand-600',
          classes.thumb,
        )}
      />
    </div>
  );
}

const sizes: Record<ToggleSize, { root: string; text: string; label: string; hint: string }> = {
  sm: {
    root: 'gap-2',
    text: '',
    label: 'text-sm font-medium',
    hint: 'text-sm',
  },
  md: {
    root: 'gap-3',
    text: 'gap-0.5',
    label: 'text-md font-medium',
    hint: 'text-md',
  },
};

export interface ToggleProps extends Omit<AriaSwitchProps, 'children'> {
  hint?: ReactNode;
  label?: ReactNode;
  size?: ToggleSize;
  slim?: boolean;
}

/** Untitled UI React's labeled toggle, narrowed to spicefe's local tokens. */
export function Toggle({
  className,
  hint,
  label,
  size = 'sm',
  slim = false,
  ...props
}: ToggleProps) {
  return (
    <AriaSwitch
      {...props}
      className={(state) => cx(
        'relative flex w-max items-start outline-none',
        state.isDisabled && 'cursor-not-allowed',
        sizes[size].root,
        typeof className === 'function' ? className(state) : className,
      )}
    >
      {({ isDisabled, isFocusVisible, isHovered, isSelected }) => (
        <>
          <ToggleBase
            slim={slim}
            size={size}
            isDisabled={isDisabled}
            isFocusVisible={isFocusVisible}
            isHovered={isHovered}
            isSelected={isSelected}
            className={slim ? 'mt-0.5' : undefined}
          />
          {label || hint ? (
            <span className={cx('flex min-w-0 flex-col', sizes[size].text)}>
              {label ? (
                <span className={cx('text-neutral-700 select-none', sizes[size].label)}>
                  {label}
                </span>
              ) : null}
              {hint ? (
                <span
                  className={cx('text-neutral-500', sizes[size].hint)}
                  onClick={(event) => event.stopPropagation()}
                >
                  {hint}
                </span>
              ) : null}
            </span>
          ) : null}
        </>
      )}
    </AriaSwitch>
  );
}
