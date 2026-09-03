/* LenDenClub Loan Analytics Dashboard — 52 charts, Apache ECharts */
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
function projectedNet(rows, feeRate, matRate, defRateOverride) {
  /* Realized + expected full-cycle net for a set of loans: interest − fees − NPA,
     plus future interest on ACTIVE loans, less future fees and expected future
     NPA losses at the (matured-only) historical default rate. */
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
  const expLoss = out * defRate / 100;
  const projected = realized + futInt * (1 - defRate / 100) - futFee - expLoss;
  return {
    t: t0, count: rows.length, disb, realized, futInt, futFee, out, defRate, expLoss, projected,
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
const MLABELS = MONTHS.map((m) => MONTH_LABEL[m] || m);
const tooltipMoney = (prefix) => ({ valueFormatter: (v) => (prefix || "") + inr(v) });

/* ---------------- chart registry ---------------- */
const SECTIONS = [];

function addChart(sectionName, sectionSub, id, title, sub, h, builder) {
  let sec = SECTIONS.find((s) => s.name === sectionName);
  if (!sec) { sec = { name: sectionName, sub: sectionSub, charts: [] }; SECTIONS.push(sec); }
  sec.charts.push({ id, title, sub, h, builder });
}

/* ============ A. Portfolio overview ============ */
addChart("Portfolio overview", "Headline numbers from the manual lending report (Dec 2025 – Sep 2026)", "g1", "Loan status split", "Share of the 2,993 loans by current status", 300, (L) => {
  const counts = {};
  L.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });
  const names = Object.keys(counts).sort();
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, trigger: "item", formatter: (p) => `${p.name}<br/><b>${fmt.format(p.value)}</b> loans (${p.percent}%)` },
    legend: { ...baseOption().legend, bottom: 0, top: "auto" },
    series: [{
      type: "pie", radius: ["45%", "72%"], center: ["50%", "46%"],
      label: { color: "#e6edf7", formatter: "{b}\n{d}%" },
      itemStyle: { borderColor: "#0b1220", borderWidth: 2 },
      data: names.map((n) => ({ name: n, value: counts[n], itemStyle: { color: STATUS_COLORS[n] } })),
    }],
  };
});

addChart("Portfolio overview", "Total disbursed vs received vs still outstanding vs NPA exposure", "g2", "Money in the portfolio", "Headline amounts from the report summary (₹)", 300, (L, S) => {
  const s = S.summary;
  const items = [
    { name: "Disbursed", value: s.disbursed_amount, c: BLUE },
    { name: "Received", value: s.total_amount_received, c: GREEN },
    { name: "Principal outstanding", value: s.principal_outstanding, c: AMBER },
    { name: "NPA amount", value: s.npa_amount, c: RED },
    { name: "Platform fees", value: s.platform_fee, c: PURPLE },
  ];
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, trigger: "item", formatter: (p) => `${p.name}<br/><b>${inr(p.value)}</b>` },
    xAxis: { type: "category", data: items.map((i) => i.name), axisLabel: { color: "#8fa3c0" }, axisLine: AXIS.axisLine },
    yAxis: VAL_AXIS(true),
    series: [{ type: "bar", barWidth: 44, data: items.map((i) => ({ value: i.value, itemStyle: { color: i.c, borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: "top", color: "#e6edf7", formatter: (p) => inrCompact(p.value) } }],
  };
});

addChart("Portfolio overview", "2,969 monthly-repayment vs 24 daily-repayment loans", "g3", "Repayment type split", "How loans are set to repay", 300, (L) => {
  const counts = {};
  L.forEach((l) => { counts[l.repayment_type] = (counts[l.repayment_type] || 0) + 1; });
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, trigger: "item", formatter: (p) => `${p.name}<br/><b>${fmt.format(p.value)}</b> loans (${p.percent}%)` },
    series: [{
      type: "pie", radius: "68%", center: ["50%", "50%"],
      label: { color: "#e6edf7", formatter: "{b}\n{d}%" },
      data: Object.entries(counts).map(([name, value]) => ({ name, value, itemStyle: { color: name === "Monthly" ? GREEN : CYAN } })),
    }],
  };
});

addChart("Portfolio overview", "Rate range seen across all loans (18.0% – 58.2%)", "g4", "Interest rate histogram", "How many loans carry each rate band", 300, (L) => {
  const h = histOf(L, "interest_rate", RATE_BUCKETS);
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(h.map((b) => b.label)),
    yAxis: VAL_AXIS(false),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p.name}<br/><b>${fmt.format(p.value)}</b> loans<br/>avg rate ${p.data.avg.toFixed(2)}%` },
    series: [{ type: "bar", barWidth: "58%", data: h.map((b) => ({ value: b.count, avg: b.count ? b.sum / b.count : 0, itemStyle: { color: GREEN, borderRadius: [6, 6, 0, 0] } })) }],
  };
});

/* ============ B. Disbursement activity ============ */
addChart("Disbursement activity", "₹26.28L lent across 10 months", "d1", "Monthly disbursed amount", "New lending per month (₹)", 300, (L) => ({
  ...baseOption(),
  xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(true),
  tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/><b>${inr(p[0].value)}</b> disbursed` },
  series: [{
    type: "line", smooth: true, symbol: "circle", symbolSize: 7,
    data: sumByMonth(L, "amount"),
    lineStyle: { color: GREEN, width: 3 }, itemStyle: { color: GREEN },
    areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(34,197,94,0.35)" }, { offset: 1, color: "rgba(34,197,94,0.02)" }] } },
  }],
}));

addChart("Disbursement activity", "Loan origination volume by month", "d2", "Loans disbursed per month", "Count of loans originated each month", 300, (L) => ({
  ...baseOption(),
  xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(false),
  tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/><b>${fmt.format(p[0].value)}</b> loans` },
  series: [{ type: "bar", barWidth: "55%", data: countByMonth(L), itemStyle: { color: BLUE, borderRadius: [6, 6, 0, 0] }, label: { show: true, position: "top", color: "#8fa3c0", fontSize: 10 } }],
}));

addChart("Disbursement activity", "Running total of capital lent", "d3", "Cumulative amount disbursed", "₹ lent since Dec 2025, accumulating", 300, (L) => ({
  ...baseOption(),
  xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(true),
  tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Cumulative <b>${inr(p[0].value)}</b>` },
  series: [{ type: "line", smooth: true, data: cum(sumByMonth(L, "amount")), lineStyle: { color: CYAN, width: 3 }, itemStyle: { color: CYAN }, areaStyle: { color: "rgba(6,182,212,0.12)" } }],
}));

addChart("Disbursement activity", "Average ticket size per month (disbursed ÷ loans)", "d4", "Average loan amount by month", "Ticket-size trend over time", 300, (L) => ({
  ...baseOption(),
  xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(true),
  tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Avg <b>${inr(p[0].value)}</b>` },
  series: [{ type: "line", smooth: true, data: avgByMonth(L, "amount"), lineStyle: { color: PURPLE, width: 3 }, itemStyle: { color: PURPLE }, areaStyle: { color: "rgba(168,85,247,0.12)" } }],
}));

addChart("Disbursement activity", "Which weekday you lend on most", "d5", "Disbursements by day of week", "Total ₹ disbursed per weekday", 300, (L) => {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const sums = names.map(() => 0);
  L.forEach((l) => {
    const d = new Date(l.disbursement_date + "T00:00:00");
    if (!isNaN(d)) sums[d.getDay()] += l.amount || 0;
  });
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(names), yAxis: VAL_AXIS(true),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/><b>${inr(p[0].value)}</b> disbursed` },
    series: [{ type: "bar", barWidth: "52%", data: sums.map((v) => ({ value: v, itemStyle: { color: GREEN, borderRadius: [6, 6, 0, 0] } })) }],
  };
});

addChart("Disbursement activity", "Seasonality within the month", "d6", "Disbursements by day of month", "Total ₹ disbursed on the 1st…31st", 300, (L) => {
  const sums = Array(31).fill(0);
  L.forEach((l) => { const d = new Date(l.disbursement_date + "T00:00:00"); if (!isNaN(d)) sums[d.getDate() - 1] += l.amount || 0; });
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(Array.from({ length: 31 }, (_, i) => i + 1)), yAxis: VAL_AXIS(true),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `Day ${p[0].axisValue}<br/><b>${inr(p[0].value)}</b> disbursed` },
    series: [{ type: "line", smooth: true, symbol: "none", data: sums, lineStyle: { color: AMBER, width: 2 }, areaStyle: { color: "rgba(245,158,11,0.10)" } }],
  };
});

addChart("Disbursement activity", "Stacked by tenure in months", "d7", "Monthly disbursed by tenure", "Which tenures drive each month's lending", 340, (L) => {
  const ser = TENURES.map((t) => ({
    name: t + " mo", type: "bar", stack: "t", barWidth: "62%",
    data: MONTHS.map((m) => L.filter((l) => (l.disbursement_date || "").slice(0, 7) === m && l.tenure === t).reduce((a, l) => a + (l.amount || 0), 0)),
  }));
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + inr(p.value) + "</b>").join("<br/>") },
    xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(true),
    series: ser.map((s, i) => ({ ...s, itemStyle: { color: ["#22c55e", "#3b82f6", "#06b6d4", "#a855f7", "#f59e0b", "#ef4444"][i] } })),
  };
});

addChart("Disbursement activity", "Ranking of origination months by ₹ lent", "d8", "Top months by disbursement", "Highest-volume months", 300, (L) => {
  const vals = sumByMonth(L, "amount").map((v, i) => ({ name: MLABELS[i], value: v }));
  vals.sort((a, b) => a.value - b.value);
  return {
    ...baseOption(),
    grid: { left: 70, right: 20, top: 10, bottom: 26 },
    tooltip: { ...baseOption().tooltip, trigger: "item", formatter: (p) => `${p.name}<br/><b>${inr(p.value)}</b>` },
    xAxis: VAL_AXIS(true), yAxis: { type: "category", data: vals.map((v) => v.name), axisLine: AXIS.axisLine, axisLabel: { color: "#8fa3c0" } },
    series: [{ type: "bar", data: vals.map((v) => ({ value: v.value, itemStyle: { color: GREEN, borderRadius: [0, 6, 6, 0] } })) }],
  };
});

/* ============ C. Loan characteristics ============ */
addChart("Loan characteristics", "Ticket sizes seen (0-amount unfunded loans excluded)", "c1", "Loan amount distribution", "Number of loans in each amount band", 300, (L) => {
  const h = histOf(L.filter((l) => (l.amount || 0) > 0), "amount", AMOUNT_BUCKETS);
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(h.map((b) => b.label)), yAxis: VAL_AXIS(false),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p.name}<br/><b>${fmt.format(p.value)}</b> loans<br/>total ${inr(p.data.sum)}` },
    series: [{ type: "bar", barWidth: "58%", data: h.map((b) => ({ value: b.count, sum: b.sum, itemStyle: { color: GREEN, borderRadius: [6, 6, 0, 0] } })) }],
  };
});

addChart("Loan characteristics", "Average ticket size per tenure", "c2", "Average loan amount by tenure", "₹ lent per loan vs tenure", 300, (L) => {
  const data = TENURES.map((t) => { const xs = L.filter((l) => l.tenure === t && (l.amount || 0) > 0); return { name: t + " mo", avg: xs.length ? avg(xs.map((l) => l.amount)) : null, count: xs.length }; });
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(data.map((d) => d.name)), yAxis: VAL_AXIS(true),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Avg <b>${inr(p[0].value)}</b> (${fmt.format(p[0].data.count)} loans)` },
    series: [{ type: "bar", barWidth: "52%", data: data.map((d) => ({ value: d.avg, count: d.count, itemStyle: { color: BLUE, borderRadius: [6, 6, 0, 0] } })) }],
  };
});

