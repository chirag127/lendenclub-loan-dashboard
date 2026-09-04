/* ============================================================
 * charts/allocation.js — al1..al3 (rendered: al1, al2, al3)
 * ------------------------------------------------------------
 * "Where is my money actually going, versus where the data says
 * it should go?" — computed by the pipeline's month_allocation()
 * on the newest disbursement month's still-open loans. This is
 * the direct check on whether you are funding the high-return
 * cells the verdict recommends or drifting into the rest.
 *   al1  this month's ₹ by tenure: actual vs recommended
 *   al2  by tenure × score cell: actual vs recommended, tier-coded
 *   al3  tier split of this month's money (core/support/avoid/unproven)
 * Whole-book: the allocation is a monthly snapshot, not a filter.
 * ============================================================ */

const ALLOC_SECTION = "The verdict — lend only these";

/* al1 — actual vs recommended by tenure */
addChart(ALLOC_SECTION, "Your newest disbursement month's money by tenure, against the tenure share the verdict recommends (from xirr_picks, which nets every fee and default). Whole book: this is a snapshot of how you are actually deploying, not a filter.", "al1", "This month's money vs the verdict — by tenure", () => {
  const MA = (window.INSIGHTS_DATA || {}).month_allocation;
  if (!MA || !MA.by_tenure.length) return "No fresh disbursement month with still-open loans in this report.";
  const rows = MA.by_tenure;
  const core = MA.core_pct;
  const over = rows.filter((r) => r.actual_pct > (r.rec_pct || 0) + 1.5).map((r) => r.tenure + " mo").join(", ");
  const under = rows.filter((r) => r.actual_pct < (r.rec_pct || 0) - 1.5 && r.rec_pct).map((r) => r.tenure + " mo").join(", ");
  return `${MA.month}: <b>${fmt.format(MA.loans)} loans</b> / <b>${inr(MA.amount)}</b> deployed. Only <b>${core.toFixed(1)}%</b> went into core (recommended) cells; the money is overweight ${over ? "<b>" + over + "</b> (" : ""}${over ? "actual > recommended" : ""}${over ? ")" : "—"} and starved ${under ? "<b>" + under + "</b>" : "—"} where the best risk-adjusted XIRR sits.`;
}, 320, () => {
  const MA = (window.INSIGHTS_DATA || {}).month_allocation;
  if (!MA || !MA.by_tenure.length) return null;
  const rows = MA.by_tenure;
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Actual this month", "Recommended"] },
    tooltip: {
      ...baseOption().tooltip,
      formatter: (ps) => {
        const r = rows[ps[0].dataIndex];
        const lines = ps.map((p) => p.marker + p.seriesName + ": <b>" + (p.value == null ? "—" : p.value.toFixed(1) + "%") + "</b>").join("<br/>");
        const diff = r.actual_pct - (r.rec_pct || 0);
        return `<b>${r.tenure} mo</b><br/>` + lines + `<br/><span style='color:#8fa3c0'>${diff > 0 ? "▲ over-funded by " + diff.toFixed(1) + " pts" : diff < 0 ? "▼ under-funded by " + (-diff).toFixed(1) + " pts" : "on target"} · ₹${fmt.format(Math.round(r.amount))} this month</span>`;
      },
    },
    xAxis: CAT_AXIS(rows.map((r) => r.tenure + " mo")),
    yAxis: VAL_AXIS(false),
    series: [
      { name: "Actual this month", type: "bar", barWidth: "26%", data: rows.map((r) => r.actual_pct), itemStyle: { color: "#38bdf8", borderRadius: [5, 5, 0, 0] }, label: { show: true, position: "top", color: "#7dd3fc", fontSize: 9.5, formatter: (p) => (p.value == null ? "" : p.value.toFixed(1) + "%") } },
      { name: "Recommended", type: "bar", barWidth: "26%", data: rows.map((r) => r.rec_pct), itemStyle: { color: "#34d399", borderRadius: [5, 5, 0, 0] }, label: { show: true, position: "top", color: "#6ee7b7", fontSize: 9.5, formatter: (p) => (p.value == null ? "" : p.value.toFixed(1) + "%") } },
    ],
  };
});

