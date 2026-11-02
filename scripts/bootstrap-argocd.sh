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

echo "Argo CD is ready."