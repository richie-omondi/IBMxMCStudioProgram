# Demo Script — Sita Fintech Security Layer

**Project:** Kenyan Digital Lender — IBM Cornerstone Project (Security Pathway)  
**Format:** Solo live demo — 15 minutes  
**Environments needed:** RHEL 9 VPC (app running), Microsoft Sentinel (browser open)  
**GitHub:** fork open in browser with Actions tab visible  

---

## Pre-Demo Checklist

Before starting the demo, confirm:

- [ ] RHEL 9 VPC serial console or SSH is open and app is running (`podman ps` shows both containers Up)
- [ ] `curl -s http://localhost:3000/reports` returns 200
- [ ] Microsoft Sentinel is open in browser on the **Sita Fintech — Security Overview** workbook
- [ ] Sentinel → Analytics shows all three rules (R1, R2, R3) enabled
- [ ] GitHub fork is open in browser with the Actions tab showing a green GHAS run
- [ ] Compliance mapping doc is open: `cornerstone-project/fintech/docs/compliance-mapping.md`

---

## 0:00 – 1:30 — Problem Statement

**Say:**
> "A licensed Kenyan digital lender submits monthly regulatory reports to the Central Bank of
> Kenya and the Capital Markets Authority. The current process is entirely manual — a finance
> analyst exports raw loan data, reformats it in Excel, and emails PDFs. This takes three days
> per cycle and has produced two compliance errors in the past year.
>
> Beyond the reporting problem, there is a security gap: no real-time monitoring of who is
> generating reports, when, or whether there are suspicious access patterns — which is an
> AML/CFT obligation under CBK and a data protection obligation under Kenya's ODPC.
>
> My build automates the CBK reporting pipeline and adds a real-time security monitoring layer
> on top of it, grounded in the Kenyan regulatory context."

---

## 1:30 – 3:30 — Data Model Tour

**Show:** `SitaSector Live files/SitaSector Live files/fintech/models/` (or the copies in `cornerstone-project/fintech/`)

**Say:**
> "The data model reflects a real Kenyan digital lender. Four tables:
> - **Customers** — KYC tier, risk score, national ID
> - **Loan accounts** — personal, business, or asset loans with CBK-relevant fields: principal,
>   interest rate, disbursement date, status including NPL flag
> - **Repayment transactions** — payment channel is M-Pesa, bank transfer, or USSD — all three
>   are standard Kenyan mobile money channels
> - **Regulatory reports** — tracks every CBK, CMA, and SASRA report with status and file path
>
> This is not a generic app — the data model is built specifically around the CBK Monthly Credit
> Return format and the Kenyan mobile money ecosystem."

---

## 3:30 – 6:00 — Live Pipeline Run

**Show:** terminal / serial console on the RHEL 9 VPC

**Run:**
```bash
curl -s -X POST http://localhost:3000/reports/generate \
  -H "Content-Type: application/json" \
  -H "x-user: demo-analyst" \
  -d '{"period":"2026-10"}'
```

**Show:** the JSON response with `reportId`

**Run:**
```bash
podman logs fintech_app_1 2>&1 | grep "ADMIN_ACTION" | tail -4
```

**Say:**
> "The pipeline extracted loan data from the core banking database, deduplicated customer
> records via IBM MDM, applied the CBK transformation rules, generated a report artifact,
> and persisted the record. Every step emits a structured ADMIN_ACTION security event in
> CEF-compatible JSON — that's what you see in the logs. These events flow via rsyslog and
> Azure Monitor Agent into Microsoft Sentinel in real time."

---

## 6:00 – 9:00 — Sentinel Dashboard

**Show:** Microsoft Sentinel → Workbooks → **Sita Fintech — Security Overview**

**Walk through each widget:**
1. **Security Event Rate** — point to the event rate graph, show the spike from the pipeline run
2. **Event Categories Breakdown** — show the pie chart with ADMIN_ACTION as the dominant category
3. **Recent Failure Events** — show the table (may be empty if no failures triggered yet)
4. **After-Hours Admin Actions** — explain the EAT timezone filter

**Say:**
> "This workbook gives a compliance officer a live view of all security-relevant activity on
> the lending platform. Every report generation, every compliance submission, every access
> attempt is visible here with a full audit trail — which is exactly what the CBK internal
> controls requirement and the ODPC data protection audit trail obligation mandate."

---

## 9:00 – 11:30 — Trigger a Live Incident

**Show:** terminal on the RHEL 9 VPC

