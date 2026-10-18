# ADR-007: Edge and networking

## Context
Users should reach the app over HTTPS on our domain, with static
content cached and the cluster not directly exposed.

## Decision
- Route 53 alias record to CloudFront.
- CloudFront has two origins: S3 for the frontend (through Origin
  Access Control) and the ALB for /api/*, with caching disabled for
  the API.
- ACM certificate in us-east-1 for CloudFront and a regional one for
  the ALB.
- The ALB security group allows only the CloudFront managed prefix
  list, and the app also requires a secret origin header.
- AWS WAF on CloudFront with managed rule sets.

## Consequences
Good:
- Nothing is public except CloudFront.
- Static content is served from the edge.
Bad:
- The prefix list admits all CloudFront users, so the secret header
  is what makes the lock real, and it needs rotation.
- WAF adds cost.

## Alternatives considered
1. Public ALB with Route 53 only. Rejected: no CDN and exposed origin.
2. S3 website hosting. Rejected: requires a public bucket.