/* ============================================================
 * ui/reasons.js — renderReasons: the compact lend-only verdict strip
 * ------------------------------------------------------------
 * Renders "🟢 Lend these / 🔵 Keep small / 🔴 Never lend" as chips,
 * computed live from the same xirr_picks cells the ranking panels use.
 * The long-form "What the data shows / Why it happens" narratives
 * live in the insight-card engine (ui/cards.js + cards-insights.js);
 * this file deliberately does NOT repeat them — the topic grid was
 * removed in v26 because it duplicated those cards verbatim.
 * Classic script (no ES modules — must keep working from file://).
 * ============================================================ */

function renderReasons() {
  const el = document.getElementById("reasons");
  if (!el) return;
  const INS = window.INSIGHTS_DATA || {};
  const P = INS.xirr_picks || {};
  const X = INS.xirr_returns || {};
  const cells = (P.cells || []).slice();
  if (!cells.length) { el.innerHTML = `<div class="v-foot">Verdict unavailable — the data file is missing or stale. Rebuild with <code>python scripts/build.py</code>.</div>`; return; }

  const coreCells = cells.filter((c) => c.tier === "core").sort((a, b) => b.rec_pct - a.rec_pct);
  const supCells = cells.filter((c) => c.tier === "support" && c.xirr_all > 0).sort((a, b) => b.rec_pct - a.rec_pct);
  const noCells = cells.filter((c) => c.xirr_all != null && c.xirr_all <= 0);
  const chipHtml = (c) => `<span class="v-chip" title="${c.tenure} mo · ${c.band}: net ${pct(c.xirr_all)}/yr incl. all defaults, ${pct(c.def_rate)} matured default">${c.tenure} mo · ${c.band} <b>₹${(c.rec_pct * 10).toFixed(0)}</b>/₹1k</span>`;
  const tp = P.tier_pcts || {};
  const aX = X.portfolio_net_all;

  el.innerHTML = `
    <div class="verdict">
      <div class="verdict-block v-lend">
        <div class="v-hdr">🟢 Lend these — your money engine</div>
        <div class="v-sub">The Core cells of the recommendation, in order. Lend them every month; per-₹1,000 is the share of each ₹1,000 the data says to put there.</div>
        <div class="v-chips">${coreCells.map(chipHtml).join("")}</div>
      </div>
      <div class="verdict-block v-little">
        <div class="v-hdr">🔵 Keep these small</div>
        <div class="v-sub">Profitable Support cells — fine to take, but each gets only a small slice of the allocation.</div>
        <div class="v-chips">${supCells.map(chipHtml).join("")}</div>
      </div>
      <div class="verdict-block v-no">
        <div class="v-hdr">🔴 Never lend these — they lose money once defaults are counted</div>
        <div class="v-sub">Net XIRR ≤ 0%/yr after fees and every default. In plain terms: no 12-month, no 6-month below score 750, and watch the mid-score 4-month cell (small sample).</div>
        <div class="v-chips">${noCells.map((c) => `<span class="v-chip no" title="${c.tenure} mo · ${c.band}: ${pct(c.def_rate)} matured default">${c.tenure} mo · ${c.band} <b>${pct(c.xirr_all)}</b></span>`).join("")}</div>
      </div>
    </div>
    <div class="v-foot">Split of your next ₹1,000, computed by <code>scripts/ldc/insights.py → xirr_picks()</code>: Core <b>${tp.core != null ? tp.core.toFixed(0) + "%" : "—"}</b> · Support <b>${tp.support != null ? tp.support.toFixed(0) + "%" : "—"}</b> · everything else <b>₹0</b>. Whole-book net XIRR incl. every default: <b>${aX != null ? pct(aX) + "/yr" : "—"}</b>. The filters above do not change this section.</div>`;
}