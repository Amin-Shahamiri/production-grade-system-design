import { createApp } from './src/app.js';
import { createStore } from './src/adapters/store.js';
import { createCache } from './src/adapters/cache.js';

const log = (entry) => console.log(JSON.stringify(entry));

function required(name) {
  const value = process.env[name];
  if (!value) {
    log({ level: 'fatal', msg: `missing required env var ${name}` });
    process.exit(1);
  }
  return value;
}

const store = createStore({ tableName: required('RESULTS_TABLE') });
const cache = createCache({ url: required('REDIS_URL'), log });
const app = createApp({ store, cache, log });

const port = Number(process.env.PORT ?? 8080);
const server = app.listen(port, () => log({ level: 'info', msg: 'results listening', port }));

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    log({ level: 'info', msg: 'shutting down', signal });
    setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      await cache.close();
      process.exit(0);
    });
  });
}