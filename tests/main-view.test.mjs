import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { browseView, configuredProfiles, mainView } from '../public/lib/main-view.js';

const blank = { id: 'draft', host: '' };
const saved = { id: 'saved', host: '192.168.1.20' };

test('keeps one deployable third-party notice and no obsolete EdgeOne config', () => {
  assert.equal(existsSync(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url)), false);
  assert.equal(existsSync(new URL('../public/edgeone.json', import.meta.url)), false);
  assert.equal(existsSync(new URL('../public/THIRD_PARTY_NOTICES.md', import.meta.url)), true);
});

test('a blank first-run draft does not count as a configured server', () => {
  assert.deepEqual(configuredProfiles([blank]), []);
  assert.equal(mainView([blank], { wanted: false }), 'welcome');
});

test('returning and disconnected users see their configured servers', () => {
  assert.deepEqual(configuredProfiles([blank, saved]), [saved]);
  assert.equal(mainView([blank, saved], { wanted: false }), 'servers');
});

test('welcome and server library remain separate browsable pages', () => {
  assert.equal(browseView([saved], 'welcome'), 'welcome');
  assert.equal(browseView([saved], 'servers'), 'servers');
  assert.equal(mainView([saved], { wanted: false }, 'welcome'), 'welcome');
  assert.equal(mainView([saved], { wanted: false }, 'servers'), 'servers');
  assert.equal(mainView([blank], { wanted: false }, 'servers'), 'welcome');
});

test('browser setup remains available with or without saved servers', () => {
  assert.equal(browseView([saved], 'browser-setup'), 'browser-setup');
  assert.equal(mainView([saved], { wanted: false }, 'browser-setup'), 'browser-setup');
  assert.equal(mainView([blank], { wanted: false }, 'browser-setup'), 'browser-setup');
});

test('the combined usage guide remains available with or without saved servers', () => {
  assert.equal(browseView([saved], 'guide'), 'guide');
  assert.equal(mainView([saved], { wanted: false }, 'guide'), 'guide');
  assert.equal(mainView([blank], { wanted: false }, 'guide'), 'guide');
  assert.equal(browseView([saved], 'self-host'), 'guide');
});

test('card management remains available with or without saved servers', () => {
  assert.equal(browseView([saved], 'cards'), 'cards');
  assert.equal(mainView([saved], { wanted: false }, 'cards'), 'cards');
  assert.equal(mainView([blank], { wanted: false }, 'cards'), 'cards');
});

test('connection diagnostics remain on the server list until video is live', () => {
  assert.equal(mainView([saved], {
    wanted: true,
    videoState: 'connecting',
  }, 'servers'), 'servers');
  assert.equal(mainView([saved], {
    wanted: true,
    videoState: 'error',
  }, 'servers'), 'servers');
  assert.equal(mainView([saved], {
    wanted: true,
    videoState: 'live',
  }, 'servers'), 'stream');
  assert.equal(mainView([saved], {
    wanted: true,
    videoState: 'live',
  }, 'welcome'), 'stream');
});

test('ticker profiles remain in the library until their first display value arrives', () => {
  const ticker = { ...saved, tickerEnabled: true };
  assert.equal(mainView([ticker], {
    wanted: true,
    profile: ticker,
    videoState: 'connecting',
  }, 'servers'), 'servers');
  assert.equal(mainView([ticker], {
    wanted: true,
    profile: ticker,
    videoState: 'live',
  }, 'servers'), 'stream');
});