addChart("Loan characteristics", "Rates charged rise sharply with tenure", "c3", "Average interest rate by tenure", "Cost of money vs repayment period", 300, (L) => {
  const data = TENURES.map((t) => { const xs = L.filter((l) => l.tenure === t && l.interest_rate != null); return { name: t + " mo", avg: xs.length ? avg(xs.map((l) => l.interest_rate)) : null }; });
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(data.map((d) => d.name)), yAxis: VAL_AXIS(false),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Avg rate <b>${p[0].value}%</b>` },
    series: [{ type: "line", smooth: true, symbol: "circle", symbolSize: 9, data: data.map((d) => d.avg), lineStyle: { color: RED, width: 3 }, itemStyle: { color: RED } }],
  };
});

addChart("Loan characteristics", "2/3/4/5/6/12-month tenures on offer", "c4", "Tenure distribution", "How many loans at each tenure", 300, (L) => {
  const counts = TENURES.map((t) => L.filter((l) => l.tenure === t).length);
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(TENURES.map((t) => t + " mo")), yAxis: VAL_AXIS(false),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/><b>${fmt.format(p[0].value)}</b> loans` },
    series: [{ type: "bar", barWidth: "55%", data: counts.map((v, i) => ({ value: v, itemStyle: { color: ["#22c55e", "#3b82f6", "#06b6d4", "#a855f7", "#f59e0b", "#ef4444"][i], borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: "top", color: "#8fa3c0", fontSize: 10 } }],
  };
});

addChart("Loan characteristics", "Where your ₹26.28L went by tenure", "c5", "Disbursed amount by tenure", "₹ lent per tenure bucket", 300, (L) => {
  const sums = TENURES.map((t) => L.filter((l) => l.tenure === t).reduce((a, l) => a + (l.amount || 0), 0));
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(TENURES.map((t) => t + " mo")), yAxis: VAL_AXIS(true),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/><b>${inr(p[0].value)}</b>` },
    series: [{ type: "bar", barWidth: "55%", data: sums.map((v, i) => ({ value: v, itemStyle: { color: ["#22c55e", "#3b82f6", "#06b6d4", "#a855f7", "#f59e0b", "#ef4444"][i], borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: "top", color: "#8fa3c0", fontSize: 10, formatter: (p) => inrCompact(p.value) } }],
  };
});

addChart("Loan characteristics", "LenDenClub scores run 700–878 (avg 732)", "c6", "LenDenClub score histogram", "Underwriting score distribution", 300, (L) => {
  const h = histOf(L, "score", SCORE_BANDS);
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(h.map((b) => b.label)), yAxis: VAL_AXIS(false),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `Score ${p.name}<br/><b>${fmt.format(p.value)}</b> loans` },
    series: [{ type: "bar", barWidth: "58%", data: h.map((b) => ({ value: b.count, itemStyle: { color: CYAN, borderRadius: [6, 6, 0, 0] } })) }],
  };
});

addChart("Loan characteristics", "Borrower quality trend over time", "c7", "Average score by month", "Avg LenDenClub score of loans originated", 300, (L) => ({
  ...baseOption(),
  xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(false),
  tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Avg score <b>${p[0].value}</b>` },
  series: [{ type: "line", smooth: true, data: avgByMonth(L, "score"), lineStyle: { color: BLUE, width: 3 }, itemStyle: { color: BLUE }, areaStyle: { color: "rgba(59,130,246,0.12)" } }],
}));

addChart("Loan characteristics", "Score vs repayment duration", "c8", "Average score by tenure", "Borrower quality across tenures", 300, (L) => {
  const data = TENURES.map((t) => { const xs = L.filter((l) => l.tenure === t && l.score != null); return { name: t + " mo", avg: xs.length ? avg(xs.map((l) => l.score)) : null }; });
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(data.map((d) => d.name)), yAxis: VAL_AXIS(false),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Avg score <b>${p[0].value}</b>` },
    series: [{ type: "bar", barWidth: "52%", data: data.map((d) => d.avg), itemStyle: { color: PURPLE, borderRadius: [6, 6, 0, 0] } }],
  };
});

addChart("Loan characteristics", "Higher scores get bigger tickets", "c9", "Average loan amount by score band", "Ticket size vs credit score", 300, (L) => {
  const data = SCORE_BANDS.map((b) => { const xs = L.filter((l) => l.score >= b.min && l.score < b.max && (l.amount || 0) > 0); return { name: b.label, avg: xs.length ? avg(xs.map((l) => l.amount)) : null, count: xs.length }; });
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(data.map((d) => d.name)), yAxis: VAL_AXIS(true),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `Score ${p[0].axisValue}<br/>Avg <b>${inr(p[0].value)}</b> (${fmt.format(p[0].data.count)} loans)` },
    series: [{ type: "bar", barWidth: "52%", data: data.map((d) => ({ value: d.avg, count: d.count, itemStyle: { color: GREEN, borderRadius: [6, 6, 0, 0] } })) }],
  };
});

addChart("Loan characteristics", "Rates by borrower score bucket", "c10", "Average interest rate by score band", "Do better scores get cheaper money?", 300, (L) => {
  const data = SCORE_BANDS.map((b) => { const xs = L.filter((l) => l.score >= b.min && l.score < b.max && l.interest_rate != null); return { name: b.label, avg: xs.length ? avg(xs.map((l) => l.interest_rate)) : null }; });
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(data.map((d) => d.name)), yAxis: VAL_AXIS(false),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `Score ${p[0].axisValue}<br/>Avg rate <b>${p[0].value}%</b>` },
    series: [{ type: "line", smooth: true, symbol: "circle", symbolSize: 9, data: data.map((d) => d.avg), lineStyle: { color: AMBER, width: 3 }, itemStyle: { color: AMBER } }],
  };
});

addChart("Loan characteristics", "Origination volume by score bucket", "c11", "Loan count by score band", "How many loans per score band", 300, (L) => {
  const h = histOf(L, "score", SCORE_BANDS);
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(h.map((b) => b.label)), yAxis: VAL_AXIS(false),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `Score ${p.name}<br/><b>${fmt.format(p.value)}</b> loans` },
    series: [{ type: "bar", barWidth: "52%", data: h.map((b) => ({ value: b.count, itemStyle: { color: CYAN, borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: "top", color: "#8fa3c0", fontSize: 10 } }],
  };
});

addChart("Loan characteristics", "Yields trend month to month", "c12", "Average interest rate by month", "Avg contracted rate of monthly originations", 300, (L) => ({
  ...baseOption(),
  xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(false),
  tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Avg rate <b>${p[0].value}%</b>` },
  series: [{ type: "line", smooth: true, data: avgByMonth(L, "interest_rate"), lineStyle: { color: RED, width: 3 }, itemStyle: { color: RED }, areaStyle: { color: "rgba(239,68,68,0.10)" } }],
}));

/* ============ D. Portfolio & status health ============ */
addChart("Portfolio & status health", "Composition of the book over time", "s1", "Loan status counts by month", "Number of loans per status, originated each month", 320, (L) => {
  const statuses = ["CLOSED", "ACTIVE", "NPA", "PROCESSING", "REJECTED", "CANCELLED"];
  const series = statuses.map((st) => ({
    name: st, type: "bar", stack: "s", barWidth: "62%",
    data: MONTHS.map((m) => L.filter((l) => l.status === st && (l.disbursement_date || "").slice(0, 7) === m).length),
    itemStyle: { color: STATUS_COLORS[st] },
  }));
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + p.value + "</b>").join("<br/>") },
    xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(false),
    series,
  };
});

addChart("Portfolio & status health", "Relative composition — share of each month's book", "s2", "Status share by month", "100% stacked view of originations", 320, (L) => {
  const statuses = ["CLOSED", "ACTIVE", "NPA", "PROCESSING", "REJECTED", "CANCELLED"];
  const series = statuses.map((st) => ({
    name: st, type: "bar", stack: "s", barWidth: "62%",
    data: MONTHS.map((m) => { const t = L.filter((l) => (l.disbursement_date || "").slice(0, 7) === m).length || 1; return +((L.filter((l) => l.status === st && (l.disbursement_date || "").slice(0, 7) === m).length / t) * 100).toFixed(1); }),
    itemStyle: { color: STATUS_COLORS[st] },
  }));
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, valueFormatter: (v) => v + "%", formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + p.value + "%</b>").join("<br/>") },
    xAxis: CAT_AXIS(MLABELS), yAxis: { ...VAL_AXIS(false), max: 100, axisLabel: { color: "#8fa3c0", formatter: "{value}%" } },
    series,
  };
});

addChart("Portfolio & status health", "Average ticket by outcome bucket", "s3", "Average loan amount by status", "Avg ₹ per loan in each status", 300, (L) => {
  const statuses = ["CLOSED", "ACTIVE", "NPA", "PROCESSING", "REJECTED", "CANCELLED"];
  const data = statuses.map((st) => { const xs = L.filter((l) => l.status === st && (l.amount || 0) > 0); return { name: st, avg: xs.length ? avg(xs.map((l) => l.amount)) : 0 }; });
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(data.map((d) => d.name)), yAxis: VAL_AXIS(true),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Avg <b>${inr(p[0].value)}</b>` },
    series: [{ type: "bar", barWidth: "52%", data: data.map((d) => ({ value: d.avg, itemStyle: { color: STATUS_COLORS[d.name], borderRadius: [6, 6, 0, 0] } })) }],
  };
});

addChart("Portfolio & status health", "Rates by outcome — NPAs carry the highest rates", "s4", "Average interest rate by status", "Avg contracted rate per status", 300, (L) => {
  const statuses = ["CLOSED", "ACTIVE", "NPA", "PROCESSING", "REJECTED", "CANCELLED"];
  const data = statuses.map((st) => { const xs = L.filter((l) => l.status === st && l.interest_rate != null); return { name: st, avg: xs.length ? avg(xs.map((l) => l.interest_rate)) : 0 }; });
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(data.map((d) => d.name)), yAxis: VAL_AXIS(false),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Avg rate <b>${p[0].value}%</b>` },
    series: [{ type: "bar", barWidth: "52%", data: data.map((d) => ({ value: d.avg, itemStyle: { color: STATUS_COLORS[d.name], borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: "top", color: "#8fa3c0", fontSize: 10, formatter: (p) => p.value.toFixed(1) + "%" } }],
  };
});

addChart("Portfolio & status health", "Borrower quality vs outcome", "s5", "Average score by status", "Avg LenDenClub score per status", 300, (L) => {
  const statuses = ["CLOSED", "ACTIVE", "NPA", "PROCESSING", "REJECTED", "CANCELLED"];
  const data = statuses.map((st) => { const xs = L.filter((l) => l.status === st && l.score != null); return { name: st, avg: xs.length ? avg(xs.map((l) => l.score)) : 0 }; });
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(data.map((d) => d.name)), yAxis: VAL_AXIS(false),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Avg score <b>${p[0].value}</b>` },
    series: [{ type: "bar", barWidth: "52%", data: data.map((d) => ({ value: d.avg, itemStyle: { color: STATUS_COLORS[d.name], borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: "top", color: "#8fa3c0", fontSize: 10 } }],
  };
});

addChart("Portfolio & status health", "How long each bucket runs", "s6", "Average tenure by status", "Avg months per status", 300, (L) => {
  const statuses = ["CLOSED", "ACTIVE", "NPA", "PROCESSING", "REJECTED", "CANCELLED"];
  const data = statuses.map((st) => { const xs = L.filter((l) => l.status === st && l.tenure != null); return { name: st, avg: xs.length ? avg(xs.map((l) => l.tenure)) : 0 }; });
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(data.map((d) => d.name)), yAxis: VAL_AXIS(false),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Avg <b>${p[0].value}</b> months` },
    series: [{ type: "bar", barWidth: "52%", data: data.map((d) => ({ value: d.avg, itemStyle: { color: STATUS_COLORS[d.name], borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: "top", color: "#8fa3c0", fontSize: 10, formatter: (p) => p.value.toFixed(1) + " mo" } }],
  };
});

addChart("Portfolio & status health", "Area of each rectangle = ₹ disbursed", "s7", "Status treemap by disbursed amount", "Portfolio value by status", 320, (L) => {
  const m = {};
  L.forEach((l) => { m[l.status] = (m[l.status] || 0) + (l.amount || 0); });
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, trigger: "item", formatter: (p) => `${p.name}<br/><b>${inr(p.value)}</b>` },
    series: [{
      type: "treemap", roam: false, nodeClick: false,
      breadcrumb: { show: false },
      label: { color: "#fff", fontSize: 13, formatter: (p) => p.name + "\n" + inrCompact(p.value) },
      data: Object.entries(m).map(([name, value]) => ({ name, value, itemStyle: { color: STATUS_COLORS[name] } })),
    }],
  };
});

