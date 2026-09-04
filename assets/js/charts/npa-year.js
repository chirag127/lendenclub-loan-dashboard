/* ============================================================
 * charts/npa-year.js — ny1..ny4 (rendered: ny1, ny2, ny3, ny4)
 * ------------------------------------------------------------
 * NPA by origination year × tenure, each figure shown two ways:
 *   rate_life  — NPA over the loan's whole term (matured basis)
 *   rate_ann   — annualized per year, rate × 12/tenure (same turnover
 *                convention as the annualized-return charts, so default
 *                cost sits on the same footing as return per tenure).
 * The numbers come straight from the Python pipeline
 * (INSIGHTS_DATA.npa_by_year — scripts/ldc/insights.py), the same rows
 * the audit's Y-checks reconcile, and the ledger table shows.
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

const nyData = () => (window.INSIGHTS_DATA && INSIGHTS_DATA.npa_by_year) || null;

/* tenure rows (r.tenure != null) of one origination year, in tenure order */
function nyTenureRows(year) {
  const ny = nyData();
  if (!ny || !ny.rows) return [];
  const m = {};
  ny.rows.forEach((r) => { if (r.year === year && r.tenure != null) m[r.tenure] = r; });
  return TENURES.filter((t) => m[t]).map((t) => m[t]);
}

/* blended all-tenure rows (r.tenure == null) of the given years */
function nyYearRows(years) {
  const ny = nyData();
  if (!ny || !ny.rows) return [];
  const m = {};
  ny.rows.forEach((r) => { if (r.tenure == null) m[r.year] = r; });
  return years.filter((y) => m[y]).map((y) => ({ y, row: m[y] }));
}

const NY_YEAR_LABEL = (y) => (y === "ALL" ? "All years" : y + " origination");

const npaAxis = () => ({ ...VAL_AXIS(false), axisLabel: { color: "#8fa3c0", formatter: "{value}%" } });

addChart("NPA by year — tenure-level vs annualized", "Matured loans only (closed + NPA); rates over the loan's life vs per year", "ny1", "NPA rate by tenure — over the loan's life vs per year", "Whole book, all origination years: % of matured loans at each tenure that went NPA during the loan (blue) vs the same rate scaled to a full year of lending at that tenure — ×12/tenure, money recycles 2–6× a year (red). The raw rate flatters long tenures and hides how fast short-cycle defaults stack up: 2-month is 1.5% over its life but ≈9%/yr; 6-month is 10.6% over its life and ≈21%/yr.", 300, () => {
  const rows = nyTenureRows("ALL");
  const meta = rows.map((r) => ({ m: r.matured, n: r.npa, d: r.disb, amt: r.npa_amt }));
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(rows.map((r) => r.tenure + " mo")),
    yAxis: npaAxis(),
    tooltip: {
      ...baseOption().tooltip,
      formatter: (ps) => `<b>${ps[0].axisValue}</b> loans — ${fmt.format(meta[ps[0].dataIndex].m)} matured, ${meta[ps[0].dataIndex].n} NPA<br/>` + ps.map((p) => p.marker + p.seriesName + ": <b>" + (p.value == null ? "–" : p.value + "%") + "</b>").join("<br/>"),
    },
    series: [
      { name: "NPA over the loan's life", type: "bar", barWidth: "28%", data: rows.map((r) => r.rate_life), itemStyle: { color: BLUE, borderRadius: [5, 5, 0, 0] } },
      { name: "Annualized NPA per year", type: "bar", barWidth: "28%", data: rows.map((r) => r.rate_ann), itemStyle: { color: RED, borderRadius: [5, 5, 0, 0] } },
    ],
  };
});

addChart("NPA by year — tenure-level vs annualized", "Blended across tenures at each year's average tenure", "ny2", "NPA by origination year — over the loan's life vs per year", "Data window is Dec 2025 – Sep 2026, so the year = the loan's origination year: '2025' is the December-2025 vintage, '2026' is Jan–Sep 2026. Each bar is the whole matured book originated that year (all tenures blended at the pool's average tenure, listed in the tooltip). Defaults per year of lending: 2025 vintage ≈15.8%/yr, 2026 ≈16.8%/yr.", 300, () => {
  const ny = nyData();
  const years = ny ? ny.years : [];
  const rows = nyYearRows([...years, "ALL"]);
  const meta = rows.map((x) => ({ y: x.y, m: x.row.matured, n: x.row.npa, avg: x.row.avg_months, d: x.row.disb, amt: x.row.npa_amt }));
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(rows.map((x) => NY_YEAR_LABEL(x.y))),
    yAxis: npaAxis(),
    tooltip: {
      ...baseOption().tooltip,
      formatter: (ps) => `<b>${NY_YEAR_LABEL(meta[ps[0].dataIndex].y)}</b> — ${fmt.format(meta[ps[0].dataIndex].m)} matured loans, ${meta[ps[0].dataIndex].n} NPA, avg tenure ${meta[ps[0].dataIndex].avg} months<br/>` + ps.map((p) => p.marker + p.seriesName + ": <b>" + (p.value == null ? "–" : p.value + "%") + "</b>").join("<br/>"),
    },
    series: [
      { name: "NPA over the loan's life", type: "bar", barWidth: "26%", data: rows.map((x) => x.row.rate_life), itemStyle: { color: BLUE, borderRadius: [5, 5, 0, 0] } },
      { name: "Annualized NPA per year", type: "bar", barWidth: "26%", data: rows.map((x) => x.row.rate_ann), itemStyle: { color: RED, borderRadius: [5, 5, 0, 0] } },
    ],
  };
});

