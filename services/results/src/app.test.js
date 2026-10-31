import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';

const JOB = '3f1d2c4e-5b6a-4c7d-8e9f-0a1b2c3d4e5f';
const doneItem = {
  jobId: JOB,
  userId: 'user-1',
  status: 'done',
  summary: 'A summary.',
  modelId: 'fake',
  inputTokens: 14,
  outputTokens: 20,
  finishedAt: 1793384604516,
};

function makeDeps({ items = {}, cacheOverrides = {} } = {}) {
  const calls = { storeGets: 0 };
  const cacheData = new Map();
  return {
    calls,
    cacheData,
    store: {
      get: async (jobId) => {
        calls.storeGets += 1;
        return items[jobId] ?? null;
      },
    },
    cache: {
      get: async (key) => cacheData.get(key) ?? null,
      set: async (key, value) => {
        cacheData.set(key, value);
      },
      ...cacheOverrides,
    },
  };
}

async function withServer(deps, fn) {
  const app = createApp(deps);
  let server;
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
    server.closeAllConnections();
  }
}

const getResult = (base, jobId, userId) =>
  fetch(`${base}/results/${jobId}`, { headers: userId ? { 'x-user-id': userId } : {} });

test('GET /health returns ok', async () => {
  await withServer(makeDeps(), async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
  });
});

test('requests without a user id get 401, and a malformed job id gets 400', async () => {
  const deps = makeDeps();
  await withServer(deps, async (base) => {
    assert.equal((await getResult(base, JOB)).status, 401);
    assert.equal((await getResult(base, 'not-a-uuid', 'user-1')).status, 400);
    assert.equal(deps.calls.storeGets, 0);
  });
});

test('the owner gets the finished result, without the owner field, and it is never cacheable', async () => {
  await withServer(makeDeps({ items: { [JOB]: doneItem } }), async (base) => {
    const res = await getResult(base, JOB, 'user-1');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const body = await res.json();
    assert.equal(body.summary, 'A summary.');
    assert.equal(body.status, 'done');
    assert.equal('userId' in body, false);
  });
});

test('another user gets the same 404 as a job that does not exist', async () => {
  await withServer(makeDeps({ items: { [JOB]: doneItem } }), async (base) => {
    const notYours = await getResult(base, JOB, 'user-2');
    const missing = await getResult(base, '9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d', 'user-2');
    assert.equal(notYours.status, 404);
    assert.equal(missing.status, 404);
    assert.deepEqual(await notYours.json(), await missing.json());
  });
});

test('a cache hit still enforces ownership', async () => {
  const deps = makeDeps();
  deps.cacheData.set(`result:${JOB}`, doneItem);
  await withServer(deps, async (base) => {
    assert.equal((await getResult(base, JOB, 'user-2')).status, 404);
    assert.equal(deps.calls.storeGets, 0);
  });
});

test('finished results are cached, unfinished ones are not', async () => {
  const processingJob = '11111111-2222-4333-8444-555555555555';
  const deps = makeDeps({
    items: {
      [JOB]: doneItem,
      [processingJob]: { jobId: processingJob, userId: 'user-1', status: 'processing' },
    },
  });
  await withServer(deps, async (base) => {
    const first = await getResult(base, JOB, 'user-1');
    const second = await getResult(base, JOB, 'user-1');
    assert.equal(first.headers.get('x-cache'), 'miss');
    assert.equal(second.headers.get('x-cache'), 'hit');
    assert.equal(deps.calls.storeGets, 1);

    await getResult(base, processingJob, 'user-1');
    await getResult(base, processingJob, 'user-1');
    assert.equal(deps.calls.storeGets, 3);
  });
});

test('if Redis fails, the service still answers from the database', async () => {
  const broken = async () => {
    throw new Error('redis down');
  };
  const deps = makeDeps({
    items: { [JOB]: doneItem },
    cacheOverrides: { get: broken, set: broken },
  });
  await withServer(deps, async (base) => {
    const res = await getResult(base, JOB, 'user-1');
    assert.equal(res.status, 200);
    assert.equal((await res.json()).summary, 'A summary.');
  });
});