import React from 'react';

import BrowserSetupEnglish from './docs/browser-setup.en.mdx.js';
import BrowserSetupChinese from './docs/browser-setup.zh-CN.mdx.js';
import {
  DocumentBack,
  type DocumentBackProps,
  HttpAddress,
  type HttpAddressProps,
} from './docs/components';
import UsageGuideEnglish from './docs/usage-guide.en.mdx.js';
import UsageGuideChinese from './docs/usage-guide.zh-CN.mdx.js';

type MdxComponents = {
  DocumentBack: React.ComponentType<Omit<DocumentBackProps, 'onBack'>>;
  HttpAddress: React.ComponentType<Pick<HttpAddressProps, 'copyLabel'>>;
};

type MdxPage = React.ComponentType<{ components: MdxComponents }>;

export function Documentation({
  locale,
  view,
  httpModeAddress,
  onBack,
  onCopyAddress,
}: {
  locale: string;
  view: string;
  httpModeAddress: string;
  onBack: () => void;
  onCopyAddress: () => void | Promise<void>;
}) {
  const chinese = locale === 'zh-CN';
  const UsageGuide = (chinese ? UsageGuideChinese : UsageGuideEnglish) as MdxPage;
  const BrowserSetup = (chinese ? BrowserSetupChinese : BrowserSetupEnglish) as MdxPage;
  const components: MdxComponents = {
    DocumentBack: ({ id, label }: Omit<DocumentBackProps, 'onBack'>) => (
      <DocumentBack id={id} label={label} onBack={onBack} />
    ),
    HttpAddress: ({ copyLabel }: Pick<HttpAddressProps, 'copyLabel'>) => (
      <HttpAddress
        address={httpModeAddress}
        copyLabel={copyLabel}
        onCopy={onCopyAddress}
      />
    ),
  };

  return (
    <>
      <section
        id="usage-guide-page"
        className="document-page"
        aria-label={chinese ? '使用指南' : 'Usage guide'}
        hidden={view !== 'guide'}
      >
        <div id="usage-guide-page-shell" className="document-shell">
          <article id="usage-guide" className="document-article">
            <UsageGuide components={components} />
          </article>
        </div>
      </section>
      <section
        id="browser-setup"
        className="document-page"
        aria-label={chinese ? '浏览器连接设置' : 'Browser connection setup'}
        hidden={view !== 'browser-setup'}
      >
        <div className="document-shell">
          <article className="document-article">
            <BrowserSetup components={components} />
          </article>
        </div>
      </section>
    </>
  );
}
