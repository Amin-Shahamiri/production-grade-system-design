import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export function createStorage({ bucket, forcePathStyle, maxBytes = 200 * 1024 }) {
  const client = new S3Client({ forcePathStyle });
  return {
    async getObjectText(key) {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (res.ContentLength > maxBytes) {
        throw new Error(`object too large: ${res.ContentLength} bytes`);
      }
      return res.Body.transformToString();
    },
  };
}