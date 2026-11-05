# DocSummarizer on AWS

[![ci](https://github.com/Amin-Shahamiri/production-grade-system-design/actions/workflows/ci.yml/badge.svg)](https://github.com/Amin-Shahamiri/production-grade-system-design/actions/workflows/ci.yml)

A small system built the way a production system is built. A user uploads a text document, and a few seconds later the system returns a summary written by an AI model.

This is a **hands-on learning project** for cloud and DevOps engineering. The application is simple on purpose. The platform around it is the point: queues, data stores, identity, CI/CD, GitOps, and (soon) autoscaling, observability, security testing, and load testing.

<p align="center">
  <img src="docs/architecture.svg" alt="Animated architecture diagram. A user sends a document to the api. The api saves the file in S3 and a record in Postgres, and puts a job in a queue. The worker reads the job, asks a Bedrock model for a summary, and saves it in DynamoDB. The results service reads the summary from Redis or DynamoDB." width="900">
</p>

> **Status: work in progress.** The services, the tests, CI, the AWS infrastructure, and the first GitOps deployment work. Secrets, the public edge, autoscaling, observability, and security and load testing are planned. See [Project status](#project-status).

## Contents

- [How it works](#how-it-works)
- [Design rules](#design-rules)
- [Delivery pipeline](#delivery-pipeline)
- [Repository layout](#repository-layout)
- [Run it on your laptop](#run-it-on-your-laptop)
- [Deploy it to AWS](#deploy-it-to-aws)
- [Security](#security)
- [Project status](#project-status)
- [Lessons learned](#lessons-learned)
- [License](#license)

## How it works

| Part | Job |
|---|---|
| **api** service | Receives documents. Checks the user and the rate limit. Saves the file in S3 and a record in Postgres. Puts a small job message in the queue. Answers fast. |
| **worker** service | Takes jobs from the queue. Reads the file. Asks the model for a summary. Saves the result in DynamoDB. |
| **results** service | Gives a finished summary to its owner. Uses Redis as a fast copy. |
| **SQS** (with a dead-letter queue) | Keeps jobs in a line until a worker is ready. A bad job moves to the dead-letter queue after 3 tries. |
| **S3** | Keeps the uploaded files. |
| **RDS PostgreSQL** | Keeps one record per document. |
| **DynamoDB** | Keeps the finished summaries, found by job ID. |
| **ElastiCache Redis** | Keeps a cache of finished summaries and the counters for the rate limit. It is never the source of truth. |
| **Amazon Bedrock** | Writes the summary (Claude Haiku 4.5 through a cross-region inference profile). |
| **Amazon EKS** | Runs the three services. |

The model is slow, so the user must not wait for it. The api answers at once with "accepted", and the worker does the slow job later. The queue connects the two.

### Why these data stores

| Store | Reason |
|---|---|
| Postgres | Structured records with relations and transactions. |
| DynamoDB | Fast lookup of one item by its key. It grows without capacity work. |
| Redis | Data that can be lost without harm. |
| S3 | Files. |

Each store does one job. The decisions are written down in [`docs/adr`](docs/adr).

## Design rules

1. The queue message carries only the **file name**, never the document text. The format is a versioned contract: [`contracts/job-message.v1.json`](contracts/job-message.v1.json).
2. Queues deliver a message at least once. The worker is **idempotent**: a second delivery of a finished job is acknowledged and costs nothing.
3. A bad message is retried, then moved to the dead-letter queue. A person can look at it there.
4. Redis is only a copy. If Redis fails, the system stays correct and becomes slower.
5. Each service has its **own IAM role** with only the permissions it needs. For example, the worker can call exactly one Bedrock model, and the api cannot read results.
6. A user can read **only their own** results. A job that belongs to someone else returns the same answer as a job that does not exist.
7. Error details go to the logs, never to the user. Logs are structured JSON.
8. The text of a document is **untrusted input** for the model. It is wrapped in delimiters, and the instructions say never to follow it.

## Delivery pipeline

<p align="center">
  <img src="docs/pipeline.svg" alt="Animated delivery pipeline. A developer opens a pull request. CI runs tests and scans. After the merge, CI builds three images, gets AWS access with OIDC, and pushes them to ECR. Argo CD deploys the image tag written in the deploy folder to EKS." width="900">
</p>

The workflow is in [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

| Job | What it does | When |
|---|---|---|
| `test` | Runs the tests of each service on a clean machine (a matrix of three jobs). | Pull requests and `main` |
| `secrets` | Scans the **whole Git history** for secrets with gitleaks. | Pull requests and `main` |
| `scan-images` | Builds each image and scans it with Trivy. It fails on HIGH or CRITICAL problems that have a fix. | Pull requests and `main` |
| `build` | Pushes the three images to ECR. It needs the three jobs above, so a red check means no image. | `main` only |

Key points:

- **No stored AWS keys.** GitHub proves its identity to AWS with an OIDC token. The role trusts only this repository and only the `main` branch, using the permanent numeric IDs of the owner and the repository. The role can only push to three ECR repositories.
- **Immutable image tags.** The tag is the Git commit ID, and the ECR repositories refuse to overwrite a tag. A tag always means the same code.
- **Scanners are pinned by digest.** gitleaks and Trivy run as Docker images pinned by content hash, not as third-party actions with version tags. See [Lessons learned](#lessons-learned) for the reason.
- **Dependabot** proposes updates for actions, npm packages, base images, and Terraform providers. Major versions (for example a new Node.js major) are planned work, not automatic merges.
- **GitOps.** Argo CD deploys what is written in Git. A reviewed commit is the only way to change what runs. *Planned:* CI writes the new image tag into [`deploy/staging`](deploy/staging) after each build.

## Repository layout

```
contracts/              The queue message contract (JSON Schema)
services/
  api/                  Upload endpoint, rate limit, job creation
  worker/               Queue consumer, model call, result storage
  results/              Result lookup with cache and ownership check
chart/service/          One generic Helm chart used by all three services
deploy/
  apps/                 Argo CD Applications (one per service)
  staging/              Helm values per service (image tag, settings)
  argocd/               Values for the Argo CD installation
  root-app.yaml         The "app of apps" that Argo CD watches
infra/
  bootstrap/            Terraform state bucket
  platform/             VPC and EKS cluster
  data/                 S3, SQS, DynamoDB, RDS, Redis, per-service IAM roles
  ci/                   ECR repositories and the GitHub OIDC role
scripts/                bootstrap-argocd.sh (one-time setup after a cluster rebuild)
dev/                    Local settings (dummy values only) and init scripts
docs/                   Architecture decision records and diagrams
compose.yaml            Local environment: Postgres, Redis, AWS emulator
```

Each Terraform folder has its **own state**, because each has its own lifecycle. The data layer is built after the platform and destroyed before it.

## Run it on your laptop

You need Docker, Node.js 24, and the AWS CLI.

**1. Start the local environment.** It runs Postgres 17, Redis 7, and an AWS emulator ([Floci](https://floci.io)) for S3, SQS, and DynamoDB. A small init script creates the bucket, the queue with its dead-letter queue, and the table.

```bash
docker compose up -d
```

**2. Start the three services**, each in its own terminal. Their settings come from `dev/*.local.env`. These files contain **dummy values only**.

```bash
cd services/api     && npm ci && npm run dev
cd services/worker  && npm ci && npm run dev
cd services/results && npm ci && npm run dev
```

The worker starts with a **fake model** (a deterministic summary with a short delay), so you pay nothing.

**3. Send a document and read the result.**

```bash
RESP=$(curl -s -X POST localhost:8080/documents \
  -H 'content-type: text/plain' -H 'x-user-id: user-1' \
  --data 'The quick brown fox jumps over the lazy dog every single morning.')
JOB=$(echo "$RESP" | jq -r .jobId)

sleep 4
curl -s localhost:8081/results/$JOB -H 'x-user-id: user-1'
```

You get `"status":"done"` and a summary. Ask for the same job as `user-2` and you get `404`.

**Useful commands.** This alias makes sure local commands can never reach a real AWS account:

```bash
alias awslocal='AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1 AWS_ENDPOINT_URL=http://localhost:4566 aws'
awslocal sqs list-queues
```

### Tests

```bash
cd services/api     && npm test   # 11 tests
cd services/worker  && npm test   # 11 tests
cd services/results && npm test   # 7 tests
```

The services receive their dependencies as arguments (storage, queue, database, cache, model). The tests use fakes, so they run in milliseconds and need no cloud.

## Deploy it to AWS

> **Cost warning.** While the cluster, the NAT gateway, RDS, and Redis run, the bill is roughly **8 to 10 USD per day** (my estimate, check the AWS pricing pages). Create a budget alarm first, and destroy everything when you stop.

You need an AWS account, a region with Bedrock access (this project uses `us-east-1`), and access to a Bedrock model.

1. **State bucket:** `infra/bootstrap`. Then create a local `terraform.tfvars` in `infra/platform` and `infra/ci` (see the variables in each folder). These files are not committed.
2. **CI access:** `infra/ci` creates the ECR repositories and the OIDC role. Put the role ARN in the GitHub secret `AWS_ROLE_ARN`.
3. **Platform:** `infra/platform` (about 15 to 20 minutes), then refresh your kubeconfig.
4. **Data:** `infra/data` (about 10 minutes).
5. **Argo CD:** `scripts/bootstrap-argocd.sh` installs Argo CD and starts the root application. Argo CD then deploys the three services from `deploy/`.

Always apply a saved plan: `terraform plan -out=tfplan`, then `terraform apply tfplan`.

**Stop rule.** Destroy in this order, so nothing blocks the VPC deletion:

```bash
cd infra/data && terraform destroy
cd ../platform && terraform destroy
```

After the next rebuild, run `scripts/bootstrap-argocd.sh` again. It is safe to run many times.

## Security

**What is in place**

- One IAM role per service, bound to a Kubernetes service account with EKS Pod Identity. No access keys exist anywhere.
- Containers run as a non-root user, cannot gain privileges, drop all Linux capabilities, and use a read-only root filesystem.
- Private subnets for nodes. The database and Redis have no public path. Redis requires TLS.
- Ownership check on every result (protection against IDOR), and per-user rate limits.
- Input validation, request size limits, and generic error messages.
- Secrets scan on the full Git history, image scan before push, scanners pinned by digest.
- No secrets in Git. Local files contain dummy values only.

**Known gaps (honest list)**

- **Identity is a placeholder.** The `x-user-id` header is *not* authentication. Anyone can claim any ID. It keeps the project focused on infrastructure, and it is a deliberate target for the planned security tests. Real authentication is future work.
- The application connects to the database with the master user, and TLS to RDS is not finished yet.
- A single AWS account and a single cluster (staging and prod are namespaces). Production would use separate accounts.
- The rate limit is a fixed window keyed by the self-declared user ID. A rate rule in AWS WAF is planned.
- No network policies and no observability yet.

## Project status

- [x] Three services with tests, a versioned queue contract, and a local environment
- [x] Dockerfiles (non-root, small runtime image)
- [x] CI: tests, secrets scan, image scan, push to ECR with OIDC, Dependabot
- [x] Terraform: state, VPC, EKS, data layer, per-service IAM, ECR, OIDC role
- [x] Bedrock access limited to one model
- [x] Helm chart and Argo CD (app of apps)
- [ ] Database secret with External Secrets, database TLS, schema migration
- [ ] CI writes the new image tag into `deploy/` (full GitOps loop)
- [ ] Public edge: Route 53, CloudFront, WAF, ALB
- [ ] Autoscaling: HPA, queue-based scaling with KEDA, node autoscaling
- [ ] Observability: Prometheus, Loki, Grafana, alerts
- [ ] RBAC and cluster hardening
- [ ] Security testing and load testing, with a written report

## Lessons learned

Real problems met while building this, and what they taught.

| Problem | What I learned |
|---|---|
| CI could not assume the AWS role: `AccessDenied`. GitHub had changed the OIDC subject to include permanent owner and repository IDs. | Two strings that look alike are not equal. IDs are safer than names, because a name can be reused. |
| The image push failed on `ecr:BatchGetImage`. | Read AWS errors as three parts: who, action, resource. Find the minimal permission set by running the real tool. |
| The Trivy GitHub Action was compromised in March 2026 (version tags were moved to malware). | A tag is a label that can move. A digest cannot. Scanners run as images pinned by digest. |
| Trivy found HIGH vulnerabilities in npm and corepack inside the base image. | Runtime images should not contain package managers. Removing them cut the findings and the size. |
| Errors logged as an empty string during connection failures. | Node throws an `AggregateError` with no message when IPv4 and IPv6 both fail. Log the name and the code. |
| A Terraform typo (`instance_type` for `instance_types`) was ignored without a warning, and the node group hung. | Search the plan for the values you set. If a default appears instead, a key is misspelled. |
| A local AWS emulator now needs an account token. | Check the licence and the terms of a tool before building on it. |

## License

[MIT](LICENSE)
