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
  assert.equal(manifest.dependencies.esbuild, undefined);
  assert.equal(manifest.devDependencies.esbuild, undefined);
  assert.equal(manifest.dependencies.typescript, undefined);
  assert.equal(manifest.devDependencies.typescript, undefined);
  assert.equal(manifest.dependencies['react-aria-components'], '1.20.0');
  assert.equal(manifest.dependencies['tailwind-merge'], '3.6.0');
  assert.match(manifest.scripts.build, /npm run typecheck && npm run styles && esbuild src\/app\.tsx/);
  assert.match(manifest.scripts.styles, /tailwindcss -i src\/styles\.css -o public\/assets\/styles\.css --minify/);
  assert.match(flake, /nativeBuildInputs = \[[\s\S]*pkgs\.esbuild[\s\S]*pkgs\.tailwindcss_4[\s\S]*pkgs\.typescript/);
  assert.match(flake, /untitleduico\/react\/d29a2adf6909e5aaeb234bccf82dcffeb67fdb2e/);
});

test('uses the pinned Untitled UI React foundation for shared controls', () => {
  const button = read('../src/ui/button.tsx');
  const checkbox = read('../src/ui/checkbox.tsx');
  const toggle = read('../src/ui/toggle.tsx');
  const badge = read('../src/ui/status-badge.tsx');
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
  assert.match(components, /<Button[\s\S]*?<Checkbox[\s\S]*?<StatusBadge/);
  assert.match(source, /d29a2adf6909e5aaeb234bccf82dcffeb67fdb2e/);
  assert.match(source, /components\/base\/buttons\/button\.tsx/);
  assert.match(source, /components\/base\/toggle\/toggle\.tsx/);
  assert.match(app, /tickerToggle: createRoot\(tickerToggleRoot\)/);
  assert.match(app, /<Toggle[\s\S]*?label=\{t\('settings\.tickerEnabled'\)\}[\s\S]*?hint=\{t\('settings\.tickerHelp'\)\}/);
  assert.match(markup, /id="ticker-toggle-root"/);
  assert.doesNotMatch(markup, /segment-display-control|segment-display-checkbox/);
  assert.doesNotMatch(source, /does not include React|plain CSS/);
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
  assert.match(application, /\.profile-share-dialog\s*\{[\s\S]*?margin:\s*auto/);
  assert.match(application, /\.card-editor-dialog\s*\{[\s\S]*?margin:\s*auto/);
  assert.match(application, /\.card-import-dialog\s*\{[\s\S]*?margin:\s*auto/);
  assert.match(
    application,
    /\.settings-dialog,\s*\n\.icon-dialog,\s*\n\.confirm-dialog\s*\{[\s\S]*?margin:\s*auto/,
  );
  assert.match(components, /className="server-status-tags"/);
  assert.match(components, /className="server-status-tag/);
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
