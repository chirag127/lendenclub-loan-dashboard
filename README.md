# 💚 LenDenClub Loan Analytics Dashboard

Interactive **lending-decision dashboard** for a **LenDenClub (Lending Club India) manual lending report** — 64 curated charts (of 91 defined) plus gauge dials, plain-HTML tables (tenure × score risk matrix + an NPA-by-year ledger), KPIs, recommendation panels and a full loan register. Every view answers one question: *which loans should I fund next?* Hosted on GitHub Pages.

The curated set is **not fixed at 50** — more charts and other forms (gauges, tables, matrices) are added by listing their ids in one file (`assets/js/curation.js`).

**Pure static site** — data ships as `data/*.js` globals and ECharts is vendored locally, so the page also works by double-clicking `index.html` directly from `file://` (no build, no server, no internet).

**Live:** https://chirag127.github.io/lendenclub-loan-dashboard/

![Charts](https://img.shields.io/badge/charts-64%20curated-brightgreen) ![Loans](https://img.shields.io/badge/loans-2%2C993-blue) ![Stack](https://img.shields.io/badge/stack-pure%20static%20html%2Bjs%2Becharts-orange) ![Audit](https://img.shields.io/badge/audit-24%2F32%20checks%20passed-brightgreen)

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

## Dashboard features — a decision flow, 64 charts in 7 sections (not a fixed cap)

Everything below the KPI row is ordered the way you decide: **glance → supply → returns → risk → NPA-by-year → watch-outs → verdict.** Charts are one form of showing the data; the dashboard also uses **ECharts gauge dials** and **plain-HTML tables** (loan register + the tenure × score risk matrix + the NPA-by-year ledger) wherever a table or dial reads better than a chart.

- **12 KPI cards** — disbursed, received, interest, P&L, fees, NPA, outstanding, avg rate, active/closed/NPA counts, DPD exposure
- **Data-integrity audit bar** — every figure reconciled against the source report by `scripts/ldc/audit.py`; 32 checks (24 PASS · 8 notes · 0 FAIL), regenerated on every build
- **64 interactive charts** (Apache ECharts) in 7 sections + extra forms:
  - *The book at a glance* (8) — status split, money in the portfolio, repayment-type split, monthly disbursed ₹, monthly disbursed by tenure, tenure distribution, disbursed ₹ by tenure + **three gauge dials** (net XIRR incl. defaults, NPA rate, NPA recovery)
  - *Borrower supply & ticket sizes* (4) — avg ticket by tenure, score histogram, avg score by month (is quality trending?), avg ticket by score band (high scores = bigger loans)
  - *What loans actually pay — net of fees & defaults* (15) — P&L/ROI/annualized statement panel, XIRR by tenure (successful vs **incl. all defaults**), simple-vs-XIRR and amortization explainers, realized-vs-projected net ROI by tenure, the full rate ladder (sticker → fees → defaults → net), cumulative net earnings, net ROI by score band, fee vs NPA drag, **projected net-ROI heatmap (tenure × score)**, default-rate sensitivity, net ₹ per loan by tenure, **net-XIRR matrix heatmap (tenure × score)**, contracted-vs-collected interest by tenure, and the money-map bubble
  - *Where loans default — risk by tenure × score* (14 + **risk-matrix table**) — NPA counts/₹/rates by month, NPA rate by tenure & score band, NPA heatmap tenure × score + loan-count denominator, loss-rate ₹ by tenure, share of loans vs NPAs, interest vs NPA loss, matured-only default rates, score-tier behaviour, risk-vs-return bubbles + **5 auto-computed lending guardrail cards** + a plain-HTML **tenure × score risk reference table** (every cell: loans, NPA %, matured default %, loss % — no cell hidden)
  - *NPA by origination year — tenure-level vs annualized* (3 + **NPA-by-year ledger**) — every default and ₹-loss figure shown twice — over the loan's whole life (matured basis) and **annualized per year** (× 12/tenure, same convention as annualized returns): by tenure, by origination year (Dec-2025 vintage vs 2026, blended at each year's average tenure), and the rupee cost of NPA per tenure, plus a full **ledger table** (2025/2026/all × tenure: matured loans, NPA count, rate over life, rate per year, ₹ lent, NPA ₹, loss over life, loss per year) computed by `npa_by_year()` in the Python pipeline and reconciled by audit checks Y1–Y2
  - *Cashflow & watch-outs* (17) — received/interest/P&L by month, recovery rate, cumulative received vs disbursed, expected vs received, expected future EMI receipts, active-book expected-vs-received and **projected net XIRR** (`active_xirr()`), active ₹ exposure by tenure **and by origination month**, overdue share, avg DPD and 30/60/90-day severity, **NPA recovery by tenure**
  - *The verdict — lend only these* (2 + 2 panels) — the **Highest-XIRR loan picks panel** (every tenure × score cell with ≥10 completed loans ranked by net XIRR incl. all defaults, tiered Core/Support/Avoid, per-₹1,000 split from `xirr_picks()`), allocation donut, successful-vs-defaults chart, the **“Lend only these” verdict strip** and **14 plain-language reason cards** (every figure read live from the data globals: why 2–3 month wins, why 12-month loses, why 6-month below 750 is the NPA engine, the 67.7 → 53.2 → 22.2% ladder, and risk = time × borrower quality)
