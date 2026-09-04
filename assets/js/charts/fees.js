/* ============================================================
 * charts/fees.js — fe1..fe3 (rendered: fe1, fe2, fe3)
 * ------------------------------------------------------------
 * The one fee the report discloses — a single "Platform Fee (₹)"
 * per loan — broken down honestly:
 *   fe1  what the fee schedule actually is, by tenure (fully
 *        repaid loans vs how much active/NPA loans paid so far)
 *   fe2  where the fee ₹ sits vs the interest received, by tenure
 *   fe3  the fee's total ₹ impact: gross interest → −fees → −NPA
 *        → what you keep
 * Whole-book charts (like dx1/dx3/ny): the fee schedule is a
 * pricing property of the platform, not a monthly event, so they
 * read the full LOANS set and do not react to the month filter.
 * All values come live from the loan records (scripts/ldc/*.py
 * regenerates data/loans.js from the source xlsx).
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* median of fee ÷ amount × 100 for a set of loans (the per-loan fee rate) */
function feeMedianPct(xs) {
  const rates = xs.filter((l) => (l.platform_fee || 0) > 0 && (l.amount || 0) > 0)
    .map((l) => (100 * l.platform_fee) / l.amount).sort((a, b) => a - b);
  if (!rates.length) return null;
  const mid = Math.floor(rates.length / 2);
  return +(rates.length % 2 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2).toFixed(2);
}

/* fee-rate row per tenure: full schedule (closed) + pro-rata paid so far (active/NPA) */
function feeScheduleRows() {
  return TENURES.map((t) => {
    const closed = LOANS.filter((l) => l.status === "CLOSED" && l.tenure === t);
    const partial = LOANS.filter((l) => (l.status === "ACTIVE" || l.status === "NPA") && l.tenure === t);
    const full = feeMedianPct(closed), sofar = feeMedianPct(partial);
    return {
      t, full, sofar,
      nFull: closed.filter((l) => (l.platform_fee || 0) > 0).length,
      nSoFar: partial.filter((l) => (l.platform_fee || 0) > 0).length,
      disb: LOANS.filter((l) => l.tenure === t).reduce((s, l) => s + (l.amount || 0), 0),
      fee: LOANS.filter((l) => l.tenure === t).reduce((s, l) => s + (l.platform_fee || 0), 0),
      intr: LOANS.filter((l) => l.tenure === t).reduce((s, l) => s + (l.interest_received || 0), 0),
    };
  });
}

const FEE_SECTION = "What loans actually pay — net of fees & defaults";

addChart(FEE_SECTION, "The report records ONE 'Platform Fee (₹)' per loan — no fee-type split is disclosed. These charts decompose that single line by tenure and show its total ₹ cost. Whole book: like the other fee math on this dashboard they read every loan and do not react to the month filter.", "fe1", "Platform fee schedule — what LenDenClub charges by tenure", "Fee is charged as repayments arrive, not upfront: on fully-repaid loans the per-loan fee follows a tenure schedule — ≈1.0% of the amount at 2–3 months, 2.3–2.5% at 4–5 months, 3.0% at 6 months, 6.0% at 12 months (≈₹10–₹60 per ₹1,000 lent). Active and NPA loans have only paid the pro-rata share of that schedule so far (right bar in each pair) — a default also cancels the unpaid fees.", 320, () => {
  const rows = feeScheduleRows().filter((r) => r.full != null || r.sofar != null);
  const meta = rows.map((r) => ({ r, perK: (v) => "₹" + fmt.format(Math.round((v || 0) * 10)) }));
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Fee on fully repaid loans", "Fee paid so far (active/NPA)"] },
    tooltip: {
      ...baseOption().tooltip,
      formatter: (ps) => {
        const m = meta[ps[0].dataIndex];
        const line = (p) => {
          const v = p.value == null ? null : m.r[p.seriesName.indexOf("repaid") >= 0 ? "full" : "sofar"];
          const n = p.seriesName.indexOf("repaid") >= 0 ? m.r.nFull : m.r.nSoFar;
          return p.marker + p.seriesName + ": <b>" + (v == null ? "–" : v + "% of amount") + "</b> <span style='color:#8fa3c0'>(" + (v == null ? "–" : m.perK(v) + " per ₹1,000") + " · " + fmt.format(n) + " loans)</span>";
        };
        return `<b>${ps[0].axisValue}</b> — fee on ₹${fmt.format(Math.round(m.r.disb))} lent, ₹${fmt.format(Math.round(m.r.fee))} total<br/>` + ps.map(line).join("<br/>");
      },
    },
    xAxis: CAT_AXIS(rows.map((r) => r.t + " mo")),
    yAxis: VAL_AXIS(false),
    series: [
      { name: "Fee on fully repaid loans", type: "bar", barWidth: "26%", data: rows.map((r) => r.full), itemStyle: { color: PURPLE, borderRadius: [5, 5, 0, 0] }, label: { show: true, position: "top", color: "#c084fc", fontSize: 9.5, formatter: (p) => (p.value == null ? "" : p.value.toFixed(1) + "%") } },
      { name: "Fee paid so far (active/NPA)", type: "bar", barWidth: "26%", data: rows.map((r) => r.sofar), itemStyle: { color: "#64748b", borderRadius: [5, 5, 0, 0] }, label: { show: true, position: "top", color: "#94a3b8", fontSize: 9.5, formatter: (p) => (p.value == null ? "" : p.value.toFixed(1) + "%") } },
    ],
  };
});

