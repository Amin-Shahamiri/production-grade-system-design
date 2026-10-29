import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export function createStorage({ bucket, forcePathStyle }) {
  const client = new S3Client({ forcePathStyle });
  return {
    async putObject({ key, body, contentType }) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
      );
    },
  };
}