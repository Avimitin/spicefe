import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

export type StatusTone = 'gray' | 'warning' | 'success' | 'error';

const tones: Record<StatusTone, { dot: string; root: string }> = {
  gray: {
    root: 'bg-neutral-50 text-neutral-700 ring-neutral-200',
    dot: 'bg-neutral-400 ring-neutral-100',
  },
  warning: {
    root: 'bg-warning-50 text-warning-700 ring-warning-200',
    dot: 'bg-warning-500 ring-warning-200',
  },
  success: {
    root: 'bg-success-50 text-success-700 ring-success-200',
    dot: 'bg-success-500 ring-success-200',
  },
  error: {
    root: 'bg-error-50 text-error-700 ring-error-200',
    dot: 'bg-error-600 ring-error-200',
  },
};

interface StatusBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  children: ReactNode;
  pulse?: boolean;
  tone?: StatusTone;
}

export function StatusBadge({
  children,
  className,
  pulse = false,
  tone = 'gray',
  ...props
}: StatusBadgeProps) {
  return (
    <span
      {...props}
      className={cx(
        'flex size-max items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5',
        'text-xs font-medium ring-1 ring-inset',
        tones[tone].root,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx('size-2 shrink-0 rounded-full ring-3', tones[tone].dot, pulse && 'animate-pulse')}
      />
      {children}
    </span>
  );
}
