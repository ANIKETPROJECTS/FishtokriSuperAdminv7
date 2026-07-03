#!/bin/bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${API_PORT:-8080}"
WEB_PORT="${PORT:-5000}"
WAIT_TIMEOUT="${API_WAIT_TIMEOUT:-60}"

echo "Waiting for API server on port ${API_PORT} (timeout: ${WAIT_TIMEOUT}s)..."
elapsed=0
until curl -sf "http://localhost:${API_PORT}/api/healthz" > /dev/null 2>&1; do
  if [ "$elapsed" -ge "$WAIT_TIMEOUT" ]; then
    echo "ERROR: API server did not become healthy after ${WAIT_TIMEOUT}s. Check the 'Start API' workflow logs." >&2
    exit 1
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done
echo "API server ready."

if curl -sf "http://localhost:${WEB_PORT}/" > /dev/null 2>&1; then
  echo "Web server already running on port ${WEB_PORT}. Idling so this workflow stays alive."
  while true; do sleep 3600; done
else
  cd "$ROOT_DIR/artifacts/fishtokri-admin" && PORT="$WEB_PORT" BASE_PATH=/ pnpm run dev
fi
