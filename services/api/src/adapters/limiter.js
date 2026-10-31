import { createClient } from 'redis';

export function createLimiter({ url, limit, windowSeconds = 60, log = () => {} }) {
  const client = createClient({
    url,
    disableOfflineQueue: true,
    socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3000) },
  });
  client.on('error', (err) =>
    log({ level: 'warn', msg: 'redis error', error: err.message || err.name, code: err.code })
  );
  client.connect().catch(() => {});

  return {
    async hit(userId) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const windowId = Math.floor(nowSeconds / windowSeconds);
      const key = `rl:${userId}:${windowId}`;
      const [count] = await client.multi().incr(key).expire(key, windowSeconds * 2).exec();
      return {
        allowed: Number(count) <= limit,
        retryAfter: windowSeconds - (nowSeconds % windowSeconds),
      };
    },
    async close() {
      await client.quit().catch(() => {});
    },
  };
}