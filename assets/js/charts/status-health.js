/* ============================================================
 * charts/status-health.js — s1..s7 (not rendered)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

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

