/* ============================================================
 * charts/decision-extra.js — dx1..dx4 + dg1 gauge dials
 * ------------------------------------------------------------
 * Extra decision views that complement the curated set:
 *   dx1  net-XIRR matrix heatmap (tenure × score, all defaults in)
 *   dx2  what actually comes back from NPA loans, by tenure
 *   dx3  contracted vs actually-collected interest, by tenure
 *   dx4  ₹ still outstanding on the active book, by origination month
 *   dg1  three whole-book "where do I stand" gauge dials
 * Whole-book charts deliberately read the global LOANS/INSIGHTS_DATA,
 * not the filtered view, because a lending rule must use all evidence.
 * ============================================================ */

addChart("What loans actually pay — net of fees & defaults", "Every tenure × score cell with ≥10 completed loans — the same numbers as the picks ranking, in matrix form. Whole book.", "dx1", "Net XIRR matrix: tenure × score (incl. every default)", "Negative cells lose money once defaults are counted — red. The green block is where your lending belongs.", 360, () => {
  const p = window.INSIGHTS_DATA && window.INSIGHTS_DATA.xirr_picks;
  const cols = ["700–724", "725–749", "750–774", "775+"];
  const map = {};
  ((p && p.cells) || []).forEach((c) => { map[c.tenure + "|" + c.band] = c; });
  const data = [];
  TENURES.forEach((t, j) => cols.forEach((b, i) => {
    const c = map[t + "|" + b];
    if (c && c.xirr_all != null) data.push([i, j, +c.xirr_all.toFixed(1), c.def_rate, c.matured, c.rec_pct]);
  }));
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, position: "top", formatter: (pp) => {
      const v = pp.value;
      return `${cols[v[0]]} · ${TENURES[v[1]]} mo<br/>Net XIRR <b>${v[2].toFixed(1)}%/yr</b> (incl. all defaults)<br/><small>matured default ${v[3] != null ? v[3].toFixed(1) + "%" : "–"} · ${fmt.format(v[4])} completed loans${v[5] > 0 ? " · ₹" + (v[5] * 10).toFixed(0) + "/₹1k rec" : ""}</small>`;
    } },
    grid: { left: 60, right: 20, top: 16, bottom: 74 },
    xAxis: { type: "category", data: cols, splitArea: { show: true }, axisLabel: { color: "#8fa3c0" }, axisLine: AXIS.axisLine },
    yAxis: { type: "category", data: TENURES.map((t) => t + " mo"), splitArea: { show: true }, axisLabel: { color: "#8fa3c0" }, axisLine: AXIS.axisLine },
    visualMap: {
      type: "piecewise", orient: "horizontal", left: "center", bottom: 0,
      textStyle: { color: "#8fa3c0", fontSize: 10 },
      pieces: [
        { lte: -0.001, color: "#b91c1c", label: "<0% loses money" },
        { gt: -0.001, lte: 15, color: "#b45309", label: "0–15%" },
        { gt: 15, lte: 35, color: "#1d4ed8", label: "15–35%" },
        { gt: 35, color: "#15803d", label: ">35%" },
      ],
    },
    series: [{ type: "heatmap", data, label: { show: true, color: "#0b1220", fontSize: 9.5, fontWeight: 700, formatter: (pp) => pp.value[2].toFixed(0) + "%" } }],
  };
});

addChart("Cashflow & watch-outs", "Whole book: of the ₹ lent into each tenure's NPA loans, how much actually came back before write-off.", "dx2", "What comes back from NPA loans by tenure", "Borrower recovery is part of the return — ~27% of NPA principal has come back overall, and it varies sharply by tenure.", 300, () => {
  const disb = {}, rec = {};
  LOANS.filter((l) => l.status === "NPA").forEach((l) => {
    const t = l.tenure;
    disb[t] = (disb[t] || 0) + (l.amount || 0);
    rec[t] = (rec[t] || 0) + (l.total_received || 0);
  });
  const cats = TENURES.filter((t) => (disb[t] || 0) > 0);
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Lent into NPAs", "Recovered before write-off"] },
    tooltip: { ...baseOption().tooltip, trigger: "axis", formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + inr(p.value) + "</b>").join("<br/>") + (disb[ps[0].axisValue.replace(" mo", "")] ? "<br/>recovery <b>" + pct(100 * rec[ps[0].axisValue.replace(" mo", "")] / disb[ps[0].axisValue.replace(" mo", "")]) + "</b>" : "") },
    xAxis: CAT_AXIS(cats.map((t) => t + " mo")), yAxis: VAL_AXIS(true),
    series: [
      { name: "Lent into NPAs", type: "bar", barWidth: "34%", data: cats.map((t) => ({ value: Math.round(disb[t]), itemStyle: { color: "#991b1b", borderRadius: [5, 5, 0, 0] } })) },
      { name: "Recovered before write-off", type: "bar", barWidth: "34%", data: cats.map((t) => ({ value: Math.round(rec[t] || 0), itemStyle: { color: GREEN, borderRadius: [5, 5, 0, 0] } })), label: { show: true, position: "top", color: "#4ade80", fontSize: 9.5, formatter: (p) => (p.value ? pct(100 * p.value / Math.round(disb[cats[p.dataIndex]])) : "") } },
    ],
  };
});