**Run the burst trigger (R1):**
```bash
for i in {1..6}; do
  curl -s -X POST http://localhost:3000/reports/generate \
    -H "Content-Type: application/json" \
    -d '{"period":"2026-10"}' && sleep 1
done
```

**Run the unauthorised access trigger (R2):**
```bash
for i in {1..3}; do
  curl -s -X POST http://localhost:3000/compliance/submit \
    -H "Content-Type: application/json" \
    -d '{}' && sleep 1
done
```

**Switch to Sentinel → Incidents**

**Say:**
> "I've just simulated two threat patterns. The first is a burst of report generation calls —
> this is the kind of pattern that could indicate automated scraping of regulated financial
> data, which CBK's AML/CFT framework requires us to detect. The second is repeated compliance
> submission attempts without a valid report ID — an ODPC data protection violation.
>
> Sentinel's analytics rules run every 5 minutes — if the incidents have fired you'll see them
> here. I can also run the Logs query directly to show the raw events."

**Show:** Sentinel → Logs, run:
```kql
Syslog
| where ProcessName == "sita-fintech"
| extend EventData = parse_json(SyslogMessage)
| project TimeGenerated, Category = tostring(EventData.category),
          Outcome = tostring(EventData.outcome), Msg = tostring(EventData.msg)
| order by TimeGenerated desc
| take 20
```

---

## 11:30 – 13:00 — Compliance Mapping

**Show:** `cornerstone-project/fintech/docs/compliance-mapping.md`

**Say:**
> "Every control I've implemented is traceable to a specific Kenyan regulatory obligation.
> This mapping table shows the full chain: regulation → obligation → control implemented →
> Sentinel rule → how to verify it in this demo.
>
> For example: CBK's AML/CFT obligation requires monitoring for suspicious high-frequency
> payment activity. That maps to the transaction rate guard in my code, which emits a
> TRANSACTION_BURST event, which triggers Sentinel rule R1, which I just demonstrated.
>
> The citations are directly from the Africa Regulatory Dossier for Kenya — sections 2 and 4 —
> which is part of this program's reference material."

---

## 13:00 – 14:30 — GHAS Pipeline

**Show:** GitHub fork → Actions tab → latest **Security Scanning (GHAS)** workflow run

**Say:**
> "The final security control is in the CI/CD pipeline itself. GitHub Advanced Security runs
> a CodeQL static analysis scan on every push to main — covering all JavaScript in the
> monorepo. A dependency review action blocks any pull request that introduces a
> critical vulnerability.
>
> This satisfies the ODPC breach prevention obligation — code cannot expose credentials
> or introduce known vulnerabilities into the pipeline that processes customer KYC and
> loan data."

**Show:** GitHub → Security tab → Code scanning alerts (even if empty — show the scan ran)

---

## 14:30 – 15:00 — What I'd Do With More Time

**Say:**
> "Three things I would add with more time:
>
> First — IBM Guardium for database-level auditing. Right now I'm monitoring at the
> application layer. Guardium would add a second layer that catches direct database
> queries, schema changes, and privilege escalations at the PostgreSQL level — which
> is the gold standard for CBK audit trail requirements.
>
> Second — A full OpenPages regulatory rule library. Right now the CBK and CMA
> transformation rules are hardcoded. OpenPages would give a configurable rule engine
> where a compliance officer can update thresholds without touching code.
>
> Third — Automated Sentinel playbooks. Right now the rules fire incidents but a human
> has to review them. I'd add Logic App playbooks that automatically notify the
> compliance officer by email when an R1 or R3 incident fires — closing the loop
> from detection to response."

---

## Backup — If Sentinel Incidents Haven't Fired Yet

If the 5-minute rule evaluation window hasn't elapsed, show the raw events directly:

```kql
Syslog
| where ProcessName == "sita-fintech"
| where SyslogMessage has "TRANSACTION_BURST" or SyslogMessage has "UNAUTHORISED_ACCESS"
| extend EventData = parse_json(SyslogMessage)
| project TimeGenerated, Category = tostring(EventData.category),
          Source = tostring(EventData.src), Msg = tostring(EventData.msg)
| order by TimeGenerated desc
```

**Say:**
> "The events have reached Sentinel — you can see them in the raw logs. The analytics
> rules evaluate on a 5-minute schedule so the incident will appear shortly. The
> detection logic is already active."

---

*Sita Sector Sprint · MC Studio · IBM Silver Partner · Nairobi, Kenya*  
*Cornerstone Project — Security Pathway — Solo submission*
