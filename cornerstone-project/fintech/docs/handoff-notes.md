# Handoff Notes — Sita Fintech Security Layer

**Project:** Kenyan Digital Lender — IBM Cornerstone Project (Security Pathway)  
**Author:** Solo submission  
**Last updated:** 2026-10  

---

## 1. Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| Node.js | 18.x or higher | Run fintech API and pipelines |
| Python | 3.10 or higher | Run Django-based sector tests |
| Podman | 4.x or higher | Container runtime on RHEL 9 |
| podman-compose | 1.x or higher | Orchestrate app + db containers |
| Git | Any | Clone the repository |
| RHEL 9 IBM Cloud VPC | 2 vCPU / 4 GB RAM minimum | Application host |
| Microsoft Azure account | Free tier or higher | Sentinel workspace |
| Microsoft Sentinel workspace | `sita-fintech-law` | SIEM — receives security events |
| Azure Monitor Agent (AMA) | Installed via Azure Arc | Forwards rsyslog events to Sentinel |

---

## 2. Environment Variables

All variables live in `cornerstone-project/.env`. Copy from `.env.example` and fill in:

| Variable | Purpose | Example value |
|---|---|---|
| `SITA_MOCK_MODE` | `1` = in-memory mocks, `0` = live PostgreSQL + IBM APIs | `0` (live) / `1` (local dev) |
| `DATABASE_URL` | PostgreSQL connection string for the fintech app | `postgresql://sita:sita_pass@127.0.0.1:5432/sita_sprint` |
| `CORE_BANKING_DB_URL` | PostgreSQL connection used by DataStage connector | `postgresql://sita:sita_pass@127.0.0.1:5432/sita_sprint` |
| `POSTGRES_USER` | PostgreSQL superuser name | `sita` |
| `POSTGRES_PASSWORD` | PostgreSQL superuser password | `sita_pass` |
| `POSTGRES_DB` | Database name created on first boot | `sita_sprint` |
| `APP_PORT` | Port the Node.js API listens on | `3000` |
| `IBM_MDM_URL` | IBM MDM API base URL (optional — mock used if blank) | `https://your-mdm.example.com` |
| `IBM_MDM_API_KEY` | IBM MDM API key (optional) | leave blank for mock mode |
| `WATSON_ML_ENDPOINT` | Watson ML scoring endpoint (optional) | `https://us-south.ml.cloud.ibm.com` |
| `WATSON_API_KEY` | Watson ML API key (optional) | leave blank for mock mode |

> **Note:** `SITA_MOCK_MODE=1` is safe for local development and runs all tests without
> any cloud credentials. Set `SITA_MOCK_MODE=0` on the RHEL 9 VPC for live operation.

---

## 3. Deployment Steps (RHEL 9 VPC)

### 3.1 — First-time setup

```bash
# 1. Update system and install dependencies
sudo dnf update -y
sudo dnf module reset nodejs -y && sudo dnf module enable nodejs:18 -y
sudo dnf install -y git curl wget nano python3-pip podman nodejs
pip3 install podman-compose

# 2. Clone the repository
git clone https://github.com/YOUR_USERNAME/IBMxMCStudioProgram.git
cd IBMxMCStudioProgram/cornerstone-project

# 3. Set up environment
cp .env.example .env
nano .env
# Set: SITA_MOCK_MODE=0
# Set: DATABASE_URL=postgresql://sita:sita_pass@127.0.0.1:5432/sita_sprint
# Set: CORE_BANKING_DB_URL=postgresql://sita:sita_pass@127.0.0.1:5432/sita_sprint
# Set: POSTGRES_USER=sita, POSTGRES_PASSWORD=sita_pass, POSTGRES_DB=sita_sprint, APP_PORT=3000

# 4. Build images (no cache to ensure latest code)
cd fintech
podman build --no-cache -t localhost/fintech_app -f Dockerfile ..
podman build --no-cache -t localhost/fintech_db -f Dockerfile.db ..

# 5. Start containers
podman-compose up -d

# 6. Verify
sleep 30 && curl -s http://localhost:3000/reports
```

### 3.2 — Redeployment (after git pull)

```bash
cd ~/IBMxMCStudioProgram
git pull origin main
cd cornerstone-project/fintech
podman-compose down
podman rmi localhost/fintech_app -f
podman build --no-cache -t localhost/fintech_app -f Dockerfile ..
podman-compose up -d
```

### 3.3 — Stop everything

```bash
cd ~/IBMxMCStudioProgram/cornerstone-project/fintech
podman-compose down -v
```

---

## 4. Azure Monitor Agent Setup (RHEL 9 VPC → Microsoft Sentinel)

### 4.1 — Install Azure CLI and connect via Arc

```bash
sudo rpm --import https://packages.microsoft.com/keys/microsoft.asc
sudo dnf install -y https://packages.microsoft.com/config/rhel/9/packages-microsoft-prod.rpm
sudo dnf install -y azure-cli
az login --use-device-code
curl -sSL https://aka.ms/azcmagent-linux | sudo bash
sudo azcmagent connect \
  --resource-group "sita-fintech-security-rg" \
  --tenant-id "$(az account show --query tenantId -o tsv)" \
  --location "$(az group show --name sita-fintech-security-rg --query location -o tsv)" \
  --subscription-id "$(az account show --query id -o tsv)"
```

