const CARD_NUMBER_PATTERN = /^[0-9A-F]{16}$/;
const WINDOWS_RESERVED_NAME = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
const INVALID_FILE_NAME_CHARACTERS = /[\u0000-\u001f<>:"/\\|?*]/g;
const MAX_FILE_BASE_CODE_UNITS = 220;
const UTF8_FLAG = 0x0800;
const STORE_METHOD = 0;
const ZIP_VERSION = 20;

export interface BackupCard {
  id: string;
  name: string;
  number: string;
}

export interface CardBackupEntry {
  name: string;
  content: string;
}

interface EncodedZipEntry extends CardBackupEntry {
  crc32: number;
  data: Uint8Array;
  nameBytes: Uint8Array;
  offset: number;
}

const encoder = new TextEncoder();

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1
        ? (value >>> 1) ^ 0xedb88320
        : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of data) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function zipDateTime(date: Date) {
  const validDate = Number.isFinite(date.getTime()) ? date : new Date();
  const year = Math.min(2107, Math.max(1980, validDate.getFullYear()));
  return {
    date: ((year - 1980) << 9) | ((validDate.getMonth() + 1) << 5) | validDate.getDate(),
    time: (validDate.getHours() << 11)
      | (validDate.getMinutes() << 5)
      | Math.floor(validDate.getSeconds() / 2),
  };
}

function safeCardFileBase(name: string, fallback: string) {
  let base = String(name || '').normalize('NFC').trim();
  base = base.replace(/\.txt$/i, '');
  base = base.replace(INVALID_FILE_NAME_CHARACTERS, '_');
  base = base.replace(/[. ]+$/g, '').trim();
  base = base.slice(0, MAX_FILE_BASE_CODE_UNITS).replace(/[\ud800-\udbff]$/i, '');
  base = base.replace(/[. ]+$/g, '').trim();
  if (!base || base === '.' || base === '..') {
    base = fallback;
  }
  if (WINDOWS_RESERVED_NAME.test(base)) {
    base = `${base}_`;
  }
  return base;
}

function uniqueCardFileName(base: string, usedNames: Set<string>) {
  let suffix = 1;
  let fileName = `${base}.txt`;
  while (usedNames.has(fileName.toLocaleLowerCase('en-US'))) {
    suffix += 1;
    fileName = `${base} (${suffix}).txt`;
  }
  usedNames.add(fileName.toLocaleLowerCase('en-US'));
  return fileName;
}

export function cardBackupEntries(cards: readonly BackupCard[]): CardBackupEntry[] {
  const usedNames = new Set<string>();
  return cards.map((card, index) => {
    const content = String(card.number || '').trim().toUpperCase();
    if (!CARD_NUMBER_PATTERN.test(content)) {
      throw new TypeError(`Card ${card.id || index + 1} does not contain a valid card ID`);
    }
    const base = safeCardFileBase(card.name, `card-${index + 1}`);
    return {
      name: uniqueCardFileName(base, usedNames),
      content,
    };
  });
}

function localFileHeader(entry: EncodedZipEntry, date: number, time: number) {
  const header = new Uint8Array(30 + entry.nameBytes.length);
  const view = new DataView(header.buffer);
  writeUint32(view, 0, 0x04034b50);
  writeUint16(view, 4, ZIP_VERSION);
  writeUint16(view, 6, UTF8_FLAG);
  writeUint16(view, 8, STORE_METHOD);
  writeUint16(view, 10, time);
  writeUint16(view, 12, date);
  writeUint32(view, 14, entry.crc32);
  writeUint32(view, 18, entry.data.length);
  writeUint32(view, 22, entry.data.length);
  writeUint16(view, 26, entry.nameBytes.length);
  writeUint16(view, 28, 0);
  header.set(entry.nameBytes, 30);
  return header;
}

function centralDirectoryHeader(entry: EncodedZipEntry, date: number, time: number) {
  const header = new Uint8Array(46 + entry.nameBytes.length);
  const view = new DataView(header.buffer);
  writeUint32(view, 0, 0x02014b50);
  writeUint16(view, 4, ZIP_VERSION);
  writeUint16(view, 6, ZIP_VERSION);
  writeUint16(view, 8, UTF8_FLAG);
  writeUint16(view, 10, STORE_METHOD);
  writeUint16(view, 12, time);
  writeUint16(view, 14, date);
  writeUint32(view, 16, entry.crc32);
  writeUint32(view, 20, entry.data.length);
  writeUint32(view, 24, entry.data.length);
  writeUint16(view, 28, entry.nameBytes.length);
  writeUint16(view, 30, 0);
  writeUint16(view, 32, 0);
  writeUint16(view, 34, 0);
  writeUint16(view, 36, 0);
  writeUint32(view, 38, 0);
  writeUint32(view, 42, entry.offset);
  header.set(entry.nameBytes, 46);
  return header;
}

function endOfCentralDirectory(entryCount: number, size: number, offset: number) {
  const footer = new Uint8Array(22);
  const view = new DataView(footer.buffer);
  writeUint32(view, 0, 0x06054b50);
  writeUint16(view, 4, 0);
  writeUint16(view, 6, 0);
  writeUint16(view, 8, entryCount);
  writeUint16(view, 10, entryCount);
  writeUint32(view, 12, size);
  writeUint32(view, 16, offset);
  writeUint16(view, 20, 0);
  return footer;
}

function concatenate(chunks: readonly Uint8Array[]) {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export function createCardBackupArchive(
  cards: readonly BackupCard[],
  modifiedAt = new Date(),
): ArrayBuffer {
  if (cards.length === 0) {
    throw new TypeError('At least one card is required for backup');
  }
  if (cards.length > 0xffff) {
    throw new RangeError('A ZIP archive cannot contain more than 65535 cards');
  }

  const entries: EncodedZipEntry[] = cardBackupEntries(cards).map((entry) => ({
    ...entry,
    crc32: 0,
    data: encoder.encode(entry.content),
    nameBytes: encoder.encode(entry.name),
    offset: 0,
  }));
  const timestamp = zipDateTime(modifiedAt);
  const localChunks: Uint8Array[] = [];
  let localSize = 0;

  for (const entry of entries) {
    entry.crc32 = crc32(entry.data);
    entry.offset = localSize;
    const header = localFileHeader(entry, timestamp.date, timestamp.time);
    localChunks.push(header, entry.data);
    localSize += header.length + entry.data.length;
  }

  const directoryChunks = entries.map((entry) => (
    centralDirectoryHeader(entry, timestamp.date, timestamp.time)
  ));
  const directorySize = directoryChunks.reduce((total, chunk) => total + chunk.length, 0);
  const archive = concatenate([
    ...localChunks,
    ...directoryChunks,
    endOfCentralDirectory(entries.length, directorySize, localSize),
  ]);
  return archive.buffer as ArrayBuffer;
}

export function cardBackupArchiveName(date = new Date()) {
  const validDate = Number.isFinite(date.getTime()) ? date : new Date();
  const year = String(validDate.getFullYear()).padStart(4, '0');
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  const day = String(validDate.getDate()).padStart(2, '0');
  return `spicefe-card-backup-${year}-${month}-${day}.zip`;
}
