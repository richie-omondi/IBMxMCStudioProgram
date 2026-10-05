# Cornerstone Project — Kenyan Fintech Security

**Sita Sector Sprint · MC Studio · IBM Silver Partner**

![Security Scanning](../../actions/workflows/security.yml/badge.svg)

> Cornersone Project for the IBM x MC Studio Phase 3 program — Security Pathway.  
> Sector: Fintech — Kenyan Digital Lender (CBK/CMA regulatory reporting).  
> Audience Feature: Real-time security/anomaly monitoring via IBM QRadar on Cloud.

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
and QRadar rule mapping.

## Compliance Mapping

See [`fintech/docs/compliance-mapping.md`](fintech/docs/compliance-mapping.md) for the full
CBK/ODPC regulatory obligation → security control → QRadar rule traceability table.

---

*Regulatory reference: [`africa-regulatory/kenya.md`](../africa-regulatory/kenya.md)*  
*Implementation plan: [`kenyan-fintech-security-plan.md`](../kenyan-fintech-security-plan.md)*
