/* ============================================================
 * charts/picks.js — hp1,hp2 (rendered: both)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ============ Highest-XIRR loan picks (computed by the pipeline) ============ */
addChart("Highest-XIRR loan picks", "Which tenure × score cells your completed loans say earn the most per year — net XIRR with every default included — and how to split next month's lending", "hp1", "Recommended split of your next ₹1,000", "Core picks weighted 2×, support 1× in the pipeline allocation — money-losing cells get ₹0", 320, () => {
  const p = window.INSIGHTS_DATA && window.INSIGHTS_DATA.xirr_picks;
  const cells = (p && p.cells || []).filter((c) => c.rec_pct > 0 && c.xirr_all != null);
  const colors = { core: GREEN, support: BLUE, gate: AMBER, avoid: RED };
  return {
    ...baseOption(),
    tooltip: { ...baseOption().tooltip, trigger: "item", formatter: (pp) => `${pp.name}<br/><b>₹${(pp.value * 10).toFixed(0)}</b> of every ₹1,000 lent (${pp.percent}%)<br/><small>${(p.rule || "").split(";")[0]}</small>` },
    legend: { ...baseOption().legend, bottom: 0, top: "auto" },
    series: [{
      type: "pie", radius: ["40%", "70%"], center: ["50%", "42%"],
      label: { color: "#e6edf7", fontSize: 10.5, formatter: "{b}\n{d}%" },
      labelLine: { length: 8, length2: 6 },
      itemStyle: { borderColor: "#0b1220", borderWidth: 2 },
      data: cells.map((c) => ({ name: c.key.replace("·", " · "), value: +c.rec_pct.toFixed(1), itemStyle: { color: colors[c.tier] } })),
    }],
  };
});

addChart("Highest-XIRR loan picks", "Every pick loses something to defaults — the gap between the two bars is the cost of that cell's NPAs", "hp2", "Net XIRR: successful loans vs including all defaults", "Top-8 cells by default-inclusive return. 6/12-mo and low-score 6-mo cells are excluded because they lose money once defaults are counted", 320, () => {
  const p = window.INSIGHTS_DATA && window.INSIGHTS_DATA.xirr_picks;
  const rows = (p && p.cells || []).filter((c) => c.xirr_all != null).slice(0, 8);
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Successful loans only", "Incl. all defaults"] },
    tooltip: { ...baseOption().tooltip, formatter: (ps) => ps[0].axisValue + "<br/>" + ps.map((pp) => pp.marker + " " + pp.seriesName + ": <b>" + pp.value.toFixed(1) + "%/yr</b>").join("<br/>") },
    xAxis: CAT_AXIS(rows.map((c) => c.key.replace("·", " · "))),
    yAxis: VAL_AXIS(false),
    series: [
      { name: "Successful loans only", type: "bar", barWidth: "30%", data: rows.map((c) => c.xirr), itemStyle: { color: "#64748b", borderRadius: [5, 5, 0, 0] } },
      { name: "Incl. all defaults", type: "bar", barWidth: "30%", data: rows.map((c) => c.xirr_all), itemStyle: { color: (pp) => (pp.value >= 40 ? GREEN : pp.value >= 15 ? BLUE : pp.value > 0 ? AMBER : RED), borderRadius: [5, 5, 0, 0] }, label: { show: true, position: "top", color: "#8fa3c0", fontSize: 9.5, formatter: (pp) => pp.value.toFixed(0) + "%" } },
    ],
  };
});

