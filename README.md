# 💚 LenDenClub Loan Analytics Dashboard

Interactive **lending-decision dashboard** for a **LenDenClub (Lending Club India) manual lending report** — exactly 50 charts (of 83 defined, pruned to the decision-relevant set), KPIs, recommendation panels and a full loan register. Every chart shown answers one question: *which loans should I fund next?* Hosted on GitHub Pages.

**Pure static site** — data ships as `data/*.js` globals and ECharts is vendored locally, so the page also works by double-clicking `index.html` directly from `file://` (no build, no server, no internet).

**Live:** https://chirag127.github.io/lendenclub-loan-dashboard/

![Charts](https://img.shields.io/badge/charts-50%20(decision%20view)-brightgreen) ![Loans](https://img.shields.io/badge/loans-2%2C993-blue) ![Stack](https://img.shields.io/badge/stack-pure%20static%20html%2Bjs%2Becharts-orange) ![Audit](https://img.shields.io/badge/audit-22%2F30%20checks%20passed-brightgreen)

## The data

- **Lender:** CHIRAG SINGHAL · User ID `5XDIOTZGEZ`
- **Window:** 2025-12-03 → 2026-09-02 (10 months of activity)
- **Loans:** 2,993 individual loans, 19 fields each (loan ID, amount, status, interest rate, tenure, LenDenClub score, DPD, received/interest/fee amounts, NPA…)
- Source: `MANUAL_LENDING_REPORT_5XDIOTZGEZ_17883746044558.xlsx` (parsed with pure-Python stdlib, no dependencies)

## Portfolio snapshot

| Metric | Value |
|---|---|
| Total disbursed | ₹26,27,500 |
| Total received | ₹22,59,975 |
| Principal received | ₹20,06,920 |
| Interest earned | ₹2,53,067 |
| Platform fees | ₹45,115 |
| Net earnings (interest − fees) | ₹2,07,952 |
| Net after NPA loss | ₹1,24,122 |
| Gross ROI | 9.63% (≈12.9% annualized) |
| Principal outstanding | ₹5,23,239 |
| NPA amount | ₹83,830 attributed (₹84,843 book-level, 148 loans, 4.9%) |
| Loans with DPD > 0 | 275 |

## Key findings

- **79% of loans (2,363) have closed** and repaid in full; 416 are still active, 148 went NPA, 35 are processing and 31 were rejected/cancelled.
- **Avg contracted interest rate is 45.7%** (range 18.0–58.2%) — rates scale sharply with tenure: ~2-month loans run low-40s, 12-month loans push past 50%.
- **Avg LenDenClub score is 732** (range 700–878). Score drives ticket size — higher-score borrowers get meaningfully larger loans.
- **NPA rate ≈ 4.9% overall.** Defaults cluster in longer tenures and lower score bands; most NPA exposure sits in loans originated Dec 2025–Mar 2026.
- **Recovery is strong:** cumulative principal received has tracked cumulative disbursements closely, and 100% of interest/fees received to date total ₹2.53L vs ₹45.1K paid in platform fees.
- 24 daily-repayment loans vs 2,969 monthly — daily loans are the minority, mostly 2-month tenures.

## Dashboard features — a decision flow, 50 charts in 6 sections

Everything below the KPI row is ordered the way you decide: **glance → supply → returns → risk → watch-outs → verdict.**

- **12 KPI cards** — disbursed, received, interest, P&L, fees, NPA, outstanding, avg rate, active/closed/NPA counts, DPD exposure
- **Data-integrity audit bar** — every figure reconciled against the source report by `scripts/ldc/audit.py`; 30 checks (22 PASS · 8 notes · 0 FAIL), regenerated on every build
- **50 interactive charts** (Apache ECharts) in 6 sections:
  - *The book at a glance* (7) — status split, money in the portfolio, repayment-type split, monthly disbursed ₹, monthly disbursed by tenure, tenure distribution, disbursed ₹ by tenure
  - *Borrower supply & ticket sizes* (4) — avg ticket by tenure, score histogram, avg score by month (is quality trending?), avg ticket by score band (high scores = bigger loans)
  - *What loans actually pay — net of fees & defaults* (12) — P&L/ROI/annualized statement panel, XIRR by tenure (successful vs **incl. all defaults**), simple-vs-XIRR and amortization explainers, realized-vs-projected net ROI by tenure, the full rate ladder (sticker → fees → defaults → net), cumulative net earnings, net ROI by score band, fee vs NPA drag, **projected net-ROI heatmap (tenure × score)**, default-rate sensitivity, net ₹ per loan by tenure
  - *Where loans default — risk by tenure × score* (13) — NPA counts/₹/rates by month, NPA rate by tenure & score band, NPA heatmap tenure × score + loan-count denominator, loss-rate ₹ by tenure, share of loans vs NPAs, interest vs NPA loss, matured-only default rates, and score-tier behaviour + **5 auto-computed lending guardrail cards**
  - *Cashflow & watch-outs* (12) — received/interest/P&L by month, recovery rate, cumulative received vs disbursed, expected future EMI receipts, active-book expected-vs-received and **projected net XIRR** (`active_xirr()`), active ₹ exposure, overdue share & DPD severity
  - *The verdict — lend only these* (2 + 2 panels) — the **Highest-XIRR loan picks panel** (every tenure × score cell with ≥10 completed loans ranked by net XIRR incl. all defaults, tiered Core/Support/Avoid, per-₹1,000 split from `xirr_picks()`), allocation donut, successful-vs-defaults chart, the **“Lend only these” verdict strip** and **14 plain-language reason cards** (every figure read live from the data globals: why 2–3 month wins, why 12-month loses, why 6-month below 750 is the NPA engine, the 67.7 → 53.2 → 22.2% ladder, and risk = time × borrower quality)
- **Live filters** — status chips, repayment type, single-month data window (charts + KPIs + table react)
- **Sortable, searchable loan register** — all 2,993 loans (loan ID, order ID, dates, amount, status, rate, tenure, score, DPD, received, interest, P&L)

The other 33 chart definitions (seasonality, status treemaps, correlations, pure monthly actuals…) remain in `assets/js/charts/*.js` but are **not rendered** — the dashboard stays 100% focused on picking loans. The render set is curated in one place (`curation.js`); to show or hide a chart, edit its id in that file's group lists.

## Repo structure

```
├── index.html            # dashboard page (v8 — loads data globals + modular JS)
├── assets/
│   ├── echarts.min.js    # ECharts vendored locally (Apache-2.0)
│   ├── styles.css        # dark theme
│   └── js/               # modular classic scripts (no build, works from file://)
│       ├── README.md     # module map + load order
│       ├── core.js       # helpers, state, chart registry (SECTIONS + addChart)
│       ├── charts/       # all 83 chart definitions, one topic per file
│       ├── curation.js   # ★ what renders: the 50 decision charts in 6 sections
│       ├── ui/           # one renderer per responsibility (panels, KPIs, table…)
│       └── boot.js       # CDN fallback, init(), filter listeners (load last)
├── data/                 # generated by scripts/build.py (json + js globals)
│   ├── loans.json/js     # all 2,993 loans (parsed from xlsx)
│   ├── summary.json/js   # lender + summary + portfolio stats
│   ├── insights.json/js  # tenure × score matrix + returns economics
│   └── audit.json/js     # verification results shown on the dashboard
└── scripts/
    ├── build.py          # orchestrator: parse → clean → summarize → insights → audit → emit
    └── ldc/              # modular pipeline (stdlib only, no pandas/openpyxl)
        ├── xlsx.py       # read .xlsx sheets (zipfile + xml.etree)
        ├── clean.py      # normalize cells into typed loan records
        ├── summary.py    # portfolio statistics
        ├── insights.py   # tenure × score matrix, returns by tenure, overall P&L
        ├── audit.py      # 29 integrity checks reconciling against the report
        └── emit.py       # write data/*.json and data/*.js globals
```

The Python side is already one module per concern; this refactor brings the front-end to the same
standard — `assets/js/` holds 20+ small files (largest ≈ 340 lines) instead of one 2,130-line `app.js`,
with a module map in `assets/js/README.md`.

## Regenerating the data

```bash
python scripts/build.py "path/to/MANUAL_LENDING_REPORT_....xlsx"
```

The pipeline is **fully modular** (one responsibility per module) and uses only the Python standard library. It re-parses the xlsx, recomputes every statistic, re-runs the full audit and rewrites all `data/` artifacts. **Exit code is non-zero if any audit check FAILs**, so it can run in CI to guarantee the site always ships verified numbers.

## Audit & verification

The audit engine (`scripts/ldc/audit.py`) runs **29 checks** on every build:

- **Money reconciliation (M1–M7)** — per-loan sums vs the report's headline figures (disbursed, received, principal, interest, fees match to the paisa; NPA and outstanding are book-level figures with documented deltas)
- **Counts & keys (C1–C5)** — row count, status counts add up, loan IDs unique, no blank fields
- **Value sanity (V1–V6)** — non-negative amounts, rates 0–100%, scores 0–1000, known tenures, DPD ≥ 0, chart-critical fields populated
- **Cross-field consistency (X1–X7)** — principal+interest = total received, date ordering, no over-repaid ACTIVE loans, closed loans have zero DPD
- **Matrix integrity (T1–T4)** — tenure × score heatmap cells re-derived in Python so the JS charts can never silently disagree

Current result: **22 PASS · 7 documented notes · 0 FAIL**. The notes are verified source-data characteristics (batch order IDs, unfunded loans without a disbursement date, ₹-level rounding on prepayments/recoveries, book-level NPA totals).

## Notes

- **Privacy:** the lender's registered email and mobile number from the report are intentionally **not** included in this public dataset.
- Static site, 100% client-side with **zero runtime CDN dependency**: ECharts (Apache-2.0) is vendored in `assets/echarts.min.js` and the data ships as embedded JS globals (`data/*.js`), so the page works offline, from `file://`, or behind strict networks. To run it locally just download the folder and double-click `index.html` — no server or build step needed.

---

Made with 💚 · [chirag127](https://github.com/chirag127)