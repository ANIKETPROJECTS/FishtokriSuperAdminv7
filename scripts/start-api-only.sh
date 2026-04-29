#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${API_PORT:-8080}"

fuser -k "${API_PORT}/tcp" 2>/dev/null || true

cd "$ROOT_DIR/artifacts/api-server" && PORT="$API_PORT" pnpm run dev
