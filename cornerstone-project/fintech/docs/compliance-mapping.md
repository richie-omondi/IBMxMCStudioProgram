# Compliance Mapping — Sita Fintech Security Layer

**Project:** Kenyan Digital Lender — IBM Cornerstone Project (Security Pathway)  
**Regulatory reference:** [`africa-regulatory/kenya.md`](../../../africa-regulatory/kenya.md) — sections 2 and 4  
**SIEM:** Microsoft Sentinel (Workspace: `sita-fintech-law`)  
**Last updated:** 2026-10

---

## 1. Context — Why These Controls Exist

A licensed Kenyan digital lender operates under two primary regulatory frameworks that mandate
real-time security monitoring:

**Central Bank of Kenya (CBK)** — under the Banking Act and the National Payment System
Regulations, CBK requires licensed lenders to:
- Maintain AML/CFT controls that detect and report suspicious transaction patterns
- Keep immutable audit trails of all privileged system actions (report generation, regulatory
  submissions)
- Implement internal controls that flag out-of-hours administrative activity for review

**Office of the Data Protection Commissioner (ODPC)** — under the Data Protection Act 2019,
the ODPC requires entities processing personal data (customer KYC, loan records) to:
- Log and alert on unauthorised attempts to access personal data
- Implement technical measures preventing unauthorised data processing
- Maintain records of processing activities sufficient for a breach investigation

The three security controls implemented in this project directly address these obligations. Each
control is traceable from the regulatory text through to a specific detection rule in Microsoft
Sentinel that fires during the live demo.

---

## 2. Compliance Mapping Table

| Regulation | Obligation | Control Implemented | Sentinel Rule | Demo Verification |
|---|---|---|---|---|
| CBK AML/CFT | Monitor for suspicious high-frequency payment activity | Transaction rate guard (`transaction_rate_guard.js`) emits `TRANSACTION_BURST` event when >5 generate calls hit the same period within 60s | **R1 — Transaction Burst** (KQL: counts `TRANSACTION_BURST` events per minute, alerts if >1) | Trigger 6 rapid `POST /reports/generate` calls → show R1 incident firing in Sentinel |
| ODPC Data Protection Act 2019 | Log and alert on unauthorised attempts to access customer PII / regulated data | `submitCompliance` route emits `UNAUTHORISED_ACCESS` event on missing `reportId` (400 response) | **R2 — Unauthorised API Access** (KQL: counts `UNAUTHORISED_ACCESS` failures per 5 min, alerts if >2) | Send 3 unauthenticated `POST /compliance/submit` calls without `reportId` → show R2 incident |
| CBK Internal Controls | Privileged actions (report generation, regulatory submission) must be logged and flagged for review | `cbk_report_pipeline.js` and compliance route emit `ADMIN_ACTION` events at start and completion of every privileged operation | **R3 — After-Hours Admin Action** (KQL: filters `ADMIN_ACTION` events outside 07:00–19:00 EAT) | Trigger pipeline outside EAT business hours → show R3 incident in Sentinel |
| CBK Audit Trail | Immutable record of all report submissions must be maintained | `regulatory_reports` table persists every report with status, timestamp, and file path; all pipeline actions emit `ADMIN_ACTION` events to Sentinel log | All rules (Sentinel log retention) | Show Sentinel Logs query returning full `sita-fintech` event history for the demo period |
| ODPC Breach Prevention | Code must not expose credentials or PII in source control or CI/CD pipelines | GitHub Advanced Security (GHAS): CodeQL static analysis + dependency review on every push/PR | GitHub Actions workflow (`security.yml`) | Show green GHAS workflow run in GitHub Actions tab; show Security tab for any findings |

---

## 3. Security Event to Rule Traceability

