/* ============================================================
 * core.js — shared infrastructure
 * Formatting helpers, palette, state + data helpers, tenure/projection maths, shared ECharts option
 * pieces, the polish() styling pass, and the chart registry (SECTIONS + addChart).
 * Load FIRST: every other file builds on these bindings.
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* LenDenClub Loan Analytics Dashboard — curated decision view (of 142 defined), Apache ECharts */
"use strict";

/* normalize ECharts tooltip params: always work on a non-empty array */
function tp(p) {
  const a = Array.isArray(p) ? p : p && p.value != null ? [p] : [];
  return a;
}

/* ---------------- formatting helpers ---------------- */
const fmt = new Intl.NumberFormat("en-IN");
const inr = (n) => "₹" + fmt.format(Math.round(n || 0));
function inrCompact(n) {
  const a = Math.abs(n || 0);
  if (a >= 1e7) return "₹" + (n / 1e7).toFixed(2) + "Cr";
  if (a >= 1e5) return "₹" + (n / 1e5).toFixed(2) + "L";
  if (a >= 1e3) return "₹" + (n / 1e3).toFixed(1) + "K";
  return "₹" + fmt.format(Math.round(n || 0));
}
const pct = (n) => (n == null ? "–" : n.toFixed(1) + "%");
const MONTH_LABEL = {
  "2025-12": "Dec 25", "2026-01": "Jan 26", "2026-02": "Feb 26", "2026-03": "Mar 26",
  "2026-04": "Apr 26", "2026-05": "May 26", "2026-06": "Jun 26", "2026-07": "Jul 26",
  "2026-08": "Aug 26", "2026-09": "Sep 26",
};

/* ---------------- palette ---------------- */
const STATUS_COLORS = {
  CLOSED: "#22c55e", ACTIVE: "#3b82f6", NPA: "#ef4444",
  PROCESSING: "#f59e0b", REJECTED: "#64748b", CANCELLED: "#a855f7",
};
const GREEN = "#22c55e", BLUE = "#3b82f6", RED = "#ef4444", AMBER = "#f59e0b", PURPLE = "#a855f7", CYAN = "#06b6d4";
const AXIS = { axisLine: { lineStyle: { color: "#2b3c5e" } }, axisLabel: { color: "#8fa3c0" }, splitLine: { lineStyle: { color: "rgba(31,46,74,0.5)" } } };

/* ---------------- state ---------------- */
let LOANS = [];
let SUMMARY = null;
const state = {
  status: new Set(["CLOSED", "ACTIVE", "NPA", "PROCESSING", "REJECTED", "CANCELLED"]),
  repay: "All",
  window: "All",
  view: "All",            // which tab is showing: "All" or a section name (see ui/tabs.js)
  density: "standard",     // chart density: "compact" | "standard" | "everything"
};
let MONTHS = []; // 'YYYY-MM' ascending

const WINDOW_MAP = {
  All: null, Dec25: "2025-12", Jan26: "2026-01", Feb26: "2026-02", Mar26: "2026-03",
  Apr26: "2026-04", May26: "2026-05", Jun26: "2026-06", Jul26: "2026-07", Aug26: "2026-08", Sep26: "2026-09",
};

/* ---------------- data helpers ---------------- */
function filtered() {
  const wm = WINDOW_MAP[state.window];
  return LOANS.filter((l) =>
    state.status.has(l.status) &&
    (state.repay === "All" || l.repayment_type === state.repay) &&
    (!wm || (l.disbursement_date || "").startsWith(wm))
  );
}
/* does the current filter slice contain ANY loan a given section cares about?
   sec.need: "any" (default) | "matured" (CLOSED+NPA) | "active" | "npa" — lets a
   section hide itself with a friendly empty-state instead of rendering zeros. */
