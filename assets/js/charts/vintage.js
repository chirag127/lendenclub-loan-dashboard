/* ============================================================
 * charts/vintage.js — vc1..vc5 (rendered: vc1..vc5)
 * ------------------------------------------------------------
 * Vintage curves: how each origination cohort's defaults arrive
 * month by month as the cohort ages — and every percentage that
 * goes with each cohort.
 *   vc1  cumulative default rate by loan age, one line per
 *        origination month — read a vintage's default bill as it
 *        builds and whether the curve has flattened (bill paid)
 *        or still ends rising (recent cohorts unproven)
 *   vc2  when defaults actually strike: pooled histogram of the
 *        month-of-life of every NPA
 *   vc3  NPA rate per cohort two ways: over the loan's life vs
 *        annualized per year (rate x 12 / the cohort's avg tenure)
 *   vc4  the rupee bill per cohort two ways: NPA principal lost as
 *        % of what was lent, over the loan's life vs per year
 *   vc5  net kept per cohort after everything (interest received −
 *        fees − NPA principal booked), per ₹1,000 lent, realized
 *        to date and per year
 * The full ledger of the same numbers sits below in the table
 * (ui/vintage-table.js). Whole book (like ny/dx): cohort curves
 * need the full history, so they read INSIGHTS_DATA.vintage and
 * ignore the month filter. Every number is computed by
 * scripts/ldc/insights.py (vintage()) and reconciled by audit
 * checks Z1–Z5 — nothing is re-typed here.
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

const vgData = () => (window.INSIGHTS_DATA && INSIGHTS_DATA.vintage) || null;

const MONTH_SHORT = {
  "2025-12": "Dec 25", "2026-01": "Jan 26", "2026-02": "Feb 26", "2026-03": "Mar 26",
  "2026-04": "Apr 26", "2026-05": "May 26", "2026-06": "Jun 26", "2026-07": "Jul 26",
  "2026-08": "Aug 26", "2026-09": "Sep 26",
};
const COHORT_COLORS = ["#22c55e", "#3b82f6", "#a855f7", "#06b6d4", "#eab308", "#f97316", "#ef4444", "#64748b", "#f43f5e", "#84cc16"];

addChart("Vintage curves — how defaults arrive as cohorts age", "One line per origination month: the cumulative NPA rate of that cohort at each age in months. A curve that rises and flattens has paid its default bill; one that still ends rising is unproven — its tail will climb as the cohort seasons. Whole book: cohort curves need the full history, so like the NPA-by-year charts these do not react to the month filter.", "vc1", "Vintage curves — cumulative defaults by loan age", "Dec-25 and Jan-26 money settled at 5.4–6.1% over ~6–9 months. Every cohort since starts higher and faster: Feb-26 hit 5.5% in its very first month and reached 9.1%, Apr-26 reached 7.1% in 6 months. Defaults arrive early — most of each bill is visible within 2–4 months of lending, which is exactly why 6–12-month money is dangerous: its defaults land before its interest has. May-26 and Jul-26 (dashed) have almost no settled defaults yet — young and unproven, not clean.", 340, () => {
  const vg = vgData();
  if (!vg || !vg.cohorts || !vg.cohorts.length) return null;
  const cohorts = vg.cohorts;
  const maxAge = Math.max(...cohorts.map((c) => c.curve[c.curve.length - 1].age));
  const ages = Array.from({ length: maxAge }, (_, i) => (i + 1) + " mo");
  const series = cohorts.map((c, ci) => {
    const byAge = {};
    c.curve.forEach((p) => { byAge[p.age] = p; });
    const data = ages.map((_, i) => (byAge[i + 1] ? byAge[i + 1].rate : null));
    // solid = the cohort has mostly resolved (its bill is settled); dashed =
    // a large share is still active so the curve can still climb as it seasons
    const openShare = c.loans ? c.active / c.loans : 0;
    const stillOpen = openShare > 0.10;
    return {
      name: MONTH_SHORT[c.month] || c.month,
      type: "line",
      data,
      symbol: "circle",
      symbolSize: 5,
      lineStyle: { width: 2.5, type: stillOpen ? "dashed" : "solid" },
      itemStyle: { color: COHORT_COLORS[ci % COHORT_COLORS.length] },
      _meta: c,
    };
  });
  const meta = series.map((s) => ({ m: s._meta, open: s.lineStyle.type === "dashed" }));
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: series.map((s) => s.name), top: 0 },
    tooltip: {
      ...baseOption().tooltip,
      trigger: "axis",
      formatter: (ps) => {
        const lines = ps.map((p, i) => {
          const mm = meta[i] && meta[i].m;
          if (p.value == null || !mm) return p.marker + p.seriesName + ": not observed yet";
          const pt = mm.curve.find((q) => q.age === p.dataIndex + 1);
          const flat = mm.curve[mm.curve.length - 1].age === p.dataIndex + 1;
          return p.marker + p.seriesName + ": <b>" + p.value.toFixed(1) + "%</b> <span style='color:#8fa3c0'>(" + pt.npa + " NPA / " + pt.denom + " loans" + (flat ? " — settled to date" : "") + ")</span>";
        });
        return `<b>Loan age ${p.dataIndex + 1} mo</b> — cumulative NPA rate<br/>` + lines.join("<br/>");
      },
    },
    grid: { left: 46, right: 16, top: 56, bottom: 30 },
    xAxis: CAT_AXIS(ages),
    yAxis: VAL_AXIS(false),
    series,
  };
});

addChart("Vintage curves — how defaults arrive as cohorts age", "All 148 NPAs pooled: which month of the loan's life each default struck. Whole book.", "vc2", "When defaults strike — month-of-life of every NPA", "31% of all NPAs paid almost nothing and defaulted in month 1; by month 3 nearly three-quarters of the default bill has already arrived, and by month 4 almost 9 in 10. The default bill of a cohort is mostly settled before a 6-month loan is half over — the losses show up fast, the interest does not.", 320, () => {
  const vg = vgData();
  if (!vg || !vg.arrival || !vg.arrival.length) return null;
  const arr = vg.arrival;
  const rows = arr.map((r) => ({ age: r.age, pct: r.pct_of_all, cum: r.cum_pct, n: r.npa }));
  return {
    ...baseOption(),
    tooltip: {
      ...baseOption().tooltip,
      trigger: "item",
      formatter: (p) => {
        const r = rows[p.dataIndex];
        return `<b>Month ${r.age} of the loan</b><br/>${p.marker}<b>${r.pct.toFixed(1)}%</b> of all NPAs struck here <span style='color:#8fa3c0'>(${fmt.format(r.n)} loans)</span><br/><span style='color:#8fa3c0'>Cumulative by month ${r.age}: <b style='color:#e6edf7'>${r.cum.toFixed(1)}%</b> of the book's NPA bill</span>`;
      },
    },
    xAxis: CAT_AXIS(rows.map((r) => "mo " + r.age)),
    yAxis: VAL_AXIS(false),
    series: [{
      type: "bar",
      barWidth: "52%",
      data: rows.map((r, i) => ({ value: r.pct, itemStyle: { color: i === 0 ? RED : lighten(RED, 0.18 * Math.min(i, 4)), borderRadius: [5, 5, 0, 0] } })),
      label: { show: true, position: "top", color: "#8fa3c0", fontSize: 9.5, formatter: (p) => p.value.toFixed(0) + "%" },
    }],
  };
});

/* ---------- shared bits for the vc3–vc5 cohort percentage charts ---------- */
const vcCohorts = () => { const vg = vgData(); return vg && vg.cohorts && vg.cohorts.length ? vg.cohorts : []; };
const vcNames = (cs) => cs.map((c) => (MONTH_SHORT[c.month] || c.month) + (c.open ? " ◌" : ""));

