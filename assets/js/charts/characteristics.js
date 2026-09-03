/* ============================================================
 * charts/characteristics.js — c1..c12 (rendered: c2,c4,c5,c6,c7,c9)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

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

