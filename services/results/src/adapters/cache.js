import { createClient } from 'redis';

export function createCache({ url, ttlSeconds = 3600, log = () => {} }) {
  const client = createClient({
    url,
    disableOfflineQueue: true,
    socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3000) },
  });
    client.on('error', (err) =>
    log({
      level: 'warn',
      msg: 'redis error',
      error: err.message || err.name,
      code: err.code ?? err.errors?.[0]?.code,
    })
  );
  client.connect().catch(() => {});

  return {
    async get(key) {
      const raw = await client.get(key);
      return raw ? JSON.parse(raw) : null;
    },
    async set(key, value) {
      await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    },
    async close() {
      await client.quit().catch(() => {});
    },
  };
}