/* ============ E. Risk — NPA & DPD ============ */
const isNPA = (l) => l.status === "NPA";
addChart("Risk — NPA & DPD", "148 loans have gone bad", "r1", "NPA loans by month", "NPA loans originated per month", 300, (L) => {
  const n = MONTHS.map(() => 0);
  L.forEach((l) => { const i = monthIndex((l.disbursement_date || "").slice(0, 7)); if (i >= 0 && isNPA(l)) n[i] += 1; });
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(false),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/><b>${fmt.format(p[0].value)}</b> NPA loans` },
    series: [{ type: "bar", barWidth: "55%", data: n, itemStyle: { color: RED, borderRadius: [6, 6, 0, 0] }, label: { show: true, position: "top", color: "#f87171", fontSize: 10 } }],
  };
});

addChart("Risk — NPA & DPD", "Principal stuck in non-performing loans", "r2", "NPA amount by month", "₹ of NPA principal per origination month", 300, (L) => {
  const n = MONTHS.map(() => 0);
  L.forEach((l) => { const i = monthIndex((l.disbursement_date || "").slice(0, 7)); if (i >= 0 && isNPA(l)) n[i] += l.npa_amount || 0; });
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(true),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>NPA <b>${inr(p[0].value)}</b>` },
    series: [{ type: "bar", barWidth: "55%", data: n, itemStyle: { color: RED, borderRadius: [6, 6, 0, 0] }, label: { show: true, position: "top", color: "#f87171", fontSize: 9, formatter: (p) => (p.value ? inrCompact(p.value) : "") } }],
  };
});

addChart("Risk — NPA & DPD", "Default rate = NPA loans ÷ loans originated that month", "r3", "NPA rate by month", "% of each month's book that went bad", 300, (L) => ({
  ...baseOption(),
  xAxis: CAT_AXIS(MLABELS), yAxis: { ...VAL_AXIS(false), axisLabel: { color: "#8fa3c0", formatter: "{value}%" } },
  tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>NPA rate <b>${p[0].value}%</b>` },
  series: [{ type: "line", smooth: true, symbol: "circle", symbolSize: 8, data: rateByMonth(L, isNPA), lineStyle: { color: RED, width: 3 }, itemStyle: { color: RED }, areaStyle: { color: "rgba(239,68,68,0.12)" } }],
}));

addChart("Risk — NPA & DPD", "Which tenures default most often?", "r4", "NPA rate by tenure", "% of loans at each tenure that are NPA", 300, (L) => {
  const data = TENURES.map((t) => { const xs = L.filter((l) => l.tenure === t); return { name: t + " mo", rate: xs.length ? +((xs.filter(isNPA).length / xs.length) * 100).toFixed(2) : null }; });
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(data.map((d) => d.name)), yAxis: { ...VAL_AXIS(false), axisLabel: { color: "#8fa3c0", formatter: "{value}%" } },
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>NPA rate <b>${p[0].value}%</b>` },
    series: [{ type: "bar", barWidth: "52%", data: data.map((d) => ({ value: d.rate, itemStyle: { color: RED, borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: "top", color: "#f87171", fontSize: 10, formatter: (p) => (p.value == null ? "" : p.value + "%") } }],
  };
});

addChart("Risk — NPA & DPD", "Does score predict defaults?", "r5", "NPA rate by score band", "% of loans in each score band that went NPA", 300, (L) => {
  const data = SCORE_BANDS.map((b) => { const xs = L.filter((l) => l.score >= b.min && l.score < b.max); return { name: b.label, rate: xs.length ? +((xs.filter(isNPA).length / xs.length) * 100).toFixed(2) : null }; });
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(data.map((d) => d.name)), yAxis: { ...VAL_AXIS(false), axisLabel: { color: "#8fa3c0", formatter: "{value}%" } },
    tooltip: { ...baseOption().tooltip, formatter: (p) => `Score ${p[0].axisValue}<br/>NPA rate <b>${p[0].value}%</b>` },
    series: [{ type: "line", smooth: true, symbol: "circle", symbolSize: 9, data: data.map((d) => d.rate), lineStyle: { color: AMBER, width: 3 }, itemStyle: { color: AMBER } }],
  };
});

addChart("Risk — NPA & DPD", "How overdue are the stressed loans", "r6", "DPD (days past due) histogram", "Loans grouped by overdue bucket", 300, (L) => {
  const h = histOf(L, "dpd", DPD_BUCKETS);
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(h.map((b) => b.label)), yAxis: VAL_AXIS(false),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `DPD ${p.name}<br/><b>${fmt.format(p.value)}</b> loans` },
    series: [{ type: "bar", barWidth: "58%", data: h.map((b, i) => ({ value: b.count, itemStyle: { color: ["#22c55e", "#3b82f6", "#f59e0b", "#f97316", "#ef4444"][i], borderRadius: [6, 6, 0, 0] } })) }],
  };
});

addChart("Risk — NPA & DPD", "Severity of lateness by origination month", "r7", "Average DPD by month", "Avg days past due of each month's book", 300, (L) => ({
  ...baseOption(),
  xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(false),
  tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Avg DPD <b>${p[0].value}</b> days` },
  series: [{ type: "line", smooth: true, data: avgByMonth(L, "dpd"), lineStyle: { color: RED, width: 3 }, itemStyle: { color: RED }, areaStyle: { color: "rgba(239,68,68,0.10)" } }],
}));

addChart("Risk — NPA & DPD", "Borrowers more than 30/60/90 days late", "r8", "Loans beyond 30/60/90 DPD by month", "Delinquency severity over time", 300, (L) => {
  const mk = (n) => MONTHS.map((m) => L.filter((l) => (l.disbursement_date || "").slice(0, 7) === m && (l.dpd || 0) >= n).length);
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(false),
    tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + p.value + "</b>").join("<br/>") },
    series: [
      { name: ">30 days", type: "line", data: mk(30), itemStyle: { color: AMBER }, lineStyle: { width: 2 } },
      { name: ">60 days", type: "line", data: mk(60), itemStyle: { color: "#f97316" }, lineStyle: { width: 2 } },
      { name: ">90 days", type: "line", data: mk(90), itemStyle: { color: RED }, lineStyle: { width: 3 } },
    ],
  };
});

/* ============ F0. Tenure × score risk & guardrails ============ */
addChart("Tenure × score risk & guardrails", "NPA behaviour cross-analysed by tenure and LenDenClub score, with data-driven lending guardrails", "n1", "NPA rate heatmap: tenure × score band", "% of loans in each cell currently NPA (tooltip shows counts and matured-only default rate)", 360, (L) => {
  const cells = TENURES.flatMap((t) => SCORE_BANDS.map((b) => tenureBandStats(L, t, b)));
  const max = Math.max(...cells.map((c) => c.npaRate || 0), 1);
  const at = (x, y) => cells[y * SCORE_BANDS.length + x] || {}; // x = score col, y = tenure row
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, position: "top", formatter: (p) => {
      const ps = tp(p);
      if (!ps.length || !ps[0].value) return "";
      const c = at(ps[0].value[0], ps[0].value[1]);
      return `${c.t} mo · score ${c.band}<br/><b>${c.npa}</b> NPA of <b>${c.count}</b> loans (${c.npaRate}%)<br/>matured-only default: <b>${c.maturedRate}%</b><br/>loss ${inr(c.npaAmt)} of ${inr(c.disb)} disbursed`;
    } },
    grid: { left: 60, right: 16, top: 12, bottom: 60 },
    xAxis: { type: "category", data: SCORE_BANDS.map((b) => b.label), splitArea: { show: true }, axisLabel: { color: "#8fa3c0" }, axisLine: AXIS.axisLine },
    yAxis: { type: "category", data: TENURES.map((t) => t + " mo"), splitArea: { show: true }, axisLabel: { color: "#8fa3c0" }, axisLine: AXIS.axisLine },
    visualMap: { min: 0, max: Math.max(10, max), calculable: false, orient: "horizontal", left: "center", bottom: 0, textStyle: { color: "#8fa3c0", fontSize: 10 }, inRange: { color: ["#052e16", "#16a34a", "#f59e0b", "#ef4444"] } },
    series: [{ type: "heatmap", data: TENURES.flatMap((t, i) => SCORE_BANDS.map((b, j) => [j, i, cells[i * SCORE_BANDS.length + j].npaRate || 0])), label: { show: true, color: "#fff", fontSize: 11, formatter: (p) => { const v = p.value[2]; return v ? v + "%" : ""; } } }],
  };
});

addChart("Tenure × score risk & guardrails", "Denominator context — cells with tiny samples are unreliable", "n2", "Loan count: tenure × score band", "Number of loans behind each NPA-rate cell", 360, (L) => {
  const cells = TENURES.flatMap((t) => SCORE_BANDS.map((b) => tenureBandStats(L, t, b)));
  const max = Math.max(...cells.map((c) => c.count), 1);
  const at = (x, y) => cells[y * SCORE_BANDS.length + x] || {};
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, position: "top", formatter: (p) => {
      const ps = tp(p);
      if (!ps.length || !ps[0].value) return "";
      const c = at(ps[0].value[0], ps[0].value[1]);
      return `${c.t} mo · score ${c.band}<br/><b>${c.count}</b> loans · ${c.npa} NPA`;
    } },
    grid: { left: 60, right: 16, top: 12, bottom: 60 },
    xAxis: { type: "category", data: SCORE_BANDS.map((b) => b.label), splitArea: { show: true }, axisLabel: { color: "#8fa3c0" }, axisLine: AXIS.axisLine },
    yAxis: { type: "category", data: TENURES.map((t) => t + " mo"), splitArea: { show: true }, axisLabel: { color: "#8fa3c0" }, axisLine: AXIS.axisLine },
    visualMap: { min: 0, max, calculable: false, orient: "horizontal", left: "center", bottom: 0, textStyle: { color: "#8fa3c0", fontSize: 10 }, inRange: { color: ["#0b1220", "#1e3a8a", "#3b82f6", "#06b6d4"] } },
    series: [{ type: "heatmap", data: TENURES.flatMap((t, i) => SCORE_BANDS.map((b, j) => [j, i, cells[i * SCORE_BANDS.length + j].count])), label: { show: true, color: "#fff", fontSize: 10, formatter: (p) => { const v = p.value[2]; return v || ""; } } }],
  };
});

addChart("Tenure × score risk & guardrails", "NPA principal ÷ disbursed, per tenure — the real money lost", "n3", "Loss rate by tenure (% of ₹ disbursed)", "Which tenures actually lose money", 300, (L) => {
  const data = TENURES.map((t) => tenureStats(L, t)).filter((s) => s.count > 0);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Loss <b>${p[0].value}%</b> of disbursed<br/>NPA ₹ ${inr(p[0].data.npaAmt)} on ${inr(p[0].data.disb)}` },
    xAxis: CAT_AXIS(data.map((d) => d.t + " mo")), yAxis: { ...VAL_AXIS(false), axisLabel: { color: "#8fa3c0", formatter: "{value}%" } },
    series: [{ type: "bar", barWidth: "52%", data: data.map((d) => ({ value: d.lossRate, npaAmt: d.npaAmt, disb: d.disb, itemStyle: { color: d.lossRate > 4 ? RED : d.lossRate > 2 ? AMBER : GREEN, borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: "top", color: "#8fa3c0", fontSize: 10, formatter: (p) => (p.value == null ? "" : p.value + "%") } }],
  };
});

addChart("Tenure × score risk & guardrails", "6-month loans = 22% of book but 40% of all NPAs", "n4", "Share of loans vs share of NPAs by tenure", "Where defaults concentrate vs volume", 300, (L) => {
  const data = TENURES.map((t) => tenureStats(L, t)).filter((s) => s.count > 0);
  const totN = data.reduce((a, d) => a + d.count, 0);
  const totNpa = data.reduce((a, d) => a + d.npa, 0);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + p.value + "%</b>").join("<br/>") },
    xAxis: CAT_AXIS(data.map((d) => d.t + " mo")), yAxis: { ...VAL_AXIS(false), axisLabel: { color: "#8fa3c0", formatter: "{value}%" } },
    series: [
      { name: "Share of loans", type: "bar", barWidth: 16, data: data.map((d) => +((d.count / totN) * 100).toFixed(1)), itemStyle: { color: BLUE } },
      { name: "Share of NPAs", type: "bar", barWidth: 16, data: data.map((d) => +((d.npa / totNpa) * 100).toFixed(1)), itemStyle: { color: RED } },
    ],
  };
});

