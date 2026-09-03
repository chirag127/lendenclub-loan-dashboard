/* ============================================================
 * charts/risk.js — r1..r8 (rendered: r1,r2,r3,r4,r5,r6,r8)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

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

