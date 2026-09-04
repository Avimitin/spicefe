import React from 'react';

type TranslatedProps = {
  as?: React.ElementType;
  children?: React.ReactNode;
  message: string;
  [attribute: string]: unknown;
};

/**
 * Keeps an English fallback beside the document structure while exposing the
 * existing translation key to the app's locale updater.
 */
export function T({
  as: Component = 'span',
  message,
  children,
  ...props
}: TranslatedProps) {
  return (
    <Component {...props} data-i18n={message}>
      {children}
    </Component>
  );
}
