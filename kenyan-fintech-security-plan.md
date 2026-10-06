# Kenyan Fintech Security Cornerstone Project — Implementation Plan

## Top-Level Overview

**Goal:** Extend the existing Sita Sector Fintech monorepo (Kenyan Digital Lender case study) with a
real-time security and anomaly monitoring layer that satisfies the IBM Security Pathway and the
declared Audience Feature — *real-time security/anomaly monitoring for internal compliance and
operations staff*.

**Scope:**
- Instrument the existing Node.js fintech application (CBK pipeline, compliance API, report
  scheduler) to emit structured security events
- Ship those events from the RHEL 9 IBM Cloud VPC to Microsoft Sentinel via rsyslog + Azure
  Monitor Agent (AMA)
- Build three Sentinel Analytics Rules (KQL) that cover the three highest-risk patterns in the
  Kenyan digital-lender context (high-frequency suspicious transactions, unauthorised API access
  attempts, privilege-escalation / admin actions)
- Add a GitHub Advanced Security (GHAS) workflow to the repo for pipeline secret and dependency
  scanning
- Write a short compliance mapping document that ties each rule back to the Kenya CBK/ODPC
  regulatory requirements in `africa-regulatory/kenya.md`
- Produce handoff notes sufficient for another team to pick up the build

**What is NOT in scope:**
- IBM Guardium (database-level auditing) — kept out to maintain a tight solo scope
- Full CBK report UI — the existing pipeline already handles report generation; this plan only adds
  the security instrumentation layer on top of it
- Refactoring existing sector code — all changes are additive

> **Note — SIEM change:** IBM QRadar on Cloud was unavailable on TechZone at time of build.
> Microsoft Sentinel (Azure Log Analytics Workspace: `sita-fintech-law`, Resource Group:
> `sita-fintech-security-rg`) was used as a drop-in replacement. CEF-compatible JSON events
> emitted by `audit_logger.js` are forwarded via rsyslog → Azure Monitor Agent → Sentinel.
> The three detection rules are implemented as Sentinel Scheduled Query Rules (KQL) instead of
> QRadar rules. All rubric criteria are satisfied equivalently.

**Pathway:** Security — Microsoft Sentinel (replacing IBM QRadar on Cloud)
**Sector:** Fintech — Kenyan Digital Lender
**Audience Feature:** Real-time security/anomaly monitoring
**Team:** Solo
**Environments:** QRadar on Cloud + RHEL 9 IBM Cloud VPC (itz-vpc-02-eu-es-europe-eu-es-3)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│            RHEL 9 IBM Cloud VPC                     │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  Fintech App (Docker / Podman)               │   │
│  │  - Node.js API  (compliance.js, reports.js)  │   │
│  │  - CBK pipeline (cbk_report_pipeline.js)     │   │
│  │  - PostgreSQL   (loan/customer/txn tables)   │   │
│  └──────────┬───────────────────────────────────┘   │
│             │ security events (JSON → syslog)        │
│  ┌──────────▼───────────────────────────────────┐   │
│  │  security/audit_logger.js                    │   │
│  │  (new — wraps existing API routes)           │   │
│  └──────────┬───────────────────────────────────┘   │
│             │ rsyslog UDP/TCP 514                    │
│  ┌──────────▼───────────────────────────────────┐   │
│  │  rsyslog  (RHEL 9 system daemon)             │   │
│  └──────────┬───────────────────────────────────┘   │
└─────────────┼───────────────────────────────────────┘
              │ TLS syslog (QRadar Log Source)
┌─────────────▼───────────────────────────────────────┐
│            IBM QRadar on Cloud                      │
│                                                     │
│  Log Source: Sita-Fintech-RHEL9                     │
│  DSM:        Universal DSM (custom event mapping)   │
│                                                     │
│  Detection Rules:                                   │
│  R1 — High-frequency transaction burst              │
│  R2 — Repeated unauthorised API access              │
│  R3 — Admin/privilege action outside business hours │
│                                                     │
│  Dashboard: Fintech Security Overview               │
└─────────────────────────────────────────────────────┘

GitHub Actions (GHAS)
  ├── CodeQL scan  (on push / PR)
  └── Dependency review (on PR)