- **Live filters** — status chips, repayment type, single-month data window (charts + KPIs + table react)
- **Sortable, searchable loan register** — all 2,993 loans (loan ID, order ID, dates, amount, status, rate, tenure, score, DPD, received, interest, P&L)

The remaining 27 chart definitions (seasonality, status treemaps, correlations, pure monthly actuals…) stay in `assets/js/charts/*.js` but are **not rendered**. Nothing is hard-capped: the render set is curated in one place (`assets/js/curation.js`) — add a chart id to a group and it shows; add a new `addChart(...)` and it becomes available there too.

## Repo structure

```
├── index.html            # dashboard page (v9 — loads data globals + modular JS)
├── assets/
│   ├── echarts.min.js    # ECharts vendored locally (Apache-2.0)
│   ├── styles.css        # dark theme
│   └── js/               # modular classic scripts (no build, works from file://)
│       ├── README.md     # module map + load order
│       ├── core.js       # helpers, state, chart registry (SECTIONS + addChart)
│       ├── charts/       # all 91 chart definitions, one topic per file
│       ├── curation.js   # ★ what renders: the 64 decision charts in 7 sections
│       ├── ui/           # one renderer per responsibility (panels, KPIs, tables…)
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

The audit engine (`scripts/ldc/audit.py`) runs **32 checks** on every build:

- **Money reconciliation (M1–M7)** — per-loan sums vs the report's headline figures (disbursed, received, principal, interest, fees match to the paisa; NPA and outstanding are book-level figures with documented deltas)
- **Counts & keys (C1–C5)** — row count, status counts add up, loan IDs unique, no blank fields
- **Value sanity (V1–V6)** — non-negative amounts, rates 0–100%, scores 0–1000, known tenures, DPD ≥ 0, chart-critical fields populated
- **Cross-field consistency (X1–X8)** — principal+interest = total received, date ordering, no over-repaid ACTIVE loans, closed loans have zero DPD, EMI rebate reality on closed loans
- **Matrix integrity (T1–T4)** — tenure × score heatmap cells re-derived in Python so the JS charts can never silently disagree
- **NPA-by-year ledger integrity (Y1–Y2)** — the year × tenure rows sum exactly to the book's matured loans, NPA count and NPA rupees

Current result: **24 PASS · 8 documented notes · 0 FAIL**. The notes are verified source-data characteristics (batch order IDs, unfunded loans without a disbursement date, ₹-level rounding on prepayments/recoveries, book-level NPA totals).

## Notes

- **Privacy:** the lender's registered email and mobile number from the report are intentionally **not** included in this public dataset.
- Static site, 100% client-side with **zero runtime CDN dependency**: ECharts (Apache-2.0) is vendored in `assets/echarts.min.js` and the data ships as embedded JS globals (`data/*.js`), so the page works offline, from `file://`, or behind strict networks. To run it locally just download the folder and double-click `index.html` — no server or build step needed.

---

Made with 💚 · [chirag127](https://github.com/chirag127)