### 4.2 — Install AMA extension

```bash
sudo az login --use-device-code
sudo az connectedmachine extension create \
  --name AzureMonitorLinuxAgent \
  --publisher Microsoft.Azure.Monitor \
  --type AzureMonitorLinuxAgent \
  --machine-name "$(hostname)" \
  --resource-group "sita-fintech-security-rg" \
  --location "$(az group show --name sita-fintech-security-rg --query location -o tsv)" \
  --enable-auto-upgrade true
```

### 4.3 — Configure rsyslog forwarding

```bash
sudo tee /etc/rsyslog.d/50-sita-fintech.conf << 'EOF'
if $programname == 'sita-fintech' then {
    action(type="omfwd" target="127.0.0.1" port="28330" protocol="tcp")
    stop
}
auth.*      action(type="omfwd" target="127.0.0.1" port="28330" protocol="tcp")
authpriv.*  action(type="omfwd" target="127.0.0.1" port="28330" protocol="tcp")
EOF
sudo systemctl restart rsyslog
```

### 4.4 — Create Data Collection Rule (Azure Portal)

1. Azure Portal → Data Collection Rules → **+ Create**
2. Name: `sita-fintech-dcr`, RG: `sita-fintech-security-rg`, Platform: Linux
3. Resources: add RHEL 9 VM (under Azure Arc → Machines)
4. Data source: Syslog, facility `syslog` + `authpriv`, level `LOG_DEBUG`
5. Destination: Azure Monitor Logs → `sita-fintech-law`

---

## 5. Running Tests

### Mock mode (local / no cloud credentials needed)

```bash
cd cornerstone-project/fintech
$env:SITA_MOCK_MODE="1"   # PowerShell (Windows)
# export SITA_MOCK_MODE=1  # bash (Linux)
node tests/cbk_pipeline.test.js
```

Expected output:
```
{"category":"ADMIN_ACTION","outcome":"initiated",...}
{"category":"ADMIN_ACTION","outcome":"success",...}
CBK report RPT-1 generated: .../output/CBK_Monthly_Credit_Return_2026-05_...json
[PASS] fintech CBK pipeline: RPT-1
```

### Burst detector unit test

```bash
cd cornerstone-project/fintech
node -e "
const { checkBurst, resetGuard } = require('./security/transaction_rate_guard');
resetGuard();
for (let i = 1; i <= 6; i++) console.log('Call ' + i + ': burst=' + checkBurst('ACC-001'));
"
```

Expected: calls 1–5 print `burst=false`, call 6 prints `burst=true`

---

## 6. Manually Triggering Each Sentinel Rule

Run these curl commands against the live API on the RHEL 9 VPC (replace IP if needed):

### Trigger R1 — Transaction Burst

Run this 6 times in quick succession:
```bash
for i in {1..6}; do
  curl -s -X POST http://localhost:3000/reports/generate \
    -H "Content-Type: application/json" \
    -d '{"period":"2026-05"}' && sleep 1
done
```

Expected: `TRANSACTION_BURST` events appear in Sentinel Logs within 5 minutes, R1 incident fires.

### Trigger R2 — Unauthorised API Access

Run this 3 times:
```bash
for i in {1..3}; do
  curl -s -X POST http://localhost:3000/compliance/submit \
    -H "Content-Type: application/json" \
    -d '{}' && sleep 1
done
```

Expected: `UNAUTHORISED_ACCESS` events appear in Sentinel Logs, R2 incident fires.

### Trigger R3 — After-Hours Admin Action

Run this outside 07:00–19:00 EAT (UTC+3):
```bash
curl -s -X POST http://localhost:3000/reports/generate \
  -H "Content-Type: application/json" \
  -H "x-user: demo-admin" \
  -d '{"period":"2026-06"}'
```

Expected: `ADMIN_ACTION` event with EAT hour outside business hours triggers R3 incident.

---

## 7. Known Limitations

| Limitation | Detail | Workaround |
|---|---|---|
| PDF generation writes JSON | `report_utils.js` writes a `.json` artifact in mock mode, not a real PDF | Acceptable for demo — shows report content clearly |
| Sentinel rule latency | Analytics rules run every 5 minutes — incidents may take up to 5 min to appear after trigger | Trigger events at least 5 minutes before the demo slot |
| TechZone environment expiry | RHEL 9 VPC reservations expire — redeploy using Section 3.1 above | Request a new reservation 6h before the demo |
| AMA event delay | Events forwarded via AMA may take 2–5 minutes to appear in Sentinel Logs | Wait 5 minutes after first event before checking Sentinel |
| Mock mode on Windows | `logger` command unavailable on Windows — syslog call is silently skipped | Only relevant for local dev — SITA_MOCK_MODE=1 handles this |

---

*Sita Sector Sprint · MC Studio · IBM Silver Partner · Nairobi, Kenya*  
*Cornerstone Project — Security Pathway — Solo submission*
