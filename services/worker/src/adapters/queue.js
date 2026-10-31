import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

export function createQueue({ queueUrl }) {
  const client = new SQSClient({});
  return {
    async receive({ maxMessages, waitSeconds, signal }) {
      const res = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: Math.min(maxMessages, 10),
          WaitTimeSeconds: waitSeconds,
        }),
        { abortSignal: signal }
      );
      return (res.Messages ?? []).map((m) => ({
        id: m.MessageId,
        body: m.Body,
        receiptHandle: m.ReceiptHandle,
      }));
    },
    async delete(receiptHandle) {
      await client.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: receiptHandle }));
    },
  };
}