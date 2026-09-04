import React from 'react';

import BrowserSetup from './docs/browser-setup.mdx.js';
import UsageGuide from './docs/usage-guide.mdx.js';

export function Documentation() {
  return (
    <>
      <UsageGuide />
      <BrowserSetup />
    </>
  );
}
