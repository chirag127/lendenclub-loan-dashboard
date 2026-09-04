/* ============================================================
 * curation.js — DECISION VIEW
 * Rebuilds SECTIONS from the registry into the decision flow (groups with chart ids,
 * panels, Q&A) and the curated render set (currently 45 charts — NOT a fixed cap: add a
 * chart id to a group's ids and it renders, remove one and it disappears). Runs after all
 * chart files; its id lists are the single source of truth for what shows.
 *
 * Curation rules (kept deliberately tight):
 *   • one chart per question — near-duplicates stay in the registry, not on the page;
 *   • only decision heatmaps — the few maps that directly say "fund / avoid";
 *   • everything else stays one click away (Full-registry tab / Everything density).
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ============ DECISION VIEW — the curated set that answers "which loans should I fund?" ============
   All 142 chart definitions stay in the codebase (nothing is deleted); the ones listed below render, in a
   decision flow: glance -> supply -> returns -> risk -> fine-bucket atlas -> NPA-by-year -> vintage -> watch-outs -> verdict. The count is not
   fixed — more charts and other forms (gauges, tables, matrices) are added by listing them here.
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
      sub: "Book size, how the money sits across statuses and tenures, and how fast it goes out each month — the base facts before every decision.",
      ids: ["g1", "g2", "d1", "c5", "dg1"],
      need: "any",
      cards: true,
    },
    {
      name: "Borrower supply & ticket sizes",
      sub: "What you can actually buy: how big the tickets are at each tenure, the score distribution, and whether borrower quality is trending up or down.",
      ids: ["c2", "c6", "c7"],
      need: "any",
    },
    {
      name: "What loans actually pay — net of fees & defaults",
      sub: "What your settled loans have really earned — the realized XIRR by tenure, the sticker→fees→defaults ladder, the fee schedule and its mid-book increase, and the realized net-XIRR heatmap. Every number already nets fees and the NPA book.",
      ids: ["rt1", "nr2", "fe3", "fe4", "dx1", "dx3"],
      returnsStatement: true,
      need: "matured",
      cards: true,
    },
    {
      name: "Expected future returns — what the book should earn next",
      sub: "Forward-looking, not history: the active book's projected net XIRR and net ₹ by tenure, the projected net-ROI map for new lending, the monthly EMI receipts still coming, and realized-vs-projected so you can see how much of the total is still ahead. Projections haircut future interest by each tenure's historical collection rate and apply its matured default rate.",
      ids: ["nr1", "rt6", "nr6", "nr9", "rt2", "nr10"],
      whole: true,
      need: "any",
      cards: true,
    },
    {
      name: "Your questions answered",
      qa: true,
      sub: "The headline questions behind the whole dashboard — expected annualized return vs 25%/yr, whether the numbers really are net of fees &amp; defaults, simple ROI vs XIRR, which tenures to give, rates &amp; ticket sizes, the fee bill, and whether the future will match the past — answered in plain language with live numbers (whole-book answers; the charts above react to the filters).",
    },
    {
      name: "Where loans default — risk by tenure × score",
      sub: "The risk side of every pick: matured default rates by tenure, the NPA heatmap by tenure × score, and the rupee loss rate — the three numbers that decide whether a cell's return is real.",
      ids: ["n7", "n1", "n3"],
      guardrails: true,
      riskMatrix: true,
      need: "matured",
      cards: true,
    },
    {
      name: "Fine-bucket net-XIRR atlas — tenure × score",
      whole: true,
      cards: true,
      sub: "Tenure × LenDenClub score in 10-point bands (700-709 … 790-799, 800+) = 50 buckets with matured loans. Four decision maps: the bucket's net XIRR incl. every default (whole book), the same for the 2026 vintage (is the cell getting worse?), net kept ₹ per ₹1,000 lent, and the evidence map (matured loans per bucket — read every other map next to it). Everything else (per-loan median, drag, fee %, sticker…) stays in the Full registry. Whole book: bucket maps need full history, so these do not react to the month filter.",
      ids: ["xa01", "xa03", "xa34", "xa37"],
    },
    {
      name: "NPA by origination year — tenure-level vs annualized",
      whole: true,
      cards: true,
      sub: "Defaults and rupee losses two ways — over the loan's whole life and annualized per year (× 12/tenure, so 2-month and 12-month money compare fairly) — plus the year × tenure heatmap, with the full ledger underneath. Whole book: slicing the month filter would break the by-year attribution.",
      ids: ["ny1", "ny3", "ny4"],
      npaYearTable: true,
    },
    {
      name: "Defaults by origination cohort — curves, rates & the ₹ bill",
      whole: true,
      cards: true,
      sub: "How each origination month's defaults actually arrived: cumulative NPA rate by loan age per cohort, the month-of-life of every default, and net kept per ₹1,000 after fees & every default — with the complete cohort ledger underneath. Whole book: cohort curves need the full history.",
      ids: ["vc1", "vc2", "vc5"],
      vintageTable: true,
    },
    {
      name: "Cashflow & watch-outs",
      sub: "What actually comes in each month, what the active book has received so far vs its schedule, where money is still exposed, the overdue pipeline that will decide your next default bill, and what comes back from NPAs.",
      ids: ["i1", "rt4", "n10", "n11", "dx2"],
      need: "any",
    },
    {
      name: "The verdict — lend only these",
      sub: "The recommendation, computed from everything above: every tenure × score cell ranked by net XIRR incl. all defaults, your per-₹1,000 allocation, the return-driver checks (rate, ticket size) and the plain-language reasons. Fund the green, skip the red.",
      ids: ["hp1", "hp2", "al1", "al3", "rd1", "rd2", "rd4"],
      loanPicks: true,
      decisionTable: true,
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
      sub: "Every chart definition not needed for the decision (fee-schedule detail, per-cohort rate ledgers, monthly NPA time series, DPD severity, treemaps, correlations, the 38 diagnostic atlas maps…), reachable here or via the \u201cEverything\u201d density. Not curated because it repeats a decision view already shown — but nothing is capped or hidden.",
      ids: rest,
      need: "any",
    });
  }
  SECTIONS.length = 0;
  groups.forEach((g) => {
    const sec = { name: g.name, sub: g.sub, charts: (g.ids || []).map((id) => byId[id]).filter(Boolean) };
    if (g.guardrails) sec.guardrails = true;
    if (g.returnsStatement) sec.returnsStatement = true;
    if (g.loanPicks) sec.loanPicks = true;
    if (g.why) sec.why = true;
    if (g.riskMatrix) sec.riskMatrix = true;
    if (g.npaYearTable) sec.npaYearTable = true;
    if (g.vintageTable) sec.vintageTable = true;
    if (g.decisionTable) sec.decisionTable = true;
    if (g.need) sec.need = g.need;
    if (g.whole) sec.whole = true;
    if (g.cards) sec.cards = true;
    if (g.qa) sec.qa = true;
    SECTIONS.push(sec);
  });
})();
