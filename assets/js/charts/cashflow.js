/* ============================================================
 * charts/cashflow.js — i1..i8 (rendered: i1,i3,i5,i6,i7)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

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