test('the connection editor leaves server selection to the library', () => {
  const markup = readFileSync(
    new URL('../public/index.html', import.meta.url),
    'utf8',
  );
  const script = readFileSync(
    new URL('../src/app.tsx', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(markup, /id="profile-picker"/);
  assert.doesNotMatch(markup, /id="new-profile"/);
  assert.match(
    markup,
    /<footer class="dialog-footer">[\s\S]*id="delete-profile"[^>]*hidden[\s\S]*id="save-profile"/,
  );
  assert.match(script, /delete-profile'\)\.hidden = editingProfileIsNew/);
});

test('the welcome page leads into README showcases while setup has its own page', () => {
  const markup = readFileSync(
    new URL('../public/index.html', import.meta.url),
    'utf8',
  );
  const script = readFileSync(
    new URL('../src/app.tsx', import.meta.url),
    'utf8',
  );

  assert.match(markup, /id="empty-state"[\s\S]*href="#showcase"[\s\S]*id="showcase"/);
  assert.match(markup, /id="usage-guide-page"[^>]*hidden/);
  assert.match(markup, /id="usage-guide-page-link"[^>]*href="\?page=guide"/);
  assert.match(markup, /\.\/assets\/showcase\/server-library\.png/);
  assert.match(markup, /\.\/assets\/showcase\/card-insert\.png/);
  assert.match(markup, /\.\/assets\/showcase\/iidx-16-segment-display\.mp4/);
  assert.match(markup, /id="showcase-stream-carousel"/);
  assert.match(markup, /id="showcase-cards-carousel"/);
  assert.match(
    script,
    /showcaseStream[\s\S]*?iidx-stream\.png[\s\S]*?gitadora-stream\.png/,
  );
  assert.match(
    script,
    /showcaseCards[\s\S]*?card-create\.png[\s\S]*?card-library\.png/,
  );
  assert.match(
    markup,
    /class="showcase-feature-list"[\s\S]*showcase\.streamLabel[\s\S]*showcase\.libraryLabel[\s\S]*showcase\.cardsLabel[\s\S]*showcase\.insertLabel/,
  );
  assert.match(
    markup,
    /class="showcase-video-section"[\s\S]*class="showcase-privacy-section"[\s\S]*href="https:\/\/github\.com\/Avimitin\/spicefe"[\s\S]*class="showcase-cta"/,
  );
  assert.match(
    markup,
    /showcase\.localTitle[\s\S]*showcase\.openTitle[\s\S]*showcase\.creditsTitle[\s\S]*public\/THIRD_PARTY_NOTICES\.md/,
  );
  assert.doesNotMatch(
    markup.slice(markup.indexOf('id="usage-guide-page"'), markup.indexOf('id="server-library"')),
    /setup\.directTitle|setup\.directCopy|setup\.sourceLink/,
  );
  assert.doesNotMatch(markup, /docs\/screenshots\/welcome\.png/);
  assert.match(markup, /id="self-host-guide"/);
  assert.match(script, /self-host-guide-slot'\)\.replaceWith\(selfHostGuide\)/);
});

test('connection entry points expose the usage guide and a clear primary icon', () => {
  const markup = readFileSync(
    new URL('../public/index.html', import.meta.url),
    'utf8',
  );
  const script = readFileSync(
    new URL('../src/app.tsx', import.meta.url),
    'utf8',
  );

  assert.match(
    markup,
    /id="empty-configure"[\s\S]*class="welcome-connect-icon"[\s\S]*data-i18n="home\.configure"/,
  );
  assert.match(
    markup,
    /id="settings-guide-link"[^>]*href="\?page=guide"[\s\S]*data-i18n="settings\.guideLink"[\s\S]*id="profile-name"/,
  );
  assert.match(
    script,
    /settings-guide-link'\)\.addEventListener\('click',[\s\S]*navigateToBrowsePage\('guide'\)/,
  );
});

test('saved servers expose explicit QR export and query restore controls', () => {
  const markup = readFileSync(
    new URL('../public/index.html', import.meta.url),
    'utf8',
  );
  const script = readFileSync(
    new URL('../src/app.tsx', import.meta.url),
    'utf8',
  );
  const components = readFileSync(
    new URL('../src/components.tsx', import.meta.url),
    'utf8',
  );

  assert.match(markup, /id="profile-share-dialog"/);
  assert.match(markup, /id="profile-share-qr"[\s\S]*id="profile-share-link"/);
  assert.match(markup, /id="profile-share-restore"[^>]*hidden/);
  assert.match(
    components,
    /className="server-card-icon-button server-share-button"[\s\S]*onPress=\{\(\) => onShare\(profile\.id\)\}/,
  );
  assert.match(
    script,
    /onShare=\{\(id\) => \{[\s\S]*store\.get\(id\)[\s\S]*openProfileShare\(latestProfile\)/,
  );
  assert.match(
    script,
    /const incomingProfileShare = extractSharedProfile\(location\.href\);[\s\S]*history\.replaceState\(null, '', incomingProfileShare\.cleanPath\)/,
  );
  assert.match(
    script,
    /if \(incomingProfileShare\.profile\) \{[\s\S]*showProfileRestore\(incomingProfileShare\.profile\)/,
  );
  assert.match(script, /profileShareRestore\.addEventListener\('click', restoreSharedProfile\)/);
  assert.doesNotMatch(script, /showProfileRestore\([^)]+\)[\s\S]{0,200}session\.connect/);
});
