/* ============================================================
 * charts/portfolio.js — g1..g4 (rendered: g1,g2,g3)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ============ A. Portfolio overview ============ */
addChart("Portfolio overview", "Headline numbers from the manual lending report (Dec 2025 – Sep 2026)", "g1", "Loan status split", () => `Share of the ${fmt.format(LOANS.length)} loans by current status`, 300, (L) => {
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

