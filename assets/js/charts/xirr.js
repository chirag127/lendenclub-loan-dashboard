/* ============================================================
 * charts/xirr.js — rt1..rt6 (all rendered)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ============ H. Cashflow timing & true returns ============ */
addChart("Cashflow timing & true returns", "EMIs arrive monthly, not at tenure end — time-weighted (XIRR) returns computed by the pipeline on your actual repayment schedules", "rt1", "True annualized return (XIRR) by tenure — net of fees", "Green = successful closed loans only. Red = the same loans PLUS every NPA default (incl. zero-recovery) — the honest default-inclusive return", 320, (L) => {
  const x = window.INSIGHTS_DATA && window.INSIGHTS_DATA.xirr_returns;
  const rows = TENURES.filter((t) => x && x.net_by_tenure[t] != null);
  const allOf = (k) => rows.map((t) => (x && x[k] && x[k][t] != null ? x[k][t] : null));
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Successful closed", "Incl. all defaults"] },
    tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + p.value.toFixed(1) + "%/yr</b>").join("<br/>") },
    xAxis: CAT_AXIS(rows.map((t) => t + " mo")), yAxis: VAL_AXIS(false),
    series: [
      { name: "Successful closed", type: "bar", barWidth: "32%", data: rows.map((t) => x.net_by_tenure[t]), itemStyle: { color: GREEN, borderRadius: [6, 6, 0, 0] }, label: { show: true, position: "top", color: "#4ade80", fontSize: 10, formatter: (p) => p.value.toFixed(1) + "%" }, markLine: { symbol: "none", lineStyle: { color: "#f59e0b", type: "dashed" }, data: [{ yAxis: x.portfolio_net, label: { color: "#fbbf24", fontSize: 10, formatter: "success " + x.portfolio_net.toFixed(1) + "%/yr" } }, { yAxis: x.portfolio_net_all != null ? x.portfolio_net_all : 0, lineStyle: { color: "#f87171" }, label: { color: "#f87171", fontSize: 10, formatter: "with defaults " + (x.portfolio_net_all != null ? x.portfolio_net_all.toFixed(1) : "—") + "%/yr" } }] } },
      { name: "Incl. all defaults", type: "bar", barWidth: "32%", data: allOf("net_all_by_tenure"), itemStyle: { color: "#f87171", borderRadius: [6, 6, 0, 0] }, label: { show: true, position: "top", color: "#f87171", fontSize: 10, formatter: (p) => (p.value == null ? "" : p.value.toFixed(1) + "%") } },
    ],
  };
});

