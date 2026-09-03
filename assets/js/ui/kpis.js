/* ============================================================
 * ui/kpis.js — renderKPIs + weightedRate (KPI cards)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ---------------- KPI cards ---------------- */
function renderKPIs() {
  const L = filtered();
  const s = SUMMARY.summary;
  const st = SUMMARY.stats;
  const totalAmt = L.reduce((a, l) => a + (l.amount || 0), 0);
  const totalRecv = L.reduce((a, l) => a + (l.total_received || 0), 0);
  const totalInt = L.reduce((a, l) => a + (l.interest_received || 0), 0);
  const totalFee = L.reduce((a, l) => a + (l.platform_fee || 0), 0);
  const totalPnl = L.reduce((a, l) => a + (l.pnl || 0), 0);
  const npaCount = L.filter(isNPA).length;
  const dpdCount = L.filter((l) => (l.dpd || 0) > 0).length;
  const cards = [
    { label: "Total disbursed", value: inrCompact(totalAmt), sub: inr(totalAmt), cls: "blue" },
    { label: "Total received", value: inrCompact(totalRecv), sub: inr(totalRecv), cls: "good" },
    { label: "Interest earned", value: inrCompact(totalInt), sub: inr(totalInt), cls: "good" },
    { label: "Net P&L", value: inrCompact(totalPnl), sub: inr(totalPnl), cls: totalPnl >= 0 ? "good" : "bad" },
    { label: "Platform fees", value: inrCompact(totalFee), sub: inr(totalFee) },
    { label: "NPA amount", value: inrCompact(s.npa_amount), sub: npaCount + " NPA loans", cls: "bad" },
    { label: "Principal outstanding", value: inrCompact(s.principal_outstanding), sub: "still active", cls: "blue" },
    { label: "Avg interest rate", value: avg(L.map((l) => l.interest_rate).filter((x) => x != null)).toFixed(2) + "%", sub: "weighted avg " + weightedRate(L).toFixed(2) + "%", cls: "amber" },
    { label: "Active loans", value: fmt.format(L.filter((l) => l.status === "ACTIVE").length), sub: "repaying now", cls: "blue" },
    { label: "Closed loans", value: fmt.format(L.filter((l) => l.status === "CLOSED").length), sub: "fully repaid", cls: "good" },
    { label: "NPA loans", value: fmt.format(npaCount), sub: pct((npaCount / (L.length || 1)) * 100) + " of book", cls: "bad" },
    { label: "Loans with DPD > 0", value: fmt.format(dpdCount), sub: "days past due", cls: dpdCount ? "bad" : "good" },
  ];
  const el = document.getElementById("kpis");
  el.innerHTML = cards.map((c) => `<div class="kpi ${c.cls || ""}"><div class="kpi-label">${c.label}</div><div class="kpi-value">${c.value}</div><div class="kpi-sub">${c.sub}</div></div>`).join("");
}

function weightedRate(L) {
  let num = 0, den = 0;
  L.forEach((l) => { if ((l.amount || 0) > 0 && l.interest_rate != null) { num += l.amount * l.interest_rate; den += l.amount; } });
  return den ? num / den : 0;
}
