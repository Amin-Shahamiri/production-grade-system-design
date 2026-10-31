import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createApp } from './app.js';

const schema = JSON.parse(
  readFileSync(new URL('../../../contracts/job-message.v1.json', import.meta.url))
);
const ajv = new Ajv2020();
addFormats(ajv);
const validateMessage = ajv.compile(schema);

function makeDeps(overrides = {}) {
  const calls = { puts: [], sent: [], inserted: [], statuses: [] };
  return {
    calls,
    storage: { putObject: async (o) => { calls.puts.push(o); } },
    queue: { send: async (m) => { calls.sent.push(m); } },
    db: {
      insertDocument: async (d) => { calls.inserted.push(d); },
      updateStatus: async (id, status) => { calls.statuses.push({ id, status }); },
    },
    ...overrides,
  };
}

async function withServer(deps, fn) {
  const app = createApp(deps);
  let server;
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
    server.closeAllConnections();
  }
}

const post = (base, body, headers = {}) =>
  fetch(`${base}/documents`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain', ...headers },
    body,
  });

test('GET /health returns ok', async () => {
  await withServer(makeDeps(), async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });
});

test('POST without x-user-id is rejected with 401', async () => {
  const deps = makeDeps();
  await withServer(deps, async (base) => {
    const res = await post(base, 'hello');
    assert.equal(res.status, 401);
    assert.equal(deps.calls.puts.length, 0);
  });
});

test('POST with an unsafe user id is rejected and nothing is stored', async () => {
  const deps = makeDeps();
  await withServer(deps, async (base) => {
    const res = await post(base, 'hello', { 'x-user-id': '../etc' });
    assert.equal(res.status, 400);
    assert.equal(deps.calls.puts.length, 0);
  });
});

test('POST with an empty body is rejected with 400', async () => {
  await withServer(makeDeps(), async (base) => {
    const res = await post(base, '   ', { 'x-user-id': 'user-1' });
    assert.equal(res.status, 400);
  });
});

test('POST with a body over 100 KB is rejected with 413', async () => {
  await withServer(makeDeps(), async (base) => {
    const res = await post(base, 'a'.repeat(200 * 1024), { 'x-user-id': 'user-1' });
    assert.equal(res.status, 413);
  });
});

test('valid POST stores, records, queues a contract-valid message and returns 202', async () => {
  const deps = makeDeps();
  await withServer(deps, async (base) => {
    const text = 'a secret document body';
    const res = await post(base, text, { 'x-user-id': 'user-1' });
    assert.equal(res.status, 202);
    const { documentId, jobId } = await res.json();

    assert.equal(deps.calls.puts.length, 1);
    assert.equal(deps.calls.puts[0].key, `uploads/user-1/${documentId}.txt`);

    assert.equal(deps.calls.sent.length, 1);
    const message = deps.calls.sent[0];
    assert.ok(validateMessage(message), JSON.stringify(validateMessage.errors));
    assert.equal(message.jobId, jobId);
    assert.ok(!JSON.stringify(message).includes(text), 'message must not carry the document text');
  });
});

test('if queueing fails, the document is marked enqueue_failed and the client gets 503', async () => {
  const deps = makeDeps({
    queue: { send: async () => { throw new Error('sqs down'); } },
  });
  await withServer(deps, async (base) => {
    const res = await post(base, 'hello', { 'x-user-id': 'user-1' });
    assert.equal(res.status, 503);
    assert.equal(deps.calls.statuses.length, 1);
    assert.equal(deps.calls.statuses[0].status, 'enqueue_failed');
  });
});

test('unexpected errors return a generic 500 and never leak details', async () => {
  const deps = makeDeps({
    db: {
      insertDocument: async () => {
        throw new Error('password=hunter2 in connection string');
      },
      updateStatus: async () => {},
    },
  });
  await withServer(deps, async (base) => {
    const res = await post(base, 'hello', { 'x-user-id': 'user-1' });
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.ok(!text.includes('hunter2'));
    assert.deepEqual(JSON.parse(text), { error: 'internal error' });
  });
});

test('over the limit: 429 with Retry-After, and nothing is stored or queued', async () => {
  const deps = makeDeps({
    limiter: { hit: async () => ({ allowed: false, retryAfter: 30 }) },
  });
  await withServer(deps, async (base) => {
    const res = await post(base, 'hello', { 'x-user-id': 'user-1' });
    assert.equal(res.status, 429);
    assert.equal(res.headers.get('retry-after'), '30');
    assert.equal(deps.calls.puts.length, 0);
    assert.equal(deps.calls.sent.length, 0);
  });
});

test('the limiter is keyed by the user id', async () => {
  const seen = [];
  const deps = makeDeps({
    limiter: {
      hit: async (userId) => {
        seen.push(userId);
        return { allowed: true };
      },
    },
  });
  await withServer(deps, async (base) => {
    await post(base, 'hello', { 'x-user-id': 'user-7' });
    assert.deepEqual(seen, ['user-7']);
  });
});

test('if the limiter fails, the request is still served (fail open)', async () => {
  const deps = makeDeps({
    limiter: {
      hit: async () => {
        throw new Error('redis down');
      },
    },
  });
  await withServer(deps, async (base) => {
    const res = await post(base, 'hello', { 'x-user-id': 'user-1' });
    assert.equal(res.status, 202);
  });
});