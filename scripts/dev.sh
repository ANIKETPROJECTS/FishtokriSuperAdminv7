#!/bin/bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${API_PORT:-8080}"
WEB_PORT="${PORT:-5000}"

echo "Waiting for API server on port ${API_PORT}..."
until curl -sf "http://localhost:${API_PORT}/api/healthz" > /dev/null 2>&1; do
  sleep 1
done
echo "API server ready."

if curl -sf "http://localhost:${WEB_PORT}/" > /dev/null 2>&1; then
  echo "Web server already running on port ${WEB_PORT}. Idling so this workflow stays alive."
  while true; do sleep 3600; done
else
  cd "$ROOT_DIR/artifacts/fishtokri-admin" && PORT="$WEB_PORT" BASE_PATH=/ pnpm run dev
fi
