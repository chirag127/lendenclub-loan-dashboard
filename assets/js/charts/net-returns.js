/* ============================================================
 * charts/net-returns.js — nr1..nr11 (rendered: nr1..nr8,nr10)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ============ G. Net returns — after everything ============ */
addChart("Net returns — after everything", "Every chart here is net of platform fees AND NPA losses — realized to date and projected full-cycle", "nr1", "Net ROI by tenure: realized vs projected", "(interest − fees − NPA losses) ÷ ₹ disbursed per tenure", 320, (L) => {
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L), cr = collRateByTenure(L);
  const rows = TENURES.map((t) => projectedNet(L.filter((l) => l.tenure === t), fr, mr, cr)).filter((p) => p.count > 0);
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
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L), cr = collRateByTenure(L);
  const rows = SCORE_BANDS.map((b) => projectedNet(L.filter((l) => l.score != null && l.score >= b.min && l.score < b.max), fr, mr, cr)).filter((p) => p.count > 0);
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
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L), cr = collRateByTenure(L);
  const grid = [];
  const xs = SCORE_BANDS.map((b) => b.label), ys = TENURES.map((t) => t + " mo");
  let max = 0;
  SCORE_BANDS.forEach((b, j) => TENURES.forEach((t) => {
    const rows = L.filter((l) => l.tenure === t && l.score != null && l.score >= b.min && l.score < b.max);
    if (rows.length < 10) { grid.push([j, ys.indexOf(t + " mo"), null]); return; }
    const matured = rows.filter((l) => l.status === "CLOSED" || l.status === "NPA");
    const cellRate = matured.length >= 5 ? (100 * matured.filter((l) => l.status === "NPA").length) / matured.length : mr[t];
    const p = projectedNet(rows, fr, mr, cr, cellRate);
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
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L), cr = collRateByTenure(L);
  const all = projectedNet(L, fr, mr, cr);
  const hist = all.out ? all.expLoss / all.out : 0;
  const pts = [0, 5, 10, 15, 20, 25, 30, 35, 40].map((dr) => {
    const loss = all.out * dr / 100;
    const net = all.realized + all.futInt * (all.collRate / 100) * (1 - dr / 100) - all.futFee - loss;
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
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L), cr = collRateByTenure(L);
  const rows = TENURES.map((t) => projectedNet(L.filter((l) => l.tenure === t), fr, mr, cr)).filter((p) => p.count > 0);
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${p[0].axisValue}<br/><b>${inr(p[0].value)}</b> net per loan` },
    xAxis: CAT_AXIS(rows.map((r) => r.t + " mo")), yAxis: VAL_AXIS(true),
    series: [{ type: "bar", barWidth: "50%", data: rows.map((r) => +((r.projected / r.count)).toFixed(2)), itemStyle: { color: (p) => p.value >= 0 ? GREEN : RED, borderRadius: [6, 6, 0, 0] }, label: { show: true, position: "top", color: "#8fa3c0", fontSize: 10, formatter: (p) => inrCompact(p.value) } }],
  };
});

addChart("Net returns — after everything", "Where the remaining ~₹66K of expected net comes from", "nr9", "Future net from the active book by tenure", "Future interest minus future fees minus expected future NPA losses", 340, (L) => {
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L), cr = collRateByTenure(L);
  const rows = TENURES.map((t) => projectedNet(L.filter((l) => l.tenure === t), fr, mr, cr)).filter((p) => p.count > 0 && p.out > 0);
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
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L), cr = collRateByTenure(L);
  const rows = TENURES.map((t) => {
    const p = projectedNet(L.filter((l) => l.tenure === t), fr, mr, cr);
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
  const fr = feeRateByTenure(L), mr = maturedRateByTenure(L), cr = collRateByTenure(L);
  const pts = [];
  TENURES.forEach((t) => SCORE_BANDS.forEach((b) => {
    const rows = L.filter((l) => l.tenure === t && l.score != null && l.score >= b.min && l.score < b.max);
    if (rows.length < 10) return;
    const p = projectedNet(rows, fr, mr, cr, mr[t]);
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

