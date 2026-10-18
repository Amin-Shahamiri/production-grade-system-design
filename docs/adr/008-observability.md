# ADR-008: Observability

## Context
We need to see metrics, logs and alerts during normal use and during
load tests.

## Decision
- Prometheus (kube-prometheus-stack) for metrics.
- Loki for logs, collected by Grafana Alloy, with chunks stored in S3.
- Grafana as the single place to view both.
- Services write structured JSON logs that include jobId, so one job
  can be followed across api and worker.
- Alerts: DLQ not empty, oldest queue message age, 5xx rate, p95
  latency, Bedrock error rate.

## Consequences
Good:
- Metrics and logs in one tool, correlated by jobId.
Bad:
- We operate Loki ourselves. Retention is kept short for cost.

## Alternatives considered
1. CloudWatch Logs. Fully managed, but cost per GB and weaker
   correlation with Prometheus metrics.
2. ELK or OpenSearch. Rejected: heavy for a learning cluster.