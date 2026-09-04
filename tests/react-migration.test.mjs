import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('pins React source packages while Nix supplies compiler binaries', () => {
  const manifest = JSON.parse(read('../package.json'));
  const flake = read('../flake.nix');

  assert.equal(manifest.dependencies.react, '19.2.8');
  assert.equal(manifest.dependencies['react-dom'], '19.2.8');
  assert.equal(manifest.devDependencies['@types/react'], '19.2.18');
  assert.equal(manifest.devDependencies['@types/react-dom'], '19.2.5');
  assert.equal(manifest.devDependencies['@mdx-js/mdx'], '3.1.1');
  assert.equal(manifest.dependencies.esbuild, undefined);
  assert.equal(manifest.devDependencies.esbuild, undefined);
  assert.equal(manifest.dependencies.typescript, undefined);
  assert.equal(manifest.devDependencies.typescript, undefined);
  assert.equal(manifest.dependencies['react-aria-components'], '1.20.0');
  assert.equal(manifest.dependencies['embla-carousel-react'], '8.6.0');
  assert.equal(manifest.dependencies['tailwind-merge'], '3.6.0');
  assert.match(manifest.scripts.build, /npm run typecheck && npm run styles && esbuild src\/app\.tsx/);
  assert.match(manifest.scripts.build, /^node tools\/compile-mdx\.mjs &&/);
  assert.match(manifest.scripts.styles, /tailwindcss -i src\/styles\.css -o public\/assets\/styles\.css --minify/);
  assert.match(flake, /nativeBuildInputs = \[[\s\S]*pkgs\.esbuild[\s\S]*pkgs\.tailwindcss_4[\s\S]*pkgs\.typescript/);
  assert.match(flake, /node_modules\/@mdx-js\/mdx\/package\.json/);
  assert.match(flake, /untitleduico\/react\/d29a2adf6909e5aaeb234bccf82dcffeb67fdb2e/);
});

test('keeps complete locale pages in prose-first MDX', () => {
  const html = read('../public/index.html');
  const app = read('../src/app.tsx');
  const documentation = read('../src/documentation.tsx');
  const components = read('../src/docs/components.tsx');
  const styles = read('../src/styles/application.css');
  const browserSetupEnglish = read('../src/docs/browser-setup.en.mdx');
  const browserSetupChinese = read('../src/docs/browser-setup.zh-CN.mdx');
  const usageGuideEnglish = read('../src/docs/usage-guide.en.mdx');
  const usageGuideChinese = read('../src/docs/usage-guide.zh-CN.mdx');
  const compiler = read('../tools/compile-mdx.mjs');
  const documents = [
    browserSetupEnglish,
    browserSetupChinese,
    usageGuideEnglish,
    usageGuideChinese,
  ];

  assert.match(html, /id="documentation-root"/);
  assert.doesNotMatch(html, /id="usage-guide-page"|id="browser-setup"/);
  assert.match(documentation, /import BrowserSetupEnglish from '\.\/docs\/browser-setup\.en\.mdx\.js'/);
  assert.match(documentation, /import BrowserSetupChinese from '\.\/docs\/browser-setup\.zh-CN\.mdx\.js'/);
  assert.match(documentation, /import UsageGuideEnglish from '\.\/docs\/usage-guide\.en\.mdx\.js'/);
  assert.match(documentation, /import UsageGuideChinese from '\.\/docs\/usage-guide\.zh-CN\.mdx\.js'/);
  assert.match(documentation, /const chinese = locale === 'zh-CN'/);
  assert.match(browserSetupEnglish, /^# Browser connection setup$/m);
  assert.match(browserSetupChinese, /^# 浏览器连接设置$/m);
  assert.match(usageGuideEnglish, /^## 1\. Configure spice2x$/m);
  assert.match(usageGuideChinese, /^## 1\. 配置 spice2x$/m);
  assert.match(usageGuideEnglish, /```text[\s\S]*spice64\.exe -api 1337 -apistream[\s\S]*```/);
  assert.match(usageGuideEnglish, /id="self-host-guide"/);
  for (const source of documents) {
    assert.doesNotMatch(source, /data-i18n|\bmessage=|<T\b/);
    assert.doesNotMatch(source, /platform-guide|browser-guide-card|guide-panel|config-method/);
  }
  assert.match(components, /export function HttpAddress/);
  assert.match(components, /export function DocumentBack/);
  assert.match(styles, /\.document-page\s*\{/);
  assert.match(styles, /\.document-article\s*\{/);
  assert.doesNotMatch(styles, /\.platform-guide|\.browser-guide-card|\.guide-panel|\.config-method/);
  assert.match(app, /<Documentation[\s\S]*locale=\{i18n\.locale\}[\s\S]*view=\{view\}/);
  assert.match(compiler, /compile\(source/);
  assert.match(compiler, /unlink\(resolve\(directory, generatedName\)\)/);
});

test('uses the pinned Untitled UI React foundation for shared controls', () => {
  const button = read('../src/ui/button.tsx');
  const checkbox = read('../src/ui/checkbox.tsx');
  const toggle = read('../src/ui/toggle.tsx');
  const badge = read('../src/ui/status-badge.tsx');
  const carousel = read('../src/ui/carousel.tsx');
  const components = read('../src/components.tsx');
  const app = read('../src/app.tsx');
  const markup = read('../public/index.html');
  const source = read('../public/vendor/untitled-ui/SOURCE.md');

  assert.match(button, /Button as AriaButton/);
  assert.match(checkbox, /Checkbox as AriaCheckbox/);
  assert.match(toggle, /Switch as AriaSwitch/);
  assert.match(toggle, /hint\?: ReactNode/);
  assert.match(toggle, /return \(\s*<div\s+aria-hidden="true"/);
  assert.doesNotMatch(toggle, /<span\s+aria-hidden="true"/);
  assert.match(toggle, /shrink-0 cursor-pointer/);
  assert.match(button, /shadow-xs-skeuomorphic/);
  assert.match(badge, /export function StatusBadge/);
  assert.match(carousel, /useEmblaCarousel/);
  assert.match(carousel, /export const Carousel/);
  assert.match(carousel, /export type CarouselApi/);
  assert.match(components, /<Button[\s\S]*?<Checkbox[\s\S]*?<StatusBadge/);
  assert.match(source, /d29a2adf6909e5aaeb234bccf82dcffeb67fdb2e/);
  assert.match(source, /components\/base\/buttons\/button\.tsx/);
  assert.match(source, /components\/base\/toggle\/toggle\.tsx/);
  assert.match(source, /components\/application\/carousel\/carousel-base\.tsx/);
  assert.match(app, /tickerToggle: createRoot\(tickerToggleRoot\)/);
  assert.match(app, /<Toggle[\s\S]*?label=\{t\('settings\.tickerEnabled'\)\}[\s\S]*?hint=\{t\('settings\.tickerHelp'\)\}/);
  assert.match(markup, /id="ticker-toggle-root"/);
  assert.doesNotMatch(markup, /segment-display-control|segment-display-checkbox/);
  assert.doesNotMatch(source, /does not include React|plain CSS/);
});

test('reinitializes welcome carousels after a hidden library-first start', () => {
  const app = read('../src/app.tsx');
  const components = read('../src/components.tsx');

  assert.match(components, /onApi\?: \(api: CarouselApi\) => void/);
  assert.match(components, /setApi=\{onApi\}/);
  assert.match(
    app,
    /view === 'welcome' && previousView !== 'welcome'[\s\S]*showcaseStreamApi\?\.reInit\(\)[\s\S]*showcaseCardsApi\?\.reInit\(\)/,
  );
});

test('generates a compact stylesheet from maintained source files', () => {
  const entry = read('../src/styles.css');
  const application = read('../src/styles/application.css');
  const generated = read('../public/assets/styles.css');

  assert.match(entry, /@import "tailwindcss" source\(none\)/);
  assert.match(entry, /@import "\.\/styles\/application\.css"/);
  assert.doesNotMatch(entry, /legacy\.css/);
  assert.ok(application.split('\n').length < 7000, 'application CSS should not regain removed duplicate rules');
  assert.ok(generated.length < 130_000, 'generated CSS should remain below the pre-migration size');
});

test('keeps responsive server cards and modal surfaces centered', () => {
  const application = read('../src/styles/application.css');
  const components = read('../src/components.tsx');

  assert.match(application, /\.server-list\s*\{[\s\S]*?columns:\s*5 196px/);
  assert.match(application, /@media \(max-width: 520px\)[\s\S]*?\.server-list\s*\{[\s\S]*?columns:\s*2 156px/);
  assert.match(application, /@container \(max-width: 220px\)/);
  assert.match(
    application,
    /\.server-card-details-backdrop\s*\{[\s\S]*?filter:\s*blur\(12px\) saturate\(0\.9\) brightness\(1\.8\)/,
  );
  assert.match(
    application,
    /\.server-card-details-surface\s*\{[\s\S]*?background:\s*rgba\(229, 238, 246, 0\.62\)/,
  );
  assert.match(application, /\.profile-share-dialog\s*\{[\s\S]*?margin:\s*auto/);
  assert.match(application, /\.card-editor-dialog\s*\{[\s\S]*?margin:\s*auto/);
  assert.match(application, /\.card-import-dialog\s*\{[\s\S]*?margin:\s*auto/);
  assert.match(
    application,
    /\.settings-dialog,\s*\n\.icon-dialog,\s*\n\.confirm-dialog\s*\{[\s\S]*?margin:\s*auto/,
  );
  assert.match(components, /className="server-status-tags"/);
  assert.match(components, /className="server-status-tag/);
  assert.doesNotMatch(components, /server-status-tag bg-black/);
  assert.match(
    application,
    /\.server-card \.server-status-tag\s*\{[\s\S]*?background:\s*#f5f5f5;[\s\S]*?color:\s*#171717;/,
  );
  assert.match(
    application,
    /\.server-card \.server-status-tag > \[aria-hidden="true"\]\s*\{[\s\S]*?box-shadow:\s*none;/,
  );
  assert.match(components, /className="server-address"[\s\S]*?tabIndex=\{0\}[\s\S]*?library\.addressReveal/);
  assert.match(components, /className="server-address-prefix">IP:<\/span>/);
  assert.match(application, /\.server-address-value\s*\{[\s\S]*?filter:\s*blur\(5px\)/);
  assert.match(
    application,
    /\.server-card \.server-address:hover \.server-address-value,[\s\S]*?\.server-card \.server-address:focus \.server-address-value\s*\{[\s\S]*?filter:\s*blur\(0\)/,
  );
  assert.match(
    components,
    /className="server-card-actions"[\s\S]*className="server-card-icon-button server-edit-button"[\s\S]*className="server-card-icon-button server-share-button"/,
  );
  assert.match(
    application,
    /\.server-card \.server-card-actions\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) repeat\(2, 34px\)/,
  );
});

test('type-checks the React migration with strict TypeScript settings', () => {
  const config = JSON.parse(read('../tsconfig.json'));

  assert.equal(config.compilerOptions.strict, true);
  assert.equal(config.compilerOptions.noImplicitAny, true);
  assert.equal(config.compilerOptions.strictNullChecks, true);
  assert.equal(config.compilerOptions.jsx, 'react-jsx');
  assert.equal(config.compilerOptions.noEmit, true);
});

test('React owns the repeated interactive collections', () => {
  const app = read('../src/app.tsx');
  const components = read('../src/components.tsx');

  for (const root of [
    'cardImportList',
    'cardList',
    'cardMenuList',
    'cardPreview',
    'iconGroups',
    'serverList',
    'showcaseCards',
    'showcaseStream',
    'tickerToggle',
  ]) {
    assert.match(app, new RegExp(`${root}: createRoot\\(`));
  }
  for (const component of [
    'CreditCard',
    'GameIconGroups',
    'CardCollection',
    'CardImportOptions',
    'StreamCardList',
    'ServerList',
    'ShowcaseCarousel',
  ]) {
    assert.match(components, new RegExp(`export function ${component}\\(`));
  }
  assert.doesNotMatch(app, /function createServerCard\(/);
  assert.doesNotMatch(app, /function createManagedCard\(/);
  assert.doesNotMatch(app, /function createIconOption\(/);
});

test('keeps connection diagnostics in the server library instead of the streaming topbar', () => {
  const html = read('../public/index.html');
  const app = read('../src/app.tsx');
  const components = read('../src/components.tsx');

  assert.doesNotMatch(html, /id="connection-statuses"/);
  assert.doesNotMatch(html, /id="(?:api|video)-status"/);
  assert.doesNotMatch(app, /element\('connection-statuses'\)/);
  assert.match(components, /className="server-status-tags"/);
  assert.match(components, /<ChannelStatus channel="API"/);
});

test('keeps stream telemetry in the topbar without a bottom control bar', () => {
  const html = read('../public/index.html');
  const app = read('../src/app.tsx');
  const styles = read('../src/styles/application.css');

  assert.match(html, /id="stream-metric" class="topbar-stream-metric"/);
  assert.match(html, /id="video-metric"/);
  assert.match(app, /session\.onmemory =/);
  assert.match(app, /metric\.memory/);
  assert.doesNotMatch(html, /id="stage-hud"|id="hud-show-button"/);
  assert.doesNotMatch(html, /id="view-mode"|id="view-mode-button"/);
  assert.doesNotMatch(app, /setViewMode|dataset\.viewMode|hudDismissed/);
  assert.match(styles, /\.stream-view \{[\s\S]*?object-fit: contain;/);
  assert.doesNotMatch(styles, /stage-hud|data-view-mode/);
});

test('card position controls feed the shared React card renderer', () => {
  const html = read('../public/index.html');
  const app = read('../src/app.tsx');
  const components = read('../src/components.tsx');

  for (const id of [
    'card-eamusement-position',
    'card-konmai-position',
    'card-id-position',
    'card-name-position',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(app, new RegExp(`element\\('${id}'\\)\\.value`));
  }
  assert.match(components, /data-position=\{card\.eAmusementPosition\}/);
  assert.match(components, /data-position=\{card\.konmaiPosition\}/);
  assert.match(components, /data-position=\{card\.cardIdPosition\}/);
  assert.match(components, /data-position=\{card\.namePosition\}/);
});

test('opens new and existing card editing in a dedicated modal', () => {
  const html = read('../public/index.html');
  const app = read('../src/app.tsx');

  assert.match(html, /<dialog id="card-editor-dialog" class="card-editor-dialog"/);
  assert.doesNotMatch(html, /<aside class="card-editor"/);
  assert.match(app, /function showCardEditor\(/);
  assert.match(app, /cardEditorDialog\.showModal\(\)/);
  assert.match(app, /function startNewCard[\s\S]*?showCardEditor\(focus\)/);
  assert.match(app, /function editCard[\s\S]*?showCardEditor\(focus\)/);
});

test('only shows card backup selectors while explicit backup mode is active', () => {
  const app = read('../src/app.tsx');
  const components = read('../src/components.tsx');

  assert.match(app, /let cardBackupMode = false/);
  assert.match(app, /cardBackupAction\(cardBackupMode, selectedCardBackupIds\.size\)/);
  assert.match(app, /exportCardsButton\.addEventListener\('click', handleCardBackupAction\)/);
  assert.match(components, /\{backupMode \? \([\s\S]*?className="managed-card-backup-select"[\s\S]*?\) : null\}/);
});

test('ships React runtime provenance and its complete shared license', () => {
  const source = read('../public/vendor/react/SOURCE.md');
  const license = read('../public/vendor/react/LICENSE.MIT.txt');

  assert.match(source, /react@19\.2\.8/);
  assert.match(source, /react-dom@19\.2\.8/);
  assert.match(source, /scheduler@0\.27\.0/);
  assert.match(license, /Copyright \(c\) Meta Platforms, Inc\. and affiliates\./);
  assert.match(license, /Permission is hereby granted, free of charge/);
});

test('ships provenance for the accessible component runtime', () => {
  const source = read('../public/vendor/react-aria/SOURCE.md');
  const license = read('../public/vendor/react-aria/LICENSE.Apache-2.0.txt');
  const mergeSource = read('../public/vendor/tailwind-merge/SOURCE.md');

  assert.match(source, /react-aria-components@1\.20\.0/);
  assert.match(source, /react-aria@3\.51\.0/);
  assert.match(source, /react-stately@3\.49\.0/);
  assert.match(license, /Apache License[\s\S]*Version 2\.0/);
  assert.match(mergeSource, /tailwind-merge@3\.6\.0/);
});

test('ships provenance and the complete shared license for Embla Carousel', () => {
  const source = read('../public/vendor/embla-carousel/SOURCE.md');
  const license = read('../public/vendor/embla-carousel/LICENSE.MIT.txt');
  const notices = read('../public/THIRD_PARTY_NOTICES.md');

  assert.match(source, /embla-carousel@8\.6\.0/);
  assert.match(source, /embla-carousel-react@8\.6\.0/);
  assert.match(source, /embla-carousel-reactive-utils@8\.6\.0/);
  assert.match(source, /npm integrity/);
  assert.match(license, /Copyright \(c\) David Jerleke\./);
  assert.match(license, /Permission is hereby granted, free of charge/);
  assert.match(notices, /## Embla Carousel/);
});
