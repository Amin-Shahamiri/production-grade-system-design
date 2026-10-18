# ADR-009: Bedrock integration

## Context
Bedrock is the slowest, quota limited and most costly dependency. It
also receives user supplied text.

## Decision
- Only the worker calls Bedrock, through a VPC interface endpoint,
  with an IAM role allowed to invoke only the chosen model.
- The model ID is configuration, not code.
- Document text is untrusted input: strict system instructions,
  length limits, and the output is never executed or trusted.
- Timeouts, exponential backoff, and throttling errors return the
  message to the queue instead of failing it.
- A maximum document size protects cost.

## Consequences
Good:
- Traffic stays in AWS, and the blast radius is limited to one model.
Bad:
- Default quotas are low and model access must be enabled first.
- Models are retired over time, so config must be easy to change.

## Alternatives considered
1. Calling an external model API. Rejected: leaves the AWS boundary
   and adds key management.
2. Self hosted model on SageMaker. Rejected: heavy for this goal.