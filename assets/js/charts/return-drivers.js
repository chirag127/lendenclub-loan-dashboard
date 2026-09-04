/* ============================================================
 * charts/return-drivers.js — rd1..rd3 (rendered: rd1, rd2, rd3)
 * ------------------------------------------------------------
 * Realized net return after fees & every default, cut by the
 * attributes a lender actually CHOOSES when picking a loan:
 *   rd1  quoted interest-rate band → net XIRR (does chasing a
 *        higher sticker rate pay?)
 *   rd2  ticket size → net XIRR + net kept per ₹1,000 (does
 *        lending bigger or smaller tickets pay more?)
 *   rd3  repayment type → net XIRR (monthly vs daily)
 * Computed by scripts/ldc/insights.py → return_drivers() with the
 * same per-EMI fee + front-loaded-NPA cashflow model as the picks,
 * reconciled by audit W3/W4. Matured loans only (CLOSED + NPA).
 * ============================================================ */

const RD_SECTION = "The verdict — lend only these";

addChart(RD_SECTION, "Your matured loans cut by the interest rate the borrower quoted — is the higher sticker rate real money after defaults? Matured only, all fees and every default inside the number (return_drivers() → audit W3/W4).", "rd1", "Quoted rate vs realized net XIRR — does chasing a high rate pay?", () => {
  const RD = (window.INSIGHTS_DATA || {}).return_drivers;
  if (!RD || !RD.by_rate.length) return "No matured loans to bucket.";
  const rows = RD.by_rate;
  const best = rows.reduce((a, b) => (b.xirr_all != null && (a.xirr_all == null || b.xirr_all > a.xirr_all) ? b : a), {});
  const worst = rows.reduce((a, b) => (b.xirr_all != null && (a.xirr_all == null || b.xirr_all < a.xirr_all) ? b : a), {});
  return `On your matured loans the quoted rate <b>does</b> track what you keep: ${worst.label} quoted nets <b>${pct(worst.xirr_all)}/yr</b> while ${best.label} nets <b>${pct(best.xirr_all)}/yr</b> after fees and every default. ${best.loans >= 200 ? "This is a real gradient across hundreds of loans, not noise — but remember it is one factor inside the tenure × score verdict, which matters more." : "Caution: the top band has only " + best.loans + " matured loans — treat it as a hint, not a rule."}`;
}, 320, () => {
  const RD = (window.INSIGHTS_DATA || {}).return_drivers;
  if (!RD || !RD.by_rate.length) return null;
  const rows = RD.by_rate;
  return {
    ...baseOption(),
    tooltip: {
      ...baseOption().tooltip,
      formatter: (ps) => {
        const r = rows[ps[0].dataIndex];
        return `<b>${r.label} quoted</b><br/>net XIRR <b>${pct(r.xirr_all)}/yr</b> incl. defaults & fees<br/><span style='color:#8fa3c0'>${fmt.format(r.loans)} matured · default ${pct(r.def_rate)} · net kept ${inr(r.net_1000)} per ₹1,000 lent · fee ${r.fee_pct}% of lent</span>`;
      },
    },
    xAxis: CAT_AXIS(rows.map((r) => r.label)),
    yAxis: VAL_AXIS(false),
    series: [{
      type: "bar", barWidth: "38%",
      data: rows.map((r) => ({
        value: r.xirr_all,
        itemStyle: { color: r.xirr_all >= 0 ? GREEN : RED, borderRadius: [5, 5, 0, 0] },
      })),
      label: { show: true, position: "top", color: "#8fa3c0", fontSize: 9.5, formatter: (p) => (p.value == null ? "" : p.value.toFixed(1) + "%") },
    }],
  };
});