```

---

## Sub-Tasks

---

### Sub-Task 1 — Containerise the Fintech Application on the RHEL 9 VPC

**Status:** `[ ] pending`

**Intent:**
The existing fintech Node.js application runs locally in mock mode. This sub-task makes it
deployable on the provisioned RHEL 9 VPC using Podman (RHEL 9's default container runtime), with
PostgreSQL running as a companion container. This satisfies the *Environment & provisioning* rubric
criterion (10%) and creates the live system that will generate real security events.

**Expected Outcomes:**
- `Dockerfile` present in `SitaSector Live files/SitaSector Live files/fintech/`
- `docker-compose.yml` (Podman-compatible) at the monorepo root of the fintech directory
- Application starts with `podman-compose up` on the RHEL 9 VM
- `npm run test:fintech` passes against the live PostgreSQL container (SITA_MOCK_MODE=0)
- The CBK pipeline endpoint (`POST /reports/generate`) responds on port 3000

**Todo List:**
1. Create `fintech/Dockerfile` — Node 18 slim image, copy fintech + shared directories, expose
   port 3000
2. Create `fintech/docker-compose.yml` — two services: `app` (the Dockerfile above) and `db`
   (postgres:15), with a named volume for data persistence and environment variables wired from
   `.env`
3. Add a `fintech/init.sql` that runs all four SQL model files
   (`customer.sql`, `loan_account.sql`, `repayment_transaction.sql`, `regulatory_report.sql`) in
   order on first boot
4. Update `.env.example` to add `APP_PORT=3000` and document the Podman deployment steps
5. Add a `fintech/entrypoint.sh` that waits for PostgreSQL to be ready before starting the Node
   process (simple pg connection retry loop)
6. On the RHEL 9 VM: install Podman + podman-compose, clone the repo, copy `.env.example` → `.env`,
   set `SITA_MOCK_MODE=0` and `DATABASE_URL` to the compose service hostname, run
   `podman-compose up -d`
7. Verify: hit `GET /reports` from the VM's localhost and confirm a 200 response

**Relevant Context:**
- Existing app entry point: `SitaSector Live files/SitaSector Live files/fintech/db.js` delegates
  to `shared/db_mock.js`; when `SITA_MOCK_MODE=0` it switches to real `pg` Pool
- Shared clients: `shared/datastage_connector.js`, `shared/ibm_mdm_client.js` — both already
  handle mock vs live via env var
- SQL models: `fintech/models/*.sql` — all four files need to be run once in dependency order
- Package deps already include `pg` and `dotenv` — no new npm packages needed for this sub-task

---

### Sub-Task 2 — Security Event Instrumentation (Audit Logger)

**Status:** `[ ] pending`

**Intent:**
Add a thin audit logging module that wraps the existing API routes and pipeline entry points,
emitting structured JSON security events to stdout / local syslog socket. This is the event
*source* that QRadar will consume. Every event must carry enough context (timestamp, actor,
action, resource, outcome, IP) to trigger meaningful QRadar rules.

The three event categories to instrument match the three QRadar rules planned in Sub-Task 4:
- `TRANSACTION_BURST` — emitted when a single account_id appears in more than N repayment
  POST calls within a rolling window
- `UNAUTHORISED_ACCESS` — emitted on any 401/403 response from the compliance or reports routes
- `ADMIN_ACTION` — emitted when the CBK/CMA report generation or submission endpoint is called,
  recording the caller identity and timestamp

**Expected Outcomes:**
- New file: `fintech/security/audit_logger.js`
- New file: `fintech/security/transaction_rate_guard.js` (in-memory sliding window counter)
- Existing route files (`compliance.js`, `reports.js`) updated to call the audit logger at entry
  and exit — no logic changes, only logging calls added
- `cbk_report_pipeline.js` emits an `ADMIN_ACTION` event at pipeline start and completion
- All events written in CEF (Common Event Format) compatible JSON so QRadar's Universal DSM can
  parse them without a custom parser
- `npm run test:fintech` still passes (logging is additive, no functional changes)

**Todo List:**
1. Create `fintech/security/audit_logger.js`:
   - Exports a single `logEvent(category, payload)` function
   - Formats output as a JSON line: `{ timestamp, category, ...payload }`
   - Writes to `process.stdout` and also to the local Unix syslog socket via Node's
     `child_process.exec('logger ...')` call so rsyslog picks it up
   - In mock mode (`SITA_MOCK_MODE=1`) writes to stdout only (no syslog call)
2. Create `fintech/security/transaction_rate_guard.js`:
   - Maintains an in-memory Map of `account_id → [timestamps]`
   - Exports `checkBurst(accountId, threshold=5, windowMs=60000)` — returns `true` if the
     account has exceeded `threshold` events in the rolling window, purges stale entries
3. Update `fintech/api/routes/reports.js` — add `logEvent('ADMIN_ACTION', ...)` at the start
   of `generateReport` and on completion; add `logEvent('UNAUTHORISED_ACCESS', ...)` on any
   caught auth error
4. Update `fintech/api/routes/compliance.js` — add `logEvent('ADMIN_ACTION', ...)` when
   `submitCompliance` is called
5. Update `fintech/pipelines/cbk_report_pipeline.js` — add `logEvent('ADMIN_ACTION', ...)` at
   pipeline start and after the final `UPDATE regulatory_reports` call
6. Add a `fintech/security/README.md` explaining the three event categories, their JSON schema,
   and how they map to QRadar rule conditions — this doubles as part of the handoff notes

**Relevant Context:**
- Routes to instrument: `fintech/api/routes/compliance.js` (9 lines),
  `fintech/api/routes/reports.js` (13 lines) — both are thin stubs; changes are purely additive
- Pipeline: `fintech/pipelines/cbk_report_pipeline.js` — instrument after line 17 (start) and
  after line 55 (PDF path written)
- CEF JSON format expected by QRadar Universal DSM:
  `{ "deviceVendor":"SitaFintech", "deviceProduct":"LendingAPI", "category":"ADMIN_ACTION",
    "src":"<ip>", "suser":"<caller>", "outcome":"success"|"failure", "msg":"<detail>" }`

---

### Sub-Task 3 — rsyslog Configuration on RHEL 9 VPC

**Status:** `[ ] pending`

**Intent:**
Configure the RHEL 9 system rsyslog daemon to forward the fintech application's security events
to IBM QRadar on Cloud. This is the network transport layer that connects the instrumented
application (Sub-Task 2) to the SIEM (Sub-Task 4). Without this, QRadar receives no events and
the demo has no live data.

**Expected Outcomes:**
- `/etc/rsyslog.d/50-qradar.conf` present on the RHEL 9 VM
- Application events tagged `sita-fintech` are forwarded to QRadar on Cloud via TLS syslog
  (TCP 6514 — QRadar's encrypted log source port)
- A test `logger -t sita-fintech "TEST EVENT"` command produces a visible event in the QRadar
  Log Activity view within 60 seconds
- System auth logs (`/var/log/secure`) are also forwarded to capture OS-level login events
  (brute-force SSH attempts) — adds realism to the demo without extra coding

**Todo List:**
1. In the QRadar on Cloud console: add a new Log Source of type **Universal DSM**, name it
   `Sita-Fintech-RHEL9`, set protocol to **Syslog (TLS)**, note the assigned Log Source
   Identifier
2. Download the QRadar TLS certificate from the console and place it at
   `/etc/rsyslog.d/qradar-ca.pem` on the RHEL 9 VM
3. Create `/etc/rsyslog.d/50-qradar.conf` with:
   - `$DefaultNetstreamDriverCAFile /etc/rsyslog.d/qradar-ca.pem`
   - A filter rule that matches `programname == 'sita-fintech'` and forwards to QRadar TLS
     endpoint
   - A second rule forwarding `auth.*` and `authpriv.*` to the same QRadar endpoint
4. Restart rsyslog: `sudo systemctl restart rsyslog`
5. Open firewall port if needed: `sudo firewall-cmd --add-port=6514/tcp --permanent`
6. Trigger a test event from the app container and verify it appears in QRadar Log Activity
7. Add the rsyslog config file to the repo under `fintech/deployment/rsyslog/50-qradar.conf`
   (with the actual QRadar hostname as a placeholder `QRADAR_HOST`) for handoff documentation

**Relevant Context:**
- RHEL 9 ships with rsyslog 8.x which supports `omfwd` with TLS natively
- QRadar on Cloud uses port **6514** for TLS syslog by default (verify in your console under
  Admin → Log Sources → Protocol Configuration)
- The `audit_logger.js` from Sub-Task 2 uses `logger -t sita-fintech` to write to syslog —
  this tag is what the rsyslog filter matches

---

### Sub-Task 4 — QRadar Detection Rules and Dashboard

**Status:** `[ ] pending`

**Intent:**
Create the three detection rules in QRadar on Cloud that turn raw log events into actionable
security alerts. This is the core Security Pathway deliverable and directly demonstrates the
*Audience Feature* (real-time anomaly monitoring). Each rule must fire against live data during
the demo to score at level 3–4 on the rubric.

The rules are grounded in the Kenya CBK/ODPC regulatory context:
- **R1 (Transaction Burst)** — CBK requires monitoring for suspicious high-frequency payment
  activity (AML/CFT obligation)
- **R2 (Unauthorised API Access)** — ODPC data protection requires logging and alerting on
  unauthorised attempts to access customer PII
- **R3 (After-Hours Admin Action)** — Internal control requirement; CBK audit trail rules require
  privileged actions to be flagged for review

**Expected Outcomes:**
- Three custom rules active in QRadar on Cloud, each with an offense category and magnitude set
- A QRadar Dashboard named **"Sita Fintech — Security Overview"** with three widgets:
  - Event rate graph (last 24h)
  - Active offenses list
  - Top event categories pie chart
- All three rules fire at least once during a manually triggered test run before the demo
- Rule definitions exported as QRadar rule XML / JSON backup and saved to
  `fintech/deployment/qradar/rules/` for handoff

**Todo List:**
1. In QRadar Console → Rules → New Event Rule:
   **R1 — Transaction Burst:**
   - Condition: `when the same source IP or username is seen in more than 5 events with category
     TRANSACTION_BURST in 60 seconds`
   - Action: Create offense, severity High, category "Suspicious Activity"
2. **R2 — Unauthorised API Access:**
   - Condition: `when the same source IP generates more than 3 events with category
     UNAUTHORISED_ACCESS in 5 minutes`
   - Action: Create offense, severity Medium, category "Access Violation"
3. **R3 — After-Hours Admin Action:**
   - Condition: `when an event with category ADMIN_ACTION occurs and local time is outside
     07:00–19:00 EAT (UTC+3)`
   - Action: Create offense, severity Medium, category "Policy Violation"
4. Create the **Sita Fintech — Security Overview** dashboard with the three widgets listed above
5. Run `npm run test:fintech` against the live app on the VPC to generate real events; verify
   each rule fires and creates an offense
6. Export rule definitions: QRadar Console → Rules → select each rule → Export, save XML files
   to `fintech/deployment/qradar/rules/R1_transaction_burst.xml` etc.
7. Take screenshots of the dashboard with active offenses — include in the demo slides

**Relevant Context:**
- The CEF JSON fields `category`, `suser`, `src`, and `outcome` from `audit_logger.js`
  (Sub-Task 2) are what QRadar rule conditions filter on
- QRadar EAT timezone: set the Log Source timezone to `Africa/Nairobi` (UTC+3) so the
  after-hours rule uses the correct local time
- QRadar Universal DSM auto-maps `category` to QRadar's High-Level Category if the field name
  matches — verify in DSM Editor after first events arrive

---

### Sub-Task 5 — GitHub Advanced Security (GHAS) Pipeline

**Status:** `[ ] pending`

**Intent:**
Add a GitHub Actions workflow that runs CodeQL static analysis and dependency vulnerability
review on every push and pull request. This satisfies the *DevSecOps* security control in the
proposal and provides a demonstrable pipeline security layer during the demo without requiring
a separate environment.

**Expected Outcomes:**
- `.github/workflows/security.yml` present in the repo
- CodeQL scan runs on push to `main` and on any PR targeting `main`, covering JavaScript
- Dependency review action runs on PRs and blocks merge if a critical vulnerability is introduced
- At least one finding (even informational) visible in the GitHub Security tab before the demo
  (demonstrates the feature is working)

**Todo List:**
1. Create `.github/workflows/security.yml`:
   - Trigger: `push` to `main`, `pull_request` targeting `main`
   - Job 1 `codeql`: uses `github/codeql-action/init` (language: javascript) +
     `github/codeql-action/analyze`
   - Job 2 `dependency-review`: uses `actions/dependency-review-action` with
     `fail-on-severity: critical`
2. Ensure `.gitignore` already excludes `.env` and `node_modules` (it does — verify and leave
   as-is)
3. Push a test commit to trigger the workflow and confirm both jobs pass in the Actions tab
4. Add a badge to the repo `README.md` linking to the workflow status

**Relevant Context:**
- Repo already has `.gitignore` and `.gitattributes` at root — do not modify these
- `package.json` lists only `dotenv` and `pg` as dependencies — both are well-known and unlikely
  to produce critical CVEs, but the workflow still demonstrates the control is in place
- CodeQL JavaScript analysis covers Node.js — it will scan `fintech/`, `edtech/`, `retail/`,
  `energy/` JS files

---

### Sub-Task 6 — Compliance Mapping Document

**Status:** `[ ] pending`

**Intent:**
Write a short document that explicitly maps each QRadar rule and security control to the Kenya
CBK/ODPC regulatory requirements. This is what earns the *Sector case-study grounding* score
(20%) — it proves the build is not generic but is specifically designed around the Kenyan
digital-lender regulatory context. It also contributes to the *Documentation / handoff notes*
criterion (5%).

**Expected Outcomes:**
- New file: `fintech/docs/compliance-mapping.md`
- Document covers: regulatory obligation → security control implemented → QRadar rule that
  enforces it → how to verify in the demo
- References `africa-regulatory/kenya.md` for CBK/ODPC citations
- Readable in under 10 minutes by a reviewer who has not seen the codebase before

**Todo List:**
1. Create `fintech/docs/compliance-mapping.md` with a mapping table:

   | Regulation | Obligation | Control Implemented | QRadar Rule | Demo Verification |
   |---|---|---|---|---|
   | CBK AML/CFT | Monitor suspicious payment activity | Transaction rate guard + R1 rule | R1 — Transaction Burst | Trigger 6 rapid POSTs to `/reports/generate`, show offense in QRadar |
   | ODPC Data Protection | Log and alert on unauthorised PII access | 401/403 audit events + R2 rule | R2 — Unauthorised API Access | Send unauthenticated request to `/compliance/submit`, show offense |
   | CBK Internal Controls | Privileged actions must be logged and flagged | Admin action audit events + R3 rule | R3 — After-Hours Admin Action | Run pipeline outside EAT business hours, show offense |
   | CBK Audit Trail | Immutable record of all report submissions | `regulatory_reports` table + audit log | All rules (log retention) | Show QRadar Log Activity query returning full event history |
   | ODPC Breach Prevention | Code must not expose credentials or PII | GHAS CodeQL + dependency review | GitHub Actions workflow | Show green workflow run in GitHub Actions tab |

2. Add a short narrative section (3–4 paragraphs) explaining the Kenyan digital-lender context,
   why these specific controls are required, and what a real CBK compliance officer would look
   for in the demo
3. Cross-reference `africa-regulatory/kenya.md` sections 2 and 4 (Central bank / Fintech
   compliance steps) with inline links

**Relevant Context:**
- `africa-regulatory/kenya.md` section 2: CBK licensing, AML/CFT, ODPC
- `africa-regulatory/kenya.md` section 4: Fintech primary compliance steps
- The mapping table is also useful as a demo script — walk through each row live

---

### Sub-Task 7 — Handoff Notes and Demo Script

**Status:** `[ ] pending`

**Intent:**
Produce the written handoff notes required by the *Documentation / handoff notes* rubric
criterion (5%) and a structured demo script to guide the 10–15 minute live walkthrough. The
handoff notes must be complete enough that another team could reproduce the full build from
scratch.

**Expected Outcomes:**
- New file: `fintech/docs/handoff-notes.md` — environment setup, deployment steps, credential
  variables, how to run tests, how to trigger each QRadar rule
- New file: `fintech/docs/demo-script.md` — timed, step-by-step walkthrough structured as:
  problem statement → data model tour → live pipeline run → QRadar dashboard → offense drill-down
  → GHAS scan → what I'd do with more time
- Both documents are accurate (commands verified against the actual deployed environment)

**Todo List:**
1. Write `fintech/docs/handoff-notes.md` with these sections:
   - Prerequisites (Node 18+, Python 3.10+, Podman, RHEL 9 VPC, QRadar on Cloud tenant)
   - Environment variables table (every variable in `.env.example` with purpose and example value)
   - Deployment steps (clone → env → podman-compose up → verify → rsyslog config → QRadar log
     source setup)
   - How to run each test (`npm run test:fintech`, Python tests)
   - How to manually trigger each QRadar rule (exact curl commands or API calls)
   - Known limitations (mock mode vs live, PDF generation writes JSON artifact not real PDF)
2. Write `fintech/docs/demo-script.md` with a timed walkthrough:
   - 0:00–1:30 — Problem statement: the manual CBK reporting pain + security gap
   - 1:30–3:30 — Data model: show the 4 SQL tables, explain the loan lifecycle
   - 3:30–6:00 — Live pipeline run: `POST /reports/generate`, show CBK report artifact generated
   - 6:00–9:00 — QRadar dashboard: show the Security Overview dashboard, explain the 3 rules
   - 9:00–11:30 — Trigger an offense: send burst transactions, switch to QRadar offense view
   - 11:30–13:00 — Compliance mapping: reference the table in `compliance-mapping.md`, explain
     the CBK/ODPC tie-in
   - 13:00–14:30 — GHAS: show GitHub Actions security scan result
   - 14:30–15:00 — What I'd do with more time: IBM Guardium for DB-level auditing, Guardium
     Vulnerability Assessment, full OpenPages rule library

**Relevant Context:**
- Demo is 10–15 minutes solo — the script above is 15 minutes; trim the data model section if
  running short
- The compliance-mapping table from Sub-Task 6 doubles as a live reference during the demo
- All curl commands in the handoff notes should target `http://localhost:3000` (or the VPC
  public IP) so they work both locally and on the VM

---

## Rubric Self-Check

| Criterion | Weight | How This Plan Addresses It |
|---|---|---|
| Environment & provisioning | 10% | RHEL 9 VPC + Podman deployment (Sub-Task 1); QRadar on Cloud tenant (Sub-Task 3/4) |
| Technical build — pathway fit | 30% | QRadar rules, log source, Universal DSM, GHAS pipeline (Sub-Tasks 2–5) |
| Sector case-study grounding | 20% | All rules grounded in CBK/ODPC obligations; compliance mapping cites kenya.md (Sub-Task 6) |
| Audience feature implementation | 20% | Three live QRadar rules demonstrated end-to-end during demo (Sub-Task 4) |
| Demo & presentation | 15% | Timed demo script, dashboard screenshots, offense drill-down (Sub-Task 7) |
| Documentation / handoff notes | 5% | Handoff notes + compliance mapping + security README (Sub-Tasks 6/7) |

**Pass threshold check:** Each criterion has a concrete deliverable. None will score 0. Target
weighted average: 3.0–3.5 / 4.0 (working, grounded, and technically polished).

---

## Dependency Order

```
Sub-Task 1 (Deploy app on VPC)
    └── Sub-Task 2 (Instrument audit logger)
            └── Sub-Task 3 (rsyslog → QRadar transport)
                    └── Sub-Task 4 (QRadar rules + dashboard)

Sub-Task 5 (GHAS) — independent, can run in parallel with Sub-Tasks 2–4

Sub-Task 6 (Compliance mapping) — after Sub-Task 4 rules are defined
Sub-Task 7 (Handoff + demo script) — after all other sub-tasks complete
```

---

*Plan authored for: Sita Sector Sprint · MC Studio · IBM Silver Partner*
*Regulatory reference: `africa-regulatory/kenya.md` — CBK/ODPC sections 2 and 4*
*Monorepo reference: `SitaSector Live files/SitaSector Live files/README.md` — Sector 1 Fintech*
