#!/usr/bin/env bash
# One-shot setup for the Ghostfolio dev container.
# Runs as postCreateCommand — before services start.
# Idempotent: safe to re-run.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Seeding .env from .env.dev (if missing)"
if [ ! -f .env ]; then
  cp .env.dev .env
  sed -i 's|<INSERT_REDIS_PASSWORD>|devredispassword|g' .env
  sed -i 's|<INSERT_POSTGRES_PASSWORD>|devpostgrespassword|g' .env
  # Fixed salt so the demo seed script can pre-compute access tokens.
  sed -i 's|<INSERT_RANDOM_STRING>|ad3d16d55e0eef2f98cfafb2a8c7d2cf3aec1a78198100a4012a9a6d1466a4ad|g' .env
fi

echo "==> Pre-pulling Postgres + Redis images"
docker pull postgres:15-alpine &>/dev/null || true
docker pull redis:alpine &>/dev/null || true

echo "==> Installing npm dependencies"
npm ci --no-audit --no-fund

echo "==> Done. Services will be brought up by Ona automations."
