# Security Event Layer — Sita Fintech

This directory contains the real-time security instrumentation for the Kenyan Digital Lender
application. Events emitted here are forwarded to IBM QRadar on Cloud via rsyslog and trigger
the three detection rules that satisfy the Security Pathway Audience Feature requirement.

---

## Event Categories

| Category | Trigger | QRadar Rule | CBK / ODPC Obligation |
|---|---|---|---|
| `ADMIN_ACTION` | CBK/CMA report generation or submission endpoint called | R3 — After-Hours Admin Action | CBK Internal Controls: privileged actions must be logged and flagged for review |
| `TRANSACTION_BURST` | More than 5 report-generate calls for the same period within 60 seconds | R1 — Transaction Burst | CBK AML/CFT: monitor for suspicious high-frequency payment activity |
| `UNAUTHORISED_ACCESS` | Compliance submit called without a valid `reportId` (400 response) | R2 — Unauthorised API Access | ODPC Data Protection: log and alert on unauthorised attempts to access regulated data |

---

## JSON Event Schema

All events are emitted as a single-line JSON object in CEF-compatible format:

```json
{
  "timestamp":     "<ISO 8601>",
  "deviceVendor":  "SitaFintech",
  "deviceProduct": "LendingAPI",
  "category":      "ADMIN_ACTION | TRANSACTION_BURST | UNAUTHORISED_ACCESS",
  "src":           "<caller IP address>",
  "suser":         "<caller identity — x-user header, submittedBy, or 'pipeline'>",
  "outcome":       "initiated | success | failure | alert",
  "msg":           "<human-readable event description>"
}
```

### Field mapping to QRadar Universal DSM

| JSON field | QRadar field | Notes |
|---|---|---|
| `category` | High-Level Category | Mapped in DSM Editor after first events arrive |
| `src` | Source IP | Used in R1 and R2 rule conditions |
| `suser` | Source Username | Used in R3 rule condition |
| `outcome` | Event Disposition | `failure` maps to QRadar "Failure" disposition |
| `timestamp` | Log Source Time | QRadar normalises to UTC |

---

## Files

| File | Purpose |
|---|---|
| `audit_logger.js` | `logEvent(category, payload)` — formats and emits events; calls `logger -t sita-fintech` in live mode |
| `transaction_rate_guard.js` | `checkBurst(accountId, threshold, windowMs)` — sliding-window burst detector |

---

## How Events Reach QRadar

```
Node.js app
  └── audit_logger.js
        ├── console.log (stdout — always)
        └── logger -t sita-fintech (live mode only)
              └── rsyslog daemon (/etc/rsyslog.d/50-qradar.conf)
                    └── TLS syslog → IBM QRadar on Cloud (port 6514)
                          └── Log Source: Sita-Fintech-RHEL9 (Universal DSM)
```

In mock mode (`SITA_MOCK_MODE=1`), events are written to stdout only. Set `SITA_MOCK_MODE=0`
on the RHEL 9 VPC to enable rsyslog forwarding.

---

## QRadar Rule Conditions (summary)

- **R1 — Transaction Burst:** same source IP or username in > 5 `TRANSACTION_BURST` events within 60 seconds → High severity offense
- **R2 — Unauthorised API Access:** same source IP in > 3 `UNAUTHORISED_ACCESS` events within 5 minutes → Medium severity offense
- **R3 — After-Hours Admin Action:** any `ADMIN_ACTION` event outside 07:00–19:00 EAT (UTC+3) → Medium severity offense

Full rule XML exports are in `fintech/deployment/qradar/rules/`.

---

*Sita Sector Sprint · MC Studio · IBM Silver Partner*  
*Regulatory reference: `africa-regulatory/kenya.md` — sections 2 and 4*
