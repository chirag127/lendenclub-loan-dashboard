/* ============================================================
 * ui/unproven.js — "Unproven / thin-evidence" watchlist
 * ------------------------------------------------------------
 * The verdict only ranks tenure × score cells with >= 30 matured
 * loans (strict evidence gate). This panel makes the reverse
 * visible: every pick-band cell with 1–29 matured loans (has some
 * history but not enough to certify) and every cell with zero
 * loans — so the user always knows where the recommendation is
 * silent because of evidence, and where it is silent because no
 * such loan has ever been taken.
 * Classic script (no ES modules — must keep working from file://).
 * ============================================================ */

const UNPROVEN_BANDS = [
  { lo: 700, hi: 725, label: "700–724" },
  { lo: 725, hi: 750, label: "725–749" },
  { lo: 750, hi: 775, label: "750–774" },
  { lo: 775, hi: Infinity, label: "775+" },
];
const UNPROVEN_TENURES = [2, 3, 4, 5, 6, 12];

function unprovenBandOf(score) {
  if (score == null) return null;
  for (const b of UNPROVEN_BANDS) if (score >= b.lo && score < b.hi) return b.label;
  return null;
}

function unprovenCells() {
  const cells = {};
  UNPROVEN_TENURES.forEach((t) => UNPROVEN_BANDS.forEach((b) => {
    cells[`${t}mo·${b.label}`] = { tenure: t, band: b.label, loans: 0, npa: 0, disb: 0, matured: [] };
  }));
  (LOANS || []).forEach((l) => {
    if (!(l.status === "CLOSED" || l.status === "NPA")) return;
    if (!l.disbursement_date || !(l.amount > 0)) return;
    const band = unprovenBandOf(l.score);
    if (!band) return;
    const key = `${Math.round(l.tenure)}mo·${band}`;
    const c = cells[key];
    if (!c) return;
    c.loans += 1;
    if (l.status === "NPA") c.npa += 1;
    c.disb += l.amount;
  });
  return cells;
}

function renderUnprovenWatch() {
  const el = document.getElementById("unproven-watch");
  if (!el) return;
  const cells = unprovenCells();
  const thin = Object.values(cells).filter((c) => c.loans > 0 && c.loans < 30);
  const none = Object.values(cells).filter((c) => c.loans === 0);
  thin.sort((a, b) => b.loans - a.loans);

  const chip = (c) => {
    const cls = c.loans === 0 ? "empty" : (c.npa > 0 ? "risky" : (c.loans >= 10 ? "likely" : ""));
    const note = c.loans === 0
      ? "0 loans — untested"
      : (c.npa > 0 ? `${c.loans} matured · ${c.npa} NPA` : `${c.loans} matured · 0 NPA`);
    return `<div class="uw-cell ${cls}"><b>${c.tenure}mo·${c.band}</b><small>${note}</small></div>`;
  };
  el.innerHTML = `
    <div class="unproven-watch">
      <div class="uw-head">
        <h4>🧪 Unproven sections — where the evidence is still too thin to rank</h4>
        <p>The verdict only certifies cells with <b>≥ 30 matured loans</b>. These cells have some history but are <b>not yet ranked</b> — lending into them is a bet on a hint, not a proven pattern. Blue left-edge = thin but clean (0 defaults so far). Amber = thin and already showing defaults. Grey = no such loan has ever been taken — treat as untested territory, not "safe".</p>
      </div>
      <div class="uw-grid">${thin.map(chip).join("")}${none.map(chip).join("")}</div>
      <p class="uw-foot"><b>How to use this:</b> the highest-value watch is <b>2-mo × 725–749 — 28 matured loans, 0 defaults</b>, one short of the evidence bar; if it keeps paying clean it will be certified as a Core-grade cell next report. The 775+ cells and the empty 12-month band are where you have <b>no evidence either way</b> — smaller tickets, smaller slices, and re-check next month rather than assuming they are good or bad. Matured basis (CLOSED + NPA only) so still-active loans never flatter the count.</p>
    </div>`;
}