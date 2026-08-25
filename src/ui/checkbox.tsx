import type { ReactNode } from 'react';
import {
  Checkbox as AriaCheckbox,
  type CheckboxProps as AriaCheckboxProps,
} from 'react-aria-components';

import { cx } from './cx';

export interface CheckboxProps extends Omit<AriaCheckboxProps, 'children' | 'className'> {
  children?: ReactNode;
  className?: string;
  hint?: ReactNode;
  label?: ReactNode;
}

/** A compact adaptation of Untitled UI React's MIT-licensed checkbox. */
export function Checkbox({ children, className, hint, label, ...props }: CheckboxProps) {
  return (
    <AriaCheckbox
      {...props}
      className={({ isDisabled }) => cx(
        'group flex cursor-pointer items-start gap-2 text-sm text-neutral-700 outline-none',
        isDisabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      {({ isFocusVisible, isSelected }) => (
        <>
          <span
            aria-hidden="true"
            className={cx(
              'relative mt-0.5 flex size-4 shrink-0 items-center justify-center rounded bg-white',
              'ring-1 ring-neutral-300 ring-inset transition duration-100',
              isSelected && 'bg-brand-600 ring-brand-600',
              isFocusVisible && 'outline-2 outline-offset-2 outline-brand-500',
            )}
          >
            <svg
              viewBox="0 0 14 14"
              fill="none"
              className={cx('size-3 text-white opacity-0', isSelected && 'opacity-100')}
            >
              <path
                d="M11.667 3.5 5.25 9.917 2.333 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          {children || label || hint ? (
            children || (
            <span className="inline-flex min-w-0 flex-col">
              {label ? <span className="font-medium select-none">{label}</span> : null}
              {hint ? <span className="text-neutral-500">{hint}</span> : null}
            </span>
            )
          ) : null}
        </>
      )}
    </AriaCheckbox>
  );
}
