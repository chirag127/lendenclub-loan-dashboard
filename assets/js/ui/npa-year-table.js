/* ============================================================
 * ui/npa-year-table.js — renderNpaYearTable
 * ------------------------------------------------------------
 * A plain HTML ledger (no chart library) of the same rows the
 * ny1–ny3 charts plot, straight from the Python pipeline
 * (INSIGHTS_DATA.npa_by_year). Every bucket is shown twice:
 *   over the loan's life (matured basis)  AND  annualized per
 *   year (× 12/tenure, money recycles). Count side and rupee
 *   side are both here, so 2025 vs 2026 × each tenure can be
 *   read cell by cell. Whole book — the filters above do not
 *   change this table (slicing the window would break the
 *   by-year attribution).
 * ============================================================ */

function renderNpaYearTable() {
  const el = document.getElementById("npa-year-table");
  if (!el) return;
  const ny = (window.INSIGHTS_DATA && INSIGHTS_DATA.npa_by_year) || null;
  if (!ny || !ny.rows || !ny.rows.length) {
    el.innerHTML = `<div class="dm-note">NPA-by-year ledger unavailable — no data.</div>`;
    return;
  }
  const yearLabel = (y) => (y === "ALL" ? "All years" : "Originated " + y);
  const shade = (v) => (v == null ? "dm-na" : v >= 10 ? "dm-bad" : v >= 5 ? "dm-warn" : "dm-ok");
  const p = (v) => (v == null ? "–" : v.toFixed(1) + "%");
  const cell = (v, cls, title) => `<td class="dm-cell ${cls || ""}"${title ? ` title="${title}"` : ""}>${p(v)}</td>`;

  /* one data row -> <tr>; the year cell (with rowspan) renders only on the first row of a group */
  const rowHtml = (r, opts) => {
    const isTotal = r.tenure == null;
    const title = r.small ? "fewer than 10 matured loans — treat the rate with caution" : "";
    const maturedTxt = fmt.format(r.matured) + (r.small ? " †" : "");
    return `<tr class="${isTotal ? "nyt-total" : ""}${opts && opts.grand ? " nyt-grand" : ""}">
      ${opts && opts.yearLabel ? `<td class="dm-cell nyt-year" rowspan="${opts.rowspanYear}">${opts.yearLabel}</td>` : ""}
      <td class="dm-cell nyt-lab">${isTotal ? "All tenures" : r.tenure + " mo"}</td>
      <td class="dm-cell nyt-num" title="${title}">${maturedTxt}</td>
      <td class="dm-cell nyt-num">${fmt.format(r.npa)}</td>
      ${cell(r.rate_life, shade(r.rate_life), "NPA loans ÷ matured loans, over the loan's whole term")}
      <td class="dm-cell nyt-num nyt-ann" title="rate × 12/tenure — money at this tenure recycles 12÷tenure times a year">${p(r.rate_ann)}</td>
      <td class="dm-cell nyt-num">${inr(r.disb)}</td>
      <td class="dm-cell nyt-num">${inr(r.npa_amt)}</td>
      ${cell(r.loss_life, shade(r.loss_life), "NPA principal ÷ ₹ disbursed on the same matured loans, over the loan's term")}
      <td class="dm-cell nyt-num nyt-ann" title="loss × 12/tenure annualized">${p(r.loss_ann)}</td>
    </tr>`;
  };

  /* group rows: per year, tenure rows first then the year's blended total */
  const groupRows = (year) => ny.rows.filter((r) => r.year === year);
  const yearGroups = [...ny.years, "ALL"];
  let html = "";
  yearGroups.forEach((year) => {
    const g = groupRows(year);
    g.forEach((r, idx) => {
      html += rowHtml(r, {
        yearLabel: idx === 0 ? yearLabel(year) : "",
        rowspanYear: idx === 0 ? g.length : 0,
        grand: year === "ALL" && r.tenure == null,
      });
    });
  });

  el.innerHTML = `
    <div class="dm-head">
      <h4>📋 NPA by year — full ledger: tenure-level vs annualized</h4>
      <div class="lp-sub">Every bucket twice: <b>over the loan's life</b> (NPA loans ÷ <i>matured</i> loans = closed+NPA, so active loans that can still default are excluded) and <b>annualized per year</b> (× 12/tenure — 2-month money recycles 6× a year so its small default rate stacks up; a 12-month rate doesn't scale). The ₹ columns are the actual money cost: NPA principal ÷ ₹ disbursed on the same matured loans. Colour = the life-of-loan rate (green ≤5%, amber 5–10%, red ≥10%). Whole book — <b>the filters above do not change this table</b>.</div>
    </div>
    <div class="dm-wrap">
      <table class="dm nyt">
        <thead><tr>
          <th class="nyt-lab">Origination</th><th class="nyt-lab">Tenure</th>
          <th>Matured</th><th>NPA</th>
          <th>NPA rate · loan life</th><th>NPA rate · per year</th>
          <th>₹ lent (matured)</th><th>NPA ₹</th>
          <th>₹ loss · loan life</th><th>₹ loss · per year</th>
        </tr></thead>
        <tbody>${html}</tbody>
      </table>
    </div>
    <div class="dm-key">
      <span class="dm-k dm-ok">life rate ≤ 5%</span><span class="dm-k dm-warn">5–10%</span><span class="dm-k dm-bad">≥ 10%</span>
      <span class="dm-note">† fewer than 10 matured loans — rate unreliable.</span>
      <span class="dm-note">Read the last line first: whole book 5.9% of matured loans default over their lives, but because the average tenure is only ~4.3 months that money cycles ~2.8× a year — <b>≈16.5% of your annual lending defaults</b>.</span>
    </div>`;
}