addChart("Tenure × score risk & guardrails", "Interest earned vs NPA principal lost — the net economics", "n5", "Interest earned vs NPA loss by tenure", "Income minus loss per tenure (₹)", 320, (L) => {
  const data = TENURES.map((t) => tenureStats(L, t)).filter((s) => s.count > 0);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + inr(p.value) + "</b>").join("<br/>") },
    xAxis: CAT_AXIS(data.map((d) => d.t + " mo")), yAxis: VAL_AXIS(true),
    series: [
      { name: "Interest earned", type: "bar", barWidth: 16, data: data.map((d) => d.intr), itemStyle: { color: GREEN } },
      { name: "NPA principal lost", type: "bar", barWidth: 16, data: data.map((d) => d.npaAmt), itemStyle: { color: RED } },
    ],
  };
});

addChart("Tenure × score risk & guardrails", "NPA loss as a % of that tenure's interest income", "n6", "NPA loss vs interest earned by tenure", "How much of each tenure's interest NPA erodes", 300, (L) => {
  const data = TENURES.map((t) => tenureStats(L, t)).filter((s) => s.count > 0);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Loss is <b>${p[0].value}%</b> of interest earned<br/>interest ${inr(p[0].data.intr)} · NPA ${inr(p[0].data.npaAmt)}` },
    xAxis: CAT_AXIS(data.map((d) => d.t + " mo")), yAxis: { ...VAL_AXIS(false), axisLabel: { color: "#8fa3c0", formatter: "{value}%" } },
    series: [{ type: "bar", barWidth: "52%", data: data.map((d) => ({ value: d.npaShareOfInterest, intr: d.intr, npaAmt: d.npaAmt, itemStyle: { color: d.npaShareOfInterest > 30 ? RED : d.npaShareOfInterest > 15 ? AMBER : GREEN, borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: "top", color: "#8fa3c0", fontSize: 10, formatter: (p) => (p.value == null ? "" : p.value + "%") } }],
  };
});

addChart("Tenure × score risk & guardrails", "Honest comparison: only loans that have already closed or defaulted — excludes still-active loans", "n7", "Default rate on matured loans by tenure", "NPA ÷ (closed + NPA) per tenure", 300, (L) => {
  const data = TENURES.map((t) => tenureStats(L, t)).filter((s) => s.count > 0);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Matured default <b>${p[0].value}%</b><br/>(${p[0].data.npa} NPA of ${p[0].data.matured} matured)` },
    xAxis: CAT_AXIS(data.map((d) => d.t + " mo")), yAxis: { ...VAL_AXIS(false), axisLabel: { color: "#8fa3c0", formatter: "{value}%" } },
    series: [{ type: "bar", barWidth: "52%", data: data.map((d) => ({ value: d.maturedRate, npa: d.npa, matured: d.matured, itemStyle: { color: d.maturedRate > 8 ? RED : d.maturedRate > 4 ? AMBER : GREEN, borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: "top", color: "#8fa3c0", fontSize: 10, formatter: (p) => (p.value == null ? "" : p.value + "%") } }],
  };
});

addChart("Tenure × score risk & guardrails", "Low scores are the common thread in 3–6 month defaults", "n8", "NPA rate by tenure × score tier", "How score cuts defaults within each tenure", 300, (L) => {
  const series = SCORE_TIERS.map((tier) => ({
    name: tier.label, type: "line", smooth: true, symbol: "circle", symbolSize: 7,
    data: TENURES.map((t) => { const xs = L.filter((l) => l.tenure === t && l.score != null && l.score >= tier.min && l.score < tier.max); const m = xs.filter((l) => l.status === "NPA" || l.status === "CLOSED"); const n = xs.filter((l) => l.status === "NPA"); return m.length ? +((n.length / m.length) * 100).toFixed(1) : null; }),
    lineStyle: { color: tier.color, width: 2.5 }, itemStyle: { color: tier.color },
  }));
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " score " + p.seriesName + ": <b>" + (p.value == null ? "–" : p.value + "%") + "</b>").join("<br/>") + "<br/><span style='color:#8fa3c0'>(matured loans only)</span>" },
    xAxis: CAT_AXIS(TENURES.map((t) => t + " mo")), yAxis: { ...VAL_AXIS(false), axisLabel: { color: "#8fa3c0", formatter: "{value}%" } },
    series,
  };
});

addChart("Tenure × score risk & guardrails", "Each bubble = one tenure × score cell (≥15 loans) — top-left is ideal", "n9", "Risk vs return: loss rate vs contracted rate", "Bubble size = ₹ disbursed in that cell", 340, (L) => {
  const pts = TENURES.flatMap((t) => SCORE_BANDS.map((b) => tenureBandStats(L, t, b))).filter((c) => c.count >= 15);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, trigger: "item", formatter: (p) => `${p.data.t} mo · score ${p.data.band}<br/><b>${p.data.count}</b> loans · ${inr(p.data.disb)}<br/>loss ${p.data.lossRate}% · rate ${p.data.avgRate}%` },
    xAxis: { type: "value", name: "NPA loss % of disbursed", nameTextStyle: { color: "#8fa3c0" }, axisLabel: { color: "#8fa3c0", formatter: "{value}%" }, splitLine: { lineStyle: { color: "rgba(31,46,74,0.5)" } } },
    yAxis: { type: "value", name: "Avg interest rate %", nameTextStyle: { color: "#8fa3c0" }, axisLabel: { color: "#8fa3c0", formatter: "{value}%" }, splitLine: { lineStyle: { color: "rgba(31,46,74,0.5)" } } },
    series: [{
      type: "scatter", data: pts.map((c) => ({
        value: [c.lossRate, c.avgRate, c.disb], t: c.t, band: c.band, count: c.count, lossRate: c.lossRate, avgRate: c.avgRate,
      })),
      symbolSize: (v) => Math.max(8, Math.min(46, Math.sqrt(v[2]) / 18)),
      itemStyle: { color: "rgba(34,197,94,0.65)" },
    }],
  };
});

addChart("Tenure × score risk & guardrails", "₹ lent that is still active/processing — where future NPA can still appear", "n10", "Active-book exposure by tenure", "Money still at risk per tenure (₹)", 300, (L) => {
  const data = TENURES.map((t) => tenureStats(L, t)).filter((s) => s.count > 0);
  const activeAmt = (t) => L.filter((l) => l.tenure === t && (l.status === "ACTIVE" || l.status === "PROCESSING")).reduce((a, l) => a + (l.amount || 0), 0);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/><b>${inr(p[0].value)}</b> still active/processing<br/>${fmt.format(p[0].data.active)} loans` },
    xAxis: CAT_AXIS(data.map((d) => d.t + " mo")), yAxis: VAL_AXIS(true),
    series: [{ type: "bar", barWidth: "52%", data: data.map((d) => ({ value: activeAmt(d.t), active: d.active, itemStyle: { color: d.t >= 6 ? AMBER : CYAN, borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: "top", color: "#8fa3c0", fontSize: 10, formatter: (p) => (p.value ? inrCompact(p.value) : "") } }],
  };
});

addChart("Tenure × score risk & guardrails", "Lateness behaviour per tenure", "n11", "Loans overdue (DPD > 0) by tenure", "% of each tenure's loans currently past due", 300, (L) => {
  const data = TENURES.map((t) => tenureStats(L, t)).filter((s) => s.count > 0);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/><b>${p[0].value}%</b> of loans overdue<br/>(${fmt.format(p[0].data.dpdCount)} loans)` },
    xAxis: CAT_AXIS(data.map((d) => d.t + " mo")), yAxis: { ...VAL_AXIS(false), axisLabel: { color: "#8fa3c0", formatter: "{value}%" } },
    series: [{ type: "bar", barWidth: "52%", data: data.map((d) => ({ value: +((d.dpdCount / d.count) * 100).toFixed(1), dpdCount: d.dpdCount, itemStyle: { color: d.dpdCount / d.count > 0.12 ? RED : AMBER, borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: "top", color: "#8fa3c0", fontSize: 10, formatter: (p) => p.value + "%" } }],
  };
});

addChart("Tenure × score risk & guardrails", "How late each tenure runs on average", "n12", "Average DPD by tenure", "Avg days past due per tenure", 300, (L) => {
  const data = TENURES.map((t) => tenureStats(L, t)).filter((s) => s.count > 0);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Avg DPD <b>${p[0].value}</b> days` },
    xAxis: CAT_AXIS(data.map((d) => d.t + " mo")), yAxis: VAL_AXIS(false),
    series: [{ type: "bar", barWidth: "52%", data: data.map((d) => d.avgDpd), itemStyle: { color: PURPLE, borderRadius: [6, 6, 0, 0] } }],
  };
});

/* ============ F. Returns & cashflow ============ */
addChart("Returns & cashflow", "What came back, month by month", "i1", "Total amount received by month", "₹ received per month (principal + interest)", 300, (L) => ({
  ...baseOption(),
  xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(true),
  tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/><b>${inr(p[0].value)}</b> received` },
  series: [{ type: "bar", barWidth: "55%", data: sumByMonth(L, "total_received"), itemStyle: { color: GREEN, borderRadius: [6, 6, 0, 0] }, label: { show: true, position: "top", color: "#4ade80", fontSize: 9, formatter: (p) => (p.value ? inrCompact(p.value) : "") } }],
}));

addChart("Returns & cashflow", "Capital returned vs interest earned", "i2", "Principal received by month", "₹ of principal repaid each month", 300, (L) => ({
  ...baseOption(),
  xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(true),
  tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/><b>${inr(p[0].value)}</b> principal` },
  series: [{ type: "bar", barWidth: "55%", data: sumByMonth(L, "principal_received"), itemStyle: { color: BLUE, borderRadius: [6, 6, 0, 0] } }],
}));

addChart("Returns & cashflow", "₹2.53L of interest earned to date", "i3", "Interest received by month", "₹ of interest collected per month", 300, (L) => ({
  ...baseOption(),
  xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(true),
  tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/><b>${inr(p[0].value)}</b> interest` },
  series: [{ type: "bar", barWidth: "55%", data: sumByMonth(L, "interest_received"), itemStyle: { color: GREEN, borderRadius: [6, 6, 0, 0] }, label: { show: true, position: "top", color: "#4ade80", fontSize: 9, formatter: (p) => (p.value ? inrCompact(p.value) : "") } }],
}));

addChart("Returns & cashflow", "Lending-club fees deducted", "i4", "Platform fee by month", "₹ of platform/facilitation fees per month", 300, (L) => ({
  ...baseOption(),
  xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(true),
  tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/><b>${inr(p[0].value)}</b> fees` },
  series: [{ type: "bar", barWidth: "55%", data: sumByMonth(L, "platform_fee"), itemStyle: { color: PURPLE, borderRadius: [6, 6, 0, 0] } }],
}));

addChart("Returns & cashflow", "Interest + fee income minus NPA write-offs", "i5", "Profit & loss by month", "P&L attributed per origination month", 300, (L) => {
  const data = sumByMonth(L, "pnl");
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(true),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>P&L <b>${inr(p[0].value)}</b>` },
    series: [{ type: "bar", barWidth: "55%", data: data.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? GREEN : RED, borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: "top", color: "#8fa3c0", fontSize: 9, formatter: (p) => (p.value ? inrCompact(p.value) : "") } }],
  };
});

addChart("Returns & cashflow", "Capital out vs capital back", "i6", "Cumulative received vs disbursed", "Running totals of lending vs repayments", 300, (L) => ({
  ...baseOption(),
  xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(true),
  tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + inr(p.value) + "</b>").join("<br/>") },
  series: [
    { name: "Disbursed", type: "line", data: cum(sumByMonth(L, "amount")), itemStyle: { color: BLUE }, lineStyle: { width: 3 } },
    { name: "Received", type: "line", data: cum(sumByMonth(L, "total_received")), itemStyle: { color: GREEN }, lineStyle: { width: 3 } },
  ],
}));

