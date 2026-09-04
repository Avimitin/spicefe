import React from 'react';

export interface HttpAddressProps {
  address: string;
  copyLabel: string;
  onCopy: () => void | Promise<void>;
}

export function HttpAddress({ address, copyLabel, onCopy }: HttpAddressProps) {
  return (
    <div className="document-address">
      <code id="http-mode-url">{address}</code>
      <button
        id="copy-http-url"
        className="secondary-button"
        type="button"
        onClick={onCopy}
      >
        {copyLabel}
      </button>
    </div>
  );
}

export interface DocumentBackProps {
  id?: string;
  label: string;
  onBack: () => void;
}

export function DocumentBack({ id, label, onBack }: DocumentBackProps) {
  return (
    <div className="document-actions">
      <button id={id} className="primary-button" type="button" onClick={onBack}>
        {label}
      </button>
    </div>
  );
}
