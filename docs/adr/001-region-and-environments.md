# ADR-001: Region and environments

## Context
This project is a hands-on learning class that mirrors a production
system: EKS, managed data stores, Bedrock, CloudFront, and a full
CI/CD pipeline. It is paid for personally, so cost and easy teardown
matter. Two technical constraints also apply: CloudFront can only use
ACM certificates from us-east-1, and we need broad Bedrock model
availability.

## Decision
We use the us-east-1 region for everything. We use a single AWS
account and a single EKS cluster, with staging and prod as separate
Kubernetes namespaces. Terraform state is stored remotely in an S3
bucket so it survives laptop changes and can be shared with CI.

## Consequences
Good:
- Lowest cost: one cluster, one set of nodes, one NAT gateway.
- Simple setup: one account to secure and one set of Terraform state.
- Putting everything in us-east-1 avoids cross-region complexity,
  including the CloudFront certificate requirement.

Bad:
- No account boundary between staging and prod. A mistake in
  staging, such as an overly broad IAM policy or a runaway load test,
  can affect prod.
- Namespaces isolate Kubernetes objects but not nodes, so a load test
  on staging competes with prod for CPU and memory.
- Single region means no regional failover. A us-east-1 outage takes
  everything down.

## Alternatives considered
1. Separate AWS accounts per environment (staging, prod). This is
   the production best practice because it limits blast radius.
   Rejected because it adds Organizations, cross-account roles, and
   duplicate infrastructure cost, which distract from the core
   learning goals.
2. Separate EKS clusters per environment. Stronger isolation than
   namespaces, but roughly doubles the control plane and node cost.
   Rejected for cost.
3. A region closer to Berlin, such as eu-central-1. Lower latency for
   us, but the CloudFront certificate would still need us-east-1,
   which mixes regions. Rejected to keep things in one place.