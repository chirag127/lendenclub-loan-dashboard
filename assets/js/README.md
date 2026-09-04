# Front-end module map

The dashboard UI is split into small, single-purpose **classic scripts** (not ES modules —
browsers block `type="module"` on `file://`, and the dashboard must keep working by
double-clicking `index.html`). Each file declares its bindings in the shared global scope,
so **load order matters** and is fixed in `index.html`.

```
core.js                       → charts/*.js            → curation.js      → ui/*.js      → boot.js
(infrastructure)              (151 chart definitions)   (decide what       (DOM renderers) (init & start)
                                                       renders: 43 of 151,
                                                       not a fixed cap)
```

## Files

### Infrastructure
| File | Responsibility |
|---|---|
| `core.js` | Formatting helpers (`inr`, `fmt`, `pct`…), palette/theme, shared state (`LOANS`, `SUMMARY`, `MONTHS`, filters), data helpers, tenure × score stats, net-projection maths, shared ECharts option pieces, `polish()` styling pass, and the chart registry (`SECTIONS` + `addChart`). |

### Chart definitions (`charts/`) — one topic per file
All **151** charts are defined here. Which ones *render* is decided later by `curation.js`.
| File | Charts | Rendered in the decision view |
|---|---|---|
| `portfolio.js` | g1–g4 | g1, g2, g3 |
| `disbursement.js` | d1–d8 | d1, d7 |
| `characteristics.js` | c1–c12 | c2, c4, c5, c6, c7, c9 |
| `status-health.js` | s1–s7 | — |
| `risk.js` | r1–r8 | r1–r8 |
| `tenure-score-risk.js` | n1–n12 | n1–n12 |
| `cashflow.js` | i1–i8 | i1, i3, i5, i6, i7, i8 |
| `net-returns.js` | nr1–nr11 | nr1–nr8, nr10, nr11 |
| `fees.js` | fe1–fe5 | fe1, fe2, fe3, fe4 — the fee model, verified from the data (fee = schedule % × principal returned per EMI, with the Apr/Jun-26 price increases for 4/5-month loans): schedule by tenure, fee ₹ vs interest, total ₹ impact waterfall, the fee increase for new 4/5-month loans, and the proof scatter (fee vs principal returned — every loan on its tenure's line) |
| `allocation.js` | al1–al3 | al2 only in the registry — the month-allocation views (al1/al3) duplicated the insight card "This month's money vs the verdict" and the decision table's "This month ₹" column, so they were cut from the curated set in v26; al2 (cell-level ₹ vs recommended) stays one click away in the Full registry |
| `return-drivers.js` | rd1–rd4 | rd1, rd2, rd3, rd4 — realized net return after fees & every default by quoted-rate band, ticket size, repayment type, and ticket-size-within-each-cell (the ₹2,500 trap), from `return_drivers()` in the pipeline (audit W3–W5) |
| `xirr.js` | rt1–rt6 | rt1–rt6 |
| `picks.js` | hp1–hp2 | hp1, hp2 |
| `decision-extra.js` | dx1–dx4, dg1 | all — new decision views (net-XIRR matrix heatmap, NPA recovery, contracted-vs-collected interest, active money by vintage, gauge dials) |
| `npa-year.js` | ny1–ny4 | all — NPA by origination year × tenure: rate over the loan's life vs annualized per year (count side + rupee side) + a year × tenure heatmap of the annualized rate |
| `vintage.js` | vc1–vc5 | all — vintage curves: cumulative NPA rate by loan age per origination month cohort (flattened bill vs still-climbing), when defaults strike (month-of-life histogram), NPA rate & ₹ loss per cohort over the loan's life vs annualized per year, and net kept per ₹1,000 after fees & every default |
| `atlas.js` | xa01–xa42 | all — the net-XIRR atlas: 42 heatmaps of 14 per-bucket metrics (net XIRR incl. defaults, repaying-only XIRR, drag, per-loan median/mean, default/loss rates over life & per year, fee %, sticker, net ₹/₹1,000, evidence) × 3 slices (whole book/2025/2026) over tenure × 10-pt score bands |
| `optional.js` | x1–x5 | — (kept for power users) |

**The count is not fixed.** The earlier “exactly 50” rule was a minimum intent, not a ceiling:
add a new `addChart(...)` and list its id in a `curation.js` group and it renders; the same file
can also host new forms (gauges like `dg1`, plus the plain-HTML `risk-matrix` table below).

### Tabs, group jump-nav, density & insight cards
- `ui/tabs.js` — the view bar: "All views" + one tab per section + a **Full registry** tab; a
  **Compact / Standard / Everything** density switch (Compact renders only `ESSENTIAL_CHARTS`
  from `core.js`; Everything adds the Full-registry section — no cap or minimum in any direction);
  and a **"Jump to" chip row** (visible in All-views mode) that smooth-scrolls to each numbered group.
- `ui/renderer.js` — every curated section renders as one visually distinct **`.group`** block
  (accent-coloured by topic, number badge, live chart-count pill) containing its own panels,
  insight cards and chart grid; groups are the jump targets of the chips above.
- `ui/cards.js` + `ui/cards-insights.js` — the insight-card engine: `addInsightCard({ section, tone,
  icon, title, data, why, need })`; every number is read live from the data globals at render time,
  cards scoped per section or global ("All"), and `need(ctx)` gates cards whose data is absent so a
  card disappears instead of lying. Nothing is hard-capped — add cards freely.


### Curation — the single source of truth for what renders
`curation.js` rebuilds `SECTIONS` into the decision flow (**decision center — the answer first** → glance → supply → realized returns → expected future returns → **your questions answered** → risk → fine-bucket-atlas → NPA-by-year → vintage → cashflow/watch-outs) and keeps the **curated render set (currently 43 — one chart per question; near-duplicates stay in the registry, only decision heatmaps are curated; the decision center holds the verdict strip, picks panel, one-table decision view, grouped loan cohorts, FY 2026–27 income plan and unproven-cell watchlist; the Q&A group holds no charts — it renders the `ui/qa.js` accordion)**.
To show or hide a chart, edit its id in that file's group lists — nothing else needs to change.

### UI renderers (`ui/`) — one responsibility per file
| File | Renders |
|---|---|
| `renderer.js` | page layout (`buildLayout` renders numbered `.group` blocks per section — panels ordered decision-first inside each group), chart instances, `renderAll`, `safeTooltip` |
| `loan-picks.js` | the "Highest-XIRR loan picks" ranking panel |
| `reasons.js` | the 🟢/🔵/🔴 lend-only verdict strip only (the long-form narrative cards were removed in v26 — they duplicated the insight-card engine; the cards live in `cards-insights.js`) |
| `guardrails.js` | the 5 lending-guardrail cards |
| `audit.js` | the data-integrity audit bar |
| `risk-matrix.js` | the tenure × score risk reference **table** (plain HTML — another form of showing the data) |
| `npa-year-table.js` | the NPA-by-year **ledger** (plain HTML): 2025/2026 × tenure, tenure-level vs annualized NPA and ₹-loss columns, from the pipeline's `npa_by_year` payload |
| `decision-table.js` | the **one-table decision view** (plain HTML): every ranked tenure × score cell — net XIRR incl. all defaults, repaying-only XIRR, matured default rate, net ₹/₹1,000, fee % of lent, quoted rate, tier, recommended ₹/₹1,000, this-month fresh ₹ (availability/drift) — sortable by any column; also exports `verdictCell(l)` / `verdictRank(l)` used by `table.js` to tag every loan in the register with its cell's verdict |
| `qa.js` | the **"Your questions answered"** Q&A accordion (plain HTML `<details>`, works from file://): 8 headline questions — expected annualized return vs 25%/yr, are the returns really net of fees & defaults (both formulas), simple ROI vs XIRR, which tenure × score to give (realized vs projected table), keep-lending-as-before, rates & the ₹2,500 ticket, the fee bill, future-vs-past — every number read live from the data globals at render time via `cardCtx()`, and answers that degrade gracefully when a figure is missing |
| `returns-statement.js` | the P&L / ROI / annualized-return statement |
| `kpis.js` | the 12 KPI cards |
| `filters.js` | the status filter chips |
| `table.js` | the sortable/searchable loan register (with a sortable **Verdict** column — Lend/Small/Conditional/Never/Unproven per loan's cell; the register can also be filtered by the selected group) |
| `loan-groups.js` | the modular **Loan groups** panel: decision verdict, tenure, score-band and ticket-size groupings with loan counts, exposure, active/closed/NPA mix, matured NPA rate, realized net return, forward expected return and click-through register filtering |
| `fy-income.js` | the **FY 2026–27 income plan** panel (plain HTML): expected net profit on the current active book + monthly reinvestment into the strict-eligible cells, formatted from the pipeline's `fy_forecast` payload (`scripts/ldc/forecast.py`) |
| `unproven.js` | the **unproven / thin-evidence watchlist**: every tenure × score cell with 1–29 matured loans (not yet certified) or zero loans (untested), so users know where the verdict is silent and why |

### Boot
`boot.js` (load last): ECharts CDN fallback chain, `showError`, `init()` — which loads the
data globals, builds the layout, renders KPIs/table/panels/charts — and the filter listeners.

## Conventions
- **No ES modules, no bundler, no build step** — plain classic scripts, global bindings, ordered tags in `index.html`.
- “Showing the data” is not limited to ECharts cards — the dashboard also mixes in gauge dials (`dg1`)
  and plain-HTML tables (loan register, `risk-matrix.js`, `npa-year-table.js`) whenever a table/dial reads better than a chart.
- Chart files only ever call `addChart(...)`; UI files only touch the DOM; `curation.js` only rearranges the registry.
- Whole-book analyses with their own dimension (like the by-origination-year NPA section) read the pipeline
  payload (`INSIGHTS_DATA`) rather than the filtered loan list, and state on the panel that the filters don't
  apply — slicing the month window would break the year attribution.
- Data itself is generated by the Python pipeline (`scripts/`) — this folder is 100% presentation logic.
