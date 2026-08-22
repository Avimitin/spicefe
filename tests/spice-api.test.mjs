import assert from 'node:assert/strict';
import test from 'node:test';

import { RC4 } from '../public/lib/rc4.js';
import { SpiceApi } from '../public/lib/spice-api.js';

class FakeWebSocket {
  static OPEN = 1;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  send(bytes) {
    this.sent.push(Uint8Array.from(bytes));
  }

  receive(bytes) {
    const copy = Uint8Array.from(bytes);
    this.onmessage?.({ data: copy.buffer });
  }

  close() {
    this.readyState = 3;
  }
}

const profile = (password = '') => ({
  host: '192.168.1.2',
  apiPort: 1337,
  password,
});

test('serializes a request and resolves its NUL-terminated response', async () => {
  const api = new SpiceApi(profile(), { WebSocketImpl: FakeWebSocket, requestTimeout: 1000 });
  api.connect();
  const socket = FakeWebSocket.instances.at(-1);
  socket.open();

  const pending = api.request('info', 'avs');
  const request = JSON.parse(new TextDecoder().decode(socket.sent[0]));
  assert.deepEqual(request, { id: 1, module: 'info', function: 'avs', params: [] });

  socket.receive(new TextEncoder().encode(JSON.stringify({
    id: request.id,
    errors: [],
    data: [{ model: 'LDJ' }],
  }) + '\0'));
  assert.deepEqual(await pending, [{ model: 'LDJ' }]);
  api.close();
});
test('keeps encrypted request and response bytes on one RC4 stream', async () => {
  const password = 'cabinet';
  const api = new SpiceApi(profile(password), { WebSocketImpl: FakeWebSocket, requestTimeout: 1000 });
  api.connect();
  const socket = FakeWebSocket.instances.at(-1);
  socket.open();

  const pending = api.request('info', 'avs');
  const serverCipher = new RC4(new TextEncoder().encode(password));
  const clearRequest = serverCipher.crypt(Uint8Array.from(socket.sent[0]));
  const request = JSON.parse(new TextDecoder().decode(clearRequest));
  assert.equal(request.function, 'avs');

  const clearResponse = new TextEncoder().encode(JSON.stringify({
    id: request.id,
    errors: [],
    data: [],
  }) + '\0');
  socket.receive(serverCipher.crypt(clearResponse));
  assert.deepEqual(await pending, []);
  api.close();
});

test('coalesces queued touch movement while preserving request order', async () => {
  const api = new SpiceApi(profile(), { WebSocketImpl: FakeWebSocket, requestTimeout: 1000 });
  api.connect();
  const socket = FakeWebSocket.instances.at(-1);
  socket.open();

  const first = api.request('info', 'avs');
  api.send('touch', 'write', [[1, 10, 10]], 'touch.write');
  api.send('touch', 'write', [[1, 20, 30]], 'touch.write');
  assert.equal(api.queue.length, 1);

  socket.receive(new TextEncoder().encode('{"id":1,"errors":[],"data":[]}\0'));
  await first;
  assert.equal(socket.sent.length, 2);
  const touch = JSON.parse(new TextDecoder().decode(socket.sent[1]));
  assert.deepEqual(touch.params, [[1, 20, 30]]);

  socket.receive(new TextEncoder().encode('{"id":2,"errors":[],"data":[]}\0'));
  api.close();
});
