import { apiWebSocketUrl } from './endpoints.js';
import { normalizeIidxTickerText } from './iidx-ticker.js';
import { RC4 } from './rc4.js';

export class SpiceApiError extends Error {
  constructor(message, code = 'api') {
    super(message);
    this.name = 'SpiceApiError';
    this.code = code;
  }
}

export class SpiceApi {
  static BUFFER_LIMIT = 1024 * 1024;
  static QUEUE_LIMIT = 64;
  static REQUEST_TIMEOUT_MS = 3500;

  constructor(profile, options = {}) {
    this.profile = { ...profile };
    this.WebSocketImpl = options.WebSocketImpl || globalThis.WebSocket;
    this.requestTimeout = options.requestTimeout || SpiceApi.REQUEST_TIMEOUT_MS;

    this.socket = null;
    this.cipher = null;
    this.buffer = new Uint8Array(0);
    this.queue = [];
    this.outstanding = null;
    this.timer = null;
    this.nextId = 1;
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
    this.closedByClient = false;

    this.onstate = () => {};
    this.onerror = () => {};
  }

  get url() {
    return apiWebSocketUrl(this.profile);
  }

  get connected() {
    return this.socket !== null && this.socket.readyState === this.WebSocketImpl.OPEN;
  }

  connect() {
    this.close();
    this.closedByClient = false;
    this.cipher = this.profile.password
      ? new RC4(this.encoder.encode(this.profile.password))
      : null;
    this.buffer = new Uint8Array(0);

    let socket;
    try {
      socket = new this.WebSocketImpl(this.url);
    } catch (error) {
      this.onerror(new SpiceApiError(error.message || 'WebSocket was blocked', 'transport'));
      this.onstate('error');
      return false;
    }

    socket.binaryType = 'arraybuffer';
    this.socket = socket;
    this.onstate('connecting');

    socket.onopen = () => {
      if (this.socket === socket) {
        this.onstate('open');
      }
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket) {
        return;
      }
      const bytes = event.data instanceof ArrayBuffer
        ? new Uint8Array(event.data)
        : new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
      this.receive(bytes);
    };

