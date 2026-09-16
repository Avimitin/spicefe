export const NAL_TYPE = Object.freeze({
  SLICE: 1,
  IDR: 5,
  SPS: 7,
  PPS: 8,
});

export function firstMacroblockInSlice(nal) {
  const type = nal instanceof Uint8Array && nal.length > 0 ? nal[0] & 0x1f : 0;
  if (type !== NAL_TYPE.SLICE && type !== NAL_TYPE.IDR) {
    throw new Error('Invalid H.264 slice NAL unit');
  }

  let byteOffset = 1;
  let currentByte = 0;
  let remainingBits = 0;
  let zeroCount = 0;
  const readByte = () => {
    while (byteOffset < nal.length) {
      const byte = nal[byteOffset];
      byteOffset += 1;
      if (zeroCount >= 2 && byte === 0x03
        && byteOffset < nal.length && nal[byteOffset] <= 0x03) {
        continue;
      }
      zeroCount = byte === 0 ? zeroCount + 1 : 0;
      return byte;
    }
    throw new Error('Truncated H.264 slice header');
  };
  const readBit = () => {
    if (remainingBits === 0) {
      currentByte = readByte();
      remainingBits = 8;
    }
    remainingBits -= 1;
    return (currentByte >> remainingBits) & 1;
  };

  // first_mb_in_slice is the first unsigned Exp-Golomb value in the slice header.
  let leadingZeros = 0;
  while (readBit() === 0) {
    leadingZeros += 1;
    if (leadingZeros > 31) {
      throw new Error('Invalid H.264 slice header');
    }
  }

  let suffix = 0;
  for (let index = 0; index < leadingZeros; index += 1) {
    suffix = (suffix * 2) + readBit();
  }
  return (2 ** leadingZeros) - 1 + suffix;
}

export function startCodeLength(data, offset) {
  if (data[offset] !== 0 || data[offset + 1] !== 0) {
    return 0;
  }
  if (data[offset + 2] === 1) {
    return 3;
  }
  return data[offset + 2] === 0 && data[offset + 3] === 1 ? 4 : 0;
}

export class AnnexBParser {
  static PENDING_LIMIT = 4 * 1024 * 1024;

  constructor(onNal, pendingLimit = AnnexBParser.PENDING_LIMIT, onNalHeader = () => {}) {
    this.onNal = onNal;
    this.onNalHeader = onNalHeader;
    this.pendingLimit = pendingLimit;
    this.generation = 0;
    this.reset();
  }

  reset() {
    this.generation += 1;
    this.buffer = new Uint8Array(0);
    this.length = 0;
    this.scanOffset = 0;
    this.prefixStart = 0;
    this.nalStart = null;
    this.headerReported = false;
  }

  reportHeader() {
    if (this.headerReported || this.nalStart === null || this.nalStart >= this.length) {
      return;
    }
    const type = this.buffer[this.nalStart] & 0x1f;
    const vcl = type === NAL_TYPE.SLICE || type === NAL_TYPE.IDR;
    if (vcl && this.nalStart + 1 >= this.length) {
      return;
    }
    this.headerReported = true;
    // An Exp-Golomb value is zero iff its first bit is one. No complete slice
    // payload is needed to identify the first slice of the following picture.
    this.onNalHeader(type, vcl && (this.buffer[this.nalStart + 1] & 0x80) !== 0);
  }

  push(chunk) {
    if (!(chunk instanceof Uint8Array) || chunk.length === 0) {
      return;
    }

    const generation = this.generation;
    const required = this.length + chunk.length;
    if (required > this.buffer.length) {
      const grown = new Uint8Array(Math.max(required, this.buffer.length * 2, 4096));
      grown.set(this.buffer.subarray(0, this.length));
      this.buffer = grown;
    }
    this.buffer.set(chunk, this.length);
    this.length = required;
    this.reportHeader();
    if (generation !== this.generation) return;

    const data = this.buffer.subarray(0, this.length);
    let offset = this.scanOffset;
    while (offset + 2 < data.length) {
      const length = startCodeLength(data, offset);
      if (length > 0) {
        if (offset - this.prefixStart > this.pendingLimit) {
          throw new Error('H.264 NAL unit exceeded the safety limit');
        }
        if (this.nalStart !== null && offset > this.nalStart) {
          // Consumers retain NALs until the picture is complete. Give them owned
          // bytes so compaction and buffer reuse cannot overwrite earlier slices.
          this.onNal(this.buffer.slice(this.nalStart, offset));
          if (generation !== this.generation) return;
        }
        this.prefixStart = offset;
        this.nalStart = offset + length;
        this.headerReported = false;
        offset += length;
        this.reportHeader();
        if (generation !== this.generation) return;
      } else {
        // Preserve an incomplete four-byte start code across network chunks.
        if (offset + 3 === data.length
          && data[offset] === 0
          && data[offset + 1] === 0
          && data[offset + 2] === 0) break;
        offset += 1;
      }
    }
    this.scanOffset = offset;

    if (this.prefixStart > 0) {
      this.buffer.copyWithin(0, this.prefixStart, this.length);
      this.length -= this.prefixStart;
      this.scanOffset -= this.prefixStart;
      this.nalStart -= this.prefixStart;
      this.prefixStart = 0;
    }
    if (this.length > this.pendingLimit) {
      throw new Error('H.264 NAL unit exceeded the safety limit');
    }
  }
}

export function codecStringFromSps(sps) {
  if (!(sps instanceof Uint8Array) || sps.length < 4 || (sps[0] & 0x1f) !== NAL_TYPE.SPS) {
    throw new Error('Invalid H.264 sequence parameter set');
  }
  return `avc1.${[sps[1], sps[2], sps[3]]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

export function joinAnnexB(nals) {
  const size = nals.reduce((total, nal) => total + 4 + nal.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const nal of nals) {
    output.set([0, 0, 0, 1], offset);
    output.set(nal, offset + 4);
    offset += 4 + nal.length;
  }
  return output;
}
