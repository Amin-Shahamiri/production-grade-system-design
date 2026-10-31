import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConsumer } from './consumer.js';

test('deletes a message only when processing says ack', async () => {
  const deleted = [];
  let delivered = false;
  const queue = {
    receive: async ({ signal }) => {
      if (delivered) {
        await new Promise((resolve) => signal.addEventListener('abort', resolve));
        throw new Error('aborted');
      }
      delivered = true;
      return [
        { id: '1', body: 'ack', receiptHandle: 'r1' },
        { id: '2', body: 'retry', receiptHandle: 'r2' },
        { id: '3', body: 'boom', receiptHandle: 'r3' },
      ];
    },
    delete: async (handle) => {
      deleted.push(handle);
    },
  };
  const processMessage = async (body) => {
    if (body === 'boom') throw new Error('failed');
    return body;
  };

  const consumer = createConsumer({ queue, processMessage });
  consumer.start();
  await new Promise((resolve) => setTimeout(resolve, 50));
  await consumer.stop();

  assert.deepEqual(deleted, ['r1']);
});