function hasLoansInSlice(sec) {
  const L = filtered();
  if (!L.length) return false;
  const need = (sec && sec.need) || "any";
  if (need === "any") return true;
  if (need === "matured") return L.some((l) => l.status === "CLOSED" || l.status === "NPA");
  if (need === "active") return L.some((l) => l.status === "ACTIVE");
  if (need === "npa") return L.some((l) => l.status === "NPA");
  return true;
}
function monthIndex(m) { return MONTHS.indexOf(m); }
function sumByMonth(loans, key) {
  const out = MONTHS.map(() => 0);
  loans.forEach((l) => { const i = monthIndex((l.disbursement_date || "").slice(0, 7)); if (i >= 0) out[i] += l[key] || 0; });
  return out;
}
function countByMonth(loans) {
  const out = MONTHS.map(() => 0);
  loans.forEach((l) => { const i = monthIndex((l.disbursement_date || "").slice(0, 7)); if (i >= 0) out[i] += 1; });
  return out;
}
function avgByMonth(loans, key) {
  const s = sumByMonth(loans, key), c = countByMonth(loans);
  return s.map((v, i) => (c[i] ? +(v / c[i]).toFixed(2) : null));
}
function cum(arr) { let t = 0; return arr.map((v) => (t += v || 0)); }
function avg(arr) { const v = arr.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; }
function histOf(loans, key, buckets) {
  // buckets: [{label, min, max}]  ->  counts + sum + avg
  const res = buckets.map((b) => ({ ...b, count: 0, sum: 0 }));
  loans.forEach((l) => {
    const v = l[key];
    if (v == null) return;
    const b = buckets.find((b) => v >= b.min && v < b.max);
    if (b) { const r = res.find((x) => x.label === b.label); r.count += 1; r.sum += v; }
  });
  return res;
}
function rateByMonth(loans, isBad) {
  const total = countByMonth(loans);
  const bad = MONTHS.map(() => 0);
  loans.forEach((l) => { const i = monthIndex((l.disbursement_date || "").slice(0, 7)); if (i >= 0 && isBad(l)) bad[i] += 1; });
  return total.map((t, i) => (t ? +((bad[i] / t) * 100).toFixed(2) : null));
}
const SCORE_BANDS = [
  { label: "700–724", min: 700, max: 725 }, { label: "725–749", min: 725, max: 750 },
  { label: "750–774", min: 750, max: 775 }, { label: "775–799", min: 775, max: 800 },
  { label: "800+", min: 800, max: 10000 },
];
const RATE_BUCKETS = [
  { label: "<35%", min: 0, max: 35 }, { label: "35–40%", min: 35, max: 40 },
  { label: "40–45%", min: 40, max: 45 }, { label: "45–50%", min: 45, max: 50 },
  { label: "50%+", min: 50, max: 100 },
];
const AMOUNT_BUCKETS = [
  { label: "≤ ₹250", min: 0, max: 250.01 }, { label: "₹251–500", min: 250.01, max: 500.01 },
  { label: "₹501–1K", min: 500.01, max: 1000.01 }, { label: "₹1–2K", min: 1000.01, max: 2000.01 },
  { label: "₹2–4K", min: 2000.01, max: 4000.01 },
];
const DPD_BUCKETS = [
  { label: "0 days", min: 0, max: 0.5 }, { label: "1–30", min: 0.5, max: 30.5 },
  { label: "31–60", min: 30.5, max: 60.5 }, { label: "61–90", min: 60.5, max: 90.5 },
  { label: ">90", min: 90.5, max: 10000 },
];
const TENURES = [2, 3, 4, 5, 6, 12];
const SCORE_TIERS = [
  { label: "700–724", min: 700, max: 725, color: "#ef4444" },
  { label: "725–774", min: 725, max: 775, color: "#f59e0b" },
  { label: "775+", min: 775, max: 10000, color: "#22c55e" },
];

/* cross-tab helpers for tenure × score risk analysis */
function tenureBandStats(L, t, b) {
  const xs = L.filter((l) => l.tenure === t && l.score != null && l.score >= b.min && l.score < b.max);
  const npa = xs.filter((l) => l.status === "NPA");
  const matured = xs.filter((l) => l.status === "NPA" || l.status === "CLOSED");
  const disb = xs.reduce((a, l) => a + (l.amount || 0), 0);
  const npaAmt = npa.reduce((a, l) => a + (l.npa_amount || 0), 0);
  const rates = xs.filter((l) => l.interest_rate != null);
  return {
    t, band: b.label, count: xs.length, npa: npa.length,
    npaRate: xs.length ? +((npa.length / xs.length) * 100).toFixed(1) : null,
    maturedRate: matured.length ? +((npa.length / matured.length) * 100).toFixed(1) : null,
    lossRate: disb ? +((npaAmt / disb) * 100).toFixed(1) : 0,
    avgRate: rates.length ? +avg(rates.map((l) => l.interest_rate)).toFixed(1) : null,
    disb, npaAmt,
  };
}
function tenureStats(L, t) {
  const xs = L.filter((l) => l.tenure === t);
  const npa = xs.filter((l) => l.status === "NPA");
  const closed = xs.filter((l) => l.status === "CLOSED");
  const matured = [...npa, ...closed];
  const active = xs.filter((l) => l.status === "ACTIVE" || l.status === "PROCESSING");
  const disb = xs.reduce((a, l) => a + (l.amount || 0), 0);
  const npaAmt = npa.reduce((a, l) => a + (l.npa_amount || 0), 0);
  const intr = xs.reduce((a, l) => a + (l.interest_received || 0), 0);
  const pnl = xs.reduce((a, l) => a + (l.pnl || 0), 0);
  const rates = xs.filter((l) => l.interest_rate != null);
  return {
    t, count: xs.length, npa: npa.length, closed: closed.length,
    active: active.length, matured: matured.length,
    npaRate: xs.length ? +((npa.length / xs.length) * 100).toFixed(1) : null,
    maturedRate: matured.length ? +((npa.length / matured.length) * 100).toFixed(1) : null,
    lossRate: disb ? +((npaAmt / disb) * 100).toFixed(1) : null,
    npaShareOfInterest: intr ? +((npaAmt / intr) * 100).toFixed(1) : null,
    disb, npaAmt, intr, pnl,
    avgRate: rates.length ? +avg(rates.map((l) => l.interest_rate)).toFixed(1) : null,
    avgDpd: +(avg(xs.map((l) => l.dpd || 0))).toFixed(1),
    dpdCount: xs.filter((l) => (l.dpd || 0) > 0).length,
  };
}