/* al2 — cell-level actual vs recommended (the fine decision view) */
addChart(ALLOC_SECTION, "The same comparison at the tenure × score level — the exact cells the verdict ranks. Green bars are where this month's money went; the ring marker is the recommended share. Money in avoid/gate cells is money you know loses after fees and defaults.", "al2", "Cell-level: where this month's ₹ went vs where it should go", () => {
  const MA = (window.INSIGHTS_DATA || {}).month_allocation;
  if (!MA || !MA.by_bucket.length) return "No allocation data in this report.";
  const avoid = MA.by_bucket.filter((b) => b.tier === "avoid" || b.tier === "gate");
  const avoidAmt = avoid.reduce((s, b) => s + (b.amount || 0), 0);
  const avoidTxt = avoid.length
    ? ` and <b>${inr(avoidAmt)}</b> (${fmt.format(avoid.reduce((s, b) => s + (b.loans || 0), 0))} loans) went into <span style='color:#f87171'>avoid/conditional cells</span> — cells the data says lose money after fees and defaults`
    : "";
  return `Top cells this month: ${MA.by_bucket.slice(0, 3).map((b) => `<b>${b.key}</b> ${b.actual_pct.toFixed(1)}%`).join(" · ")}. ${inr(MA.amount)} total${avoidTxt}. Scroll the chart to see every cell.`;
}, 360, () => {
  const MA = (window.INSIGHTS_DATA || {}).month_allocation;
  if (!MA || !MA.by_bucket.length) return null;
  const rows = MA.by_bucket.filter((b) => b.amount > 0);
  const tierColor = { core: "#34d399", support: "#38bdf8", gate: "#fbbf24", avoid: "#f87171", unproven: "#94a3b8", unbanded: "#94a3b8" };
  const sortKey = (b) => (b.actual_pct > 0 ? 1 : 0) * 1000 - (b.tier === "avoid" ? 50 : 0) - (b.tier === "unproven" ? 25 : 0);
  const sorted = rows.slice().sort((a, b) => sortKey(b) - sortKey(a));
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Actual this month", "Recommended", "Tier: core", "Tier: support", "Tier: avoid", "Tier: unproven"] },
    tooltip: {
      ...baseOption().tooltip,
      formatter: (ps) => {
        const b = sorted[ps[0].dataIndex];
        if (!b) return "";
        const rec = b.rec_pct != null ? b.rec_pct.toFixed(1) + "%" : "— (too little evidence to rank)";
        const xirr = b.xirr_all != null ? b.xirr_all.toFixed(1) + "%/yr net incl. defaults" : "no matured evidence yet";
        return `<b>${b.key}</b> · tier <b>${b.tier}</b><br/>actual <b>${b.actual_pct.toFixed(1)}%</b> (₹${fmt.format(Math.round(b.amount))}) · recommended <b>${rec}</b><br/><span style='color:#8fa3c0'>${b.loans} loans this month · cell XIRR ${xirr}</span>`;
      },
    },
    grid: { ...baseOption().grid, left: 92, right: 24, bottom: 30, top: 40 },
    xAxis: VAL_AXIS(false),
    yAxis: { type: "category", data: sorted.map((b) => b.key), axisLabel: { color: "#8fa3c0", fontSize: 10 } },
    series: [
      {
        name: "Actual this month", type: "bar", barWidth: 11,
        data: sorted.map((b) => ({ value: b.actual_pct, itemStyle: { color: tierColor[b.tier] || "#94a3b8", borderRadius: [0, 5, 5, 0] } })),
        label: { show: true, position: "right", color: "#cbd5e1", fontSize: 9, formatter: (p) => (p.value ? p.value.toFixed(1) + "%" : "") },
      },
      {
        name: "Recommended", type: "bar", barWidth: 4,
        data: sorted.map((b) => b.rec_pct),
        itemStyle: { color: "#1e293b", borderColor: "#e2e8f0", borderWidth: 1, borderRadius: [0, 3, 3, 0] },
        barGap: "-110%",
      },
    ],
  };
});

/* al3 — tier split of this month's money */
addChart(ALLOC_SECTION, "The same month's money collapsed into verdict tiers — the single answer to 'am I funding the right cells?'. Core = the cells your own completed loans earned most on after fees and defaults; avoid = cells that lose money after fees and defaults.", "al3", "This month's ₹ by verdict tier — core vs avoid vs unproven", () => {
  const MA = (window.INSIGHTS_DATA || {}).month_allocation;
  if (!MA || !MA.by_bucket.length) return "No allocation data in this report.";
  const tierAmt = { core: 0, support: 0, gate: 0, avoid: 0, unproven: 0, unbanded: 0 };
  MA.by_bucket.forEach((b) => { tierAmt[b.tier] = (tierAmt[b.tier] || 0) + (b.amount || 0); });
  return `Core cells took <b>${inr(tierAmt.core)}</b> (${MA.core_pct.toFixed(1)}% of this month's ${inr(MA.amount)}); avoid/conditional took <b>${inr(tierAmt.avoid + tierAmt.gate)}</b> (${fmt.format(MA.misaligned_loans)} loans); the rest went to support and unproven cells. Target: ~84% core / 16% support, ₹0 avoid.`;
}, 280, () => {
  const MA = (window.INSIGHTS_DATA || {}).month_allocation;
  if (!MA || !MA.by_bucket.length) return null;
  const tierAmt = { core: 0, support: 0, gate: 0, avoid: 0, unproven: 0, unbanded: 0 };
  MA.by_bucket.forEach((b) => { tierAmt[b.tier] = (tierAmt[b.tier] || 0) + (b.amount || 0); });
  const labels = { core: "Core (lend)", support: "Support (small)", gate: "Gate (conditional)", avoid: "Avoid (never)", unproven: "Unproven", unbanded: "Unscored" };
  const colors = { core: "#34d399", support: "#38bdf8", gate: "#fbbf24", avoid: "#f87171", unproven: "#94a3b8", unbanded: "#64748b" };
  const data = Object.keys(tierAmt).filter((k) => tierAmt[k] > 0).map((k) => ({ name: labels[k], value: +tierAmt[k].toFixed(0), itemStyle: { color: colors[k] } }));
  return {
    ...baseOption(),
    tooltip: {
      ...baseOption().tooltip,
      formatter: (ps) => {
        const p = ps[0];
        return `<b>${p.name}</b><br/><b>${inr(p.value)}</b> (${((100 * p.value) / MA.amount).toFixed(1)}% of this month)<br/><span style='color:#8fa3c0'>${p.name === "Core (lend)" ? "the cells your own loans earned most on, all defaults in" : p.name === "Avoid (never)" ? "net XIRR ≤ 0 after fees & defaults" : ""}</span>`;
      },
    },
    series: [{
      type: "pie", radius: ["34%", "66%"], center: ["50%", "52%"],
      data,
      label: { color: "#cbd5e1", fontSize: 10, formatter: "{b}: {d}%" },
      labelLine: { lineStyle: { color: "#334155" } },
    }],
  };
});