/* tooltip body for one cohort row — every rate and rupee it carries */
function vcRowTooltip(c) {
  const pct = (v) => (v == null ? "–" : v.toFixed(1) + "%");
  const open = c.open ? " <span style='color:#fcd34d'>— still open, can degrade</span>" : "";
  return `<b>${MONTH_SHORT[c.month] || c.month} cohort</b>${open}<br/>` +
    `<span style='color:#8fa3c0'>${fmt.format(c.loans)} loans · ${fmt.format(c.matured)} matured · ${fmt.format(c.npa)} NPA · avg tenure ${c.avg_tenure_m} mo</span><br/>` +
    `NPA rate — over loan's life: <b>${pct(c.rate_life)}</b> · per year: <b style='color:#fca5a5'>${pct(c.rate_ann)}</b><br/>` +
    `₹ loss — over loan's life: <b>${pct(c.loss_life)}</b> of ₹ lent · per year: <b style='color:#fdba74'>${pct(c.loss_ann)}</b><br/>` +
    `<span style='color:#8fa3c0'>₹${fmt.format(Math.round(c.disb))} lent · ₹${fmt.format(Math.round(c.interest))} interest · −₹${fmt.format(Math.round(c.fees))} fees · −₹${fmt.format(Math.round(c.npa_amt))} NPA</span><br/>` +
    `Net kept after everything: <b style='color:${(c.net || 0) >= 0 ? "#86efac" : "#fca5a5"}'>${inr(c.net)}</b> = ${pct(c.net_pct)} of ₹ lent (${pct(c.net_ann)} per year)`;
}

