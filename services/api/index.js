import { createApp } from './src/app.js';
import { createStorage } from './src/adapters/storage.js';
import { createQueue } from './src/adapters/queue.js';
import { createDb } from './src/adapters/db.js';

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(JSON.stringify({ level: 'fatal', msg: `missing required env var ${name}` }));
    process.exit(1);
  }
  return value;
}

const storage = createStorage({
  bucket: required('S3_BUCKET'),
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
});
const queue = createQueue({ queueUrl: required('QUEUE_URL') });
const db = createDb({
  host: required('DB_HOST'),
  port: Number(process.env.DB_PORT ?? 5432),
  database: required('DB_NAME'),
  user: required('DB_USER'),
  password: required('DB_PASSWORD'),
});

const app = createApp({ storage, queue, db });
const port = Number(process.env.PORT ?? 8080);
const server = app.listen(port, () => {
  console.log(JSON.stringify({ level: 'info', msg: 'api listening', port }));
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(JSON.stringify({ level: 'info', msg: 'shutting down', signal }));
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
}