/* ---------------- net-of-everything projection helpers ---------------- */
function feeRateByTenure(L) {
  const out = {};
  TENURES.forEach((t) => {
    const c = L.filter((l) => l.status === "CLOSED" && l.tenure === t);
    const d = c.reduce((s, l) => s + (l.amount || 0), 0);
    out[t] = d ? c.reduce((s, l) => s + (l.platform_fee || 0), 0) / d : 0.0172;
  });
  return out;
}
function maturedRateByTenure(L) {
  const out = {};
  TENURES.forEach((t) => {
    const m = L.filter((l) => l.tenure === t && (l.status === "CLOSED" || l.status === "NPA"));
    out[t] = m.length ? (100 * m.filter((l) => l.status === "NPA").length) / m.length : 0;
  });
  return out;
}
function collRateByTenure(L) {
  /* % of contracted interest actually collected on fully-closed loans per tenure.
     Borrowers prepay and get interest rebates, so this is far below 100%
     (2-mo ~87%, 6-mo ~59%, 12-mo ~25%). */
  const out = {};
  TENURES.forEach((t) => {
    const c = L.filter((l) => l.status === "CLOSED" && l.tenure === t);
    const ci = c.reduce((s, l) => s + ((l.total_repayment || 0) - (l.amount || 0)), 0);
    const ii = c.reduce((s, l) => s + (l.interest_received || 0), 0);
    out[t] = ci ? (100 * ii) / ci : 70;
  });
  return out;
}
function projectedNet(rows, feeRate, matRate, collRate, defRateOverride) {
  /* Realized + expected full-cycle net for a set of loans: interest − fees − NPA,
     plus future interest on ACTIVE loans haircut by the per-tenure interest
     collection rate (early-repayment rebates), less future fees and expected
     future NPA losses at the (matured-only) historical default rate. */
  const disb = rows.reduce((s, l) => s + (l.amount || 0), 0);
  const npaAmt = rows.filter((l) => l.status === "NPA").reduce((s, l) => s + (l.npa_amount || 0), 0);
  const realized = rows.reduce((s, l) => s + (l.interest_received || 0), 0)
    - rows.reduce((s, l) => s + (l.platform_fee || 0), 0) - npaAmt;
  let futInt = 0, futFee = 0, out = 0;
  rows.filter((l) => l.status === "ACTIVE").forEach((l) => {
    const t = l.tenure;
    futInt += Math.max(0, (l.total_repayment || 0) - (l.amount || 0) - (l.interest_received || 0));
    futFee += Math.max(0, (l.amount || 0) * (feeRate[t] || 0.0172) - (l.platform_fee || 0));
    out += (l.amount || 0) - (l.principal_received || 0);
  });
  const t0 = rows.length ? rows[0].tenure : 2;
  const defRate = defRateOverride != null ? defRateOverride : (matRate[t0] || 0);
  const collPct = (collRate ? collRate[t0] : 100) || 100;
  const expLoss = out * defRate / 100;
  const projected = realized + futInt * (collPct / 100) * (1 - defRate / 100) - futFee - expLoss;
  return {
    t: t0, count: rows.length, disb, realized, futInt, futFee, out, defRate, expLoss, projected, collRate: collPct,
    realizedROI: disb ? (100 * realized / disb) : 0,
    projectedROI: disb ? (100 * projected / disb) : 0,
  };
}

