/* ============================================================
 * charts/disbursement.js — d1..d8 (rendered: d1,d7)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

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

