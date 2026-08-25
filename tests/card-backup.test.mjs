import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cardBackupArchiveName,
  cardBackupEntries,
  createCardBackupArchive,
} from '../src/card-backup.ts';

const decoder = new TextDecoder();

function readStoredZip(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const footerOffset = bytes.length - 22;
  assert.equal(view.getUint32(footerOffset, true), 0x06054b50);
  const entryCount = view.getUint16(footerOffset + 10, true);
  let directoryOffset = view.getUint32(footerOffset + 16, true);
  const entries = [];

  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(view.getUint32(directoryOffset, true), 0x02014b50);
    assert.equal(view.getUint16(directoryOffset + 10, true), 0);
    const dataSize = view.getUint32(directoryOffset + 24, true);
    const nameSize = view.getUint16(directoryOffset + 28, true);
    const extraSize = view.getUint16(directoryOffset + 30, true);
    const commentSize = view.getUint16(directoryOffset + 32, true);
    const localOffset = view.getUint32(directoryOffset + 42, true);
    const name = decoder.decode(bytes.subarray(
      directoryOffset + 46,
      directoryOffset + 46 + nameSize,
    ));

    assert.equal(view.getUint32(localOffset, true), 0x04034b50);
    assert.equal(view.getUint16(localOffset + 8, true), 0);
    const localNameSize = view.getUint16(localOffset + 26, true);
    const localExtraSize = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameSize + localExtraSize;
    entries.push({
      name,
      content: decoder.decode(bytes.subarray(dataOffset, dataOffset + dataSize)),
    });
    directoryOffset += 46 + nameSize + extraSize + commentSize;
  }

  return entries;
}

const card = (id, name, number) => ({ id, name, number });

test('creates safe spice2x text file names without duplicating the extension', () => {
  const entries = cardBackupEntries([
    card('one', 'Main card', 'E004010000000001'),
    card('two', 'card0.txt', 'E004010000000002'),
    card('three', 'A/B:C*', 'E004010000000003'),
    card('four', 'MAIN CARD', 'E004010000000004'),
    card('five', '', 'E004010000000005'),
    card('six', 'CON', 'E004010000000006'),
    card('seven', '主卡', 'E004010000000007'),
  ]);

  assert.deepEqual(entries.map((entry) => entry.name), [
    'Main card.txt',
    'card0.txt',
    'A_B_C_.txt',
    'MAIN CARD (2).txt',
    'card-5.txt',
    'CON_.txt',
    '主卡.txt',
  ]);
});

test('bounds long card names for extraction on Windows', () => {
  const [entry] = cardBackupEntries([
    card('long', 'A'.repeat(256), 'E004010000000008'),
  ]);

  assert.equal(entry.name, `${'A'.repeat(220)}.txt`);
});

test('packs each selected card as one uncompressed UTF-8 file containing only its ID', () => {
  const cards = [
    card('one', 'P1', 'e00401000000abcd'),
    card('two', '玩家二', 'E004010000001234'),
  ];
  const archive = createCardBackupArchive(cards, new Date(2026, 7, 25, 12, 34, 56));

  assert.deepEqual(readStoredZip(archive), [
    { name: 'P1.txt', content: 'E00401000000ABCD' },
    { name: '玩家二.txt', content: 'E004010000001234' },
  ]);
});

test('rejects empty backups and malformed card IDs', () => {
  assert.throws(() => createCardBackupArchive([]), /At least one card/);
  assert.throws(
    () => createCardBackupArchive([card('bad', 'Bad card', 'not-a-card')]),
    /valid card ID/,
  );
});

test('uses a stable dated backup archive name', () => {
  assert.equal(
    cardBackupArchiveName(new Date(2026, 7, 25, 12, 0, 0)),
    'spicefe-card-backup-2026-08-25.zip',
  );
});
