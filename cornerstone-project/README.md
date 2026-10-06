# Cornerstone Project — Kenyan Fintech Security

**Sita Sector Sprint · MC Studio · IBM Silver Partner**

![Security Scanning](../../actions/workflows/security.yml/badge.svg)

> Cornerstone Project for the IBM x MC Studio Phase 3 program — Security Pathway.
> Sector: Fintech — Kenyan Digital Lender (CBK/CMA regulatory reporting).
> Audience Feature: Real-time security/anomaly monitoring via Microsoft Sentinel.

---

## Architecture

```
Fintech App (RHEL 9 VPC · Podman)
  └── audit_logger.js (CEF JSON events)
        └── rsyslog → Azure Monitor Agent (AMA)
              └── Microsoft Sentinel (sita-fintech-law)
                    ├── R1 — Transaction Burst        (CBK AML/CFT)
                    ├── R2 — Unauthorised API Access   (ODPC Data Protection)
                    └── R3 — After-Hours Admin Action  (CBK Internal Controls)

GitHub Actions (GHAS)
  ├── CodeQL scan (on push / PR)
  └── Dependency review (on PR)
```

---

## Quick Start (Mock Mode)

```bash
cd cornerstone-project
cp .env.example .env          # or: copy .env.example .env  (Windows)
cd fintech
npm install
SITA_MOCK_MODE=1 node tests/cbk_pipeline.test.js
```

## Deployment (RHEL 9 VPC)

See [`fintech/deployment/README.md`](fintech/deployment/README.md) for full Podman deployment steps.

## Security Layer

See [`fintech/security/README.md`](fintech/security/README.md) for event categories, JSON schema,
and Sentinel rule mapping.

## Compliance Mapping

See [`fintech/docs/compliance-mapping.md`](fintech/docs/compliance-mapping.md) for the full
CBK/ODPC regulatory obligation → security control → Sentinel analytics rule traceability table.

## Handoff Notes & Demo Script

See [`fintech/docs/handoff-notes.md`](fintech/docs/handoff-notes.md) for deployment steps,
environment variables, and how to manually trigger each Sentinel rule.

See [`fintech/docs/demo-script.md`](fintech/docs/demo-script.md) for the timed 15-minute
demo walkthrough with exact commands and backup queries.

---

*Regulatory reference: [`africa-regulatory/kenya.md`](../africa-regulatory/kenya.md)*
*Implementation plan: [`kenyan-fintech-security-plan.md`](../kenyan-fintech-security-plan.md)*
