/* ============================================================
 * curation.js — DECISION VIEW
 * Rebuilds SECTIONS from the registry into the 9-section decision flow and the curated render set
 * (currently 114 charts + panels/tables — NOT a fixed cap: add a chart id to a group's ids and it
 * renders, remove one and it disappears). Runs after all chart files; its id lists are the single
 * source of truth for what shows.
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ============ DECISION VIEW — the curated set that answers "which loans should I fund?" ============
   All 142 chart definitions stay in the codebase (nothing is deleted); the ones listed below render, in a
   decision flow: glance -> supply -> returns -> risk -> XIRR-atlas -> NPA-by-year -> vintage -> cashflow/watch-outs -> verdict. The count is not
   fixed at 50 — more charts and other forms (gauges, tables, matrices) are added by listing them here.
   Everything shown nets out fees + NPAs or feeds the risk/returns math behind the picks. */
(function curateDecisionView() {
  /* keep the FULL registry reachable before rebuilding SECTIONS: the "Everything"
     density and the "Full registry" tab show these otherwise-hidden charts too */
  window.FULL_SECTIONS = SECTIONS.map((s) => ({ name: s.name, sub: s.sub, charts: s.charts.slice() }));
  const byId = {};
  SECTIONS.forEach((s) => s.charts.forEach((c) => { byId[c.id] = c; }));
  const groups = [
    {
      name: "The book at a glance",
      sub: "Book size, tenure mix, repayment type and how fast money goes out each month — the base facts before every decision.",
      ids: ["g1", "g2", "g3", "d1", "d7", "c4", "c5", "dg1"],
      need: "any",
      cards: true,
    },
    {
      name: "Borrower supply & ticket sizes",
      sub: "What you can actually buy: how many loans are available at each tenure and LenDenClub score, how big the tickets are, and whether borrower quality is trending up or down.",
      ids: ["c2", "c6", "c7", "c9"],
      need: "any",
    },
    {
      name: "What loans actually pay — net of fees & defaults",
      sub: "Every return here already subtracts platform fees and the NPA book: simple ROI and money-weighted XIRR with monthly-EMI timing, by tenure and by score band, the full rate ladder and what a ₹1,000 loan really nets.",
      ids: ["rt1", "rt3", "rt5", "nr1", "nr2", "nr3", "nr4", "nr5", "fe1", "fe2", "fe3", "nr6", "nr7", "nr8", "nr10", "dx1", "dx3", "nr11"],
      returnsStatement: true,
      need: "matured",
      cards: true,
    },
    {
      name: "Where loans default — risk by tenure × score",
      sub: "Matured-only default rates (NPA ÷ closed+NPA), the NPA heatmaps by tenure × score band, and how much of each tenure's interest NPAs erase — the risk side of every pick below.",
      ids: ["r1", "r2", "r3", "r4", "r5", "n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8", "n9"],
      guardrails: true,
      riskMatrix: true,
      need: "matured",
      cards: true,
    },
    {
      name: "The net-XIRR atlas — 42 heatmaps of the fine buckets",
      whole: true,
      cards: true,
      sub: "One grid, 42 ways to read it: every tenure (2 → 12 mo) × LenDenClub score in 10-point bands (700-709 … 790-799, 800+) = up to 66 buckets — 50 of them hold matured loans, 37 have enough evidence (≥ 5 matured) to rate. The 42 heatmaps above cross 14 metrics (pooled net XIRR incl. every default and fee, repaying-loans-only XIRR, default drag, per-loan median/mean annualized net return, default & principal-loss rates over the loan's life and per year, realized fee %, sticker rate, net kept per ₹1,000, plus matured/NPA evidence) with three slices (whole book, 2025 vintage, 2026 vintage). Read a metric, then compare it across the two years to see whether a bucket is getting better or worse. Whole book: bucket maps need full history, so these do not react to the month filter.",
      ids: [...(window.ATLAS_CHART_IDS || [])],
    },
    {
      name: "NPA by origination year — tenure-level vs annualized",
      whole: true,
      cards: true,
      sub: "The same default and loss rates shown two ways — over the loan's whole life and annualized per year (× 12/tenure, so 2-month and 12-month money compare fairly) — split by the origination year (Dec-2025 vintage vs 2026) with the full ledger underneath. Whole book: slicing the month filter would break the by-year attribution, so these charts and the table do not react to it.",
      ids: ["ny1", "ny2", "ny3", "ny4"],
      npaYearTable: true,
    },
    {
      name: "Defaults by origination cohort — curves, rates & the ₹ bill",
      whole: true,
      cards: true,
      sub: "The same defaults by origination month: cumulative NPA rate at each loan age (one line per cohort), when defaults strike, then each cohort's full set of percentages — NPA rate and ₹ loss over the loan's life vs annualized per year, and net kept per ₹1,000 after fees & every default — with the complete ledger table underneath. Whole book: cohort curves need the full history, so these do not react to the month filter.",
      ids: ["vc1", "vc2", "vc3", "vc4", "vc5"],
      vintageTable: true,
    },
    {
      name: "Cashflow & watch-outs",
      sub: "What actually comes in each month, what the active book is projected to return, and the overdue pipeline that will decide your next default bill.",
      ids: ["i1", "i3", "i5", "i6", "i7", "rt2", "rt4", "rt6", "n10", "n11", "r6", "r8", "dx2", "dx4", "n12", "i8", "r7"],
      need: "any",
    },
    {
      name: "The verdict — lend only these",
      sub: "The recommendation, computed from everything above: every tenure × score cell ranked by net XIRR incl. all defaults, your per-₹1,000 allocation and the plain-language reasons. Fund the green, skip the red.",
      ids: ["hp1", "hp2"],
      loanPicks: true,
      why: true,
      need: "matured",
    },
  ];
  /* "Full registry" tab: every chart definition in the codebase that is NOT in the
     curated set above — nothing is hidden forever, the density switch or this tab
     brings it back. No fixed cap in either direction. */
  const curatedIds = new Set();
  groups.forEach((g) => (g.ids || []).forEach((id) => curatedIds.add(id)));
  const rest = [];
  (window.FULL_SECTIONS || []).forEach((s) => s.charts.forEach((c) => { if (!curatedIds.has(c.id)) rest.push(c.id); }));
  if (rest.length) {
    groups.push({
      name: "Full chart registry — everything else the code can show",
      sub: "Every remaining chart definition (seasonality, treemaps, correlations, monthly actuals…), reachable here or via the \u201cEverything\u201d density. Not curated into the decision flow because it answers narrower questions — but nothing is capped or hidden.",
      ids: rest,
      need: "any",
    });
  }
  SECTIONS.length = 0;
  groups.forEach((g) => {
    const sec = { name: g.name, sub: g.sub, charts: g.ids.map((id) => byId[id]).filter(Boolean) };
    if (g.guardrails) sec.guardrails = true;
    if (g.returnsStatement) sec.returnsStatement = true;
    if (g.loanPicks) sec.loanPicks = true;
    if (g.why) sec.why = true;
    if (g.riskMatrix) sec.riskMatrix = true;
    if (g.npaYearTable) sec.npaYearTable = true;
    if (g.vintageTable) sec.vintageTable = true;
    if (g.need) sec.need = g.need;
    if (g.whole) sec.whole = true;
    if (g.cards) sec.cards = true;
    SECTIONS.push(sec);
  });
})();
