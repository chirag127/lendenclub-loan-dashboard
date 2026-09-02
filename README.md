# 💚 LenDenClub Loan Analytics Dashboard

Interactive analytics dashboard for a **LenDenClub (Lending Club India) manual lending report** — 50+ charts, KPIs and a full loan register, hosted on GitHub Pages.

**Live:** https://chirag127.github.io/lendenclub-loan-dashboard/

![Charts](https://img.shields.io/badge/charts-52-brightgreen) ![Loans](https://img.shields.io/badge/loans-2%2C993-blue) ![Stack](https://img.shields.io/badge/stack-html%2Bjs%2Becharts-orange)

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
| Net P&L (interest + fees) | ₹1,92,540 |
| Principal outstanding | ₹5,23,239 |
| NPA amount | ₹84,843 (148 loans, 4.9%) |
| Loans with DPD > 0 | 275 |

## Key findings

- **79% of loans (2,363) have closed** and repaid in full; 416 are still active, 148 went NPA, 35 are processing and 31 were rejected/cancelled.
- **Avg contracted interest rate is 45.7%** (range 18.0–58.2%) — rates scale sharply with tenure: ~2-month loans run low-40s, 12-month loans push past 50%.
- **Avg LenDenClub score is 732** (range 700–878). Score drives ticket size — higher-score borrowers get meaningfully larger loans.
- **NPA rate ≈ 4.9% overall.** Defaults cluster in longer tenures and lower score bands; most NPA exposure sits in loans originated Dec 2025–Mar 2026.
- **Recovery is strong:** cumulative principal received has tracked cumulative disbursements closely, and 100% of interest/fees received to date total ₹2.53L vs ₹45.1K paid in platform fees.
- 24 daily-repayment loans vs 2,969 monthly — daily loans are the minority, mostly 2-month tenures.

## Dashboard features

- **12 KPI cards** — disbursed, received, interest, P&L, fees, NPA, outstanding, avg rate (simple + weighted), active/closed/NPA counts, DPD exposure
- **52 interactive charts** (Apache ECharts) in 7 sections:
  - *Portfolio overview* — status split, money in the portfolio, repayment-type split, rate histogram
  - *Disbursement activity* — monthly/ cumulative/avg disbursement, weekday & day-of-month seasonality, tenure-stacked volumes
  - *Loan characteristics* — amount/rate/score/tenure distributions, score-vs-ticket-size, rate-vs-tenure
  - *Portfolio & status health* — status counts & share by month, avg amount/rate/score/tenure by status, status treemap
  - *Risk (NPA & DPD)* — NPA counts, amounts and rates by month/tenure/score band, DPD histogram & 30/60/90-day delinquency lines
  - *Returns & cashflow* — received/principal/interest/fees/P&L by month, cumulative received vs disbursed, recovery rate, expected vs received
  - *Correlations & advanced* — amount×rate, score×rate, amount×score scatter plots + month×score and month×tenure heatmaps
- **Live filters** — status chips, repayment type, single-month data window (all charts + KPIs + table react)
- **Sortable, searchable loan register** — all 2,993 loans (loan ID, order ID, dates, amount, status, rate, tenure, score, DPD, received, interest, P&L)

## Repo structure

```
├── index.html            # dashboard page
├── assets/
│   ├── app.js            # chart engine + analysis (52 charts)
│   └── styles.css        # dark theme
├── data/
│   ├── loans.json        # all 2,993 loans (parsed from xlsx)
│   └── summary.json      # lender + summary + portfolio stats
└── scripts/
    └── build_data.py     # xlsx → JSON converter (stdlib only)
```

## Regenerating the data

```bash
python scripts/build_data.py "path/to/MANUAL_LENDING_REPORT_....xlsx"
```

No pandas/openpyxl needed — the parser reads the xlsx directly with `zipfile` + `xml.etree`.

## Notes

- **Privacy:** the lender's registered email and mobile number from the report are intentionally **not** included in this public dataset.
- Static site, 100% client-side with **zero runtime CDN dependency**: ECharts (Apache-2.0) is vendored in `assets/echarts.min.js` and the data ships as embedded JS globals, so the page works offline, from `file://`, or behind strict networks.

---

Made with 💚 · [chirag127](https://github.com/chirag127)