addChart("Returns & cashflow", "Principal received ÷ disbursed, cumulative recovery", "i7", "Recovery rate by month", "% of disbursed principal recovered", 300, (L) => {
  const disp = cum(sumByMonth(L, "amount"));
  const recv = cum(sumByMonth(L, "principal_received"));
  const data = disp.map((d, i) => (d ? +((recv[i] / d) * 100).toFixed(1) : null));
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(MLABELS), yAxis: { ...VAL_AXIS(false), axisLabel: { color: "#8fa3c0", formatter: "{value}%" } },
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/>Recovery <b>${p[0].value}%</b>` },
    series: [{ type: "line", smooth: true, symbol: "circle", symbolSize: 8, data, lineStyle: { color: CYAN, width: 3 }, itemStyle: { color: CYAN }, areaStyle: { color: "rgba(6,182,212,0.12)" } }],
  };
});

addChart("Returns & cashflow", "Contractual repayment vs what actually came in", "i8", "Expected vs received by month", "₹ expected (illustrative) vs ₹ received per month", 300, (L) => ({
  ...baseOption(),
  tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + inr(p.value) + "</b>").join("<br/>") },
  xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(true),
  series: [
    { name: "Expected", type: "bar", barWidth: "30%", data: sumByMonth(L, "total_repayment"), itemStyle: { color: "#475569" } },
    { name: "Received", type: "bar", barWidth: "30%", data: sumByMonth(L, "total_received"), itemStyle: { color: GREEN, borderRadius: [6, 6, 0, 0] } },
  ],
}));

/* ============ G. Correlations & advanced ============ */
/* ============ G. Net returns — after everything ============ */
addChart("Net returns — after everything", "Every chart here is net of platform fees AND NPA losses — realized to date and projected full-cycle", "nr1", "Net ROI by tenure: realized vs projected", "(interest − fees − NPA losses) ÷ ₹ disbursed per tenure", 320, (L) => {
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L);
  const rows = TENURES.map((t) => projectedNet(L.filter((l) => l.tenure === t), fr, mr)).filter((p) => p.count > 0);
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Realized to date", "Projected full-cycle"] },
    tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + p.value.toFixed(1) + "%</b>").join("<br/>") },
    xAxis: CAT_AXIS(rows.map((r) => r.t + " mo")), yAxis: VAL_AXIS(false),
    series: [
      { name: "Realized to date", type: "bar", barWidth: "32%", data: rows.map((r) => +r.realizedROI.toFixed(1)), itemStyle: { color: "#64748b", borderRadius: [5, 5, 0, 0] } },
      { name: "Projected full-cycle", type: "bar", barWidth: "32%", data: rows.map((r) => +r.projectedROI.toFixed(1)), itemStyle: { color: GREEN, borderRadius: [5, 5, 0, 0] } },
    ],
  };
});

addChart("Net returns — after everything", "The drag between gross interest and what you keep", "nr2", "Rate ladder: gross interest → net (whole book)", "Every ₹100 lent: interest earned, minus fees, minus NPA, equals net", 320, (L) => {
  const d = L.reduce((a, l) => a + (l.amount || 0), 0) || 1;
  const i = L.reduce((a, l) => a + (l.interest_received || 0), 0);
  const f = L.reduce((a, l) => a + (l.platform_fee || 0), 0);
  const n = L.filter((l) => l.status === "NPA").reduce((a, l) => a + (l.npa_amount || 0), 0);
  const steps = [
    { name: "Gross interest", v: +(100 * i / d).toFixed(2), c: GREEN },
    { name: "Platform fees", v: -+(100 * f / d).toFixed(2), c: RED },
    { name: "NPA losses", v: -+(100 * n / d).toFixed(2), c: RED },
    { name: "Net after everything", v: +((100 * (i - f - n)) / d).toFixed(2), c: CYAN },
  ];
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (p) => p[0].axisValue + "<br/><b>" + (p[0].value >= 0 ? "+" : "−") + Math.abs(p[0].value).toFixed(2) + "%</b> of ₹ disbursed" },
    xAxis: CAT_AXIS(steps.map((s) => s.name)), yAxis: VAL_AXIS(false),
    series: [{ type: "bar", barWidth: "46%", data: steps.map((s) => ({ value: s.v, itemStyle: { color: s.c, borderRadius: [5, 5, 0, 0] } })), label: { show: true, position: "top", color: "#8fa3c0", fontSize: 10, formatter: (p) => (p.value >= 0 ? "+" : "−") + Math.abs(p.value).toFixed(2) + "%" } }],
  };
});

addChart("Net returns — after everything", "Every rupee you actually keep, month by month", "nr3", "Cumulative net earnings (interest − fees − NPA)", "Running total of realized net P&L over time", 320, (L) => {
  const netM = MONTHS.map((m, i) => sumByMonth(L, "interest_received")[i] - sumByMonth(L, "platform_fee")[i] - sumByMonth(L, "npa_amount")[i]);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (p) => p[0].axisValue + "<br/>Cumulative net <b>" + inr(p[0].value) + "</b>" },
    xAxis: CAT_AXIS(MLABELS), yAxis: VAL_AXIS(true),
    series: [{ type: "line", data: cum(netM), itemStyle: { color: GREEN }, lineStyle: { width: 3 }, areaStyle: { color: "rgba(34,197,94,0.12)" }, symbol: "circle", symbolSize: 5 }],
  };
});

addChart("Net returns — after everything", "Which borrower-quality bands actually keep the money", "nr4", "Net ROI by LenDenClub score band", "Realized and projected net (after fees + NPA) per score band", 320, (L) => {
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L);
  const rows = SCORE_BANDS.map((b) => projectedNet(L.filter((l) => l.score != null && l.score >= b.min && l.score < b.max), fr, mr)).filter((p) => p.count > 0);
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Realized to date", "Projected full-cycle"] },
    tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + p.value.toFixed(1) + "%</b>").join("<br/>") },
    xAxis: CAT_AXIS(SCORE_BANDS.map((b, i) => (rows[i] ? b.label : null)).filter(Boolean)),
    yAxis: VAL_AXIS(false),
    series: [
      { name: "Realized to date", type: "bar", barWidth: "32%", data: rows.map((r) => +r.realizedROI.toFixed(1)), itemStyle: { color: "#64748b", borderRadius: [5, 5, 0, 0] } },
      { name: "Projected full-cycle", type: "bar", barWidth: "32%", data: rows.map((r) => +r.projectedROI.toFixed(1)), itemStyle: { color: GREEN, borderRadius: [5, 5, 0, 0] } },
    ],
  };
});

addChart("Net returns — after everything", "The two leaks: fees and defaults", "nr5", "Fee drag vs NPA drag by tenure", "% of each tenure's interest income eaten by fees vs NPA losses", 320, (L) => {
  const rows = TENURES.map((t) => {
    const s = tenureStats(L, t);
    if (!s.count || !s.intr) return null;
    const fee = L.filter((l) => l.tenure === t).reduce((a, l) => a + (l.platform_fee || 0), 0);
    return { t, feePct: (100 * fee) / s.intr, npaPct: s.npaShareOfInterest || 0 };
  }).filter(Boolean);
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Fee drag", "NPA drag"] },
    tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + p.value.toFixed(1) + "%</b> of interest").join("<br/>") },
    xAxis: CAT_AXIS(rows.map((s) => s.t + " mo")), yAxis: VAL_AXIS(false),
    series: [
      { name: "Fee drag", type: "bar", barWidth: "32%", stack: "drag", data: rows.map((s) => +s.feePct.toFixed(1)), itemStyle: { color: PURPLE, borderRadius: [5, 5, 0, 0] } },
      { name: "NPA drag", type: "bar", barWidth: "32%", stack: "drag", data: rows.map((s) => +s.npaPct.toFixed(1)), itemStyle: { color: RED, borderRadius: [5, 5, 0, 0] } },
    ],
  };
});

addChart("Net returns — after everything", "The same ₹100 lent, scored twice — this time net of everything", "nr6", "Projected net ROI heatmap: tenure × score band", "Expected full-cycle net ROI % per cell (interest − fees − expected NPA) — cells with <10 loans blank", 360, (L) => {
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L);
  const grid = [];
  const xs = SCORE_BANDS.map((b) => b.label), ys = TENURES.map((t) => t + " mo");
  let max = 0;
  SCORE_BANDS.forEach((b, j) => TENURES.forEach((t) => {
    const rows = L.filter((l) => l.tenure === t && l.score != null && l.score >= b.min && l.score < b.max);
    if (rows.length < 10) { grid.push([j, ys.indexOf(t + " mo"), null]); return; }
    const matured = rows.filter((l) => l.status === "CLOSED" || l.status === "NPA");
    const cellRate = matured.length >= 5 ? (100 * matured.filter((l) => l.status === "NPA").length) / matured.length : mr[t];
    const p = projectedNet(rows, fr, mr, cellRate);
    max = Math.max(max, p.projectedROI);
    grid.push([j, ys.indexOf(t + " mo"), +p.projectedROI.toFixed(1)]);
  }));
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, trigger: "item", formatter: (p) => `${xs[p.value[0]]} · ${ys[p.value[1]]}<br/>Projected net ROI <b>${p.value[2] == null ? "—" : p.value[2] + "%"}</b>` },
    xAxis: { type: "category", data: xs, splitArea: { show: true }, axisLabel: { color: "#8fa3c0" }, axisLine: AXIS.axisLine },
    yAxis: { type: "category", data: ys, splitArea: { show: true }, axisLabel: { color: "#8fa3c0" }, axisLine: AXIS.axisLine },
    visualMap: { min: 0, max: Math.max(10, Math.ceil(max)), calculable: false, orient: "horizontal", left: "center", bottom: 0, textStyle: { color: "#8fa3c0", fontSize: 10 }, inRange: { color: ["#7f1d1d", "#0b1220", "#166534", "#22c55e"] } },
    series: [{ type: "heatmap", data: grid }],
  };
});

addChart("Net returns — after everything", "What your ₹1.81L expected net looks like if defaults run hotter or colder", "nr7", "Net ROI vs default rate (sensitivity)", "Whole-book expected net ROI as % of active book that defaults", 320, (L) => {
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L);
  const all = projectedNet(L, fr, mr);
  const hist = all.out ? all.expLoss / all.out : 0;
  const pts = [0, 5, 10, 15, 20, 25, 30, 35, 40].map((dr) => {
    const loss = all.out * dr / 100;
    const net = all.realized + all.futInt * (1 - dr / 100) - all.futFee - loss;
    return [+dr, +(100 * net / all.disb).toFixed(2)];
  });
  const histX = Math.max(0, Math.min(40, hist * 100));
  const histY = pts[Math.round(histX / 5)][1];
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, trigger: "item", formatter: (p) => `Default rate <b>${p.value[0]}%</b><br/>Net ROI <b>${p.value[1]}%</b>` },
    xAxis: { type: "value", name: "% of active book defaulting", nameTextStyle: { color: "#8fa3c0" }, axisLabel: { color: "#8fa3c0", formatter: "{value}%" }, splitLine: { lineStyle: { color: "rgba(31,46,74,0.5)" } } },
    yAxis: { type: "value", name: "Net ROI %", nameTextStyle: { color: "#8fa3c0" }, axisLabel: { color: "#8fa3c0", formatter: "{value}%" }, splitLine: { lineStyle: { color: "rgba(31,46,74,0.5)" } } },
    series: [
      { type: "line", data: pts, itemStyle: { color: BLUE }, lineStyle: { width: 3 } },
      { type: "line", data: [[histX, histY]], symbol: "circle", symbolSize: 12, itemStyle: { color: "#f59e0b" }, label: { show: true, position: "right", color: "#fbbf24", fontSize: 10, formatter: "historical " + histX.toFixed(1) + "%" }, markLine: { symbol: "none", label: { show: false }, lineStyle: { color: "#f59e0b", type: "dashed" }, data: [{ xAxis: histX }] } },
    ],
  };
});

addChart("Net returns — after everything", "Net of everything, per loan", "nr8", "Average net ₹ per loan by tenure (projected)", "Expected full-cycle net profit split across each tenure's loans", 320, (L) => {
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L);
  const rows = TENURES.map((t) => projectedNet(L.filter((l) => l.tenure === t), fr, mr)).filter((p) => p.count > 0);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/><b>${inr(p[0].value)}</b> net per loan` },
    xAxis: CAT_AXIS(rows.map((r) => r.t + " mo")), yAxis: VAL_AXIS(true),
    series: [{ type: "bar", barWidth: "50%", data: rows.map((r) => +((r.projected / r.count)).toFixed(2)), itemStyle: { color: (p) => p.value >= 0 ? GREEN : RED, borderRadius: [6, 6, 0, 0] }, label: { show: true, position: "top", color: "#8fa3c0", fontSize: 10, formatter: (p) => inrCompact(p.value) } }],
  };
});

