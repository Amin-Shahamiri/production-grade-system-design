import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

export function createQueue({ queueUrl }) {
  const client = new SQSClient({});
  return {
    async send(message) {
      await client.send(
        new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(message) })
      );
    },
  };
}