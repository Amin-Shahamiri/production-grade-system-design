import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

export function createStore({ tableName }) {
  const client = new DynamoDBClient({});
  return {
    async get(jobId) {
      const res = await client.send(
        new GetItemCommand({
          TableName: tableName,
          Key: { jobId: { S: jobId } },
          ConsistentRead: true,
        })
      );
      return res.Item ? unmarshall(res.Item) : null;
    },
  };
}