```
fintech app (Node.js)
  │
  ├── audit_logger.js ──────────────────────────────────────────────────────┐
  │     emits CEF JSON to stdout + logger -t sita-fintech                   │
  │                                                                          ▼
  ├── transaction_rate_guard.js                                    rsyslog daemon
  │     checkBurst() → TRANSACTION_BURST event                    /etc/rsyslog.d/50-sita-fintech.conf
  │                                                                          │
  ├── api/routes/reports.js                                                  │ TCP 28330
  │     ADMIN_ACTION (initiated / success / failure)                         ▼
  │     TRANSACTION_BURST (on burst detection)                    Azure Monitor Agent (AMA)
  │                                                                          │
  ├── api/routes/compliance.js                                               │
  │     ADMIN_ACTION (submission)                                            ▼
  │     UNAUTHORISED_ACCESS (missing reportId)                    Microsoft Sentinel
  │                                                                sita-fintech-law workspace
  └── pipelines/cbk_report_pipeline.js                                       │
        ADMIN_ACTION (pipeline start + completion)                ┌──────────┴──────────┐
                                                                  │                     │
                                                            Syslog table          Analytics Rules
                                                            (raw events)          R1 / R2 / R3
                                                                                        │
                                                                                  Incidents +
                                                                                  Workbook Dashboard
```

---

## 4. Sentinel Rules Summary

### R1 — Transaction Burst
- **Severity:** High
- **Frequency:** Runs every 5 minutes, looks back 5 minutes
- **KQL logic:** Counts `TRANSACTION_BURST` events per 1-minute bin; alerts if count > 1
- **CBK obligation:** AML/CFT suspicious activity monitoring
- **Demo trigger:** 6 rapid `POST /reports/generate` calls within 60 seconds

### R2 — Unauthorised API Access
- **Severity:** Medium
- **Frequency:** Runs every 5 minutes, looks back 5 minutes
- **KQL logic:** Counts `UNAUTHORISED_ACCESS` failure events per 5-minute bin; alerts if count > 2
- **ODPC obligation:** Data Protection Act — unauthorised access to personal data
- **Demo trigger:** 3 `POST /compliance/submit` calls without `reportId` body field

### R3 — After-Hours Admin Action
- **Severity:** Medium
- **Frequency:** Runs every 5 minutes, looks back 5 minutes
- **KQL logic:** Filters `ADMIN_ACTION` events where EAT hour (UTC+3) < 7 or >= 19
- **CBK obligation:** Internal controls — privileged actions outside business hours
- **Demo trigger:** Run `POST /reports/generate` outside 07:00–19:00 EAT

---

## 5. GHAS Pipeline Controls

| Control | Tool | What it checks | Where to see it |
|---|---|---|---|
| Static code analysis | GitHub CodeQL | JavaScript security vulnerabilities in all sector code | GitHub → Security → Code scanning alerts |
| Dependency vulnerabilities | Dependency Review Action | New critical CVEs introduced by PRs | GitHub → Pull request checks |
| Secret protection | GitHub Secret Scanning | API keys, passwords committed to the repo | GitHub → Security → Secret scanning alerts |

The GHAS workflow file is at [`.github/workflows/security.yml`](../../.github/workflows/security.yml).
It runs on every push to `main` and every pull request targeting `main`.

---

## 6. Regulatory References

All citations below are from [`africa-regulatory/kenya.md`](../../../africa-regulatory/kenya.md):

- **Section 2 — Central bank and financial regulation:**
  > *"Fintech ventures should plan on central-bank licensing for payment and lending products,
  > AML/CFT registration, and consumer-credit rules."*

- **Section 4 — Fintech compliance steps:**
  > *"Office of the Data Protection Commissioner (ODPC) licensing for payments and lending;
  > AML/CFT compliance; data protection registration (16%); consumer protection."*

These two sections directly mandate the three security controls implemented in this project.
The compliance mapping table in Section 2 above traces each obligation to its specific
technical implementation and Sentinel detection rule.

---

*Sita Sector Sprint · MC Studio · IBM Silver Partner · Nairobi, Kenya*  
*Cornerstone Project — Security Pathway — Solo submission*
