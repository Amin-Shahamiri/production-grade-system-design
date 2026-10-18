# ADR-004: Compute and scaling

## Context
The api and worker have different load shapes. The api follows user
traffic. The worker follows queue depth and is limited by Bedrock
quota. Nodes must follow pod demand.

## Decision
- api: Horizontal Pod Autoscaler on CPU.
- worker: KEDA ScaledObject on SQS queue depth, with a maximum
  replica count chosen to stay inside the Bedrock quota.
- Nodes: Karpenter, which adds and removes nodes based on pending
  pods.
- Every container sets resource requests and limits, because HPA and
  Karpenter both depend on requests.

## Consequences
Good:
- The scaling signal matches each workload: users for api, backlog
  for worker.
Bad:
- Scaling the worker too far causes Bedrock throttling, so the cap is
  a real design number, found during load testing.
- Karpenter needs its own IAM, node role and configuration.

## Alternatives considered
1. CPU HPA for the worker. Rejected: CPU does not reflect queue
   backlog, since the worker mostly waits on Bedrock.
2. Cluster Autoscaler. Valid and already familiar. Rejected here only
   to learn the newer, faster approach. Comparing both is a good
   follow-up exercise.
3. Fargate. Rejected: higher cost per pod and less control.