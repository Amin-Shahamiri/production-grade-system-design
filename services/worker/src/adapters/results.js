import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
  ConditionalCheckFailedException,
} from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const STALE_AFTER_MS = 100_000;
const TTL_SECONDS = 7 * 24 * 60 * 60;

export function createResults({ tableName }) {
  const client = new DynamoDBClient({});
  const key = (jobId) => ({ jobId: { S: jobId } });

  return {
    async claim(jobId) {
      const now = Date.now();
      try {
        await client.send(
          new PutItemCommand({
            TableName: tableName,
            Item: {
              ...key(jobId),
              status: { S: 'processing' },
              startedAt: { N: String(now) },
              expiresAt: { N: String(Math.floor(now / 1000) + TTL_SECONDS) },
            },
            ConditionExpression:
              'attribute_not_exists(jobId) OR #s = :failed OR (#s = :processing AND startedAt < :stale)',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: {
              ':failed': { S: 'failed' },
              ':processing': { S: 'processing' },
              ':stale': { N: String(now - STALE_AFTER_MS) },
            },
            ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
          })
        );
        return { state: 'claimed' };
      } catch (err) {
        if (err instanceof ConditionalCheckFailedException) {
          const existing = err.Item ? unmarshall(err.Item) : {};
          return { state: existing.status === 'done' ? 'already_done' : 'in_progress' };
        }
        throw err;
      }
    },

    async complete(jobId, { summary, modelId, usage }) {
      await client.send(
        new UpdateItemCommand({
          TableName: tableName,
          Key: key(jobId),
          UpdateExpression:
            'SET #s = :done, #summary = :summary, modelId = :modelId, inputTokens = :in, outputTokens = :out, finishedAt = :now',
          ExpressionAttributeNames: { '#s': 'status', '#summary': 'summary' },
          ExpressionAttributeValues: {
            ':done': { S: 'done' },
            ':summary': { S: summary },
            ':modelId': { S: modelId },
            ':in': { N: String(usage.inputTokens) },
            ':out': { N: String(usage.outputTokens) },
            ':now': { N: String(Date.now()) },
          },
        })
      );
    },

    async fail(jobId, reason) {
      await client.send(
        new UpdateItemCommand({
          TableName: tableName,
          Key: key(jobId),
          UpdateExpression: 'SET #s = :failed, failureReason = :reason',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':failed': { S: 'failed' }, ':reason': { S: reason } },
        })
      );
    },
  };
}