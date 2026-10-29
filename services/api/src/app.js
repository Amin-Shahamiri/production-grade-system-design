import express from 'express';
import { randomUUID } from 'node:crypto';

const MAX_BYTES = 100 * 1024;
const SAFE_USER_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function createApp({ storage, queue, db }) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post(
    '/documents',
    express.text({ type: 'text/plain', limit: MAX_BYTES }),
    async (req, res) => {
      const userId = req.get('x-user-id');
      if (!userId) {
        return res.status(401).json({ error: 'missing x-user-id' });
      }
      if (!SAFE_USER_ID.test(userId)) {
        return res.status(400).json({ error: 'invalid user id' });
      }
      if (typeof req.body !== 'string' || req.body.trim() === '') {
        return res.status(400).json({ error: 'body must be non-empty text/plain' });
      }

      const documentId = randomUUID();
      const jobId = randomUUID();
      const s3Key = `uploads/${userId}/${documentId}.txt`;

      await storage.putObject({ key: s3Key, body: req.body, contentType: 'text/plain' });
      await db.insertDocument({ id: documentId, userId, s3Key, jobId, status: 'submitted' });

      try {
        await queue.send({
          schemaVersion: 1,
          jobId,
          documentId,
          userId,
          s3Key,
          requestedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error(JSON.stringify({ level: 'error', msg: 'enqueue failed', jobId, documentId }));
        await db.updateStatus(documentId, 'enqueue_failed');
        return res.status(503).json({ error: 'could not queue the job, try again' });
      }

      console.log(JSON.stringify({ level: 'info', msg: 'job queued', jobId, documentId }));
      res.status(202).json({ documentId, jobId });
    }
  );

  app.use((err, req, res, next) => {
    const status = err.status ?? err.statusCode ?? 500;
    if (status >= 500) {
      console.error(JSON.stringify({ level: 'error', msg: err.message }));
    }
    res.status(status).json({ error: status >= 500 ? 'internal error' : err.message });
  });

  return app;
}