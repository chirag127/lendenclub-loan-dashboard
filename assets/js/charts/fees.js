/* ============================================================
 * charts/fees.js — fe1..fe5 (rendered: fe1, fe2, fe3, fe4; fe5 in registry)
 * ------------------------------------------------------------
 * The platform fee — modelled the way the data proves it works:
 *   fee = schedule % × the PRINCIPAL RETURNED in each EMI
 * Verified on every loan that has returned principal (CLOSED,
 * ACTIVE and NPA alike): fee ÷ principal-returned equals the
 * schedule rate to within rounding (audit F1/F2):
 *   2mo 1.0% · 3mo 1.0% · 4mo 3.0% · 5mo 3.0% · 6mo 3.0% · 12mo 6.0%
 * with two documented mid-book increases: 4-month loans disbursed
 * before Apr-2026 paid 2.3%, 5-month before Jun-2026 paid 2.5%.
 *   fe1  the schedule, by tenure (closed vs active/NPA paid so far)
 *   fe2  fee ₹ vs interest received, by tenure
 *   fe3  the ₹ waterfall: gross interest → −fees → −NPA → kept
 *   fe4  the schedule increase — what 4/5-month loans cost before
 *        and after the pricing change (decision-relevant for NEW loans)
 *   fe5  the proof: every loan sits on its tenure's fee line
 *        (fee vs principal returned, slope = schedule rate)
 * Whole-book charts (like dx1/dx3/ny): the fee schedule is a
 * pricing property of the platform, not a monthly event, so they
 * read the full LOANS set and do not react to the month filter.
 * All values come live from the loan records and INSIGHTS_DATA.
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

/* fee-rate row per tenure: full schedule (closed) + paid-so-far (active/NPA) */
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