addChart("NPA by year — tenure-level vs annualized", "The rupee cost of defaults, not just loan counts", "ny3", "NPA ₹ loss by tenure — over the loan's life vs per year", "NPA principal written off as % of the ₹ disbursed on the same matured loans, whole book: over the loan's life (blue) vs annualized per year (red). This is the money actually lost — whole book 4.7% of lent over life → ≈13%/yr. 6-month loses 8.4% of every ₹ lent over its life (≈₹84 per ₹1,000) and 16.8%/yr.", 300, () => {
  const rows = nyTenureRows("ALL");
  const meta = rows.map((r) => ({ m: r.matured, d: r.disb, amt: r.npa_amt }));
  return {
    ...baseOption(),
    xAxis: CAT_AXIS(rows.map((r) => r.tenure + " mo")),
    yAxis: npaAxis(),
    tooltip: {
      ...baseOption().tooltip,
      formatter: (ps) => {
        const i = ps[0].dataIndex;
        const perK = (v) => (v == null ? "–" : "₹" + fmt.format(Math.round(v * 10)));
        return `<b>${ps[0].axisValue}</b> loans — ₹ lent ${inr(meta[i].d)}, NPA ₹ ${inr(meta[i].amt)} (${fmt.format(meta[i].m)} matured)<br/>` + ps.map((p) => p.marker + p.seriesName + ": <b>" + (p.value == null ? "–" : p.value + "%") + "</b> <span style='color:#8fa3c0'>(" + perK(p.value) + " per ₹1,000)</span>").join("<br/>");
      },
    },
    series: [
      { name: "NPA loss over the loan's life", type: "bar", barWidth: "28%", data: rows.map((r) => r.loss_life), itemStyle: { color: BLUE, borderRadius: [5, 5, 0, 0] } },
      { name: "Annualized loss per year", type: "bar", barWidth: "28%", data: rows.map((r) => r.loss_ann), itemStyle: { color: RED, borderRadius: [5, 5, 0, 0] } },
    ],
  };
});

addChart("NPA by year — tenure-level vs annualized", "Same grid as the ledger below: origination year × tenure, one heatmap cell per bucket. Whole book.", "ny4", "NPA heatmap: origination year × tenure — annualized per-year rate", "Colour = the annualized NPA rate per year of lending (×12/tenure) — so cells compare fairly even though tenures differ in length. Read rows top to bottom: the Dec-2025 vintage vs Jan–Sep 2026 vs the whole book; read any cell for the over-the-loan's-life rate too. Red is expensive money: 2026 6-month stands out at 22.6%/yr, and even 2026 3-month (20.4%/yr) costs more per year than the 2025 vintage's worst tenure. † = fewer than 10 matured loans (rate unreliable).", 340, () => {
  const ny = nyData();
  if (!ny) return null;
  const ys = [...(ny.years || []), "ALL"];      // rows: 2025, 2026, All years
  const byCell = {};
  ny.rows.forEach((r) => { if (r.tenure != null) byCell[r.year + "|" + r.tenure] = r; });
  const data = [];
  TENURES.forEach((t, i) => ys.forEach((y, j) => {
    const r = byCell[y + "|" + t];
    if (r) data.push([i, j, r.rate_ann, r.rate_life, r.matured, r.npa, r.disb, r.npa_amt, r.loss_life, r.loss_ann, !!r.small]);
  }));
  const maxAnn = Math.max(...data.map((v) => v[2]).filter((v) => v != null));
  return {
    ...baseOption(),
    tooltip: {
      ...baseOption().tooltip,
      position: "top",
      formatter: (pp) => {
        const v = pp.value;
        if (!v) return "";
        const year = NY_YEAR_LABEL(ys[v[1]]), ten = TENURES[v[0]] + " mo";
        const sm = v[10] ? "<br/><span style='color:#fbbf24'>† fewer than 10 matured loans — rate unreliable</span>" : "";
        return `<b>${ten} · ${year}</b><br/>` +
          `${fmt.format(v[4])} matured loans · ${fmt.format(v[5])} NPA · ₹ lent ${inr(v[6])} · NPA ₹ ${inr(v[7])}${sm}<br/>` +
          `NPA over the loan's life: <b>${v[3].toFixed(1)}%</b><br/>` +
          `Annualized NPA per year (×12/tenure): <b>${v[2].toFixed(1)}%</b><br/>` +
          `<span style='color:#8fa3c0'>₹ loss: ${v[8].toFixed(1)}% of lent over life → ${v[9].toFixed(1)}%/yr</span>`;
      },
    },
    grid: { left: 72, right: 16, top: 12, bottom: 84 },
    xAxis: { type: "category", data: TENURES.map((t) => t + " mo"), splitArea: { show: true }, axisLabel: { color: "#8fa3c0" }, axisLine: AXIS.axisLine },
    yAxis: { type: "category", data: ys.map((y) => NY_YEAR_LABEL(y)), splitArea: { show: true }, axisLabel: { color: "#8fa3c0", fontSize: 10 }, axisLine: AXIS.axisLine },
    visualMap: {
      type: "continuous", orient: "horizontal", left: "center", bottom: 4, min: 0, max: maxAnn,
      text: ["%NPA/yr", ""], textStyle: { color: "#8fa3c0", fontSize: 10 },
      inRange: { color: ["#15803d", "#84cc16", "#eab308", "#f97316", "#dc2626"] },
      itemHeight: 60, itemWidth: 8,
    },
    series: [{
      type: "heatmap", data,
      label: {
        show: true, color: "#ffffff", fontSize: 10, fontWeight: 700,
        textBorderColor: "rgba(11,18,32,0.55)", textBorderWidth: 2,
        formatter: (pp) => (pp.value[2] == null ? "–" : pp.value[2].toFixed(1) + "%") + (pp.value[10] ? " †" : ""),
      },
    }],
  };
});
