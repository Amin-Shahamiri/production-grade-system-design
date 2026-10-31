const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createConsumer({
  queue,
  processMessage,
  concurrency = 2,
  waitSeconds = 20,
  log = () => {},
}) {
  let running = false;
  let loop = null;
  let controller = null;

  async function handle(message) {
    try {
      const outcome = await processMessage(message.body);
      if (outcome === 'ack') await queue.delete(message.receiptHandle);
    } catch (err) {
      log({
        level: 'error',
        msg: 'message failed, leaving it for redelivery',
        messageId: message.id,
        error: err.message,
      });
    }
  }

  async function run() {
    while (running) {
      controller = new AbortController();
      let messages = [];
      try {
        messages = await queue.receive({
          maxMessages: concurrency,
          waitSeconds,
          signal: controller.signal,
        });
      } catch (err) {
        if (!running) break;
        log({ level: 'error', msg: 'receive failed', error: err.message });
        await sleep(2000);
        continue;
      }
      await Promise.all(messages.map(handle));
    }
  }

  return {
    start() {
      running = true;
      loop = run();
    },
    async stop() {
      running = false;
      controller?.abort();
      await loop;
    },
  };
}