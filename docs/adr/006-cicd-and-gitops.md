# ADR-006: CI/CD and GitOps

## Context
We want builds that are tested and scanned, and deployments that are
auditable and easy to roll back.

## Decision
- GitHub Actions does CI only: test, scan, build, push to ECR, then
  commit the new image tag into deploy/ values.
- Argo CD watches deploy/ and syncs the cluster. Staging syncs
  automatically. Prod requires a manual sync.
- Terraform has its own workflow: plan on pull request, apply on
  merge to main behind an approval.

## Consequences
Good:
- Git is the record of what runs. Rollback is a git revert.
- The cluster holds no CI credentials.
Bad:
- Bot commits add history noise.
- Slightly slower than pushing directly from CI.

## Alternatives considered
1. Deploy from Actions with helm or kubectl. Rejected: CI needs
   cluster credentials and drift goes unnoticed.
2. Flux. Equally valid. Argo CD chosen for its UI, which helps
   learning.
3. One pipeline for app and infra. Rejected: different risk and
   different permissions.