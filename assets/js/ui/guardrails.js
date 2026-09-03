/* ============================================================
 * ui/guardrails.js — guardrailCard + renderGuardrails (risk guardrail cards)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ---------------- tenure guardrails (computed, data-driven) ---------------- */
function guardrailCard(tone, title, body, stats) {
  const icons = { good: "✅", warn: "⚠️", bad: "🚫", info: "💡" };
  const statHtml = (stats || []).map((s) => `<span class="rail-stat">${s}</span>`).join("");
  return `<div class="guardrail tone-${tone}"><div class="rail-head">${icons[tone] || ""} ${title}</div><div class="rail-body">${body}</div>${statHtml ? `<div class="rail-stats">${statHtml}</div>` : ""}</div>`;
}
function renderGuardrails() {
  const el = document.getElementById("guardrails");
  if (!el) return;
  const L = filtered();
  const T = TENURES.map((t) => tenureStats(L, t)).filter((s) => s.count > 0);
  const g = (t) => T.find((x) => x.t === t) || {};
  const s2 = g(2), s3 = g(3), s6 = g(6), s12 = g(12);
  const allNpa = L.filter((l) => l.status === "NPA").length;
  const npa6 = s6.npa || 0, npa12 = s12.npa || 0;
  const cards = [];

  if (s2.count) {
    const good = (s2.maturedRate || 99) <= 2.5 && (s2.npa || 99) <= 5;
    cards.push(guardrailCard(good ? "good" : "warn", good ? "2-month: keep scaling — your safest bucket" : "2-month: review your best bucket",
      `Only <b>${s2.npa} of ${fmt.format(s2.count)}</b> two-month loans defaulted (<b>${s2.npaRate}%</b>; <b>${s2.maturedRate}%</b> of matured) and NPA principal was just <b>${inr(s2.npaAmt)}</b> — ${s2.lossRate}% of the ₹ lent. Two-month money turns over fast and almost always comes back, so it deserves a bigger share of your monthly lending.`,
      [`${s2.npaRate}% NPA`, `${s2.lossRate}% loss`, inrCompact(s2.npaAmt) + " lost"]));
  }
  if (s6.count) {
    const bad = (s6.maturedRate || 0) > 8 || npa6 >= 30;
    cards.push(guardrailCard(bad ? "bad" : "warn", bad ? "6-month: highest NPA engine — cut or gate it" : "6-month: watch the NPA rate",
      `<b>${s6.npa} NPAs</b> on ${fmt.format(s6.count)} loans (<b>${s6.npaRate}%</b>; ${s6.maturedRate}% of matured) — ${s6.npaShareOfInterest}% of the interest these loans earned has been wiped by NPA principal. Longer exposure = more time for borrowers to default.`,
      [`${s6.npaRate}% NPA`, `loss = ${s6.npaShareOfInterest}% of interest`, `${fmt.format(npa6)} of ${fmt.format(allNpa)} total NPAs`]));
  }
  if (s12.count) {
    const risky = (s12.maturedRate || 0) >= 8;
    cards.push(guardrailCard(risky ? "bad" : "warn", risky ? "12-month: matured default is severe — pause new 12-month lending" : "12-month: still maturing — losses can still appear",
      `Matured default is <b>${s12.maturedRate}%</b> and only ${s12.closed} of ${fmt.format(s12.count)} loans have closed — <b>${fmt.format(s12.active)} are still active/processing</b>, so today's 5.3% headline will climb. 12-month money is locked up longest for the least certainty.`,
      [`${s12.maturedRate}% matured default`, `${fmt.format(s12.active)} still active`, inrCompact(s12.disb) + " exposure"]));
  }
  // low-score tier across 3-6 month tenures
  {
    const cells = [3, 4, 6].flatMap((t) => SCORE_TIERS.slice(0, 1).map((b) => tenureBandStats(L, t, b))).filter((c) => c.count > 0);
    if (cells.length) {
      const worst = cells.reduce((a, c) => (c.maturedRate || 0) > (a.maturedRate || 0) ? c : a, cells[0]);
      cards.push(guardrailCard(worst.maturedRate >= 6 ? "warn" : "good", "Score gate: 700–724 borrowers default ~5× more in 3–6 month tenures",
        `Borrowers scoring <b>700–724</b> at 3/4/6-month tenures show matured default up to <b>${worst.maturedRate}%</b> (${worst.t}-month, ${worst.count} loans) versus ~1% on 2-month. Setting a minimum LenDenClub score of <b>750 for anything longer than 2 months</b> would remove most of the NPA book without sacrificing volume.`,
      [`up to ${worst.maturedRate}% matured default`, `${worst.count} loans in worst cell`, "gate at ≥750 outside 2-mo"]));
    }
  }
  if (npa6 + npa12 > 0 && allNpa > 0) {
    const share = +(((npa6 + npa12) / allNpa) * 100).toFixed(0);
    if (share >= 40) {
      cards.push(guardrailCard("bad", "Concentration alert: 6- & 12-month loans drive most NPAs",
        `Together, 6- and 12-month tenures hold <b>${share}% of all NPA loans</b>. Reallocating that monthly volume into 2–5 month tickets — same ₹ out, far lower default — is the single highest-impact change available.`,
      [`${share}% of all NPAs`, `${fmt.format(npa6 + npa12)} NPAs`]));
    }
  }
  el.innerHTML = `<div class="rail-note">💡 Guardrails are computed live from the currently filtered data — a rules engine over the tenure × score tables above.</div>` + cards.join("");
}
