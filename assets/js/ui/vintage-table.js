/* ============================================================
 * ui/vintage-table.js — renderVintageTable
 * ------------------------------------------------------------
 * A plain HTML ledger (no chart library) under the vc1–vc5
 * charts: every origination cohort with >= 10 matured loans and
 * ALL of its percentages side by side, straight from the Python
 * pipeline (INSIGHTS_DATA.vintage — nothing recomputed here):
 *     NPA rate over the loan's life  AND  per year (x 12 / the
 *     cohort's average tenure), the same two views for the rupee
 *     loss, then the money ledger — rupees lent (matured basis
 *     and whole cohort), and net kept after everything (interest
 *     received to date - platform fees - NPA principal booked)
 *     as ₹ and as % of ₹ lent, over the cohort term and per year.
 * ◌ = cohort still >10% active: its net is realized-to-date only
 * and can still degrade. Whole book — filters above do not apply.
 * ============================================================ */

function renderVintageTable() {
  const el = document.getElementById("vintage-table");
  if (!el) return;
  const vg = (window.INSIGHTS_DATA && INSIGHTS_DATA.vintage) || null;
  if (!vg || !vg.cohorts || !vg.cohorts.length) {
    el.innerHTML = `<div class="dm-note">Vintage ledger unavailable — no data.</div>`;
    return;
  }
  const SHORT = {
    "2025-12": "Dec 25", "2026-01": "Jan 26", "2026-02": "Feb 26", "2026-03": "Mar 26",
    "2026-04": "Apr 26", "2026-05": "May 26", "2026-06": "Jun 26", "2026-07": "Jul 26",
  };
  const pct = (v) => (v == null ? "–" : v.toFixed(1) + "%");
  const shade = (v) => (v == null ? "dm-na" : v >= 10 ? "dm-bad" : v >= 5 ? "dm-warn" : "dm-ok");
  const netShade = (v) => (v == null ? "dm-na" : v < 0 ? "dm-bad" : v < 5 ? "dm-warn" : "dm-ok");
  const cell = (v, cls, title) => `<td class="dm-cell ${cls || ""}"${title ? ` title="${title}"` : ""}><b>${v}</b></td>`;
  const moneyCell = (v, cls, title) => `<td class="dm-cell ${cls || ""}"${title ? ` title="${title}"` : ""}><b>${v}</b></td>`;

  const cs = vg.cohorts;
  let html = `<div class="dm-head"><h4>📋 Vintage ledger — every origination cohort, every percentage</h4>
    <div class="lp-sub">Each origination month's full set of numbers at once, straight from the pipeline (audit Z1–Z5). Rates are <b>matured-basis</b> (CLOSED + NPA loans): <b>over the loan's life</b> and <b>annualized per year</b> (× 12 ÷ the cohort's average tenure — same turnover convention as the rest of the dashboard). The money side is realized to date over the <b>whole cohort</b> (active loans included): net kept = interest received − platform fees − NPA principal booked, so every default and fee is already deducted before the net % is printed. Colour = life-of-loan severity (green low, amber 5–10%, red ≥ 10% or net-negative). <b>Whole book — the filters above do not change this table.</b></div></div>`;
  html += `<div class="dm-wrap"><table class="dm nyt vt"><thead><tr>
      <th class="nyt-lab">Cohort</th>
      <th>Matured</th>
      <th>NPA</th>
      <th>NPA rate · loan life</th>
      <th>NPA rate · per year</th>
      <th>₹ lent (matured)</th>
      <th>₹ loss · loan life</th>
      <th>₹ loss · per year</th>
      <th>Net kept ₹ (after everything)</th>
      <th>Net % of ₹ lent</th>
      <th>Net % · per year</th>
    </tr></thead><tbody>`;

  let tMat = 0, tNpa = 0, tDisbM = 0, tNpaAmt = 0, tNet = 0, tDisb = 0, tTenM = 0;
  cs.forEach((c) => {
    const label = (SHORT[c.month] || c.month) + (c.open ? " ◌" : "");
    const openT = c.open ? "more than 10% of this cohort is still ACTIVE — net kept is realized to date and can still degrade" : "settled cohort";
    tMat += c.matured; tNpa += c.npa; tDisbM += c.disb_m; tNpaAmt += c.npa_amt_m;
    tNet += c.net; tDisb += c.disb; tTenM += c.avg_tenure_m * c.matured;
    const netInr = inr(Math.round(c.net));
    html += `<tr class="${c.open ? "vt-open" : ""}">
      <td class="dm-cell nyt-lab" title="${openT}"><b>${label}</b><span>${c.open ? "◌ " + fmt.format(c.active) + " active" : "settled · avg tenure " + c.avg_tenure_m + " mo"}</span></td>
      <td class="dm-cell nyt-num" title="CLOSED + NPA loans of this cohort"><b>${fmt.format(c.matured)}</b><span>of ${fmt.format(c.loans)} loans</span></td>
      <td class="dm-cell nyt-num"><b>${fmt.format(c.npa)}</b><span>NPA loans</span></td>
      ${cell(pct(c.rate_life), shade(c.rate_life), "NPA loans ÷ matured loans of this cohort, over the loan's whole term")}
      ${cell(pct(c.rate_ann), shade(c.rate_ann), "same rate × 12 ÷ the cohort's average tenure — per year of lending")}
      ${moneyCell(inr(c.disb_m), "", "rupees disbursed on this cohort's matured (CLOSED + NPA) loans")}
      ${cell(pct(c.loss_life), shade(c.loss_life), "NPA principal (unrecovered) ÷ ₹ lent on the same matured loans")}
      ${cell(pct(c.loss_ann), shade(c.loss_ann), "loss × 12 ÷ the cohort's average tenure — per year of lending")}
      ${moneyCell(netInr, c.net < 0 ? "dm-bad" : c.net < 1000 ? "dm-warn" : "dm-ok", "interest received to date − platform fees − NPA principal booked, across the whole cohort (active included)")}
      ${cell(pct(c.net_pct), netShade(c.net_pct), "net kept ÷ ₹ lent over the whole cohort, realized to date")}
      ${cell(pct(c.net_ann), netShade(c.net_ann), "net % × 12 ÷ the cohort's average tenure — what the cohort earns per year of lending, realized to date")}
    </tr>`;
  });

  const totRate = 100 * tNpa / tMat;
  const totLoss = 100 * tNpaAmt / tDisbM;
  const totNetPct = 100 * tNet / tDisb;
  const totTen = tTenM / tMat;
  const totNetAnn = totNetPct * 12 / totTen;
  html += `<tr class="nyt-total nyt-grand">
    <td class="dm-cell nyt-lab" title="sum of the rows above (cohorts with ≥ 10 matured loans)"><b>All cohorts ≥ 10 matured</b><span>avg tenure ${totTen.toFixed(1)} mo</span></td>
    <td class="dm-cell nyt-num"><b>${fmt.format(tMat)}</b><span>matured</span></td>
    <td class="dm-cell nyt-num"><b>${fmt.format(tNpa)}</b><span>NPA</span></td>
    ${cell(pct(totRate), shade(totRate), "blended NPA rate over the loan's life")}
    ${cell(pct(totRate * 12 / totTen), shade(totRate * 12 / totTen), "blended NPA rate per year")}
    ${moneyCell(inr(tDisbM), "", "₹ lent on matured loans across the rows")}
    ${cell(pct(totLoss), shade(totLoss), "blended ₹ loss over the loan's life")}
    ${cell(pct(totLoss * 12 / totTen), shade(totLoss * 12 / totTen), "blended ₹ loss per year")}
    ${moneyCell(inr(Math.round(tNet)), tNet < 0 ? "dm-bad" : "dm-ok", "net kept across the rows, realized to date")}
    ${cell(pct(totNetPct), netShade(totNetPct), "net kept ÷ ₹ lent, realized to date")}
    ${cell(pct(totNetAnn), netShade(totNetAnn), "net % per year by the blended average tenure")}
  </tr>`;
  html += `</tbody></table></div>`;
  html += `<div class="dm-key">
    <span class="dm-k dm-ok">low</span><span class="dm-k dm-warn">5–10%</span><span class="dm-k dm-bad">≥ 10% or net-negative</span>
    <span class="dm-note">◌ = still >10% active — its net is realized-to-date only and can still degrade. Read the total row first: blended over the cohorts with evidence, the book keeps <b>${pct(totNetAnn)} per year</b> after fees and every default booked.</span>
  </div>`;
  el.innerHTML = html;
}
