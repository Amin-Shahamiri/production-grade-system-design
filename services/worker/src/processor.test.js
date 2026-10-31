import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProcessor } from './processor.js';
import { createFakeModel } from './models/fake.js';

const JOB_ID = '3f1d2c4e-5b6a-4c7d-8e9f-0a1b2c3d4e5f';
const DOC_ID = '9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d';

function validBody(overrides = {}) {
  return JSON.stringify({
    schemaVersion: 1,
    jobId: JOB_ID,
    documentId: DOC_ID,
    userId: 'user-1',
    s3Key: `uploads/user-1/${DOC_ID}.txt`,
    requestedAt: '2026-10-29T18:30:00Z',
    ...overrides,
  });
}

function makeDeps({ claimState = 'claimed', model = createFakeModel() } = {}) {
  const calls = { reads: [], completed: [], failed: [], claims: [], summarized: 0 };
  return {
    calls,
    storage: {
      getObjectText: async (key) => {
        calls.reads.push(key);
        return 'the quick brown fox jumps over the lazy dog';
      },
    },
    model: {
      summarize: async (text) => {
        calls.summarized += 1;
        return model.summarize(text);
      },
    },
    results: {
      claim: async (jobId, meta) => {
        calls.claims.push({ jobId, meta });
        return { state: claimState };
      },
      complete: async (jobId, output) => {
        calls.completed.push({ jobId, output });
      },
      fail: async (jobId, reason) => {
        calls.failed.push({ jobId, reason });
      },
    },
  };
}

test('processes a valid job: reads, summarizes, stores the result, acks', async () => {
  const deps = makeDeps();
  const processMessage = createProcessor(deps);

  assert.equal(await processMessage(validBody()), 'ack');
  assert.deepEqual(deps.calls.reads, [`uploads/user-1/${DOC_ID}.txt`]);
  assert.equal(deps.calls.completed.length, 1);
  assert.equal(deps.calls.completed[0].jobId, JOB_ID);
  assert.match(deps.calls.completed[0].output.summary, /FAKE SUMMARY/);
  assert.deepEqual(deps.calls.claims[0].meta, { userId: 'user-1', documentId: DOC_ID });
});

test('rejects a body that is not JSON, without touching the model', async () => {
  const deps = makeDeps();
  const processMessage = createProcessor(deps);

  await assert.rejects(processMessage('not json'), /not valid JSON/);
  assert.equal(deps.calls.summarized, 0);
  assert.equal(deps.calls.completed.length, 0);
});

test('rejects an unsupported schemaVersion', async () => {
  const deps = makeDeps();
  const processMessage = createProcessor(deps);

  await assert.rejects(processMessage(validBody({ schemaVersion: 2 })), /contract/);
  assert.equal(deps.calls.summarized, 0);
});

test('rejects an s3Key outside the message user prefix, and never reads it', async () => {
  const deps = makeDeps();
  const processMessage = createProcessor(deps);

  await assert.rejects(
    processMessage(validBody({ s3Key: 'uploads/user-2/secret.txt' })),
    /s3Key/
  );
  assert.equal(deps.calls.reads.length, 0);
});

test('a duplicate delivery of a finished job is acked without calling the model', async () => {
  const deps = makeDeps({ claimState: 'already_done' });
  const processMessage = createProcessor(deps);

  assert.equal(await processMessage(validBody()), 'ack');
  assert.equal(deps.calls.summarized, 0);
});

test('a job in progress elsewhere is left in the queue for retry', async () => {
  const deps = makeDeps({ claimState: 'in_progress' });
  const processMessage = createProcessor(deps);

  assert.equal(await processMessage(validBody()), 'retry');
  assert.equal(deps.calls.summarized, 0);
});

test('a model failure marks the job failed and rethrows so the message is redelivered', async () => {
  const deps = makeDeps({
    model: {
      summarize: async () => {
        throw new Error('boom');
      },
    },
  });
  const processMessage = createProcessor(deps);

  await assert.rejects(processMessage(validBody()), /boom/);
  assert.equal(deps.calls.failed.length, 1);
  assert.equal(deps.calls.completed.length, 0);
});