/* one shared builder for the “over the loan's life vs per year” dual-bar charts (vc3, vc4) */
function vcDualBarChart(cfg) {
  const cs = vcCohorts();
  if (!cs.length) return null;
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: [cfg.lifeName, cfg.annName], top: 0 },
    tooltip: {
      ...baseOption().tooltip,
      trigger: "axis",
      formatter: (ps) => {
        const c = cs[ps[0].dataIndex];
        if (!c) return "";
        return vcRowTooltip(c);
      },
    },
    grid: { left: 46, right: 16, top: 52, bottom: 28 },
    xAxis: CAT_AXIS(vcNames(cs)),
    yAxis: VAL_AXIS(false),
    series: [
      { name: cfg.lifeName, type: "bar", barWidth: "28%", data: cs.map((c) => (c[cfg.lifeKey] == null ? null : c[cfg.lifeKey])), itemStyle: { color: cfg.lifeColor, borderRadius: [3, 3, 0, 0] }, label: { show: false } },
      { name: cfg.annName, type: "bar", barWidth: "28%", data: cs.map((c) => (c[cfg.annKey] == null ? null : c[cfg.annKey])), itemStyle: { color: cfg.annColor, borderRadius: [3, 3, 0, 0] }, label: { show: false } },
    ],
  };
}

addChart("Defaults by origination cohort — curves, rates & the ₹ bill", "The same cohort story as numbers: for each origination month, its NPA rate over the whole loan term next to the annualized per-year rate (rate × 12 ÷ the cohort's average tenure — so 2-month money that defaults is compared fairly with 12-month money). ◌ marks cohorts still >10% active. Matured basis (CLOSED + NPA loans). Whole book — the month filter does not apply.", "vc3", "NPA rate by origination month — over the loan's life vs per year", "Read down the cohorts: Dec-25 and Jan-26 settled near 5–6% over their lives (≈15.5%/yr annualized). Feb-26 was the worst start at 9.1% over the life — 20.2%/yr — and Apr-26 reached 7.1% over only ~3 months of average tenure, an annualized 27.2%/yr. Every cohort since Feb has defaulted at or above Dec-25's level: default rates are not improving with time.", 320, () => vcDualBarChart({
  lifeName: "Over the loan's life", annName: "Per year (× 12/tenure)",
  lifeKey: "rate_life", annKey: "rate_ann",
  lifeColor: lighten(RED, 0.35), annColor: RED,
}));

