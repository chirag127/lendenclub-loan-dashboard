/* ============================================================
 * ui/loan-picks.js — TIER_META + renderLoanPicks (ranking panel HTML)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ---------------- highest-XIRR loan picks (from scripts/ldc/insights.py) ---------------- */
const TIER_META = {
  core: { label: "Core", color: "#22c55e" },
  support: { label: "Support", color: "#3b82f6" },
  gate: { label: "Gate", color: "#f59e0b" },
  avoid: { label: "Avoid", color: "#ef4444" },
};
function renderLoanPicks() {
  const el = document.getElementById("loan-picks");
  if (!el) return;
  const p = window.INSIGHTS_DATA && window.INSIGHTS_DATA.xirr_picks;
  if (!p || !p.cells || !p.cells.length) { el.style.display = "none"; return; }
  const rowsHtml = p.cells.map((c, idx) => {
    const tm = TIER_META[c.tier] || TIER_META.gate;
    const positive = (c.xirr_all || 0) > 0 && c.rec_pct > 0;
    const bar = positive ? `<span class="lp-bar"><i style="width:${Math.max(2, Math.min(100, c.rec_pct * 2.2))}%"></i></span>` : `<span class="lp-bar"></span>`;
    const rec = positive ? `₹${(c.rec_pct * 10).toFixed(0)}<small>/₹1,000</small>` : `<span class="lp-zero">₹0</span>`;
    const suc = c.xirr != null ? `<small class="lp-muted">success-only ${c.xirr.toFixed(1)}%</small>` : "";
    const defCol = c.def_rate > 10 ? "lp-defbad" : c.def_rate > 5 ? "lp-defwarn" : "lp-defgood";
    return `<div class="lp-row lp-${c.tier}">` +
      `<span class="lp-rank">${idx + 1}</span>` +
      `<span class="lp-cell">${c.tenure} mo <i>·</i> ${c.band}</span>` +
      `<span class="lp-xirr">${c.xirr_all == null ? "—" : c.xirr_all.toFixed(1)}%/yr ${suc}</span>` +
      `<span class="lp-stat ${defCol}">${c.def_rate.toFixed(1)}% default</span>` +
      `<span class="lp-stat">${fmt.format(c.matured)} matured</span>` +
      `<span class="lp-tier" style="color:${tm.color};border-color:${tm.color}44;background:${tm.color}1a">${tm.label}</span>` +
      bar + rec + `</div>`;
  }).join("");
  const tp = p.tier_pcts || {};
  const coreN = p.cells.filter((c) => c.tier === "core").length;
  const supN = p.cells.filter((c) => c.tier === "support").length;
  el.innerHTML = `
    <div class="lp-head">
      <h4>🏆 Highest-XIRR loan picks — where your own completed loans say to lend next</h4>
      <div class="lp-sub">Ranked by <b>net XIRR incl. every default</b> per tenure × score cell (matured loans only, ≥ ${p.min_matured} completed loans, platform fees deducted, zero-recovery NPAs booked as total losses). Avoid cells lose money after defaults — they get <b>₹0</b> of the recommendation. Cells with fewer than ${p.min_matured} matured loans aren't ranked yet (too little evidence).</div>
    </div>
    <div class="lp-sum">
      <span class="lp-chip" style="color:#22c55e;border-color:#22c55e44;background:#22c55e1a">🟢 Core ${tp.core ? tp.core.toFixed(0) : 0}% of lending</span>
      <span class="lp-chip" style="color:#3b82f6;border-color:#3b82f644;background:#3b82f61a">🔵 Support ${tp.support ? tp.support.toFixed(0) : 0}%</span>
      ${tp.gate ? `<span class="lp-chip" style="color:#f59e0b;border-color:#f59e0b44;background:#f59e0b1a">🟡 Gate ${tp.gate.toFixed(0)}% (conditional)</span>` : ""}
      <span class="lp-chip" style="color:#ef4444;border-color:#ef444444;background:#ef44441a">🔴 Avoid ₹0 — net-negative</span>
      <span class="lp-muted" style="margin-left:auto">${coreN} core + ${supN} support cells carry the whole recommendation</span>
    </div>
    <div class="lp-list">${rowsHtml}</div>
    <div class="lp-note">Allocation rule (computed by <code>scripts/ldc/insights.py → xirr_picks()</code>): weight = net XIRR × (100 − matured default)/100 — core cells weighted 2×, support 1×, gate 0.2×, avoid 0 — normalized to 100% of monthly lending. Example read: the top pick takes ~${(p.cells[0] && p.cells[0].rec_pct * 10).toFixed(0)} of every ₹1,000 you lend next month.</div>`;
}
