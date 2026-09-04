/* ============================================================
 * curation.js — DECISION VIEW
 * Rebuilds SECTIONS from the registry into the 7-section decision flow and the curated render set
 * (currently 64 charts + panels/tables — NOT a fixed cap: add a chart id to a group's ids and it
 * renders, remove one and it disappears). Runs after all chart files; its id lists are the single
 * source of truth for what shows.
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ============ DECISION VIEW — the curated set that answers "which loans should I fund?" ============
   All 91 chart definitions stay in the codebase (nothing is deleted); the ones listed below render, in a
   decision flow: glance -> supply -> returns -> risk -> NPA-by-year -> cashflow/watch-outs -> verdict. The count is not
   fixed at 50 — more charts and other forms (gauges, tables, matrices) are added by listing them here.
   Everything shown nets out fees + NPAs or feeds the risk/returns math behind the picks. */
(function curateDecisionView() {
  const byId = {};
  SECTIONS.forEach((s) => s.charts.forEach((c) => { byId[c.id] = c; }));
  const groups = [
    {
      name: "The book at a glance",
      sub: "Book size, tenure mix, repayment type and how fast money goes out each month — the base facts before every decision.",
      ids: ["g1", "g2", "g3", "d1", "d7", "c4", "c5", "dg1"],
    },
    {
      name: "Borrower supply & ticket sizes",
      sub: "What you can actually buy: how many loans are available at each tenure and LenDenClub score, how big the tickets are, and whether borrower quality is trending up or down.",
      ids: ["c2", "c6", "c7", "c9"],
    },
    {
      name: "What loans actually pay — net of fees & defaults",
      sub: "Every return here already subtracts platform fees and the NPA book: simple ROI and money-weighted XIRR with monthly-EMI timing, by tenure and by score band, the full rate ladder and what a ₹1,000 loan really nets.",
      ids: ["rt1", "rt3", "rt5", "nr1", "nr2", "nr3", "nr4", "nr5", "nr6", "nr7", "nr8", "nr10", "dx1", "dx3", "nr11"],
      returnsStatement: true,
    },
    {
      name: "Where loans default — risk by tenure × score",
      sub: "Matured-only default rates (NPA ÷ closed+NPA), the NPA heatmaps by tenure × score band, and how much of each tenure's interest NPAs erase — the risk side of every pick below.",
      ids: ["r1", "r2", "r3", "r4", "r5", "n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8", "n9"],
      guardrails: true,
      riskMatrix: true,
    },
    {
      name: "NPA by origination year — tenure-level vs annualized",
      sub: "The same default and loss rates shown two ways — over the loan's whole life and annualized per year (× 12/tenure, so 2-month and 12-month money compare fairly) — split by the origination year (Dec-2025 vintage vs 2026) with the full ledger underneath. Whole book: slicing the month filter would break the by-year attribution, so these charts and the table do not react to it.",
      ids: ["ny1", "ny2", "ny3", "ny4"],
      npaYearTable: true,
    },
    {
      name: "Cashflow & watch-outs",
      sub: "What actually comes in each month, what the active book is projected to return, and the overdue pipeline that will decide your next default bill.",
      ids: ["i1", "i3", "i5", "i6", "i7", "rt2", "rt4", "rt6", "n10", "n11", "r6", "r8", "dx2", "dx4", "n12", "i8", "r7"],
    },
    {
      name: "The verdict — lend only these",
      sub: "The recommendation, computed from everything above: every tenure × score cell ranked by net XIRR incl. all defaults, your per-₹1,000 allocation and the plain-language reasons. Fund the green, skip the red.",
      ids: ["hp1", "hp2"],
      loanPicks: true,
      why: true,
    },
  ];
  SECTIONS.length = 0;
  groups.forEach((g) => {
    const sec = { name: g.name, sub: g.sub, charts: g.ids.map((id) => byId[id]).filter(Boolean) };
    if (g.guardrails) sec.guardrails = true;
    if (g.returnsStatement) sec.returnsStatement = true;
    if (g.loanPicks) sec.loanPicks = true;
    if (g.why) sec.why = true;
    if (g.riskMatrix) sec.riskMatrix = true;
    if (g.npaYearTable) sec.npaYearTable = true;
    SECTIONS.push(sec);
  });
})();
