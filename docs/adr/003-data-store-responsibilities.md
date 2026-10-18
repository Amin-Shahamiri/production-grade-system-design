# ADR-003: Data store responsibilities

## Context
The app has several kinds of data with different access patterns.
One store for everything would work at small scale but would hide
the trade-offs this class exists to teach.

## Decision
- RDS PostgreSQL: users and document metadata (owner, filename,
  status, timestamps). Relational, needs transactions and queries.
- DynamoDB: job results and status events, keyed by jobId. Simple
  key lookups, on-demand billing, grows without schema work.
- Redis (ElastiCache): cached results with a TTL, per-user rate limit
  counters and duplicate request guards. Never a source of truth.
- S3: raw uploads, private, encrypted, no public access.

## Consequences
Good:
- Each store fits its job, and we learn how to operate each one.
Bad:
- Four stores to secure, back up and monitor.
- Data spans stores, so consistency is eventual. Rule: job state
  lives in DynamoDB, document metadata in RDS, and nothing important
  lives only in Redis.
- If Redis is lost, the app must stay correct and only slower.

## Alternatives considered
1. Everything in PostgreSQL. Simpler, and fine at small scale, but it
   teaches less and a results table grows without bound.
2. Everything in DynamoDB. Poor fit for relational data and ad hoc
   queries on users and documents.
3. Redis as the queue. Rejected: SQS gives durability, retries and a
   DLQ without us building them.