/* ---------------- shared option pieces ---------------- */
function baseOption() {
  return {
    backgroundColor: "transparent",
    textStyle: { color: "#e6edf7", fontFamily: "Segoe UI, system-ui, sans-serif" },
    tooltip: { trigger: "axis", backgroundColor: "#0f1a2e", borderColor: "#2b3c5e", textStyle: { color: "#e6edf7", fontSize: 12 } },
    grid: { left: 46, right: 16, top: 30, bottom: 28 },
    legend: { textStyle: { color: "#8fa3c0", fontSize: 11 }, top: 0 },
  };
}
const CAT_AXIS = (cats) => ({ type: "category", data: cats, axisLine: AXIS.axisLine, axisLabel: { color: "#8fa3c0" } });
const VAL_AXIS = (money) => ({
  type: "value", axisLabel: { color: "#8fa3c0", formatter: money ? (v) => inrCompact(v) : (v) => fmt.format(v) },
  splitLine: { lineStyle: { color: "rgba(31,46,74,0.5)" } },
});
/* MLABELS must be LIVE: MONTHS is only populated at runtime (init), so a load-time const would stay empty
   and every month axis would lose its labels. A global getter re-derives it on each access. */
Object.defineProperty(globalThis, "MLABELS", {
  configurable: true,
  get() { return MONTHS.map((m) => MONTH_LABEL[m] || m); },
});
const tooltipMoney = (prefix) => ({ valueFormatter: (v) => (prefix || "") + inr(v) });

/* ---------------- visual polish — richer use of the ECharts library ----------------
   Applied to every chart option before render: glassy tooltips with crosshair
   pointers, vertical gradients on bars, hover emphasis on all series types,
   smooth animation/transitions and dataZoom for long category axes. */