addChart("Net returns — after everything", "Where the remaining ~₹66K of expected net comes from", "nr9", "Future net from the active book by tenure", "Future interest minus future fees minus expected future NPA losses", 340, (L) => {
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L);
  const rows = TENURES.map((t) => projectedNet(L.filter((l) => l.tenure === t), fr, mr)).filter((p) => p.count > 0 && p.out > 0);
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Future interest", "Future fees", "Expected future NPA", "Future net"] },
    tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + inr(p.value) + "</b>").join("<br/>") },
    xAxis: CAT_AXIS(rows.map((r) => r.t + " mo")), yAxis: VAL_AXIS(true),
    series: [
      { name: "Future interest", type: "bar", stack: "f", barWidth: "52%", data: rows.map((r) => +r.futInt.toFixed(0)), itemStyle: { color: GREEN } },
      { name: "Future fees", type: "bar", stack: "f", data: rows.map((r) => -+r.futFee.toFixed(0)), itemStyle: { color: PURPLE } },
      { name: "Expected future NPA", type: "bar", stack: "f", data: rows.map((r) => -+r.expLoss.toFixed(0)), itemStyle: { color: RED } },
      { name: "Future net", type: "bar", stack: "f", data: rows.map((r) => +(r.projected - r.realized).toFixed(0)), itemStyle: { color: CYAN } },
    ],
  };
});

addChart("Net returns — after everything", "Sticker rate vs what the money actually earns", "nr10", "Contracted rate vs projected annualized net by tenure", "The 45.7% headline vs the net-of-everything, turnover-adjusted return", 320, (L) => {
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L);
  const rows = TENURES.map((t) => {
    const p = projectedNet(L.filter((l) => l.tenure === t), fr, mr);
    const r = L.filter((l) => l.tenure === t && l.interest_rate != null);
    return { t, contracted: r.length ? +avg(r.map((l) => l.interest_rate)).toFixed(1) : 0, netAnn: +(p.projectedROI * 12 / t).toFixed(1) };
  }).filter((r) => r.contracted > 0);
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Contracted rate", "Projected net (annualized)"] },
    tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + p.value.toFixed(1) + "%</b>").join("<br/>") },
    xAxis: CAT_AXIS(rows.map((r) => r.t + " mo")), yAxis: VAL_AXIS(false),
    series: [
      { name: "Contracted rate", type: "bar", barWidth: "32%", data: rows.map((r) => r.contracted), itemStyle: { color: "#64748b", borderRadius: [5, 5, 0, 0] } },
      { name: "Projected net (annualized)", type: "bar", barWidth: "32%", data: rows.map((r) => r.netAnn), itemStyle: { color: GREEN, borderRadius: [5, 5, 0, 0] } },
    ],
  };
});

addChart("Net returns — after everything", "Which tenure × score cells actually print money", "nr11", "Money-map: projected net ROI vs ₹ at risk", "Bubble size = ₹ disbursed in the cell — right = better net return", 340, (L) => {
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L);
  const pts = [];
  TENURES.forEach((t) => SCORE_BANDS.forEach((b) => {
    const rows = L.filter((l) => l.tenure === t && l.score != null && l.score >= b.min && l.score < b.max);
    if (rows.length < 10) return;
    const p = projectedNet(rows, fr, mr, mr[t]);
    pts.push({ value: [+p.projectedROI.toFixed(1), p.disb, p.count], t, band: b.label, netRoi: p.projectedROI, defRate: p.defRate });
  }));
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, trigger: "item", formatter: (p) => `${p.data.t} mo · score ${p.data.band}<br/>${fmt.format(p.data.value[2])} loans · ${inr(p.data.value[1])} at risk<br/>projected net ROI <b>${p.data.netRoi.toFixed(1)}%</b> (default ${p.data.defRate.toFixed(1)}%)` },
    xAxis: { type: "value", name: "Projected net ROI %", nameTextStyle: { color: "#8fa3c0" }, axisLabel: { color: "#8fa3c0", formatter: "{value}%" }, splitLine: { lineStyle: { color: "rgba(31,46,74,0.5)" } } },
    yAxis: { type: "value", name: "₹ disbursed in cell", nameTextStyle: { color: "#8fa3c0" }, axisLabel: { color: "#8fa3c0", formatter: (v) => inrCompact(v) }, splitLine: { lineStyle: { color: "rgba(31,46,74,0.5)" } } },
    series: [{ type: "scatter", data: pts, symbolSize: (v) => Math.max(10, Math.min(50, Math.sqrt(v[1]) / 14)), itemStyle: { color: (p) => (p.value[0] >= 5 ? "rgba(34,197,94,0.7)" : p.value[0] >= 0 ? "rgba(245,158,11,0.7)" : "rgba(239,68,68,0.8)") } }],
  };
});

addChart("Correlations & advanced", "One point per loan", "x1", "Loan amount vs interest rate", "Do bigger loans carry better rates?", 320, (L) => {
  const pts = L.filter((l) => (l.amount || 0) > 0 && l.interest_rate != null).map((l) => [l.amount, l.interest_rate]);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, trigger: "item", formatter: (p) => `Amount <b>${inr(p.value[0])}</b><br/>Rate <b>${p.value[1]}%</b>` },
    xAxis: { type: "value", name: "Loan amount (₹)", nameTextStyle: { color: "#8fa3c0" }, axisLabel: { color: "#8fa3c0", formatter: (v) => inrCompact(v) }, splitLine: { lineStyle: { color: "rgba(31,46,74,0.5)" } } },
    yAxis: { type: "value", name: "Interest rate (%)", nameTextStyle: { color: "#8fa3c0" }, axisLabel: { color: "#8fa3c0" }, splitLine: { lineStyle: { color: "rgba(31,46,74,0.5)" } } },
    series: [{ type: "scatter", symbolSize: 5, data: pts, itemStyle: { color: "rgba(34,197,94,0.55)" } }],
  };
});

addChart("Correlations & advanced", "One point per loan", "x2", "LenDenClub score vs interest rate", "Do higher scores get cheaper rates?", 320, (L) => {
  const pts = L.filter((l) => l.score != null && l.interest_rate != null).map((l) => [l.score, l.interest_rate]);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, trigger: "item", formatter: (p) => `Score <b>${p.value[0]}</b><br/>Rate <b>${p.value[1]}%</b>` },
    xAxis: { type: "value", name: "LenDenClub score", nameTextStyle: { color: "#8fa3c0" }, axisLabel: { color: "#8fa3c0" }, splitLine: { lineStyle: { color: "rgba(31,46,74,0.5)" } } },
    yAxis: { type: "value", name: "Interest rate (%)", nameTextStyle: { color: "#8fa3c0" }, axisLabel: { color: "#8fa3c0" }, splitLine: { lineStyle: { color: "rgba(31,46,74,0.5)" } } },
    series: [{ type: "scatter", symbolSize: 5, data: pts, itemStyle: { color: "rgba(59,130,246,0.55)" } }],
  };
});

addChart("Correlations & advanced", "One point per loan", "x3", "Loan amount vs LenDenClub score", "Ticket size vs borrower quality", 320, (L) => {
  const pts = L.filter((l) => (l.amount || 0) > 0 && l.score != null).map((l) => [l.score, l.amount]);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, trigger: "item", formatter: (p) => `Score <b>${p.value[0]}</b><br/>Amount <b>${inr(p.value[1])}</b>` },
    xAxis: { type: "value", name: "LenDenClub score", nameTextStyle: { color: "#8fa3c0" }, axisLabel: { color: "#8fa3c0" }, splitLine: { lineStyle: { color: "rgba(31,46,74,0.5)" } } },
    yAxis: { type: "value", name: "Loan amount (₹)", nameTextStyle: { color: "#8fa3c0" }, axisLabel: { color: "#8fa3c0", formatter: (v) => inrCompact(v) }, splitLine: { lineStyle: { color: "rgba(31,46,74,0.5)" } } },
    series: [{ type: "scatter", symbolSize: 5, data: pts, itemStyle: { color: "rgba(168,85,247,0.55)" } }],
  };
});

addChart("Correlations & advanced", "₹ disbursed per month × score band", "x4", "Heatmap: month × score band (₹)", "Where the money went by month and borrower quality", 340, (L) => {
  const grid = SCORE_BANDS.map((b, j) => MONTHS.map((m, i) => [i, j, L.filter((l) => (l.disbursement_date || "").slice(0, 7) === m && l.score >= b.min && l.score < b.max).reduce((a, l) => a + (l.amount || 0), 0)]));
  const max = Math.max(...grid.flat().map((c) => c[2]), 1);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, position: "top", formatter: (p) => `${MONTH_LABEL[MONTHS[p.value[0]]] || p.value[0]} · score ${SCORE_BANDS[p.value[1]].label}<br/><b>${inr(p.value[2])}</b> disbursed` },
    grid: { left: 70, right: 20, top: 16, bottom: 70 },
    xAxis: { type: "category", data: MLABELS, splitArea: { show: true }, axisLabel: { color: "#8fa3c0", rotate: 40 }, axisLine: AXIS.axisLine },
    yAxis: { type: "category", data: SCORE_BANDS.map((b) => b.label), splitArea: { show: true }, axisLabel: { color: "#8fa3c0" }, axisLine: AXIS.axisLine },
    visualMap: { min: 0, max, calculable: false, orient: "horizontal", left: "center", bottom: 0, textStyle: { color: "#8fa3c0", fontSize: 10 }, inRange: { color: ["#0b1220", "#14532d", "#22c55e"] } },
    series: [{ type: "heatmap", data: grid.flat(), label: { show: false }, emphasis: { itemStyle: { shadowBlur: 8 } } }],
  };
});

addChart("Correlations & advanced", "Loan count per month × tenure", "x5", "Heatmap: month × tenure (loan count)", "Origination density by month and tenure", 340, (L) => {
  const grid = TENURES.map((t, j) => MONTHS.map((m, i) => [i, j, L.filter((l) => (l.disbursement_date || "").slice(0, 7) === m && l.tenure === t).length]));
  const max = Math.max(...grid.flat().map((c) => c[2]), 1);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, position: "top", formatter: (p) => `${MONTH_LABEL[MONTHS[p.value[0]]] || p.value[0]} · ${TENURES[p.value[1]]} months<br/><b>${p.value[2]}</b> loans` },
    grid: { left: 70, right: 20, top: 16, bottom: 70 },
    xAxis: { type: "category", data: MLABELS, splitArea: { show: true }, axisLabel: { color: "#8fa3c0", rotate: 40 }, axisLine: AXIS.axisLine },
    yAxis: { type: "category", data: TENURES.map((t) => t + " mo"), splitArea: { show: true }, axisLabel: { color: "#8fa3c0" }, axisLine: AXIS.axisLine },
    visualMap: { min: 0, max, calculable: false, orient: "horizontal", left: "center", bottom: 0, textStyle: { color: "#8fa3c0", fontSize: 10 }, inRange: { color: ["#0b1220", "#1e3a8a", "#3b82f6"] } },
    series: [{ type: "heatmap", data: grid.flat() }],
  };
});

/* mark the tenure × score section to carry the guardrail panel */
const tenureSec = SECTIONS.find((s) => s.name.includes("Tenure × score"));
if (tenureSec) tenureSec.guardrails = true;
/* mark the Returns & cashflow section to carry the P&L returns statement */
const returnsSec = SECTIONS.find((s) => s.name.includes("Returns"));
if (returnsSec) returnsSec.returnsStatement = true;

/* ---------------- renderer ---------------- */
const instances = {};
const cardsEl = document.getElementById("charts");

function buildLayout() {
  cardsEl.innerHTML = "";
  SECTIONS.forEach((sec) => {
    const secEl = document.createElement("section");
    secEl.className = "section-title";
    secEl.innerHTML = `<h2>${sec.name}</h2><p>${sec.sub}</p>`;
    cardsEl.appendChild(secEl);
    if (sec.guardrails) {
      const g = document.createElement("div");
      g.className = "guardrails";
      g.id = "guardrails";
      cardsEl.appendChild(g);
    }
    if (sec.returnsStatement) {
      const rs = document.createElement("div");
      rs.className = "returns-statement";
      rs.id = "returns-statement";
      cardsEl.appendChild(rs);
    }
    const grid = document.createElement("div");
    grid.className = "grid";
    sec.charts.forEach((c) => {
      const card = document.createElement("div");
      card.className = "chart-card";
      card.innerHTML = `<div class="chart-head"><h3>${c.title}</h3><div class="chart-sub">${c.sub}</div></div><div class="chart-body" id="ch-${c.id}"></div>`;
      grid.appendChild(card);
    });
    cardsEl.appendChild(grid);
  });
}

