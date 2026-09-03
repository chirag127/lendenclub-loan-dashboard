/* ============================================================
 * charts/tenure-score-risk.js — n1..n12 (rendered: n1..n8,n10,n11)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

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

