# 💚 LenDenClub Loan Analytics Dashboard

Interactive **lending-decision dashboard** for a **LenDenClub (Lending Club India) manual lending report** — **45 curated charts (of 151 defined)** including 8 decision heatmaps, a fine-bucket **net-XIRR atlas** (50+ tenure × score buckets), **fee-model proof charts**, **return-driver charts** (quoted rate, ticket size, repayment type + ticket-size-within-cell), an **actual-vs-recommended allocation view** and a **one-table decision view**, plus gauge dials, plain-HTML tables (tenure × score risk matrix + NPA-by-year and vintage ledgers + the decision table), KPIs, recommendation panels and a full loan register with a per-loan **Verdict** column. Everything shown exists to answer one question: *which loans should I fund next — and which to avoid?* Hosted on GitHub Pages.

The curated set is **not fixed at 45** — more charts and other forms (gauges, tables, matrices) are added by listing their ids in one file (`assets/js/curation.js`).

**Pure static site** — data ships as `data/*.js` globals and ECharts is vendored locally, so the page also works by double-clicking `index.html` directly from `file://` (no build, no server, no internet).

**Live:** https://chirag127.github.io/lendenclub-loan-dashboard/

![Charts](https://img.shields.io/badge/charts-45%20curated-brightgreen) ![Loans](https://img.shields.io/badge/loans-3%2C672-blue) ![Stack](https://img.shields.io/badge/stack-pure%20static%20html%2Bjs%2Becharts-orange) ![Audit](https://img.shields.io/badge/audit-38%2F48%20checks%20passed-brightgreen)

## The data

- **Lender:** CHIRAG SINGHAL · User ID `5XDIOTZGEZ`
- **Window:** 2025-12-13 → 2026-09-04 (9 months of activity)
- **Loans:** 3,672 individual loans, 19 fields each (loan ID, amount, status, interest rate, tenure, LenDenClub score, DPD, received/interest/fee amounts, NPA…)
- Source: `MANUAL_LENDING_REPORT_5XDIOTZGEZ_17885170422222.xlsx` (parsed with pure-Python stdlib, no dependencies)

## Portfolio snapshot

| Metric | Value |
|---|---|
| Total disbursed | ₹27,97,250 |
| Total received | ₹22,73,357 |
| Principal received | ₹20,18,986 |
| Interest earned | ₹2,54,382 |
| Platform fees | ₹45,386 |
| Net earnings (interest − fees) | ₹2,08,996 |
| Net after NPA loss | ₹1,25,167 |
| Gross ROI | 9.09% |
| Principal outstanding | ₹6,90,672 |
| NPA amount | ₹83,830 attributed (₹84,843 book-level, 148 loans, 4.0%) |
| Loans with DPD > 0 | 275+ (incl. 148 NPA) |

## Key findings

- **2,376 loans (65%) have closed** and repaid in full; 1,106 are still active, 148 went NPA, 11 are processing and 31 were rejected/cancelled. September alone added 823 fresh loans / ₹2.65L — of which only 56.8% landed in recommended (core) cells and ₹10,500 went into cells the data says lose money after fees and defaults.
- **Avg contracted interest rate is 45.7%** (range 18.0–58.2%) — rates scale sharply with tenure: ~2-month loans run low-40s, 12-month loans push past 50%.
- **Avg LenDenClub score is 732** (range 700–878). Score drives ticket size — higher-score borrowers get meaningfully larger loans.
- **NPA rate ≈ 4.0% overall** (148 of 3,672). Defaults cluster in longer tenures and lower score bands; most NPA exposure sits in loans originated Dec 2025–Mar 2026.
- **The platform fee is charged as % of the principal returned in each EMI** — verified to the decimal on every loan that repaid principal (1.0% at 2–3 months, 3.0% at 4–6 months, 6.0% at 12 months). 4-month loans paid 2.3% before Apr-2026 and 5-month 2.5% before Jun-2026 — new longer-tenure money now carries a ~25% higher fee bill than the realised XIRRs are built on. The report's own 'pnl' column ignores the fee entirely (₹45,386 never appears in it); every net figure on this dashboard subtracts it.
- 24 daily-repayment loans vs 3,648 monthly — daily loans are the minority, mostly 2-month tenures.

## Dashboard features — a decision flow, 45 curated charts in 10 sections (not a fixed cap)

Curation rules: **one chart per question** (near-duplicates stay in the registry, not on the page), **only decision heatmaps** (the maps that directly say fund/avoid — diagnostic variations live in the Full registry), and **everything stays reachable** (Full-registry tab / Everything density).

Everything below the KPI row is ordered the way you decide: **glance → supply → realized returns → expected future returns → risk → XIRR-atlas → NPA-by-year → vintage → watch-outs → verdict.** Charts are one form of showing the data; the dashboard also uses **ECharts gauge dials** and **plain-HTML tables** (loan register + the tenure × score risk matrix + the NPA-by-year and vintage ledgers + the decision table) wherever a table or dial reads better than a chart.

- **12 KPI cards** — disbursed, received, interest, P&L, fees, NPA, outstanding, avg rate, active/closed/NPA counts, DPD exposure
- **Data-integrity audit bar** — every figure reconciled against the source report by `scripts/ldc/audit.py`; 48 checks (38 PASS · 10 notes · 0 FAIL) incl. the fee-model checks F1–F4 (fee = schedule % × principal returned, per pricing era), the fresh-money allocation check X1 and the return-driver reconciliations W3–W5, regenerated on every build
- **45 interactive charts** (Apache ECharts) in 10 sections + extra forms:
  - *The book at a glance* (5) — status split, money in the portfolio, monthly disbursed ₹, disbursed ₹ by tenure + **three gauge dials** (net XIRR incl. defaults, NPA rate, NPA recovery)
  - *Borrower supply & ticket sizes* (3) — avg ticket by tenure, score histogram, avg score by month (is quality trending?)
  - *What loans actually pay — net of fees & defaults* (6) — realized XIRR by tenure (successful vs **incl. all defaults**), the full rate ladder (sticker → fees → defaults → net), the total fee waterfall, **the fee increase (4/5-month loans now pay 3.0% where they paid 2.3–2.5%)**, the **net-XIRR pick heatmap (tenure × score)**, contracted-vs-collected interest
  - *Expected future returns — what the book should earn next* (6, NEW) — **forward-looking, not history**: realized-vs-projected net ROI by tenure (how much of the total is still ahead), the active book's **projected net XIRR by tenure** (`active_xirr()`), the **projected net-ROI heatmap (tenure × score)** for new lending, **future net ₹ from the active book by tenure** (`nr9`), the monthly **expected EMI receipts still coming** (`rt2`), and contracted-rate vs projected net — projections haircut future interest by each tenure's historical collection rate and apply its matured default rate
  - *Where loans default — risk by tenure × score* (3 + **risk-matrix table**) — matured default rates by tenure, the NPA heatmap tenure × score, loss rate by tenure + **5 auto-computed lending guardrail cards** + a plain-HTML **tenure × score risk reference table** (every cell: loans, NPA %, matured default %, loss % — no cell hidden)
  - *Fine-bucket net-XIRR atlas — tenure × score* (4) — tenure × 10-point score bands (700-709 … 790-799, 800+; 50 buckets with matured loans), computed per bucket by `xirr_atlas()` and reconciled by audit checks W1–W2: the bucket's **net XIRR incl. every default** (whole book and 2026-vintage, so you see which cells are getting worse), **net kept ₹ per ₹1,000 lent**, and the **evidence map** (matured loans per bucket). The other 38 atlas maps (per-loan median/mean, drag, fee %, sticker, 2025 slices…) stay in the Full registry
  - *NPA by origination year — tenure-level vs annualized* (3 + **NPA-by-year ledger**) — every default and ₹-loss figure shown twice — over the loan's whole life (matured basis) and **annualized per year** (× 12/tenure, same convention as annualized returns): by origination year (Dec-2025 vintage vs 2026, blended at each year's average tenure), the rupee cost of NPA per tenure, and the year × tenure heatmap of the annualized NPA rate, plus a full **ledger table** (2025/2026/all × tenure: matured loans, NPA count, rate over life, rate per year, ₹ lent, NPA ₹, loss over life, loss per year) computed by `npa_by_year()` in the Python pipeline and reconciled by audit checks Y1–Y2
  - *Defaults by origination cohort — curves, rates & the ₹ bill* (3 + **vintage ledger**) — cumulative NPA rate by loan age, one line per origination month (does each cohort's default bill flatten or is it still climbing?), the pooled month-of-life of every NPA (31% strike in month 1, ~9 in 10 by month 4), and net kept per ₹1,000 after fees & every default, realized to date (Dec-25 kept ₹71/₹1,000; Feb-26 went net-negative at −₹11/₹1,000) — with a complete **ledger table** underneath (every cohort × every percentage: matured loans, NPA, rate over life/per year, ₹ lent, loss over life/per year, net kept ₹, net % of lent, net % per year — the annualized life-vs-per-year percentage bars for rate and ₹ bill that were de-duplicated from the page still live in the Full registry as vc3/vc4), all computed by `vintage()` in the Python pipeline and reconciled by audit checks Z1–Z5
  - *Cashflow & watch-outs* (5) — received by month, active-book received-to-date vs its schedule, active ₹ exposure by tenure, the overdue pipeline (DPD > 0), **NPA recovery by tenure**
  - *The verdict — lend only these* (7 + 2 panels + **the one-table decision view**) — the **Highest-XIRR loan picks panel** (every tenure × score cell with ≥10 completed loans ranked by net XIRR incl. all defaults, tiered Core/Support/Avoid, per-₹1,000 split from `xirr_picks()`), allocation donut, successful-vs-defaults chart, **two allocation charts** (`month_allocation()`: this month's money by tenure vs recommended and collapsed into verdict tiers — Sep-26 deployed ₹2.65L with only 56.8% in core cells; the cell-level detail lives in the decision table), **three return-driver charts** (`return_drivers()`: realized net XIRR by quoted-rate band — 48%+ quotes net 49%/yr vs 8.7% for <42%; by ticket size — ₹250–₹1,000 net 33–36%/yr, ₹2,500 tickets LOSE −8.7%/yr after defaults, ₹5,000+ recovers to 21.7%; and **ticket size WITHIN each tenure × score cell** — the ₹2,500 trap is real, not a mix effect: in 6-mo×700–724 the same cell nets +18–27%/yr on ₹250–₹1,000 tickets but −50%/yr on ₹2,500, 29% default vs 8–11%), the **one-table decision view** (`ui/decision-table.js`: every ranked cell — net XIRR incl. all defaults, repaying-only XIRR, matured default rate, net ₹/₹1,000, fee % of lent, quoted rate, tier, recommended ₹/₹1,000 and how much fresh money actually went into the cell this month — sortable by any column, avoid cells pinned at ₹0), the **“Lend only these” verdict strip** and **17 plain-language reason cards** (every figure read live from the data globals: why 2–3 month wins, why 12-month loses, why 6-month below 750 is the NPA engine, the ₹2,500 ticket trap, the 68.0 → 53.5 → 23.1% ladder — with the NPA-timing correction that front-loads defaulted loans' receipts — how the fee actually works, and risk = time × borrower quality)
- **Charts divided into numbered groups** — every section renders as one visually separate block: a colour-accented header (number badge, title, explanation and live chart count) above its own tables, insight cards and chart grid, so you always know which question each group of charts answers. A **"Jump to" chip row** under the view bar (01 Glance … 10 Verdict) smooth-scrolls to any group while in All-views mode.
- **Tabs & chart density** — an "All views" tab plus one tab per section (and a **Full registry** tab exposing every non-curated definition); Compact / Standard / **Everything** density switch, so the page can show as few as ~21 or as many as 151 charts. Sections whose filtered slice has no loans render a friendly empty-state instead of zeros — whole-book sections (future returns, atlas, by-year, vintage) keep their full history regardless.
- **~50 plain-language insight cards** — a modular card engine (`ui/cards.js` + `ui/cards-insights.js`) renders "What the data shows / Why it happens" cards per section, every number read live from the data globals; a card whose data is missing in the current slice disappears rather than lying. Includes new cards on the fee mechanics (fee = % of principal returned, era increases) and this month's money vs the verdict. No cap or minimum — add a card with `addInsightCard({...})` and it renders.
- **Live filters** — status chips, repayment type, single-month data window (charts + KPIs + table react)
- **Sortable, searchable loan register** — all 3,672 loans (loan ID, order ID, dates, amount, status, **a Verdict column tagging each loan with its cell's tier — Lend/Small/Never/Unproven — sortable so you can filter the register to fundable loans only**, rate, tenure, score, DPD, received, interest, P&L)

The remaining 106 chart definitions (seasonality, status treemaps, correlations, pure monthly actuals, the 38 diagnostic atlas maps, the fee-proof scatter, the per-cohort annualized rate and ₹-bill bars vc3/vc4, per-cell allocation detail…) stay in `assets/js/charts/*.js` but are **not rendered** — reachable via the Full-registry tab / Everything density. Nothing is hard-capped: the render set is curated in one place (`assets/js/curation.js`) — add a chart id to a group and it shows; add a new `addChart(...)` and it becomes available there too.

## Repo structure

```
├── index.html            # dashboard page (v23 — loads data globals + modular JS)
├── assets/
│   ├── echarts.min.js    # ECharts vendored locally (Apache-2.0)
│   ├── styles.css        # dark theme
│   └── js/               # modular classic scripts (no build, works from file://)
│       ├── README.md     # module map + load order
│       ├── core.js       # helpers, state, chart registry (SECTIONS + addChart), ESSENTIAL_CHARTS
│       ├── charts/       # all 151 chart definitions, one topic per file
│       ├── curation.js   # ★ what renders: the 45 decision charts in 10 numbered groups (+ Full-registry tab)
│       ├── ui/           # one renderer per responsibility (tabs + group jump-nav, cards, panels, tables…)
│       └── boot.js       # CDN fallback, init(), filter listeners (load last)
├── data/                 # generated by scripts/build.py (json + js globals)
│   ├── loans.json/js     # all 3,672 loans (parsed from xlsx)
│   ├── summary.json/js   # lender + summary + portfolio stats
│   ├── insights.json/js  # tenure × score matrix + returns economics
│   └── audit.json/js     # verification results shown on the dashboard
└── scripts/
    ├── build.py          # orchestrator: parse → clean → summarize → insights → audit → emit
    └── ldc/              # modular pipeline (stdlib only, no pandas/openpyxl)
        ├── xlsx.py       # read .xlsx sheets (zipfile + xml.etree)
        ├── clean.py      # normalize cells into typed loan records
        ├── summary.py    # portfolio statistics
        ├── insights.py   # tenure × score matrix, returns by tenure, overall P&L, NPA by year, vintage curves
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

The audit engine (`scripts/ldc/audit.py`) runs **35 checks** on every build:

- **Money reconciliation (M1–M7)** — per-loan sums vs the report's headline figures (disbursed, received, principal, interest, fees match to the paisa; NPA and outstanding are book-level figures with documented deltas)
- **Counts & keys (C1–C5)** — row count, status counts add up, loan IDs unique, no blank fields
- **Value sanity (V1–V6)** — non-negative amounts, rates 0–100%, scores 0–1000, known tenures, DPD ≥ 0, chart-critical fields populated
- **Cross-field consistency (X1–X8)** — principal+interest = total received, date ordering, no over-repaid ACTIVE loans, closed loans have zero DPD, EMI rebate reality on closed loans
- **Matrix integrity (T1–T4)** — tenure × score heatmap cells re-derived in Python so the JS charts can never silently disagree
- **NPA-by-year ledger integrity (Y1–Y2)** — the year × tenure rows sum exactly to the book's matured loans, NPA count and NPA rupees

Current result: **27 PASS · 8 documented notes · 0 FAIL**. The notes are verified source-data characteristics (batch order IDs, unfunded loans without a disbursement date, ₹-level rounding on prepayments/recoveries, book-level NPA totals). The Z-series checks keep the vintage curves honest: every cohort reconciles to the funded book, the default-age histogram accounts for all 148 NPAs, and curves are verified monotone (defaults only accumulate).

## Notes

- **Privacy:** the lender's registered email and mobile number from the report are intentionally **not** included in this public dataset.
- Static site, 100% client-side with **zero runtime CDN dependency**: ECharts (Apache-2.0) is vendored in `assets/echarts.min.js` and the data ships as embedded JS globals (`data/*.js`), so the page works offline, from `file://`, or behind strict networks. To run it locally just download the folder and double-click `index.html` — no server or build step needed.

---

Made with 💚 · [chirag127](https://github.com/chirag127)