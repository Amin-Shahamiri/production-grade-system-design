# ADR-005: Identity and secrets

## Context
CI needs AWS access, pods need AWS access, and the app needs
database credentials. Long-lived keys are the most common cause of
cloud credential leaks.

## Decision
- GitHub Actions authenticates with OIDC and assumes short-lived
  roles. Separate roles: CI (push to ECR only), Terraform plan
  (read only) and Terraform apply (main branch and protected
  environment only). Trust policies are restricted to this repo and
  branch.
- Pods use EKS Pod Identity, with one least-privilege role per
  service.
- Secrets live in Secrets Manager and are synced into the cluster by
  External Secrets Operator.

## Consequences
Good:
- No stored access keys anywhere.
- A compromised service can reach only its own resources.
Bad:
- Many roles to manage, and trust policy mistakes are hard to debug.
  This is a useful skill to practice.

## Alternatives considered
1. Access keys in GitHub secrets. Rejected: long-lived and leakable.
2. IRSA. Works, but needs OIDC provider setup and annotations. Pod
   Identity is simpler.
3. One shared role for all pods. Rejected: no isolation between
   services.