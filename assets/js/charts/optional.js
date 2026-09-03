/* ============================================================
 * charts/optional.js — x1..x5 correlations (not rendered; kept for power users)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

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