/* ---------------- tenure guardrails (computed, data-driven) ---------------- */
function guardrailCard(tone, title, body, stats) {
  const icons = { good: "✅", warn: "⚠️", bad: "🚫", info: "💡" };
  const statHtml = (stats || []).map((s) => `<span class="rail-stat">${s}</span>`).join("");
  return `<div class="guardrail tone-${tone}"><div class="rail-head">${icons[tone] || ""} ${title}</div><div class="rail-body">${body}</div>${statHtml ? `<div class="rail-stats">${statHtml}</div>` : ""}</div>`;
}
function renderGuardrails() {
  const el = document.getElementById("guardrails");
  if (!el) return;
  const L = filtered();
  const T = TENURES.map((t) => tenureStats(L, t)).filter((s) => s.count > 0);
  const g = (t) => T.find((x) => x.t === t) || {};
  const s2 = g(2), s3 = g(3), s6 = g(6), s12 = g(12);
  const allNpa = L.filter((l) => l.status === "NPA").length;
  const npa6 = s6.npa || 0, npa12 = s12.npa || 0;
  const cards = [];

  if (s2.count) {
    const good = (s2.maturedRate || 99) <= 2.5 && (s2.npa || 99) <= 5;
    cards.push(guardrailCard(good ? "good" : "warn", good ? "2-month: keep scaling — your safest bucket" : "2-month: review your best bucket",
      `Only <b>${s2.npa} of ${fmt.format(s2.count)}</b> two-month loans defaulted (<b>${s2.npaRate}%</b>; <b>${s2.maturedRate}%</b> of matured) and NPA principal was just <b>${inr(s2.npaAmt)}</b> — ${s2.lossRate}% of the ₹ lent. Two-month money turns over fast and almost always comes back, so it deserves a bigger share of your monthly lending.`,
      [`${s2.npaRate}% NPA`, `${s2.lossRate}% loss`, inrCompact(s2.npaAmt) + " lost"]));
  }
  if (s6.count) {
    const bad = (s6.maturedRate || 0) > 8 || npa6 >= 30;
    cards.push(guardrailCard(bad ? "bad" : "warn", bad ? "6-month: highest NPA engine — cut or gate it" : "6-month: watch the NPA rate",
      `<b>${s6.npa} NPAs</b> on ${fmt.format(s6.count)} loans (<b>${s6.npaRate}%</b>; ${s6.maturedRate}% of matured) — ${s6.npaShareOfInterest}% of the interest these loans earned has been wiped by NPA principal. Longer exposure = more time for borrowers to default.`,
      [`${s6.npaRate}% NPA`, `loss = ${s6.npaShareOfInterest}% of interest`, `${fmt.format(npa6)} of ${fmt.format(allNpa)} total NPAs`]));
  }
  if (s12.count) {
    const risky = (s12.maturedRate || 0) >= 8;
    cards.push(guardrailCard(risky ? "bad" : "warn", risky ? "12-month: matured default is severe — pause new 12-month lending" : "12-month: still maturing — losses can still appear",
      `Matured default is <b>${s12.maturedRate}%</b> and only ${s12.closed} of ${fmt.format(s12.count)} loans have closed — <b>${fmt.format(s12.active)} are still active/processing</b>, so today's 5.3% headline will climb. 12-month money is locked up longest for the least certainty.`,
      [`${s12.maturedRate}% matured default`, `${fmt.format(s12.active)} still active`, inrCompact(s12.disb) + " exposure"]));
  }
  // low-score tier across 3-6 month tenures
  {
    const cells = [3, 4, 6].flatMap((t) => SCORE_TIERS.slice(0, 1).map((b) => tenureBandStats(L, t, b))).filter((c) => c.count > 0);
    if (cells.length) {
      const worst = cells.reduce((a, c) => (c.maturedRate || 0) > (a.maturedRate || 0) ? c : a, cells[0]);
      cards.push(guardrailCard(worst.maturedRate >= 6 ? "warn" : "good", "Score gate: 700–724 borrowers default ~5× more in 3–6 month tenures",
        `Borrowers scoring <b>700–724</b> at 3/4/6-month tenures show matured default up to <b>${worst.maturedRate}%</b> (${worst.t}-month, ${worst.count} loans) versus ~1% on 2-month. Setting a minimum LenDenClub score of <b>750 for anything longer than 2 months</b> would remove most of the NPA book without sacrificing volume.`,
      [`up to ${worst.maturedRate}% matured default`, `${worst.count} loans in worst cell`, "gate at ≥750 outside 2-mo"]));
    }
  }
  if (npa6 + npa12 > 0 && allNpa > 0) {
    const share = +(((npa6 + npa12) / allNpa) * 100).toFixed(0);
    if (share >= 40) {
      cards.push(guardrailCard("bad", "Concentration alert: 6- & 12-month loans drive most NPAs",
        `Together, 6- and 12-month tenures hold <b>${share}% of all NPA loans</b>. Reallocating that monthly volume into 2–5 month tickets — same ₹ out, far lower default — is the single highest-impact change available.`,
      [`${share}% of all NPAs`, `${fmt.format(npa6 + npa12)} NPAs`]));
    }
  }
  el.innerHTML = `<div class="rail-note">💡 Guardrails are computed live from the currently filtered data — a rules engine over the tenure × score tables above.</div>` + cards.join("");
}

/* ---------------- data audit strip (from scripts/ldc/audit.py) ---------------- */
function renderAudit() {
  const el = document.getElementById("auditBar");
  const a = window.AUDIT_DATA;
  if (!el) return;
  if (!a || !a.verdict) { el.style.display = "none"; return; }
  const v = a.verdict;
  const cls = v.ok ? "au-ok" : "au-bad";
  const icon = v.ok ? "✅" : "❌";
  const rows = (a.checks || []).map((c) =>
    `<div class="au-row au-${c.status.toLowerCase()}">` +
      `<span class="au-id">${c.id}</span>` +
      `<span class="au-name">${c.name}</span>` +
      `<span class="au-detail">${c.detail}</span>` +
      `<span class="au-status">${c.status}</span>` +
    `</div>`
  ).join("");
  el.innerHTML =
    `<div class="au-bar ${cls}">` +
      `<span class="au-icon">${icon}</span>` +
      `<span class="au-text"><strong>Data integrity verified</strong> — ${v.passed}/${v.total} checks passed against the source report · ${v.info} documented notes · ${v.failed} failed · regenerated by the modular pipeline <code>scripts/build.py</code> → <code>scripts/ldc/*.py</code></span>` +
    `</div>` +
    `<details class="au-details"><summary>View all ${v.total} audit checks</summary><div class="au-list">${rows}</div></details>`;
}

/* ---------------- P&L returns statement (computed) ---------------- */
function renderReturnsStatement() {
  const el = document.getElementById("returns-statement");
  if (!el) return;
  const L = filtered();
  const disb = L.reduce((s, l) => s + (l.amount || 0), 0);
  const recv = L.reduce((s, l) => s + (l.total_received || 0), 0);
  const prin = L.reduce((s, l) => s + (l.principal_received || 0), 0);
  const intr = L.reduce((s, l) => s + (l.interest_received || 0), 0);
  const fee = L.reduce((s, l) => s + (l.platform_fee || 0), 0);
  const npaLoss = L.filter((l) => l.status === "NPA").reduce((s, l) => s + (l.npa_amount || 0), 0);
  const closed = L.filter((l) => l.status === "CLOSED");
  const cIntr = closed.reduce((s, l) => s + (l.interest_received || 0), 0);
  const cFee = closed.reduce((s, l) => s + (l.platform_fee || 0), 0);
  const outstanding = disb - prin - npaLoss;
  const net = intr - fee;
  const netAll = net - npaLoss;
  const pct = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(2) + "%" : "—");
  const row = (k, v, cls) => `<div class="rs-row"><span class="rs-k">${k}</span><span class="rs-v ${cls || ""}">${v}</span></div>`;
  const pnl = `
    <div class="rs-block rs-block-pnl"><h4>Profit &amp; loss statement</h4>
      ${row("Total disbursed (invested)", inr(disb))}
      ${row("Total received", inr(recv))}
      ${row("&nbsp;&nbsp;→ Principal repaid", inr(prin))}
      ${row("&nbsp;&nbsp;→ Interest earned", inr(intr), "rs-good")}
      ${row("Platform / facilitation fees", "− " + inr(fee), "rs-bad")}
      ${row("NPA principal written off", "− " + inr(npaLoss), "rs-bad")}
      ${row("Net earnings (interest − fees)", inr(net), "rs-good")}
      ${row("Net after NPA loss", inr(netAll), netAll >= 0 ? "rs-good" : "rs-bad")}
      ${row("Outstanding principal at risk", inr(outstanding), "rs-warn")}
    </div>`;
  const roi = `
    <div class="rs-block"><h4>Return on invested capital</h4>
      ${row("Gross ROI (interest ÷ disbursed)", pct(intr, disb))}
      ${row("Net ROI (after fees)", pct(net, disb))}
      ${row("Net ROI after NPA loss", pct(netAll, disb))}
      ${row("Realized on closed loans only", pct(cIntr - cFee, closed.reduce((s, l) => s + (l.amount || 0), 0)))}
      ${row("Fees as % of interest earned", pct(fee, intr))}
      ${row("NPA loss as % of disbursed", pct(npaLoss, disb))}
    </div>`;
  const TEN = [2, 3, 4, 5, 6, 12];
  const rows = TEN.map((t) => {
    const r = L.filter((l) => l.tenure === t);
    if (!r.length) return null;
    const d = r.reduce((s, l) => s + (l.amount || 0), 0);
    const i = r.reduce((s, l) => s + (l.interest_received || 0), 0);
    const f = r.reduce((s, l) => s + (l.platform_fee || 0), 0);
    const n = r.filter((l) => l.status === "NPA").reduce((s, l) => s + (l.npa_amount || 0), 0);
    const netR = i - f - n;
    const ann = d > 0 ? ((netR / d) * (12 / t) * 100).toFixed(1) + "%" : "—";
    const w = Math.min(100, Math.max(2, d > 0 ? (netR / d) * (12 / t) * 100 * 3 : 0));
    return `<div class="rs-tenrow"><span class="rs-ten">${t} mo</span><span class="rs-tenbar"><i style="width:${w}%"></i></span><span class="rs-tenv">${ann}</span></div>`;
  }).filter(Boolean).join("");
  const ten = `
    <div class="rs-block"><h4>Annualized net return by tenure — realized to date (fees &amp; NPA deducted)</h4>
      ${rows}
      <div class="rs-note">Realized-only: interest received so far − fees − NPA losses, annualized by turnover. It excludes interest the active book will still earn — see the projected full-cycle panel (right) and the “Net returns — after everything” section for the complete numbers.</div>
    </div>`;

  /* ---- projected full-cycle (everything included) ---- */
  const activeL = L.filter((l) => l.status === "ACTIVE");
  const feeRate = {};
  TENURES.forEach((t) => {
    const c = L.filter((l) => l.status === "CLOSED" && l.tenure === t);
    const d = c.reduce((s, l) => s + (l.amount || 0), 0);
    feeRate[t] = d ? c.reduce((s, l) => s + (l.platform_fee || 0), 0) / d : 0;
  });
  const matRate = {};
  TENURES.forEach((t) => {
    const m = L.filter((l) => l.tenure === t && (l.status === "CLOSED" || l.status === "NPA"));
    matRate[t] = m.length ? (100 * m.filter((l) => l.status === "NPA").length) / m.length : 0;
  });
  let futInt = 0, futFee = 0;
  const outByT = {};
  activeL.forEach((l) => {
    const t = l.tenure;
    futInt += Math.max(0, (l.total_repayment || 0) - (l.amount || 0) - (l.interest_received || 0));
    futFee += Math.max(0, (l.amount || 0) * (feeRate[t] || 0.0172) - (l.platform_fee || 0));
    outByT[t] = (outByT[t] || 0) + (l.amount || 0) - (l.principal_received || 0);
  });
  const outstandingT = Object.keys(outByT).reduce((s, t) => s + outByT[t], 0);
  let expLoss = 0, wLoss = 0;
  Object.keys(outByT).forEach((t) => { expLoss += outByT[t] * (matRate[t] || 0) / 100; wLoss += outByT[t]; });
  const defRate = wLoss ? 100 * expLoss / wLoss : 0;
  const projectedNet = netAll + futInt * (1 - defRate / 100) - futFee - expLoss;
  const projRoi = disb ? (100 * projectedNet / disb) : 0;
  const scen = (dr) => { const l = outstandingT * dr; return netAll + futInt * (1 - dr) - futFee - l; };
  const scenNet = [0, defRate / 100, 0.2, 0.35].map((dr) => scen(dr));
  const scenRoi = scenNet.map((n) => (disb ? (100 * n / disb).toFixed(1) : "—"));
  const proj = `
    <div class="rs-block rs-block-proj"><h4>Projected full-cycle — everything included</h4>
      ${row("Active-book outstanding at risk", inr(outstandingT), "rs-warn")}
      ${row("Future interest still to earn", inr(futInt), "rs-good")}
      ${row("Future platform fees", "− " + inr(futFee), "rs-bad")}
      ${row("Expected future NPA loss (your historical rates " + defRate.toFixed(1) + "%)", "− " + inr(expLoss), "rs-bad")}
      ${row("Expected full-cycle net (realized + projected)", inr(projectedNet), "rs-good")}
      ${row("Expected full-cycle net ROI", pct(projectedNet, disb), "rs-good")}
      <div class="rs-note">Scenarios — net ROI if the ${fmt.format(activeL.length)} active loans default at: 0% <b>${scenRoi[0]}%</b> · historical ${defRate.toFixed(1)}% <b>${scenRoi[1]}%</b> · 20% <b>${scenRoi[2]}%</b> · 35% <b>${scenRoi[3]}%</b>. Projection uses contracted repayments and fee schedules from closed loans; real results depend on future defaults.</div>
    </div>`;
  el.innerHTML = `<div class="rs-grid">${pnl}${roi}${ten}${proj}</div>`;
}

