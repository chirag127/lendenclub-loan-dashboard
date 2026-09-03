/* ============================================================
 * ui/risk-matrix.js — renderRiskMatrix
 * ------------------------------------------------------------
 * A plain HTML table (another form of showing the data, no chart
 * library) with every tenure × score cell of the whole book:
 * loans, NPA %, matured default %, and loss % of ₹ disbursed.
 * Complements the heatmaps: here every cell is readable at once,
 * including tiny-sample cells the charts deliberately grey out.
 * ============================================================ */

function renderRiskMatrix() {
  const el = document.getElementById("risk-matrix");
  if (!el) return;
  if (!LOANS || !LOANS.length) { el.innerHTML = `<div class="dm-note">Risk matrix unavailable — no loan data.</div>`; return; }

  const rows = TENURES.map((t) => {
    const cells = SCORE_BANDS.map((b) => tenureBandStats(LOANS, t, b));
    const tot = tenureStats(LOANS, t);
    return { t, cells, tot };
  });

  const shade = (v) => (v == null ? "dm-na" : v >= 10 ? "dm-bad" : v >= 5 ? "dm-warn" : "dm-ok");
  const cellHtml = (s) => {
    if (!s || !s.count) return `<td class="dm-cell dm-empty">–</td>`;
    const cls = shade(s.maturedRate);
    return `<td class="dm-cell ${cls}" title="score ${s.band} · ${s.t} mo — ${fmt.format(s.count)} loans, NPA ${s.npaRate != null ? s.npaRate + "%" : "–"} of all, ${s.maturedRate != null ? s.maturedRate + "%" : "–"} of matured, loss ${s.lossRate != null ? s.lossRate + "%" : "–"} of ₹ lent">
      <b>${fmt.format(s.count)}</b> loans
      <span>NPA ${s.npaRate != null ? s.npaRate + "%" : "–"} · matured ${s.maturedRate != null ? s.maturedRate + "%" : "–"}</span>
      <span>loss ${s.lossRate != null ? s.lossRate + "%" : "–"} of ₹ lent${s.npa ? " · " + fmt.format(s.npa) + " NPA" : ""}</span>
    </td>`;
  };

  const grand = {
    count: rows.reduce((a, r) => a + r.tot.count, 0),
    npa: rows.reduce((a, r) => a + r.tot.npa, 0),
    disb: rows.reduce((a, r) => a + r.tot.disb, 0),
    npaAmt: rows.reduce((a, r) => a + r.tot.npaAmt, 0),
  };
  const grandMat = LOANS.filter((l) => l.status === "CLOSED" || l.status === "NPA").length;
  const grandMaturedRate = grandMat ? (100 * grand.npa) / grandMat : null;

  el.innerHTML = `
    <div class="dm-head">
      <h4>📋 Tenure × score risk reference — every cell of the whole book</h4>
      <div class="lp-sub">Per cell: loan count · NPA % of all loans in the cell · NPA % of <i>matured</i> loans (closed+NPA, the honest default rate) · loss % of ₹ lent · NPA loan count. Colour = matured default rate. No cell is hidden — small samples stay visible so you can see how much evidence each pick has. The filters above do not change this table.</div>
    </div>
    <div class="dm-wrap">
      <table class="dm">
        <thead><tr><th>Tenure</th>${SCORE_BANDS.map((b) => `<th>${b.label}</th>`).join("")}<th>Total</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr>
            <th>${r.t} mo</th>
            ${r.cells.map(cellHtml).join("")}
            <td class="dm-cell dm-total" title="whole tenure">
              <b>${fmt.format(r.tot.count)}</b> loans
              <span>NPA ${r.tot.npaRate != null ? r.tot.npaRate + "%" : "–"} · matured ${r.tot.maturedRate != null ? r.tot.maturedRate + "%" : "–"}</span>
              <span>loss ${r.tot.lossRate != null ? r.tot.lossRate + "%" : "–"} of ₹ lent</span>
            </td>
          </tr>`).join("")}
        </tbody>
        <tfoot><tr>
          <th>All</th>
          ${SCORE_BANDS.map((b) => {
            const s = { count: 0, npa: 0, disb: 0, npaAmt: 0 };
            rows.forEach((r) => {
              const c = r.cells.find((x) => x.band === b.label);
              if (!c) return;
              s.count += c.count; s.npa += c.npa; s.disb += c.disb; s.npaAmt += c.npaAmt;
            });
            const matured = LOANS.filter((l) => l.score != null && l.score >= b.min && l.score < b.max && (l.status === "CLOSED" || l.status === "NPA")).length;
            const mat = matured ? (100 * s.npa) / matured : null;
            const loss = s.disb ? (100 * s.npaAmt) / s.disb : null;
            return `<td class="dm-cell dm-total ${shade(mat)}" title="score ${b.label}, all tenures">
              <b>${fmt.format(s.count)}</b> loans
              <span>matured ${mat != null ? mat.toFixed(1) + "%" : "–"}</span>
              <span>loss ${loss != null ? loss.toFixed(1) + "%" : "–"}</span>
            </td>`;
          }).join("")}
          <td class="dm-cell dm-total" title="whole book">
            <b>${fmt.format(grand.count)}</b> loans
            <span>NPA ${pct((100 * grand.npa) / grand.count)} · matured ${grandMaturedRate != null ? pct(grandMaturedRate) : "–"}</span>
            <span>NPA ₹ ${inr(grand.npaAmt)} (${pct(grand.disb ? (100 * grand.npaAmt) / grand.disb : 0)} of lent)</span>
          </td>
        </tr></tfoot>
      </table>
    </div>
    <div class="dm-key"><span class="dm-k dm-ok">default ≤ 5%</span><span class="dm-k dm-warn">5–10%</span><span class="dm-k dm-bad">≥ 10%</span><span class="dm-k dm-empty">no loans</span><span class="dm-k">Tip: the whole row tells you the tenure's story — 2-mo is clean everywhere, 6-mo only above 750, 12-mo is red in its one big cell.</span></div>`;
}