function lighten(hex, f) {
  if (typeof hex !== "string" || hex[0] !== "#" || hex.length !== 7) return hex;
  const n = parseInt(hex.slice(1), 16);
  const m = (c) => Math.round(c + (255 - c) * f);
  return "rgb(" + m((n >> 16) & 255) + "," + m((n >> 8) & 255) + "," + m(n & 255) + ")";
}
function grad(c) {
  return { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: lighten(c, 0.32) }, { offset: 1, color: c }] };
}
function polish(opt) {
  /* accessibility + smooth animation */
  opt.aria = { enabled: true, decal: { show: false } };
  opt.animation = true;
  opt.animationDuration = 900;
  opt.animationEasing = "cubicOut";
  opt.animationDurationUpdate = 600;
  opt.animationEasingUpdate = "cubicInOut";

  /* rich glassy tooltip + crosshair pointer (keeps each chart's formatter/position) */
  const tt = opt.tooltip || {};
  const trigger = tt.trigger || "axis";
  opt.tooltip = {
    ...tt, trigger,
    confine: true,
    backgroundColor: "rgba(13,23,42,0.95)",
    borderColor: "#2b3c5e",
    borderWidth: 1,
    padding: [10, 14],
    textStyle: { color: "#e6edf7", fontSize: 12 },
    extraCssText: "box-shadow: 0 12px 34px rgba(0,0,0,0.5); border-radius: 10px; backdrop-filter: blur(8px);",
    axisPointer: trigger === "item" ? { type: "shadow", shadowStyle: { color: "rgba(59,130,246,0.12)" } } : {
      type: "cross",
      lineStyle: { color: "#4a6fa5", type: "dashed", opacity: 0.55 },
      crossStyle: { color: "#4a6fa5", type: "dashed" },
      label: { backgroundColor: "#1d2b45", borderColor: "#2b3c5e", color: "#e6edf7", fontSize: 10, padding: [3, 7] },
    },
  };

  /* legend polish */
  if (opt.legend) opt.legend = { ...opt.legend, icon: opt.legend.icon || "roundRect", itemWidth: 12, itemHeight: 12, itemGap: 16, textStyle: { color: "#8fa3c0", fontSize: 11 } };

  /* per-series upgrades */
  (opt.series || []).forEach((s) => {
    if (!s || !s.type) return;
    if (s.type === "bar") {
      const ic = s.itemStyle && s.itemStyle.color;
      if (typeof ic === "string") s.itemStyle = { ...(s.itemStyle || {}), color: grad(ic) };
      if (Array.isArray(s.data)) s.data = s.data.map((d) => {
        if (d && typeof d === "object" && d.itemStyle && typeof d.itemStyle.color === "string")
          return { ...d, itemStyle: { ...d.itemStyle, color: grad(d.itemStyle.color) } };
        return d;
      });
      s.emphasis = { ...(s.emphasis || {}), itemStyle: { ...((s.emphasis && s.emphasis.itemStyle) || {}), shadowBlur: 12, shadowColor: "rgba(0,0,0,0.45)" } };
      s.universalTransition = { enabled: true };
    } else if (s.type === "line") {
      s.symbol = s.symbol || "circle";
      s.emphasis = { ...(s.emphasis || {}), focus: "series", itemStyle: { ...((s.emphasis && s.emphasis.itemStyle) || {}), shadowBlur: 14, shadowColor: "rgba(0,0,0,0.5)" }, lineStyle: { ...((s.emphasis && s.emphasis.lineStyle) || {}), width: ((s.lineStyle && s.lineStyle.width) || 2) + 1 } };
      s.universalTransition = { enabled: true };
    } else if (s.type === "pie") {
      s.itemStyle = { ...(s.itemStyle || {}), shadowBlur: 14, shadowColor: "rgba(0,0,0,0.4)" };
      s.emphasis = { ...(s.emphasis || {}), scale: true, scaleSize: 8, itemStyle: { ...((s.emphasis && s.emphasis.itemStyle) || {}), shadowBlur: 20, shadowColor: "rgba(0,0,0,0.55)" } };
      s.labelLine = s.labelLine || { length: 12, length2: 10, lineStyle: { color: "#3a4d6e" } };
    } else if (s.type === "heatmap") {
      s.itemStyle = { ...(s.itemStyle || {}), borderColor: "#0b1220", borderWidth: 2 };
      s.emphasis = { ...(s.emphasis || {}), itemStyle: { ...((s.emphasis && s.emphasis.itemStyle) || {}), shadowBlur: 10, shadowColor: "rgba(0,0,0,0.6)", borderColor: "#e6edf7", borderWidth: 1.5 } };
    } else if (s.type === "scatter") {
      s.emphasis = { ...(s.emphasis || {}), scale: 1.5, itemStyle: { ...((s.emphasis && s.emphasis.itemStyle) || {}), shadowBlur: 14, shadowColor: "rgba(0,0,0,0.45)" } };
    }
  });

  /* dataZoom (slider + wheel) for long category charts, e.g. the 14-month EMI timeline */
  const xas = Array.isArray(opt.xAxis) ? opt.xAxis : opt.xAxis ? [opt.xAxis] : [];
  const cats = xas[0] && xas[0].type === "category" && Array.isArray(xas[0].data) ? xas[0].data : null;
  const hasBarLine = (opt.series || []).some((s) => s && (s.type === "bar" || s.type === "line"));
  if (cats && cats.length >= 12 && hasBarLine && !opt.dataZoom) {
    opt.dataZoom = [
      { type: "slider", height: 16, bottom: 2, borderColor: "#1f2e4a", backgroundColor: "rgba(15,26,46,0.5)", fillerColor: "rgba(59,130,246,0.25)", handleStyle: { color: "#3b82f6", borderColor: "#3b82f6" }, moveHandleStyle: { color: "#3b82f6" }, textStyle: { color: "#8fa3c0", fontSize: 10 }, dataBackground: { lineStyle: { color: "#2b3c5e" }, areaStyle: { color: "rgba(43,60,94,0.3)" } } },
      { type: "inside", zoomOnMouseWheel: true, moveOnMouseMove: true },
    ];
    if (opt.grid && opt.grid.bottom <= 34) opt.grid = { ...opt.grid, bottom: 42 };
  }
  return opt;
}

/* ---------------- chart registry ---------------- */
const SECTIONS = [];

/* charts flagged ESSENTIAL_CHARTS render in "Compact" density — the short list
   someone would actually read first. Keep it honest and short; "Standard" and
   "Everything" always show every curated chart regardless. */
const ESSENTIAL_CHARTS = new Set([
  "g1", "dg1",                        // glance: status split + gauges
  "rt1", "nr1", "nr2", "fe3",        // returns: ROI, XIRR by tenure, ladder, fee waterfall
  "r5", "n1",                        // risk: NPA by tenure, tenure × score heatmap
  "xa01",                            // atlas: net XIRR incl. defaults (whole book)
  "ny1", "vc1",                      // by-year NPA, vintage curves
  "hp1",                             // verdict: picks panel
]);

function addChart(sectionName, sectionSub, id, title, sub, h, builder) {
  let sec = SECTIONS.find((s) => s.name === sectionName);
  if (!sec) { sec = { name: sectionName, sub: sectionSub, charts: [] }; SECTIONS.push(sec); }
  sec.charts.push({ id, title, sub, h, builder, essential: ESSENTIAL_CHARTS.has(id) });
}