    socket.onerror = () => {
      if (this.socket === socket) {
        this.onerror(new SpiceApiError('Could not reach the spice2x input socket', 'transport'));
        this.onstate('error');
      }
    };

    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null;
        this.rejectPending(new SpiceApiError('Connection closed', 'closed'));
        this.onstate(this.closedByClient ? 'idle' : 'closed');
      }
    };
    return true;
  }

  close(reason = null) {
    this.closedByClient = reason === null;
    const socket = this.socket;
    this.socket = null;
    this.rejectPending(reason || new SpiceApiError('Connection closed', 'closed'));

    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
    }
  }

  rejectPending(error) {
    clearTimeout(this.timer);
    this.timer = null;
    const dropped = this.queue.concat(this.outstanding ? [this.outstanding] : []);
    this.queue = [];
    this.outstanding = null;
    for (const entry of dropped) {
      entry.reject?.(error);
    }
  }

  send(module, func, params = [], coalesce = null) {
    return this.enqueue({ module, func, params, coalesce });
  }

  request(module, func, params = []) {
    return new Promise((resolve, reject) => {
      const accepted = this.enqueue({ module, func, params, resolve, reject });
      if (!accepted) {
        reject(new SpiceApiError(
          this.connected ? 'Request queue is full' : 'Input API is not connected',
          this.connected ? 'queue' : 'closed',
        ));
      }
    });
  }

  insertCard(index, cardId) {
    const reader = Number(index);
    const number = String(cardId ?? '').toUpperCase();
    if (!Number.isInteger(reader) || reader < 0 || reader > 1) {
      return Promise.reject(new SpiceApiError('Card reader must be Player 1 or Player 2', 'validation'));
    }
    if (!/^[0-9A-F]{16}$/.test(number)) {
      return Promise.reject(new SpiceApiError('Card ID must contain exactly 16 hexadecimal characters', 'validation'));
    }
    return this.request('card', 'insert', [reader, number]);
  }

  async getCards() {
    const data = await this.request('card', 'get_cards', []);
    return data.map((entry) => {
      const index = Number(entry?.index);
      const cardId = String(entry?.card_id ?? '').toUpperCase();
      const source = entry?.source;
      const fileName = source === 'override'
        ? `card${index}`
        : (typeof entry?.file_name === 'string' ? entry.file_name : '');
      if (!Number.isInteger(index)
        || index < 0
        || index > 1
        || !/^[0-9A-F]{16}$/.test(cardId)
        || (source !== 'file' && source !== 'override')
        || !fileName) {
        throw new SpiceApiError('Malformed card data from the input API', 'protocol');
      }
      return {
        index,
        cardId,
        source,
        fileName,
      };
    });
  }

  async tickerGet() {
    const data = await this.request('iidx', 'ticker_get', []);
    return normalizeIidxTickerText(data[0]);
  }

  async getLauncherInfo() {
    const data = await this.request('info', 'launcher', []);
    const info = data[0];
    if (!info || typeof info !== 'object' || typeof info.version !== 'string') {
      throw new SpiceApiError('Malformed launcher data from the input API', 'protocol');
    }
    return { ...info };
  }

  writeKeypad(index, key) {
    const keypad = Number(index);
    const input = String(key ?? '');
    if (!Number.isInteger(keypad) || keypad < 0 || keypad > 1) {
      return Promise.reject(new SpiceApiError(
        'Keypad must be Player 1 or Player 2',
        'validation',
      ));
    }
    if (!/^[0-9A]$/iu.test(input)) {
      return Promise.reject(new SpiceApiError(
        'Keypad input must be one of 0-9 or A (00)',
        'validation',
      ));
    }
    return this.request('keypads', 'write', [keypad, input]);
  }

  async getButtonNames() {
    const data = await this.request('buttons', 'read', []);
    if (!Array.isArray(data)
      || data.some((entry) => !Array.isArray(entry)
        || entry.length < 3
        || typeof entry[0] !== 'string')) {
      throw new SpiceApiError('Malformed button data from the input API', 'protocol');
    }
    return data.map((entry) => entry[0]);
  }

  setButton(name, pressed) {
    const button = String(name ?? '').trim();
    if (!button || button.length > 128) {
      return Promise.reject(new SpiceApiError('Invalid game button name', 'validation'));
    }
    return pressed
      ? this.request('buttons', 'write', [[button, 1]])
      : this.request('buttons', 'write_reset', [[button]]);
  }

  releaseButtons(names) {
    const buttons = [...new Set((Array.isArray(names) ? names : [])
      .map((name) => String(name ?? '').trim())
      .filter((name) => name && name.length <= 128))];
    if (buttons.length === 0) {
      return Promise.resolve([]);
    }
    return this.request('buttons', 'write_reset', buttons.map((name) => [name]));
  }

  async getMemoryInfo() {
    const data = await this.request('info', 'memory', []);
    const info = data[0];
    const totalBytes = Number(info?.mem_total);
    const usedBytes = Number(info?.mem_total_used);
    const processBytes = Number(info?.mem_used);
    if (!Number.isSafeInteger(totalBytes)
      || !Number.isSafeInteger(usedBytes)
      || !Number.isSafeInteger(processBytes)
      || totalBytes <= 0
      || usedBytes < 0
      || usedBytes > totalBytes
      || processBytes < 0) {
      throw new SpiceApiError('Malformed memory data from the input API', 'protocol');
    }
    return { totalBytes, usedBytes, processBytes };
  }

  enqueue(entry) {
    if (!this.connected) {
      return false;
    }

    const last = this.queue.at(-1);
    if (entry.coalesce && last?.coalesce === entry.coalesce) {
      last.params = entry.params;
      return true;
    }
    if (this.queue.length >= SpiceApi.QUEUE_LIMIT) {
      return false;
    }

    this.queue.push(entry);
    this.pump();
    return true;
  }

  pump() {
    if (this.outstanding || this.queue.length === 0 || !this.connected) {
      return;
    }

    const entry = this.queue.shift();
    entry.id = this.nextId;
    this.nextId = this.nextId >= Number.MAX_SAFE_INTEGER ? 1 : this.nextId + 1;

    const bytes = this.encoder.encode(JSON.stringify({
      id: entry.id,
      module: entry.module,
      function: entry.func,
      params: entry.params,
    }));
    const payload = this.cipher ? this.cipher.crypt(bytes) : bytes;

    try {
      this.socket.send(payload);
    } catch (error) {
      entry.reject?.(error);
      this.fail(new SpiceApiError('Could not send API request', 'transport'));
      return;
    }

    this.outstanding = entry;
    this.timer = setTimeout(() => {
      this.fail(new SpiceApiError('The input API did not answer in time', 'timeout'));
    }, this.requestTimeout);
  }

  receive(bytes) {
    if (this.cipher) {
      this.cipher.crypt(bytes);
    }

    const merged = new Uint8Array(this.buffer.length + bytes.length);
    merged.set(this.buffer);
    merged.set(bytes, this.buffer.length);
    this.buffer = merged;

    if (this.buffer.length > SpiceApi.BUFFER_LIMIT) {
      this.fail(new SpiceApiError('API response exceeded the safety limit', 'protocol'));
      return;
    }

    let start = 0;
    for (let i = 0; i < this.buffer.length; i += 1) {
      if (this.buffer[i] !== 0) {
        continue;
      }
      if (i > start) {
        this.handle(this.buffer.subarray(start, i));
      }
      start = i + 1;
      if (!this.socket) {
        return;
      }
    }
    this.buffer = this.buffer.slice(start);
  }

  handle(bytes) {
    let response;
    try {
      response = JSON.parse(this.decoder.decode(bytes));
    } catch {
      this.fail(new SpiceApiError(
        this.profile.password
          ? 'Wrong API password or malformed response'
          : 'Malformed response from the input API',
        this.profile.password ? 'password' : 'protocol',
      ));
      return;
    }

    const entry = this.outstanding;
    if (!entry || entry.id !== response.id) {
      this.fail(new SpiceApiError('Unexpected response from the input API', 'protocol'));
      return;
    }

    clearTimeout(this.timer);
    this.timer = null;
    this.outstanding = null;

    const errors = Array.isArray(response.errors) ? response.errors : [];
    if (errors.length > 0) {
      const error = new SpiceApiError(String(errors[0]), 'remote');
      if (entry.reject) {
        entry.reject(error);
      } else {
        this.onerror(error);
      }
    } else {
      entry.resolve?.(Array.isArray(response.data) ? response.data : []);
    }
    this.pump();
  }

  fail(error) {
    this.onerror(error);
    this.close(error);
    this.onstate('closed');
  }
}
