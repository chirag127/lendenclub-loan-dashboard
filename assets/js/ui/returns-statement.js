/* ============================================================
 * ui/returns-statement.js — renderReturnsStatement (P&L + ROI panels)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ---------------- P&L returns statement (computed) ---------------- */
function renderReturnsStatement() {
  const el = document.getElementById("returns-statement");
  if (!el) return;
  const L = filtered();
  const disb = L.reduce((s, l) => s + (l.amount || 0), 0);
  const recv = L.reduce((s, l) => s + (l.total_received || 0), 0);
  const prin = L.reduce((s, l) => s + (l.principal_received || 0), 0);
  const intr = L.reduce((s, l) => s + (l.interest_received || 0), 0);
  const fee = L.reduce((s, l) => s + (l.platform_fee || 0), 0);
  const npaLoss = L.filter((l) => l.status === "NPA").reduce((s, l) => s + (l.npa_amount || 0), 0);
  const closed = L.filter((l) => l.status === "CLOSED");
  const cIntr = closed.reduce((s, l) => s + (l.interest_received || 0), 0);
  const cFee = closed.reduce((s, l) => s + (l.platform_fee || 0), 0);
  const outstanding = disb - prin - npaLoss;
  const net = intr - fee;
  const netAll = net - npaLoss;
  const pct = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(2) + "%" : "—");
  const row = (k, v, cls) => `<div class="rs-row"><span class="rs-k">${k}</span><span class="rs-v ${cls || ""}">${v}</span></div>`;
  const pnl = `
    <div class="rs-block rs-block-pnl"><h4>Profit &amp; loss statement</h4>
      ${row("Total disbursed (invested)", inr(disb))}
      ${row("Total received", inr(recv))}
      ${row("&nbsp;&nbsp;→ Principal repaid", inr(prin))}
      ${row("&nbsp;&nbsp;→ Interest earned", inr(intr), "rs-good")}
      ${row("Platform / facilitation fees", "− " + inr(fee), "rs-bad")}
      ${row("NPA principal written off", "− " + inr(npaLoss), "rs-bad")}
      ${row("Net earnings (interest − fees)", inr(net), "rs-good")}
      ${row("Net after NPA loss", inr(netAll), netAll >= 0 ? "rs-good" : "rs-bad")}
      ${row("Outstanding principal at risk", inr(outstanding), "rs-warn")}
    </div>`;
  const roi = `
    <div class="rs-block"><h4>Return on invested capital</h4>
      ${row("Gross ROI (interest ÷ disbursed)", pct(intr, disb))}
      ${row("Net ROI (after fees)", pct(net, disb))}
      ${row("Net ROI after NPA loss", pct(netAll, disb))}
      ${row("True annualized (XIRR — monthly EMI timing)", (window.INSIGHTS_DATA && window.INSIGHTS_DATA.xirr_returns ? window.INSIGHTS_DATA.xirr_returns.portfolio_net.toFixed(1) + "%/yr net" : "—"), "rs-good")}
      ${row("Net XIRR incl. all NPA defaults (success + NPA)", (window.INSIGHTS_DATA && window.INSIGHTS_DATA.xirr_returns && window.INSIGHTS_DATA.xirr_returns.portfolio_net_all != null ? "≈ " + window.INSIGHTS_DATA.xirr_returns.portfolio_net_all.toFixed(1) + "%/yr net" : "—"), "rs-warn")}
      ${row("Active book — projected net XIRR (expected)", (window.INSIGHTS_DATA && window.INSIGHTS_DATA.active_xirr && window.INSIGHTS_DATA.active_xirr.portfolio_expected != null ? "≈ " + window.INSIGHTS_DATA.active_xirr.portfolio_expected.toFixed(1) + "%/yr net" : "—"), "rs-good")}
      ${row("Realized on closed loans only", pct(cIntr - cFee, closed.reduce((s, l) => s + (l.amount || 0), 0)))}
      ${row("Fees as % of interest earned", pct(fee, intr))}
      ${row("NPA loss as % of disbursed", pct(npaLoss, disb))}
    </div>`;
  const TEN = [2, 3, 4, 5, 6, 12];
  const rows = TEN.map((t) => {
    /* Completed cycles only: CLOSED + NPA loans. ACTIVE/PROCESSING loans are excluded
       because their receipts are partial (interest still arriving) and their future NPA
       write-offs aren't booked yet — pooling them with completed loans distorts the
       realized return in both directions (flatters 6/12-mo, understates 2/4/5-mo). */
    const r = L.filter((l) => l.tenure === t && (l.status === "CLOSED" || l.status === "NPA") && l.disbursement_date);
    if (!r.length) return null;
    const d = r.reduce((s, l) => s + (l.amount || 0), 0);
    const i = r.reduce((s, l) => s + (l.interest_received || 0), 0);
    const f = r.reduce((s, l) => s + (l.platform_fee || 0), 0);
    const n = r.reduce((s, l) => s + (l.npa_amount || 0), 0);
    const netR = i - f - n;
    const perCycle = d ? 100 * netR / d : 0;
    return { t, n: r.length, perCycle, ann: perCycle * (12 / t) };
  }).filter(Boolean);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.ann)));
  const rowH = rows.map((r) => {
    const neg = r.ann < 0;
    const w = Math.min(100, Math.max(1.5, (100 * Math.abs(r.ann)) / maxAbs));
    return `<div class="rs-tenrow"><span class="rs-ten">${r.t} mo</span><span class="rs-tenbar"><i class="${neg ? "neg" : ""}" style="width:${w}%"></i></span><span class="rs-tenv ${neg ? "neg" : ""}" title="${r.n} matured loans · ${r.perCycle.toFixed(2)}% net per completed cycle (interest − fees − NPA)">${neg ? "−" : ""}${Math.abs(r.ann).toFixed(1)}%/yr</span></div>`;
  }).join("");
  const perNotes = rows.map((r) => `${r.t}-mo ${r.perCycle.toFixed(2)}%/cycle`).join(" · ");
  const ten = `
    <div class="rs-block"><h4>Annualized net return by tenure — completed cycles (fees &amp; NPA deducted)</h4>
      ${rowH}
      <div class="rs-note">Realized on <b>completed cycles only</b> (CLOSED + NPA loans — active &amp; unfunded excluded, their earnings aren't final yet), simple-annualized by turnover. Net per completed cycle: ${perNotes}. As active loans finish, 2/4/5-mo typically edge up — while 6/12-mo tend to fall once their defaults are booked: completed 12-mo cycles are <b>net-negative</b> (only ~25% of contracted interest collected, before write-offs). The projected panel (right) and XIRR charts cover the full lifecycle.</div>
    </div>`;

  /* ---- projected full-cycle (everything included) ---- */
  const activeL = L.filter((l) => l.status === "ACTIVE");
  const feeRate = {};
  TENURES.forEach((t) => {
    const c = L.filter((l) => l.status === "CLOSED" && l.tenure === t);
    const d = c.reduce((s, l) => s + (l.amount || 0), 0);
    feeRate[t] = d ? c.reduce((s, l) => s + (l.platform_fee || 0), 0) / d : 0;
  });
  const matRate = {};
  TENURES.forEach((t) => {
    const m = L.filter((l) => l.tenure === t && (l.status === "CLOSED" || l.status === "NPA"));
    matRate[t] = m.length ? (100 * m.filter((l) => l.status === "NPA").length) / m.length : 0;
  });
  const collRate = {};
  TENURES.forEach((t) => {
    const c = L.filter((l) => l.status === "CLOSED" && l.tenure === t);
    const ci = c.reduce((s, l) => s + ((l.total_repayment || 0) - (l.amount || 0)), 0);
    collRate[t] = ci ? 100 * c.reduce((s, l) => s + (l.interest_received || 0), 0) / ci : 70;
  });
  let futInt = 0, futFee = 0;
  const outByT = {};
  activeL.forEach((l) => {
    const t = l.tenure;
    futInt += Math.max(0, (l.total_repayment || 0) - (l.amount || 0) - (l.interest_received || 0));
    futFee += Math.max(0, (l.amount || 0) * (feeRate[t] || 0.0172) - (l.platform_fee || 0));
    outByT[t] = (outByT[t] || 0) + (l.amount || 0) - (l.principal_received || 0);
  });
  const outstandingT = Object.keys(outByT).reduce((s, t) => s + outByT[t], 0);
  let expLoss = 0, wLoss = 0, futIntAdj = 0;
  Object.keys(outByT).forEach((t) => {
    expLoss += outByT[t] * (matRate[t] || 0) / 100;
    wLoss += outByT[t];
    const tFut = activeL.filter((l) => l.tenure === +t).reduce((s, l) => s + Math.max(0, (l.total_repayment || 0) - (l.amount || 0) - (l.interest_received || 0)), 0);
    futIntAdj += tFut * ((collRate[t] || 100) / 100);
  });
  const defRate = wLoss ? 100 * expLoss / wLoss : 0;
  const projectedNet = netAll + futIntAdj * (1 - defRate / 100) - futFee - expLoss;
  const projRoi = disb ? (100 * projectedNet / disb) : 0;
  const scen = (dr) => { const l = outstandingT * dr; return netAll + futIntAdj * (1 - dr) - futFee - l; };
  const scenNet = [0, defRate / 100, 0.2, 0.35].map((dr) => scen(dr));
  const scenRoi = scenNet.map((n) => (disb ? (100 * n / disb).toFixed(1) : "—"));
  const proj = `
    <div class="rs-block rs-block-proj"><h4>Projected full-cycle — everything included</h4>
      ${row("Active-book outstanding at risk", inr(outstandingT), "rs-warn")}
      ${row("Future interest (contracted)", inr(futInt), "rs-good")}
      ${row("Collection-adjusted (early-repayment rebates)", inr(futIntAdj), "rs-warn")}
      ${row("Future platform fees", "− " + inr(futFee), "rs-bad")}
      ${row("Expected future NPA loss (historical " + defRate.toFixed(1) + "% default)", "− " + inr(expLoss), "rs-bad")}
      ${row("Expected full-cycle net (realized + projected)", inr(projectedNet), "rs-good")}
      ${row("Expected full-cycle net ROI", pct(projectedNet, disb), "rs-good")}
      <div class="rs-note">EMIs are fully counted — received = every EMI collected to date (₹22.6L). Future interest is haircut by your own collection rates on closed loans (2-mo ${collRate[2].toFixed(0)}%, 6-mo ${collRate[6].toFixed(0)}%, 12-mo ${collRate[12].toFixed(0)}%) because prepayments earn interest rebates. Scenarios — net ROI if active loans default at: 0% <b>${scenRoi[0]}%</b> · historical ${defRate.toFixed(1)}% <b>${scenRoi[1]}%</b> · 20% <b>${scenRoi[2]}%</b> · 35% <b>${scenRoi[3]}%</b>.</div>
    </div>`;
  el.innerHTML = `<div class="rs-grid">${pnl}${roi}${ten}${proj}</div>`;
}
