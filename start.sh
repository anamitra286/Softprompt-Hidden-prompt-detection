#!/usr/bin/env bash
# Start the SoftPrompt backend and frontend together for local development.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$ROOT/backend/.venv" ]; then
  echo "Creating backend virtualenv..."
  python3 -m venv "$ROOT/backend/.venv"
  "$ROOT/backend/.venv/bin/pip" install -q -r "$ROOT/backend/requirements.txt"
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd "$ROOT/frontend" && npm install)
fi

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT

(cd "$ROOT/backend" && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000) &
(cd "$ROOT/frontend" && npm run dev) &

echo "Backend  : http://127.0.0.1:8000/docs"
echo "Frontend : http://127.0.0.1:5173"
wait
