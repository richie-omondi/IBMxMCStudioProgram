#!/usr/bin/env bash
# cornerstone-project/fintech/entrypoint.sh
# Wait for PostgreSQL to be ready before starting the Node.js API.
set -e

HOST="${POSTGRES_HOST:-127.0.0.1}"
PORT="${POSTGRES_PORT:-5432}"
MAX_RETRIES=30
RETRY_INTERVAL=2

echo "[entrypoint] Waiting for PostgreSQL at ${HOST}:${PORT}..."

for i in $(seq 1 $MAX_RETRIES); do
  if pg_isready -h "$HOST" -p "$PORT" -q 2>/dev/null; then
    echo "[entrypoint] PostgreSQL is ready."
    break
  fi
  echo "[entrypoint] Attempt ${i}/${MAX_RETRIES} — not ready yet, retrying in ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
  if [ "$i" -eq "$MAX_RETRIES" ]; then
    echo "[entrypoint] PostgreSQL did not become ready in time. Exiting."
    exit 1
  fi
done

echo "[entrypoint] Starting Sita Fintech API..."
exec node /app/fintech/server.js
