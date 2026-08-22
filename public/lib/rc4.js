// spice2x runs one RC4 keystream across alternating request and response bytes.
// This implementation intentionally mutates its input, matching the native API.
export class RC4 {
  constructor(key) {
    if (!(key instanceof Uint8Array) || key.length === 0) {
      throw new TypeError('RC4 requires a non-empty Uint8Array key');
    }

    this.box = new Uint8Array(256);
    for (let i = 0; i < this.box.length; i += 1) {
      this.box[i] = i;
    }

    let j = 0;
    for (let i = 0; i < this.box.length; i += 1) {
      j = (j + this.box[i] + key[i % key.length]) & 0xff;
      [this.box[i], this.box[j]] = [this.box[j], this.box[i]];
    }

    this.a = 0;
    this.b = 0;
  }

  crypt(data) {
    if (!(data instanceof Uint8Array)) {
      throw new TypeError('RC4 data must be a Uint8Array');
    }

    for (let position = 0; position < data.length; position += 1) {
      this.a = (this.a + 1) & 0xff;
      this.b = (this.b + this.box[this.a]) & 0xff;
      [this.box[this.a], this.box[this.b]] = [this.box[this.b], this.box[this.a]];
      data[position] ^= this.box[(this.box[this.a] + this.box[this.b]) & 0xff];
    }

    return data;
  }
}