addChart("What loans actually pay — net of fees & defaults", "Whole book, closed loans only: the interest the borrower contracted vs the interest you actually received (borrowers prepay and get rebates — collection collapses as tenure grows).", "dx3", "Interest: contracted vs actually collected by tenure", "12-month borrowers only ever paid ~25% of the contracted interest — one reason 12-month lending loses money.", 300, () => {
  const IC = (window.INSIGHTS_DATA || {}).interest_collection_rates || {};
  const cats = TENURES.filter((t) => IC[t]);
  const contracted = cats.map((t) => Math.round((IC[t].contracted_interest || 0)));
  const collected = cats.map((t) => Math.round((IC[t].interest_received || 0)));
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Interest contracted", "Interest actually collected"] },
    tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((p) => p.marker + " " + p.seriesName + ": <b>" + inr(p.value) + "</b>").join("<br/>") + "<br/>collection rate <b>" + pct(IC[ps[0].axisValue.replace(" mo", "")].collection_rate) + "</b>" },
    xAxis: CAT_AXIS(cats.map((t) => t + " mo")), yAxis: VAL_AXIS(true),
    series: [
      { name: "Interest contracted", type: "bar", barWidth: "30%", data: contracted.map((v) => ({ value: v, itemStyle: { color: "#475569", borderRadius: [5, 5, 0, 0] } })) },
      { name: "Interest actually collected", type: "bar", barWidth: "30%", data: collected.map((v, i) => ({ value: v, itemStyle: { color: GREEN, borderRadius: [5, 5, 0, 0] } })), label: { show: true, position: "top", color: "#4ade80", fontSize: 9.5, formatter: (p) => pct(100 * p.value / contracted[p.dataIndex]) } },
    ],
  };
});

addChart("Cashflow & watch-outs", "Whole book: ₹ still outstanding on ACTIVE loans by the month they were originated — the vintages that can still go bad.", "dx4", "Active money at risk by origination month", "Older vintages have mostly finished paying their default bill; recent months are still unproven.", 300, () => {
  const m = {};
  LOANS.filter((l) => l.status === "ACTIVE").forEach((l) => {
    const mk = (l.disbursement_date || "").slice(0, 7);
    if (!mk) return;
    m[mk] = (m[mk] || 0) + (l.amount || 0) - (l.principal_received || 0);
  });
  const months = Object.keys(m).sort();
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, formatter: (p) => `${MONTH_LABEL[months[p[0].dataIndex]] || months[p[0].dataIndex]}<br/>Still at risk <b>${inr(p[0].value)}</b>` },
    xAxis: CAT_AXIS(months.map((x) => MONTH_LABEL[x] || x)), yAxis: VAL_AXIS(true),
    series: [{ type: "bar", barWidth: "55%", data: months.map((x) => ({ value: Math.round(m[x]), itemStyle: { color: AMBER, borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: "top", color: "#fbbf24", fontSize: 9.5, formatter: (p) => inrCompact(p.value) } }],
  };
});

/* whole-book dials — one card, three ECharts gauges */
addChart("The book at a glance", "Whole book: three dials that summarise where you stand before you look at any cell.", "dg1", "Where you stand — gauge dials", "Net XIRR incl. all defaults (the return you can spend), overall NPA rate, and how much of defaulted principal recovery brings back.", 250, () => {
  const INS = window.INSIGHTS_DATA || {};
  const X = INS.xirr_returns || {};
  const npa = LOANS.filter((l) => l.status === "NPA").length;
  const all = LOANS.length || 1;
  const npaDisb = LOANS.filter((l) => l.status === "NPA").reduce((a, l) => a + (l.amount || 0), 0);
  const npaRec = LOANS.filter((l) => l.status === "NPA").reduce((a, l) => a + (l.total_received || 0), 0);
  const dials = [
    { name: "Net XIRR incl. defaults", value: +(X.portfolio_net_all || 0).toFixed(1), max: 40, color: GREEN },
    { name: "NPA rate (whole book)", value: +((100 * npa) / all).toFixed(1), max: 15, color: AMBER },
    { name: "Recovery on NPA loans", value: +(npaDisb ? (100 * npaRec) / npaDisb : 0).toFixed(1), max: 60, color: BLUE },
  ];
  const centers = [["16%", "62%"], ["50%", "62%"], ["84%", "62%"]];
  const gauge = (d, i) => ({
    type: "gauge",
    min: 0, max: d.max,
    center: centers[i],
    radius: "78%",
    startAngle: 210, endAngle: -30,
    axisLine: { lineStyle: { width: 12, color: [[1, d.color + "33"]] } },
    progress: { show: true, width: 12, itemStyle: { color: d.color } },
    pointer: { length: "58%", width: 4, itemStyle: { color: d.color } },
    axisTick: { show: false },
    splitLine: { length: 0, show: false },
    axisLabel: { color: "#8fa3c0", fontSize: 8, distance: 12, formatter: (v) => v },
    detail: { valueAnimation: true, color: "#e6edf7", fontSize: 15, fontWeight: 700, formatter: (v) => v.toFixed(1) + "%", offsetCenter: [0, "58%"] },
    title: { offsetCenter: [0, "88%"], color: "#8fa3c0", fontSize: 10.5 },
    data: [{ value: d.value, name: d.name }],
  });
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, trigger: "item" },
    series: dials.map(gauge),
  };
});
