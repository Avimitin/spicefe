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
  assert.match(manifest.scripts.build, /npm run typecheck && esbuild src\/app\.tsx/);
  assert.match(flake, /nativeBuildInputs = \[[\s\S]*pkgs\.esbuild[\s\S]*pkgs\.typescript/);
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
  assert.match(components, /className="server-channel-statuses"/);
  assert.match(components, /<ChannelStatus channel="API"/);
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
