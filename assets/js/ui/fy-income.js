/* ============================================================
 * ui/fy-income.js — FY 2026–27 income panel
 * ------------------------------------------------------------
 * The Python pipeline computes the forecast. This module only renders it.
 * It deliberately labels principal returned as cash, not income, and shows
 * historical/default assumptions so the figure cannot be mistaken for a
 * guaranteed return.
 * ============================================================ */

function fyMoney(n) { return n == null ? "–" : inrCompact(n); }

function renderFYIncome() {
  const el = document.getElementById("fy-income");
  if (!el) return;
  const F = (window.INSIGHTS_DATA || {}).fy_forecast;
  if (!F) {
    el.innerHTML = `<div class="fy-empty">FY 2026–27 forecast is not available in this data build.</div>`;
    return;
  }
  const E = F.existing_book || {};
  const R = F.reinvestment || {};
  const months = F.months || [];
  const conservative = F.total_net_profit_conservative;
  const base = F.total_net_profit;
  const start = F.starting_active_principal;
  const expectedRate = F.profit_rate_on_start_pct;
  const conservativeRate = F.profit_rate_on_start_conservative_pct;
  const asOf = F.as_of || "the report date";
  const eligible = (R.eligible_cells || []).slice(0, 8).join(" · ");
  const detailRows = months.map((m) => `<tr>
    <td>${m.month}</td><td class="num">${fyMoney(m.existing_cash)}</td><td class="num">${fyMoney(m.existing_principal)}</td>
    <td class="num">${fyMoney(m.existing_interest)}</td><td class="num">−${fyMoney(m.existing_fee)}</td>
    <td class="num">−${fyMoney(m.existing_npa_loss)}</td><td class="num"><b>${fyMoney(m.existing_net_profit)}</b></td>
    <td class="num">${fyMoney(m.reinvested)}</td><td class="num">${fyMoney(m.new_profit)}</td><td class="num"><b>${fyMoney(m.total_net_profit)}</b></td>
  </tr>`).join("");
  el.innerHTML = `
    <div class="fy-wrap">
      <div class="fy-head">
        <div><h3>📅 FY 2026–27 income plan — current portfolio + monthly reinvestment</h3>
          <p>As of <b>${asOf}</b> · starting active principal at risk <b>${fyMoney(start)}</b> · <b>${fmt.format(F.active_loans || 0)}</b> active loans. This is an expected economic-income estimate, not a guaranteed return.</p></div>
        <span class="fy-badge">FY ${F.fy}</span>
      </div>
      <div class="fy-cards">
        <div class="fy-card good"><span>Expected net profit</span><b>${fyMoney(base)}</b><small>after fees + expected NPA loss</small></div>
        <div class="fy-card warn"><span>Conservative planning profit</span><b>${fyMoney(conservative)}</b><small>new-loan income haircut ${(R.conservative_haircut * 100 || 75).toFixed(0)}%</small></div>
        <div class="fy-card blue"><span>Expected cash returned</span><b>${fyMoney(E.cash_received_after_fee)}</b><small>includes principal; not all income</small></div>
        <div class="fy-card"><span>Expected profit / starting principal</span><b>${expectedRate == null ? "–" : pct(expectedRate)}</b><small>conservative: ${conservativeRate == null ? "–" : pct(conservativeRate)}</small></div>
      </div>
      <div class="fy-grid">
        <div class="fy-block"><h4>Existing active book — FY economics</h4>
          <div class="fy-line"><span>Interest expected to arrive</span><b>${fyMoney(E.interest_received)}</b></div>
          <div class="fy-line"><span>Platform fees deducted</span><b class="bad">−${fyMoney(E.platform_fee)}</b></div>
          <div class="fy-line"><span>Expected NPA loss</span><b class="bad">−${fyMoney(E.expected_npa_loss)}</b></div>
          <div class="fy-line"><span>Net profit from today's active book</span><b class="good">${fyMoney(E.net_profit)}</b></div>
          <div class="fy-line"><span>Principal returned (cash, not income)</span><b>${fyMoney(E.principal_returned)}</b></div>
        </div>
        <div class="fy-block"><h4>Reinvestment assumption</h4>
          <div class="fy-line"><span>Cash reinvested monthly</span><b>${fyMoney(R.cash_reinvested)}</b></div>
          <div class="fy-line"><span>New-loan net profit</span><b class="good">${fyMoney(R.new_loan_net_profit)}</b></div>
          <div class="fy-line"><span>Strict eligible cells</span><b>${fmt.format(R.eligible_cell_count || 0)}</b></div>
          <p class="fy-note">Eligible = positive default-inclusive net XIRR, ≥30 matured loans, ≤8% matured NPA, and positive net kept ₹/₹1,000. The model reinvests returned cash monthly into: ${eligible || "no eligible cells in this payload"}.</p>
        </div>
      </div>
      <details class="fy-details"><summary>Show monthly FY cash and profit ledger</summary>
        <div class="fy-table-scroll"><table class="fy-table"><thead><tr><th>Month</th><th>Existing cash</th><th>Principal returned</th><th>Interest</th><th>Fees</th><th>Expected NPA loss</th><th>Existing net profit</th><th>Reinvested</th><th>New-loan profit</th><th>Total net profit</th></tr></thead><tbody>${detailRows}</tbody></table></div>
      </details>
      <p class="fy-foot"><b>How to read this:</b> expected net profit = interest − platform fees − expected credit loss. EMI principal returned is shown separately and is reinvested in the base scenario, so it is not counted as income twice. Future installments use the report's available schedule and equal monthly timing; the model applies each tenure's historical default and interest-collection experience. The conservative figure is the planning number, not a promise. It excludes tax, withdrawal delays, platform changes not present in the report, and future defaults above the historical assumption.</p>
    </div>`;
}
