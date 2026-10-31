import { createStorage } from './src/adapters/storage.js';
import { createQueue } from './src/adapters/queue.js';
import { createResults } from './src/adapters/results.js';
import { createFakeModel } from './src/models/fake.js';
import { createBedrockModel } from './src/models/bedrock.js';
import { createProcessor } from './src/processor.js';
import { createConsumer } from './src/consumer.js';

const log = (entry) => console.log(JSON.stringify(entry));

function required(name) {
  const value = process.env[name];
  if (!value) {
    log({ level: 'fatal', msg: `missing required env var ${name}` });
    process.exit(1);
  }
  return value;
}

const provider = process.env.MODEL_PROVIDER ?? 'fake';
let model;
if (provider === 'bedrock') {
  model = createBedrockModel({ modelId: required('BEDROCK_MODEL_ID') });
} else if (provider === 'fake') {
  model = createFakeModel({ delayMs: Number(process.env.FAKE_MODEL_DELAY_MS ?? 0) });
} else {
  log({ level: 'fatal', msg: `unknown MODEL_PROVIDER ${provider}` });
  process.exit(1);
}

const storage = createStorage({
  bucket: required('S3_BUCKET'),
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
});
const queue = createQueue({ queueUrl: required('QUEUE_URL') });
const results = createResults({ tableName: required('RESULTS_TABLE') });

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 2);
const consumer = createConsumer({
  queue,
  processMessage: createProcessor({ storage, model, results, log }),
  concurrency,
  log,
});

consumer.start();
log({ level: 'info', msg: 'worker started', modelProvider: provider, concurrency });

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, async () => {
    log({ level: 'info', msg: 'shutting down', signal });
    setTimeout(() => process.exit(1), 30000).unref();
    await consumer.stop();
    process.exit(0);
  });
}