addChart(FEE_SECTION, "Where the fee ₹ actually sits: every tenure's platform-fee total against the interest that tenure actually produced. Whole book.", "fe2", "Fee ₹ vs interest received — the fee's bite by tenure", "Across the book the platform collected ₹45,115 of fees on ₹253,067 of interest — 17.8% of every interest rupee, before NPA losses. The bite is worse on long tenures: fees eat 26% of the (already thin) interest on 12-month loans vs ~10% on 3-month loans. The bar pair shows the ₹ — hover for the fee share of that tenure's interest.", 320, () => {
  const rows = feeScheduleRows();
  return {
    ...baseOption(),
    legend: { ...baseOption().legend, data: ["Interest received", "Platform fees"] },
    tooltip: {
      ...baseOption().tooltip,
      formatter: (ps) => {
        const r = rows[ps[0].dataIndex];
        const pctI = r.intr ? (100 * r.fee) / r.intr : 0;
        return `<b>${r.t} mo</b><br/>` + ps.map((p) => p.marker + p.seriesName + ": <b>" + inr(p.value) + "</b>").join("<br/>") + `<br/><span style='color:#8fa3c0'>Fee = ${pctI.toFixed(1)}% of this tenure's interest · ₹${fmt.format(Math.round(r.fee / Math.max(1, r.disb) * 1000))} per ₹1,000 lent</span>`;
      },
    },
    xAxis: CAT_AXIS(rows.map((r) => r.t + " mo")),
    yAxis: VAL_AXIS(true),
    series: [
      { name: "Interest received", type: "bar", barWidth: "26%", data: rows.map((r) => +r.intr.toFixed(0)), itemStyle: { color: GREEN, borderRadius: [5, 5, 0, 0] } },
      { name: "Platform fees", type: "bar", barWidth: "26%", data: rows.map((r) => +r.fee.toFixed(0)), itemStyle: { color: PURPLE, borderRadius: [5, 5, 0, 0] }, label: { show: true, position: "top", color: "#c084fc", fontSize: 9.5, formatter: (p) => (p.value ? inrCompact(p.value) : "") } },
    ],
  };
});

addChart(FEE_SECTION, "The same ladder as the returns statement, but in actual rupees with the fee step isolated — the answer to 'what did the fees cost me in total?'. Whole book.", "fe3", "Total ₹ impact of platform fees — gross interest → net", "₹253,067 of interest came in; ₹45,115 (17.8%) went straight to platform fees before a single default; NPA write-offs took ₹83,830 more; ₹124,122 is what you actually kept. Fees alone cost about 36% of that final net — every rupee of it on loans that did repay.", 320, () => {
  const i = LOANS.reduce((s, l) => s + (l.interest_received || 0), 0);
  const f = LOANS.reduce((s, l) => s + (l.platform_fee || 0), 0);
  const n = LOANS.filter((l) => l.status === "NPA").reduce((s, l) => s + (l.npa_amount || 0), 0);
  const net = i - f - n;
  const steps = [
    { name: "Gross interest received", v: +i.toFixed(0), c: GREEN, note: "every interest rupee the book produced" },
    { name: "Platform fees", v: -+f.toFixed(0), c: PURPLE, note: "the one fee line the report discloses — charged as repayments arrive" },
    { name: "NPA losses", v: -+n.toFixed(0), c: RED, note: "principal written off on defaulted loans" },
    { name: "Net after everything", v: +net.toFixed(0), c: CYAN, note: "what you actually keep — the base of every net XIRR on this dashboard" },
  ];
  return {
    ...baseOption(),
    tooltip: {
      ...baseOption().tooltip,
      formatter: (ps) => {
        const s = steps[ps[0].dataIndex];
        const pctOfInt = (100 * Math.abs(s.v)) / i;
        return `<b>${s.name}</b><br/>${s.v >= 0 ? "" : "−"}<b>${inr(Math.abs(s.v))}</b><br/><span style='color:#8fa3c0'>${s.note}${s.name === "Gross interest received" ? "" : " · " + pctOfInt.toFixed(1) + "% of gross interest"}</span>`;
      },
    },
    xAxis: CAT_AXIS(steps.map((s) => s.name)),
    yAxis: VAL_AXIS(true),
    series: [{
      type: "bar", barWidth: "38%", data: steps.map((s) => ({ value: s.v, itemStyle: { color: s.c, borderRadius: [5, 5, 0, 0] } })),
      label: { show: true, position: "top", color: "#8fa3c0", fontSize: 9.5, formatter: (p) => (p.value >= 0 ? "" : "−") + inrCompact(Math.abs(p.value)) },
    }],
  };
});
