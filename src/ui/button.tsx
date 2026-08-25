import type { ReactNode } from 'react';
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from 'react-aria-components';

import { cx } from './cx';

export type ButtonColor =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'primary-destructive'
  | 'secondary-destructive';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const common = [
  'group relative inline-flex h-max cursor-pointer items-center justify-center whitespace-nowrap',
  'outline-brand-500 transition duration-100 ease-linear before:absolute',
  'focus-visible:outline-2 focus-visible:outline-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
  '*:data-icon:pointer-events-none *:data-icon:size-5 *:data-icon:shrink-0',
].join(' ');

const sizes: Record<ButtonSize, string> = {
  xs: 'gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold before:rounded-[7px] data-[icon-only]:p-2 *:data-icon:size-4',
  sm: 'gap-1 rounded-lg px-3 py-2 text-sm font-semibold before:rounded-[7px] data-[icon-only]:p-2',
  md: 'gap-1 rounded-lg px-3.5 py-2.5 text-sm font-semibold before:rounded-[7px] data-[icon-only]:p-2.5',
  lg: 'gap-1.5 rounded-lg px-4 py-2.5 text-md font-semibold before:rounded-[7px] data-[icon-only]:p-3',
};

const colors: Record<ButtonColor, string> = {
  primary: [
    'bg-brand-600 text-white shadow-xs-skeuomorphic ring-1 ring-transparent ring-inset',
    'hover:bg-brand-700 data-[pressed]:bg-brand-700',
    'before:inset-px before:border before:border-white/12',
    '*:data-icon:text-white/70',
  ].join(' '),
  secondary: [
    'bg-white text-neutral-700 shadow-xs-skeuomorphic ring-1 ring-neutral-300 ring-inset',
    'hover:bg-neutral-50 hover:text-neutral-800 data-[pressed]:bg-neutral-100',
    '*:data-icon:text-neutral-400 hover:*:data-icon:text-neutral-500',
  ].join(' '),
  tertiary: [
    'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-700 data-[pressed]:bg-neutral-100',
    '*:data-icon:text-neutral-400 hover:*:data-icon:text-neutral-500',
  ].join(' '),
  'primary-destructive': [
    'bg-error-600 text-white shadow-xs-skeuomorphic ring-1 ring-transparent ring-inset',
    'outline-error-600 hover:bg-error-700 data-[pressed]:bg-error-700',
    'before:inset-px before:border before:border-white/12',
  ].join(' '),
  'secondary-destructive': [
    'bg-white text-error-700 shadow-xs ring-1 ring-error-200 ring-inset',
    'outline-error-600 hover:bg-error-50 data-[pressed]:bg-error-50',
  ].join(' '),
};

export interface ButtonProps extends Omit<AriaButtonProps, 'children' | 'className'> {
  children?: ReactNode;
  className?: string;
  color?: ButtonColor;
  iconLeading?: ReactNode;
  iconTrailing?: ReactNode;
  size?: ButtonSize;
  title?: string;
}

/**
 * Untitled UI React button, adapted from the MIT-licensed upstream component
 * pinned in flake.nix. React Aria owns interaction and accessibility state;
 * this project only narrows the variants to those spicefe uses.
 */
export function Button({
  children,
  className,
  color = 'primary',
  iconLeading,
  iconTrailing,
  size = 'sm',
  type = 'button',
  ...props
}: ButtonProps) {
  const iconOnly = Boolean((iconLeading || iconTrailing) && !children);
  return (
    <AriaButton
      {...props}
      type={type}
      data-icon-only={iconOnly || undefined}
      className={cx(common, sizes[size], colors[color], className)}
    >
      {iconLeading ? <span data-icon="leading">{iconLeading}</span> : null}
      {children ? <span data-text className="px-0.5 transition-inherit-all">{children}</span> : null}
      {iconTrailing ? <span data-icon="trailing">{iconTrailing}</span> : null}
    </AriaButton>
  );
}
