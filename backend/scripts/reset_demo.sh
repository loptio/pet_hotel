#!/usr/bin/env bash
# Reset to a pristine, fully-populated demo state for recording.
# Wipes the DB volume, rebuilds schema, seeds RBAC/services/kennels, then drives
# the API to create demo pets + bookings across all states.
#
#   cd backend && bash scripts/reset_demo.sh
#
# Requires: docker compose (postgres), backend/.venv, and the API will be
# (re)started by this script on 127.0.0.1:8000.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"          # pet-hotel-system/
BACKEND="$ROOT/backend"
PY="$BACKEND/.venv/bin/python"

echo "▸ resetting postgres volume…"
cd "$ROOT"
docker compose down -v
docker compose up -d postgres
echo "▸ waiting for postgres…"; sleep 10

echo "▸ migrate + seed…"
cd "$BACKEND"
.venv/bin/alembic upgrade head
"$PY" scripts/seed.py

echo "▸ (re)starting API on :8000…"
lsof -ti:8000 2>/dev/null | xargs kill 2>/dev/null || true
sleep 1
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --log-level warning >/tmp/uvicorn_overnight.log 2>&1 &
for i in $(seq 1 40); do curl -s --max-time 1 http://127.0.0.1:8000/health >/dev/null 2>&1 && break; sleep 0.5; done

echo "▸ seeding demo bookings via API…"
"$PY" scripts/demo_data.py

echo "✅ demo reset complete. Frontend: cd ../frontend && npm run dev  →  http://localhost:5173"
echo "   accounts: owner/frontdesk/groomer/admin@demo.example.com  ·  Passw0rd!"