function renderAll() {
  const L = filtered();
  SECTIONS.forEach((sec) => {
    sec.charts.forEach((c) => {
      let inst = instances[c.id];
      if (!inst) {
        inst = echarts.init(document.getElementById("ch-" + c.id), null, { renderer: "canvas" });
        instances[c.id] = inst;
        window.addEventListener("resize", () => inst.resize());
      }
      inst.setOption(safeTooltip(c.builder(L, SUMMARY)), true);
    });
  });
  renderGuardrails();
  renderReturnsStatement();
}

/* make every tooltip formatter immune to axis-vs-item params shape */
function safeTooltip(opt) {
  if (opt && opt.tooltip && typeof opt.tooltip.formatter === "function") {
    const trig = opt.tooltip.trigger || "axis";
    const orig = opt.tooltip.formatter;
    opt.tooltip.formatter = function (p) {
      try {
        if (trig === "axis") {
          const a = Array.isArray(p) ? p : p && p.value != null ? [p] : [];
          return a.length ? orig(a) : "";
        }
        return orig(p);
      } catch (e) {
        return "";
      }
    };
  }
  return opt;
}

/* ---------------- KPI cards ---------------- */
function renderKPIs() {
  const L = filtered();
  const s = SUMMARY.summary;
  const st = SUMMARY.stats;
  const totalAmt = L.reduce((a, l) => a + (l.amount || 0), 0);
  const totalRecv = L.reduce((a, l) => a + (l.total_received || 0), 0);
  const totalInt = L.reduce((a, l) => a + (l.interest_received || 0), 0);
  const totalFee = L.reduce((a, l) => a + (l.platform_fee || 0), 0);
  const totalPnl = L.reduce((a, l) => a + (l.pnl || 0), 0);
  const npaCount = L.filter(isNPA).length;
  const dpdCount = L.filter((l) => (l.dpd || 0) > 0).length;
  const cards = [
    { label: "Total disbursed", value: inrCompact(totalAmt), sub: inr(totalAmt), cls: "blue" },
    { label: "Total received", value: inrCompact(totalRecv), sub: inr(totalRecv), cls: "good" },
    { label: "Interest earned", value: inrCompact(totalInt), sub: inr(totalInt), cls: "good" },
    { label: "Net P&L", value: inrCompact(totalPnl), sub: inr(totalPnl), cls: totalPnl >= 0 ? "good" : "bad" },
    { label: "Platform fees", value: inrCompact(totalFee), sub: inr(totalFee) },
    { label: "NPA amount", value: inrCompact(s.npa_amount), sub: npaCount + " NPA loans", cls: "bad" },
    { label: "Principal outstanding", value: inrCompact(s.principal_outstanding), sub: "still active", cls: "blue" },
    { label: "Avg interest rate", value: avg(L.map((l) => l.interest_rate).filter((x) => x != null)).toFixed(2) + "%", sub: "weighted avg " + weightedRate(L).toFixed(2) + "%", cls: "amber" },
    { label: "Active loans", value: fmt.format(L.filter((l) => l.status === "ACTIVE").length), sub: "repaying now", cls: "blue" },
    { label: "Closed loans", value: fmt.format(L.filter((l) => l.status === "CLOSED").length), sub: "fully repaid", cls: "good" },
    { label: "NPA loans", value: fmt.format(npaCount), sub: pct((npaCount / (L.length || 1)) * 100) + " of book", cls: "bad" },
    { label: "Loans with DPD > 0", value: fmt.format(dpdCount), sub: "days past due", cls: dpdCount ? "bad" : "good" },
  ];
  const el = document.getElementById("kpis");
  el.innerHTML = cards.map((c) => `<div class="kpi ${c.cls || ""}"><div class="kpi-label">${c.label}</div><div class="kpi-value">${c.value}</div><div class="kpi-sub">${c.sub}</div></div>`).join("");
}

function weightedRate(L) {
  let num = 0, den = 0;
  L.forEach((l) => { if ((l.amount || 0) > 0 && l.interest_rate != null) { num += l.amount * l.interest_rate; den += l.amount; } });
  return den ? num / den : 0;
}

/* ---------------- filters ---------------- */
function renderChips() {
  const el = document.getElementById("statusChips");
  const counts = {};
  LOANS.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });
  el.innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([st, cnt]) => `<span class="chip ${state.status.has(st) ? "active" : "off"}" data-status="${st}"><span class="dot" style="background:${STATUS_COLORS[st]}"></span>${st} <span class="cnt">${fmt.format(cnt)}</span></span>`)
    .join("");
  el.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const st = chip.dataset.status;
      if (state.status.has(st)) { if (state.status.size > 1) state.status.delete(st); }
      else state.status.add(st);
      renderChips(); renderAll(); renderKPIs(); renderTable();
    });
  });
}

/* ---------------- table ---------------- */
let tableSort = { key: "disbursement_date", dir: -1 };
const TABLE_COLS = [
  { key: "loan_id", label: "Loan ID" }, { key: "order_id", label: "Order ID" },
  { key: "disbursement_date", label: "Disbursed" }, { key: "amount", label: "Amount", num: true },
  { key: "status", label: "Status" }, { key: "interest_rate", label: "Rate %", num: true },
  { key: "tenure", label: "Tenure", num: true }, { key: "score", label: "Score", num: true },
  { key: "dpd", label: "DPD", num: true }, { key: "total_received", label: "Received", num: true },
  { key: "interest_received", label: "Interest", num: true }, { key: "pnl", label: "P&L", num: true },
];
function renderTable() {
  const L = filtered();
  const q = (document.getElementById("tableSearch").value || "").toLowerCase();
  const rows = L
    .filter((l) => !q || (l.loan_id || "").toLowerCase().includes(q) || (l.order_id || "").toLowerCase().includes(q))
    .sort((a, b) => {
      const va = a[tableSort.key], vb = b[tableSort.key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1; if (vb == null) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * tableSort.dir;
    });
  document.getElementById("tableCount").textContent = fmt.format(rows.length) + " loans";
  const thead = document.querySelector("#loanTable thead");
  thead.innerHTML = "<tr>" + TABLE_COLS.map((c) => `<th data-key="${c.key}" class="${c.num ? "num" : ""}">${c.label}${tableSort.key === c.key ? (tableSort.dir < 0 ? " ↓" : " ↑") : ""}</th>`).join("") + "</tr>";
  thead.querySelectorAll("th").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.key;
    if (tableSort.key === k) tableSort.dir *= -1; else { tableSort.key = k; tableSort.dir = -1; }
    renderTable();
  }));
  const tbody = document.querySelector("#loanTable tbody");
  tbody.innerHTML = rows.slice(0, 2000).map((l) => `
    <tr>
      <td>${l.loan_id || "–"}</td><td>${l.order_id || "–"}</td>
      <td>${l.disbursement_date || "–"}</td><td class="num">${l.amount ? inr(l.amount) : "–"}</td>
      <td><span class="badge ${l.status}">${l.status}</span></td>
      <td class="num">${l.interest_rate != null ? l.interest_rate.toFixed(2) + "%" : "–"}</td>
      <td class="num">${l.tenure != null ? l.tenure + " mo" : "–"}</td>
      <td class="num">${l.score != null ? Math.round(l.score) : "–"}</td>
      <td class="num">${l.dpd ? Math.round(l.dpd) : "–"}</td>
      <td class="num">${l.total_received ? inr(l.total_received) : "–"}</td>
      <td class="num">${l.interest_received ? inr(l.interest_received) : "–"}</td>
      <td class="num">${l.pnl ? inr(l.pnl) : "–"}</td>
    </tr>`).join("") + (rows.length > 2000 ? `<tr><td colspan="12" class="muted">Showing first 2,000 of ${fmt.format(rows.length)} — narrow the search to see more.</td></tr>` : "");
}

/* ---------------- chart library loading (CDN fallback chain) ---------------- */
const ECHARTS_CDNS = [
  "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js",
  "https://unpkg.com/echarts@5.5.1/dist/echarts.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.1/echarts.min.js",
];
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => { s.remove(); reject(new Error("Failed to load " + src)); };
    document.head.appendChild(s);
  });
}
async function ensureECharts() {
  if (window.echarts) return;
  for (const cdn of ECHARTS_CDNS) {
    try { await loadScript(cdn); if (window.echarts) return; } catch (e) { /* try next CDN */ }
  }
  throw new Error("Could not load the chart library from any CDN.");
}

function showError(msg) {
  const box = document.createElement("div");
  box.style.cssText = "max-width:1400px;margin:20px auto;padding:14px 18px;border:1px solid #ef4444;border-radius:10px;background:rgba(239,68,68,0.12);color:#fca5a5;font-size:13px";
  box.textContent = msg;
  document.body.insertBefore(box, document.body.firstChild);
  console.error(msg);
}

/* ---------------- init ---------------- */
async function init() {
  try {
    const [loans, summary] = await Promise.all([
      window.LOAN_DATA ? Promise.resolve(window.LOAN_DATA) : fetch("data/loans.json").then((r) => r.json()),
      window.SUMMARY_DATA ? Promise.resolve(window.SUMMARY_DATA) : fetch("data/summary.json").then((r) => r.json()),
    ]);
    if (!Array.isArray(loans) || !loans.length || !summary || !summary.summary) {
      throw new Error("Loan data failed to load.");
    }
    LOANS = loans;
    SUMMARY = summary;
    MONTHS = [...new Set(loans.map((l) => (l.disbursement_date || "").slice(0, 7)).filter(Boolean))].sort();
    const s = summary.summary;
    document.getElementById("headerMeta").innerHTML =
      `<strong>${summary.lender.name}</strong> · ID ${summary.lender.user_id}<br>${s.from_date} → ${s.to_date} · <strong>${fmt.format(summary.stats.total_loans)}</strong> loans · <strong>${inr(s.disbursed_amount)}</strong> disbursed`;
    buildLayout();
    renderChips();
    renderKPIs();
    renderTable();
    renderGuardrails();
    renderAudit();
    await ensureECharts();
    renderAll();
    console.log("Dashboard ready —", SECTIONS.reduce((a, s) => a + s.charts.length, 0), "charts");
  } catch (err) {
    showError("Something went wrong: " + err.message + " — try reloading the page.");
  }
}

document.getElementById("repayFilter").addEventListener("change", (e) => { state.repay = e.target.value; renderAll(); renderKPIs(); renderTable(); });
document.getElementById("windowFilter").addEventListener("change", (e) => { state.window = e.target.value; renderAll(); renderKPIs(); renderTable(); });
document.getElementById("resetBtn").addEventListener("click", () => {
  state.status = new Set(["CLOSED", "ACTIVE", "NPA", "PROCESSING", "REJECTED", "CANCELLED"]);
  state.repay = "All"; state.window = "All";
  document.getElementById("repayFilter").value = "All";
  document.getElementById("windowFilter").value = "All";
  document.getElementById("tableSearch").value = "";
  renderChips(); renderAll(); renderKPIs(); renderTable();
});
document.getElementById("tableSearch").addEventListener("input", renderTable);

init();