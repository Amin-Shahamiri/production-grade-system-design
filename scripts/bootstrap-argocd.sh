#!/usr/bin/env bash
set -euo pipefail

ARGOCD_CHART_VERSION="10.11.6"

helm repo add argo https://argoproj.github.io/argo-helm >/dev/null 2>&1 || true
helm repo update argo >/dev/null

helm upgrade --install argocd argo/argo-cd \
  --namespace argocd --create-namespace \
  --version "$ARGOCD_CHART_VERSION" \
  --values "$(dirname "$0")/../deploy/argocd/values.yaml" \
  --wait --timeout 5m

KEY="${ARGOCD_REPO_KEY:-$HOME/.ssh/pgsd-argocd}"
kubectl -n argocd create secret generic repo-pgsd \
  --from-literal=type=git \
  --from-literal=url=git@github.com:Amin-Shahamiri/production-grade-system-design.git \
  --from-file=sshPrivateKey="$KEY" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n argocd label secret repo-pgsd argocd.argoproj.io/secret-type=repository --overwrite

kubectl apply -f "$(dirname "$0")/../deploy/root-app.yaml"

echo "Argo CD is ready."