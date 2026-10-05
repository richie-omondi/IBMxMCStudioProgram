# Sita Fintech — Deployment Guide (RHEL 9 / Podman)

## Prerequisites

| Requirement | Version | Install |
|---|---|---|
| Podman | ≥ 4.x | `sudo dnf install -y podman` |
| podman-compose | ≥ 1.0 | `sudo dnf install -y podman-compose` (or `pip3 install podman-compose`) |
| Git | any | `sudo dnf install -y git` |
| Node.js (local test only) | 18.x | `sudo dnf module install -y nodejs:18` |

---

## Clone and configure

```bash
# 1. Clone the repository
git clone <YOUR_REPO_URL> sita-cornerstone
cd sita-cornerstone/cornerstone-project

# 2. Copy the environment template
cp .env.example .env

# 3. Edit .env — at minimum set:
#    SITA_MOCK_MODE=0          (for live PostgreSQL)
#    POSTGRES_USER=sita
#    POSTGRES_PASSWORD=<strong-password>
#    POSTGRES_DB=sita_sprint
#    DATABASE_URL=postgresql://sita:<password>@db:5432/sita_sprint
#    CORE_BANKING_DB_URL=postgresql://sita:<password>@db:5432/sita_sprint
vi .env
```

---

## Start with podman-compose

```bash
cd cornerstone-project/fintech

# Build image and start both services (app + db) in detached mode
podman-compose up -d

# Follow logs
podman-compose logs -f
```

The `init.sql` file is automatically executed by the PostgreSQL container on first boot, creating all four tables.

---

## Verify the deployment

```bash
# Health check — list reports endpoint
curl -s http://localhost:3000/reports | python3 -m json.tool

# Generate a CBK report
curl -s -X POST http://localhost:3000/reports/generate \
  -H 'Content-Type: application/json' \
  -d '{"period":"2026-05"}' | python3 -m json.tool

# Submit compliance
curl -s -X POST http://localhost:3000/compliance/submit \
  -H 'Content-Type: application/json' \
  -d '{"reportId":"RPT-1","regulator":"CBK"}' | python3 -m json.tool
```

Expected response from `/reports/generate`:
```json
{ "reportId": "RPT-1", "regulator": "CBK" }
```

---

## Run the test suite

```bash
# From cornerstone-project/fintech/ — mock mode (no DB required)
SITA_MOCK_MODE=1 node tests/cbk_pipeline.test.js

# Expected output:
# CBK report RPT-1 generated: .../output/CBK_Monthly_Credit_Return_2026-05_<ts>.json
# [PASS] fintech CBK pipeline: RPT-1
```

---

## Tear down

```bash
podman-compose down          # stop containers, keep pgdata volume
podman-compose down -v       # stop containers AND delete pgdata volume
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `app` exits immediately | Check `podman-compose logs app` — likely `.env` missing or PostgreSQL not yet ready. The entrypoint retries 30 times with 2 s delay. |
| Port 3000 already in use | `sudo ss -tlnp \| grep 3000` — kill the conflicting process or change `APP_PORT` in `.env`. |
| `pg_isready: command not found` in entrypoint | The base image is `node:18-slim`; `pg_isready` is not pre-installed. The entrypoint uses it via the `postgresql-client` package — add `RUN apt-get update && apt-get install -y postgresql-client` to the Dockerfile if needed on your build. |
| Permission denied on `entrypoint.sh` | `chmod +x cornerstone-project/fintech/entrypoint.sh` locally, then rebuild. |