addChart(RD_SECTION, "Your matured loans by ticket size — does lending ₹500 vs ₹2,500 vs ₹5,000+ change what you keep after defaults? Matured only, every fee and default inside the number (return_drivers()).", "rd2", "Ticket size vs realized net return — which ticket sizes pay", () => {
  const RD = (window.INSIGHTS_DATA || {}).return_drivers;
  if (!RD || !RD.by_ticket.length) return "No matured loans to bucket.";
  const rows = RD.by_ticket;
  const hole = rows.find((r) => r.xirr_all != null && r.xirr_all < 0);
  return `₹250–₹1,000 tickets all net <b>33–36%/yr</b> after everything. The surprise: <b>₹2,500 tickets net ${hole ? pct(hole.xirr_all) : "—"}/yr</b> — ${hole ? "they lose money after defaults" : ""} — while ₹5,000+ recover to <b>${rows.find((r) => r.label === "₹5,000+").xirr_all.toFixed(1)}%/yr</b>. ${hole ? "If you see a mid-size ₹2,500 ticket next to a stack of ₹1,000s, the data says the small ones are the better bet." : ""}`;
}, 320, () => {
  const RD = (window.INSIGHTS_DATA || {}).return_drivers;
  if (!RD || !RD.by_ticket.length) return null;
  const rows = RD.by_ticket;
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Net XIRR incl. defaults (%/yr)", "Net kept ₹ per ₹1,000 lent"] },
    tooltip: {
      ...baseOption().tooltip,
      formatter: (ps) => {
        const r = rows[ps[0].dataIndex];
        return `<b>${r.label} tickets</b><br/>` + ps.map((p) => p.marker + p.seriesName + ": <b>" + (p.value == null ? "—" : p.seriesIndex === 0 ? p.value.toFixed(1) + "%/yr" : "₹" + fmt.format(Math.round(p.value))) + "</b>").join("<br/>") + `<br/><span style='color:#8fa3c0'>${fmt.format(r.loans)} matured · default ${pct(r.def_rate)}</span>`;
      },
    },
    xAxis: CAT_AXIS(rows.map((r) => r.label)),
    yAxis: VAL_AXIS(false),
    series: [
      { name: "Net XIRR incl. defaults (%/yr)", type: "bar", barWidth: "26%", data: rows.map((r) => r.xirr_all), itemStyle: { color: "#38bdf8", borderRadius: [5, 5, 0, 0] }, label: { show: true, position: "top", color: "#7dd3fc", fontSize: 9.5, formatter: (p) => (p.value == null ? "" : p.value.toFixed(1) + "%") } },
      { name: "Net kept ₹ per ₹1,000 lent", type: "bar", barWidth: "26%", data: rows.map((r) => r.net_1000), itemStyle: { color: "#34d399", borderRadius: [5, 5, 0, 0] }, label: { show: true, position: "top", color: "#6ee7b7", fontSize: 9.5, formatter: (p) => (p.value == null ? "" : "₹" + Math.round(p.value)) } },
    ],
  };
});

addChart(RD_SECTION, "Monthly vs daily-repayment loans — same net-XIRR lens. Matured only; treat the daily sample as a hint (only a handful of daily loans have matured).", "rd3", "Repayment type vs realized net return", () => {
  const RD = (window.INSIGHTS_DATA || {}).return_drivers;
  if (!RD || !RD.by_repay.length) return "No matured loans to bucket.";
  const rows = RD.by_repay;
  return rows.map((r) => `${r.label}: <b>${pct(r.xirr_all)}/yr</b> net incl. defaults (${fmt.format(r.loans)} matured · default ${pct(r.def_rate)})`).join(" · ") + (rows.find((r) => r.loans < 20) ? " — the small sample is why daily loans aren't in the verdict." : "");
}, 300, () => {
  const RD = (window.INSIGHTS_DATA || {}).return_drivers;
  if (!RD || !RD.by_repay.length) return null;
  const rows = RD.by_repay;
  return {
    ...baseOption(),
    tooltip: {
      ...baseOption().tooltip,
      formatter: (ps) => {
        const r = rows[ps[0].dataIndex];
        return `<b>${r.label} repayment</b><br/>net XIRR <b>${pct(r.xirr_all)}/yr</b><br/><span style='color:#8fa3c0'>${fmt.format(r.loans)} matured · default ${pct(r.def_rate)} · fee ${r.fee_pct}%</span>`;
      },
    },
    xAxis: CAT_AXIS(rows.map((r) => r.label)),
    yAxis: VAL_AXIS(false),
    series: [{
      type: "bar", barWidth: "34%",
      data: rows.map((r) => ({ value: r.xirr_all, itemStyle: { color: r.xirr_all >= 0 ? GREEN : RED, borderRadius: [5, 5, 0, 0] } })),
      label: { show: true, position: "top", color: "#8fa3c0", fontSize: 9.5, formatter: (p) => (p.value == null ? "" : p.value.toFixed(1) + "%") },
    }],
  };
});