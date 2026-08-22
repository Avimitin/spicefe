export const NAL_TYPE = Object.freeze({
  SLICE: 1,
  IDR: 5,
  SPS: 7,
  PPS: 8,
});

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

  constructor(onNal, pendingLimit = AnnexBParser.PENDING_LIMIT) {
    this.onNal = onNal;
    this.pendingLimit = pendingLimit;
    this.pending = new Uint8Array(0);
  }

  reset() {
    this.pending = new Uint8Array(0);
  }

  push(chunk) {
    if (!(chunk instanceof Uint8Array) || chunk.length === 0) {
      return;
    }

    const merged = new Uint8Array(this.pending.length + chunk.length);
    merged.set(this.pending);
    merged.set(chunk, this.pending.length);

    const marks = [];
    for (let offset = 0; offset + 2 < merged.length; offset += 1) {
      const length = startCodeLength(merged, offset);
      if (length > 0) {
        marks.push({ begin: offset, payload: offset + length });
        offset += length - 1;
      }
    }

    for (let index = 0; index + 1 < marks.length; index += 1) {
      const nal = merged.subarray(marks[index].payload, marks[index + 1].begin);
      if (nal.length > 0) {
        this.onNal(nal);
      }
    }

    this.pending = marks.length > 0
      ? merged.slice(marks.at(-1).begin)
      : merged;

    if (this.pending.length > this.pendingLimit) {
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