addChart("Cashflow timing & true returns", "Not everything at tenure end — the remaining ₹ arrives month by month", "rt2", "Expected future EMI receipts by month", "Contractual remaining EMIs from the " + (window.INSIGHTS_DATA && window.INSIGHTS_DATA.expected_emi_timeline ? window.INSIGHTS_DATA.expected_emi_timeline.months.length : "") + " active-book months", 320, (L) => {
  const tl = window.INSIGHTS_DATA && window.INSIGHTS_DATA.expected_emi_timeline;
  const cats = (tl && tl.months || []).map((m) => (MONTH_LABEL[m] || m).replace("20", "'"));
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/><b>${inr(p[0].value)}</b> expected in EMIs` },
    xAxis: CAT_AXIS(cats), yAxis: VAL_AXIS(true),
    series: [{ type: "bar", barWidth: "52%", data: tl && tl.receipts || [], itemStyle: { color: CYAN, borderRadius: [5, 5, 0, 0] }, label: { show: true, position: "top", color: "#8fa3c0", fontSize: 9, formatter: (p) => (p.value ? inrCompact(p.value) : "") } }],
  };
});

addChart("Cashflow timing & true returns", "Why monthly EMIs change the answer", "rt3", "Simple annualized vs true (XIRR) net return by tenure", "Grey = projected simple annualized. Green = XIRR on successful closed loans. Red = XIRR with every NPA default included — the honest range", 320, (L) => {
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L), cr = collRateByTenure(L);
  const x = window.INSIGHTS_DATA && window.INSIGHTS_DATA.xirr_returns;
  const rows = TENURES.map((t) => {
    const p = projectedNet(L.filter((l) => l.tenure === t), fr, mr, cr);
    return { t, simple: +(p.projectedROI * 12 / t).toFixed(1), xirr: x && x.net_by_tenure[t], xirrAll: x && x.net_all_by_tenure && x.net_all_by_tenure[t] };
  }).filter((r) => r.xirr != null);
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Projected net (simple annualized)", "Net XIRR (successful closed)", "Net XIRR (incl. all defaults)"] },
    tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + p.value.toFixed(1) + "%/yr</b>").join("<br/>") },
    xAxis: CAT_AXIS(rows.map((r) => r.t + " mo")), yAxis: VAL_AXIS(false),
    series: [
      { name: "Projected net (simple annualized)", type: "bar", barWidth: "26%", data: rows.map((r) => r.simple), itemStyle: { color: "#64748b", borderRadius: [5, 5, 0, 0] } },
      { name: "Net XIRR (successful closed)", type: "bar", barWidth: "26%", data: rows.map((r) => r.xirr), itemStyle: { color: GREEN, borderRadius: [5, 5, 0, 0] } },
      { name: "Net XIRR (incl. all defaults)", type: "bar", barWidth: "26%", data: rows.map((r) => r.xirrAll), itemStyle: { color: "#f87171", borderRadius: [5, 5, 0, 0] } },
    ],
  };
});

addChart("Cashflow timing & true returns", "EMIs often don't arrive on schedule — the collection reality of the active book", "rt4", "Active loans: expected vs received to date by tenure", "Contractual EMIs due so far vs what actually arrived, per tenure", 320, (L) => {
  const asOf = (SUMMARY && SUMMARY.summary && SUMMARY.summary.to_date) || "2026-09-02";
  const y0 = +asOf.slice(0, 4), m0 = +asOf.slice(5, 7);
  const rows = TENURES.map((t) => {
    const a = L.filter((l) => l.tenure === t && l.status === "ACTIVE" && l.repayment_start);
    if (!a.length) return null;
    let exp = 0, got = 0, dpd = 0;
    a.forEach((l) => {
      const emi = (l.total_repayment || 0) / (l.tenure || 1);
      const ys = +l.repayment_start.slice(0, 4), ms = +l.repayment_start.slice(5, 7);
      const due = Math.max(0, Math.min(Math.round(l.tenure || 0), (y0 - ys) * 12 + (m0 - ms) + 1));
      exp += emi * due;
      got += l.total_received || 0;
      if ((l.dpd || 0) > 0) dpd += 1;
    });
    return { t, exp, got, shortfall: exp - got, dpd };
  }).filter(Boolean);
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Expected by now", "Actually received"] },
    tooltip: { ...baseOption().tooltip, formatter: (ps) => {
      const r = rows.find((x) => x.t + " mo" === ps[0].axisValue);
      return ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + inr(p.value) + "</b>").join("<br/>") + (r ? "<br/>Shortfall <b style='color:#f87171'>" + inr(Math.max(0, r.shortfall)) + "</b> · " + r.dpd + " loans overdue" : "");
    } },
    xAxis: CAT_AXIS(rows.map((r) => r.t + " mo")), yAxis: VAL_AXIS(true),
    series: [
      { name: "Expected by now", type: "bar", barWidth: "30%", data: rows.map((r) => +r.exp.toFixed(0)), itemStyle: { color: "#64748b", borderRadius: [5, 5, 0, 0] } },
      { name: "Actually received", type: "bar", barWidth: "30%", data: rows.map((r) => +r.got.toFixed(0)), itemStyle: { color: (p) => (rows[p.dataIndex].shortfall > 0 ? AMBER : GREEN), borderRadius: [5, 5, 0, 0] } },
    ],
  };
});

addChart("Cashflow timing & true returns", "Equal monthly EMIs, interest front-loaded, first EMI 1–2 months after disbursement", "rt5", "How a typical loan amortizes (₹1,000 · 6 months)", "Illustrative internal split consistent with the report's contracted totals", 340, (L) => {
  const P = 1000, n = 6, total = 1238.70;
  const emi = total / n;
  let lo = 0.0001, hi = 0.3;
  for (let k = 0; k < 200; k++) {
    const r = (lo + hi) / 2;
    const e = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    if (e > emi) hi = r; else lo = r;
  }
  const r = (lo + hi) / 2;
  let bal = P, ints = [], prin = [], balLeft = [];
  for (let i = 0; i < n; i++) {
    const ip = bal * r, pp = emi - ip;
    bal -= pp;
    ints.push(+ip.toFixed(2)); prin.push(+pp.toFixed(2)); balLeft.push(+Math.max(0, bal).toFixed(2));
  }
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Principal part", "Interest part", "Balance left"] },
    tooltip: { ...baseOption().tooltip, formatter: (ps) => {
      const i = ps[0].dataIndex;
      return "EMI #" + (i + 1) + " (₹" + emi.toFixed(2) + ")<br/>" + ps.filter((p) => p.seriesType === "bar").map((p) => p.marker + " " + p.seriesName + ": <b>₹" + p.value.toFixed(2) + "</b>").join("<br/>") + "<br/>Balance left: <b>₹" + balLeft[i] + "</b>";
    } },
    xAxis: CAT_AXIS([1, 2, 3, 4, 5, 6].map((i) => "EMI " + i)),
    yAxis: VAL_AXIS(true),
    series: [
      { name: "Principal part", type: "bar", stack: "emi", barWidth: "46%", data: prin, itemStyle: { color: GREEN } },
      { name: "Interest part", type: "bar", stack: "emi", data: ints, itemStyle: { color: AMBER } },
      { name: "Balance left", type: "line", yAxisIndex: 0, data: balLeft, itemStyle: { color: CYAN }, lineStyle: { width: 2.5, type: "dashed" }, symbol: "circle", symbolSize: 6 },
    ],
  };
});

addChart("Cashflow timing & true returns", "Closed loans are history — this is what the money still out there is projected to earn (same monthly-EMI timing, computed by the pipeline on each active loan's remaining schedule)", "rt6", "Active book: projected net XIRR by tenure", "Amber = expected (your own matured default rates + closed-loan interest-collection haircut, fees deducted). Grey = best case if every remaining EMI repays. Closed-loan bars are on rt1 for comparison", 320, () => {
  const ax = window.INSIGHTS_DATA && window.INSIGHTS_DATA.active_xirr;
  const rows = TENURES.filter((t) => ax && ax.by_tenure_expected && ax.by_tenure_expected[t] != null);
  const v = (k) => rows.map((t) => (ax[k] && ax[k][t] != null ? ax[k][t] : null));
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Active — expected (with defaults)", "Active — best case (all repay)"] },
    tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + p.value.toFixed(1) + "%/yr</b>").join("<br/>") },
    xAxis: CAT_AXIS(rows.map((t) => t + " mo")), yAxis: VAL_AXIS(false),
    series: [
      { name: "Active — expected (with defaults)", type: "bar", barWidth: "34%", data: v("by_tenure_expected"), itemStyle: { color: AMBER, borderRadius: [6, 6, 0, 0] }, label: { show: true, position: "top", color: "#fbbf24", fontSize: 10, formatter: (p) => p.value.toFixed(1) + "%" }, markLine: { symbol: "none", lineStyle: { color: "#f59e0b", type: "dashed" }, data: [{ yAxis: ax.portfolio_expected, label: { color: "#fbbf24", fontSize: 10, formatter: "expected " + ax.portfolio_expected.toFixed(1) + "%/yr" } }] } },
      { name: "Active — best case (all repay)", type: "bar", barWidth: "34%", data: v("by_tenure_no_default"), itemStyle: { color: "#64748b", opacity: 0.75, borderRadius: [6, 6, 0, 0] }, markLine: { symbol: "none", lineStyle: { color: "#94a3b8", type: "dotted" }, data: [{ yAxis: ax.portfolio_no_default, label: { color: "#94a3b8", fontSize: 10, formatter: "no-default " + ax.portfolio_no_default.toFixed(1) + "%/yr" } }] } },
    ],
  };
});