addChart(FEE_SECTION, "The report records ONE 'Platform Fee (₹)' per loan. These charts decompose it by tenure and show its total ₹ cost. The fee is charged as <b>% of the principal returned in each EMI</b> (not on interest, not upfront) — verified to the decimal on every loan that has repaid principal. Whole book: they read every loan and do not react to the month filter.", "fe1", "Platform fee schedule — % of principal returned, by tenure", () => {
  const FS = (window.INSIGHTS_DATA || {}).fee_schedule || {};
  const rows = feeScheduleRows().filter((r) => r.full != null || r.sofar != null);
  const ch = (FS.changes || []).map((c) => `${c.tenure}-month: ${c.from_pct}% → ${c.to_pct}% from ${c.from_month.replace("2026-", "")}`).join(" · ");
  return `Fee = schedule % × the principal each EMI returns: <b>1.0%</b> at 2–3 months, <b>3.0%</b> at 4–6 months, <b>6.0%</b> at 12 months. Mid-book increases: ${ch}. A loan that defaults or forecloses only pays the fees on the principal it actually returned — the unpaid ones are cancelled.`;
}, 320, () => {
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
          return p.marker + p.seriesName + ": <b>" + (v == null ? "–" : v + "% of principal returned") + "</b> <span style='color:#8fa3c0'>(" + (v == null ? "–" : m.perK(v) + " per ₹1,000 lent") + " · " + fmt.format(n) + " loans)</span>";
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

addChart(FEE_SECTION, "Where the fee ₹ actually sits: every tenure's platform-fee total against the interest that tenure actually produced. Whole book.", "fe2", "Fee ₹ vs interest received — the fee's bite by tenure", () => {
  const O = (window.INSIGHTS_DATA || {}).overall_returns || {};
  const share = O.interest_received ? (100 * O.platform_fee) / O.interest_received : null;
  return `Across the book the platform collected <b>${inr(O.platform_fee)}</b> of fees on <b>${inr(O.interest_received)}</b> of interest — <b>${share != null ? share.toFixed(1) : "—"}% of every interest rupee</b>, before NPA losses. The bite is worse on long tenures: fees eat ~26% of the (already thin) interest on 12-month loans vs ~10% on 3-month loans. The bar pair shows the ₹ — hover for the fee share of that tenure's interest.`;
}, 320, () => {
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

addChart(FEE_SECTION, "The same ladder as the returns statement, but in actual rupees with the fee step isolated — the answer to 'what did the fees cost me in total?'. Whole book.", "fe3", "Total ₹ impact of platform fees — gross interest → net", () => {
  const O = (window.INSIGHTS_DATA || {}).overall_returns || {};
  const share = O.interest_received ? (100 * O.platform_fee) / O.interest_received : null;
  const keepShare = O.net_after_npa ? (100 * O.platform_fee) / O.net_after_npa : null;
  return `${inr(O.interest_received)} of interest came in; <b>${inr(O.platform_fee)}</b> (${share != null ? share.toFixed(1) : "—"}%) went to platform fees before a single default; NPA write-offs took <b>${inr(O.npa_loss)}</b> more; <b>${inr(O.net_after_npa)}</b> is what you actually kept. Fees alone cost ~${keepShare != null ? keepShare.toFixed(0) : "—"}% of that final net — every rupee of it on loans that did repay.`;
}, 320, () => {
  const i = LOANS.reduce((s, l) => s + (l.interest_received || 0), 0);
  const f = LOANS.reduce((s, l) => s + (l.platform_fee || 0), 0);
  const n = LOANS.filter((l) => l.status === "NPA").reduce((s, l) => s + (l.npa_amount || 0), 0);
  const net = i - f - n;
  const steps = [
    { name: "Gross interest received", v: +i.toFixed(0), c: GREEN, note: "every interest rupee the book produced" },
    { name: "Platform fees", v: -+f.toFixed(0), c: PURPLE, note: "the one fee line the report discloses — % of principal returned, collected with each EMI" },
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

/* fe4 — the fee went UP for new 4/5-month loans. Decision-relevant: every
   fresh 4–6-month loan now pays 3% where older ones paid 2.3–2.5%, so the
   realised XIRR of new 4/5-month money will sit slightly below the cells'
   historical averages. */
addChart(FEE_SECTION, "The schedule changed twice: 4-month loans disbursed from Apr-2026 and 5-month loans from Jun-2026 now pay the same 3% as 6-month. Whole book, read from the verified fee model (audit F1).", "fe4", "The fee increase — what NEW 4/5-month loans cost vs the old ones", () => {
  const FS = (window.INSIGHTS_DATA || {}).fee_schedule || {};
  const rows = (FS.observed || []).filter((r) => r.tenure === 4 || r.tenure === 5);
  if (!rows.length) return "No era split available.";
  const bits = rows.map((r) => `<b>${r.tenure} mo</b> ${r.era.replace("disbursed ", "disb. ").replace(" (", " → ").replace("%)", "%")}: <b>${r.median_pct.toFixed(1)}%</b> of principal returned (n=${r.loans})`);
  return `New 4/5-month loans carry a <b>higher fee than the ones your realised XIRR is built on</b>: ${bits.join(" · ")}. On ₹1,000 lent the fee is ₹30 at 4–6 months vs ₹23–₹25 before the change — roughly a quarter more fee on the same loan. This is a headwind for new 4/5-month picks, not a rule change about which cells are good: the pricing gap only deepens the case for short money.`;
}, 300, () => {
  const FS = (window.INSIGHTS_DATA || {}).fee_schedule || {};
  const rows = (FS.observed || []).filter((r) => r.tenure === 4 || r.tenure === 5);
  const labels = rows.map((r) => `${r.tenure} mo\n${r.era.includes("<") ? "before " + r.era.match(/\d{4}-\d{2}/)[0].replace("-", "") : "now (3.0%)"}`);
  const data = rows.map((r) => r.median_pct);
  return {
    ...baseOption(),
    tooltip: {
      ...baseOption().tooltip,
      formatter: (ps) => {
        const r = rows[ps[0].dataIndex];
        return `<b>${r.tenure}-month · ${r.era}</b><br/>median fee <b>${r.median_pct.toFixed(2)}%</b> of principal returned<br/><span style='color:#8fa3c0'>n=${r.loans} loans · p10 ${r.p10_pct.toFixed(2)}% / p90 ${r.p90_pct.toFixed(2)}%</span>`;
      },
    },
    xAxis: CAT_AXIS(labels),
    yAxis: VAL_AXIS(false),
    series: [{
      type: "bar", barWidth: "34%",
      data: data.map((v, i) => ({
        value: v,
        itemStyle: { color: rows[i].era.includes("<") ? "#64748b" : "#c084fc", borderRadius: [5, 5, 0, 0] },
      })),
      label: { show: true, position: "top", color: "#8fa3c0", fontSize: 9.5, formatter: (p) => (p.value == null ? "" : p.value.toFixed(1) + "%") },
    }],
  };
});

/* fe5 — the proof. fee vs principal returned, per loan, coloured by tenure.
   Every dot sits on its tenure's slope (fee = rate × principal returned);
   NPA loans stop where they stopped paying — the fee stops with the principal. */
addChart(FEE_SECTION, "The model-check chart: if the fee really is a % of principal returned, every loan's (principal returned, fee) point must sit on its tenure's line. NPA loans (hollow) sit on the same line — they just stop early. This is the empirical basis for the fee model used in every net-XIRR on this dashboard (audit F1/F2).", "fe5", "Proof: fee ₹ vs principal returned — every loan on its tenure's line", () => {
  const colors = { 2: "#34d399", 3: "#60a5fa", 4: "#c084fc", 5: "#fbbf24", 6: "#f87171", 12: "#38bdf8" };
  const byTen = {};
  LOANS.forEach((l) => {
    const pr = l.principal_received || 0, fee = l.platform_fee || 0;
    if (pr <= 0) return;
    const t = l.tenure;
    (byTen[t] = byTen[t] || []).push({ pr, fee, npa: l.status === "NPA" });
  });
  const series = [];
  Object.keys(byTen).sort((a, b) => +a - +b).forEach((t) => {
    const pts = byTen[t];
    const ok = pts.filter((p) => !p.npa), npa = pts.filter((p) => p.npa);
    series.push({
      name: t + " mo", type: "scatter", symbolSize: 5,
      data: ok.map((p) => [p.pr, p.fee]), itemStyle: { color: colors[t] || "#94a3b8", opacity: 0.75 },
    });
    if (npa.length) {
      series.push({
        name: t + " mo NPA", type: "scatter", symbol: "circle", symbolSize: 6,
        data: npa.map((p) => [p.pr, p.fee]),
        itemStyle: { color: "#0f1a2e", borderColor: colors[t] || "#94a3b8", borderWidth: 1.5, opacity: 0.9 },
      });
    }
  });
  const legend = { ...baseOption().legend, data: Object.keys(byTen).map((t) => t + " mo").concat(Object.keys(byTen).map((t) => t + " mo NPA")) };
  return {
    ...baseOption(),
    legend,
    grid: { ...baseOption().grid, left: 56, right: 20, bottom: 44, top: 40 },
    tooltip: {
      ...baseOption().tooltip,
      formatter: (ps) => {
        const p = ps[0];
        if (!p || p.value == null) return "";
        const t = p.seriesName.replace(" NPA", "");
        const pr = p.value[0], fee = p.value[1];
        return `<b>${p.seriesName}</b><br/>principal returned <b>${inr(pr)}</b> · fee <b>${inr(fee)}</b><br/><span style='color:#8fa3c0'>= ${((100 * fee) / pr).toFixed(1)}% of principal returned</span>`;
      },
    },
    xAxis: { type: "value", name: "Principal returned (₹)", axisLabel: { color: "#8fa3c0", fontSize: 10, formatter: (v) => inrCompact(v) }, splitLine: { lineStyle: { color: "#1f2e4a" } } },
    yAxis: { type: "value", name: "Platform fee (₹)", axisLabel: { color: "#8fa3c0", fontSize: 10, formatter: (v) => inrCompact(v) }, splitLine: { lineStyle: { color: "#1f2e4a" } } },
    series,
  };
});