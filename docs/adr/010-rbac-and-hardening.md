# ADR-010: RBAC and hardening

## Context
Different people and tools need different access, and a compromised
pod should not be able to move around freely.

## Decision
- EKS access entries map IAM roles to Kubernetes groups: admin,
  developer (read only in prod) and CI.
- Argo CD has its own roles: viewers, and operators who may sync prod.
- Grafana roles separate viewers from editors.
- Namespaces enforce the restricted Pod Security Standard.
- NetworkPolicies default to deny, with explicit allows per service.
- Containers run as non root, with read only filesystems where
  possible.

## Consequences
Good:
- Least privilege at every layer, and we can test it.
Bad:
- Default deny breaks things until each flow is allowed. That
  debugging is part of the class.

## Alternatives considered
1. Everyone as cluster admin. Rejected: no accountability.
2. Namespace only isolation without NetworkPolicies. Rejected: pods
   could still talk to everything.