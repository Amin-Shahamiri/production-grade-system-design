import express from 'express';

const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_USER_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function createApp({ store, cache, log = () => {} }) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  async function cacheGet(key) {
    try {
      return await cache.get(key);
    } catch (err) {
      log({ level: 'warn', msg: 'cache read failed', error: err.message || err.name, code: err.code ?? err.errors?.[0]?.code});
      return null;
    }
  }

  async function cacheSet(key, value) {
    try {
      await cache.set(key, value);
    } catch (err) {
      log({ level: 'warn', msg: 'cache read failed', error: err.message || err.name, code: err.code ?? err.errors?.[0]?.code});
    }
  }

  app.get('/results/:jobId', async (req, res) => {
    const userId = req.get('x-user-id');
    if (!userId) {
      return res.status(401).json({ error: 'missing x-user-id' });
    }
    if (!SAFE_USER_ID.test(userId)) {
      return res.status(400).json({ error: 'invalid user id' });
    }
    const { jobId } = req.params;
    if (!JOB_ID.test(jobId)) {
      return res.status(400).json({ error: 'invalid job id' });
    }

    const key = `result:${jobId}`;
    let item = await cacheGet(key);
    const cacheHit = item !== null;
    if (!cacheHit) {
      item = await store.get(jobId);
      if (item?.status === 'done') {
        await cacheSet(key, item);
      }
    }

    if (!item || item.userId !== userId) {
      return res.status(404).json({ error: 'not found' });
    }

    res.set('cache-control', 'no-store');
    res.set('x-cache', cacheHit ? 'hit' : 'miss');
    if (item.status !== 'done') {
      return res.json({ jobId, status: item.status });
    }
    res.json({
      jobId,
      status: item.status,
      summary: item.summary,
      modelId: item.modelId,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens,
      finishedAt: item.finishedAt,
    });
  });

  app.use((err, req, res, next) => {
    const status = err.status ?? err.statusCode ?? 500;
    if (status >= 500) {
      log({
        level: 'error',
        msg: err.message || err.name,
        name: err.name,
        code: err.code ?? err.errors?.[0]?.code,
        stack: err.stack,
      });
    }
    res.status(status).json({ error: status >= 500 ? 'internal error' : err.message });
  });

  return app;
}