addChart("Defaults by origination cohort — curves, rates & the ₹ bill", "The rupee side of the same cohorts: NPA principal written off as % of the rupees disbursed on that cohort's matured loans — again over the loan's life and per year. This is the money actually at risk of never coming back, not loan counts. Whole book — the month filter does not apply.", "vc4", "The ₹ bill per origination month — loss over the loan's life vs per year", "Feb-26 is the most expensive month on record: 11.7% of every ₹ lent on matured loans became NPA principal — 26%/yr — and Apr-26's short-tenure book still cost 6.0% over ~3 months (22.8%/yr). Dec-25 and Jan-26, by contrast, lost only 2.8–3.9% over their lives. Default ₹ has been consistently heavier since February than the platform's early book.", 320, () => vcDualBarChart({
  lifeName: "Loss over the loan's life", annName: "Loss per year (× 12/tenure)",
  lifeKey: "loss_life", annKey: "loss_ann",
  lifeColor: lighten(AMBER, 0.35), annColor: AMBER,
}));

addChart("Defaults by origination cohort — curves, rates & the ₹ bill", "After all the pieces above: interest actually received to date, minus every platform fee deducted and minus NPA principal booked (unrecovered principal = a total loss) — what each origination month keeps per ₹1,000 it lent (bars) and that same net annualized per year by the cohort's average tenure (line). Realized-to-date across the whole cohort (active loans included), so ◌ cohorts are still earning — and still able to lose. Whole book — the month filter does not apply.", "vc5", "Net kept per origination month — after fees & every default", "Dec-25 and Jan-26 kept ₹71 per ₹1,000 (20.6–16.6%/yr realized). Feb-26 lost money net of everything: −₹11 per ₹1,000 (−2.4%/yr) — its defaults and fees wiped out its interest. May-26 and Jul-26 look healthy but are young (◌): their interest is only partly received and their defaults not yet visible, so treat their lines as floors, not forecasts.", 320, () => {
  const cs = vcCohorts();
  if (!cs.length) return null;
  const vax = VAL_AXIS(false);
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Net kept ₹ per ₹1,000 lent", "Same net, per year"], top: 0 },
    tooltip: {
      ...baseOption().tooltip,
      trigger: "axis",
      formatter: (ps) => {
        const c = cs[ps[0].dataIndex];
        if (!c) return "";
        return vcRowTooltip(c);
      },
    },
    grid: { left: 52, right: 46, top: 52, bottom: 28 },
    xAxis: CAT_AXIS(vcNames(cs)),
    yAxis: [
      { ...vax, name: "₹ kept per ₹1,000 lent", nameTextStyle: { color: "#8fa3c0", fontSize: 10 } },
      { ...vax, name: "net % per year", nameTextStyle: { color: "#8fa3c0", fontSize: 10 }, splitLine: { show: false } },
    ],
    series: [
      {
        name: "Net kept ₹ per ₹1,000 lent", type: "bar", barWidth: "44%",
        data: cs.map((c) => ({
          value: +(c.net_pct * 10).toFixed(1),
          itemStyle: { color: (c.net || 0) >= 0 ? GREEN : RED, borderRadius: [3, 3, 0, 0] },
        })),
        label: { show: true, position: "top", color: (p) => (p.value >= 0 ? "#86efac" : "#fca5a5"), fontSize: 10, formatter: (p) => (p.value >= 0 ? "+" : "") + p.value },
      },
      {
        name: "Same net, per year", type: "line", yAxisIndex: 1,
        data: cs.map((c) => (c.net_ann == null ? null : c.net_ann)),
        symbol: "circle", symbolSize: 7, smooth: false,
        lineStyle: { width: 2.5, color: CYAN, type: "dashed" },
        itemStyle: { color: CYAN },
      },
    ],
  };
});
