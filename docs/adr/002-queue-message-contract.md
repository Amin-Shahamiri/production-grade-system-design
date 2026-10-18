## ADR-002: The queue message contract

**The api and worker services depend on this message format, so it needs to be agreed before either one is written.**

**Fields:** jobId, documentId, userId, s3Key, requestedAt, schemaVersion.

**Reference, not content:** the message carries the S3 key, never the document text. SQS messages are limited to 256 KB, and small messages are cheaper and safer.

**Idempotency:** jobId is the unique key. SQS delivers at least once, so the worker must handle the same message twice without double-processing.

**Retries:** after 3 failed receives, the message goes to a dead-letter queue.

**Visibility timeout:** longer than the slowest expected Bedrock call, or the message will be redelivered while still being processed.