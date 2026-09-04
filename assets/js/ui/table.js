/* ============================================================
 * ui/table.js — sortable/searchable loan register
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ---------------- table ---------------- */
let tableSort = { key: "disbursement_date", dir: -1 };
const TABLE_COLS = [
  { key: "loan_id", label: "Loan ID" }, { key: "order_id", label: "Order ID" },
  { key: "disbursement_date", label: "Disbursed" }, { key: "amount", label: "Amount", num: true },
  { key: "status", label: "Status" }, { key: "verdict", label: "Verdict" },
  { key: "interest_rate", label: "Rate %", num: true },
  { key: "tenure", label: "Tenure", num: true }, { key: "score", label: "Score", num: true },
  { key: "dpd", label: "DPD", num: true }, { key: "total_received", label: "Received", num: true },
  { key: "interest_received", label: "Interest", num: true }, { key: "pnl", label: "P&L", num: true },
];
function renderTable() {
  const L = typeof registerFilteredLoans === "function" ? registerFilteredLoans() : filtered();
  const q = (document.getElementById("tableSearch").value || "").toLowerCase();
  const rows = L
    .filter((l) => !q || (l.loan_id || "").toLowerCase().includes(q) || (l.order_id || "").toLowerCase().includes(q))
    .sort((a, b) => {
      const va = tableSort.key === "verdict" ? verdictRank(a) : a[tableSort.key];
      const vb = tableSort.key === "verdict" ? verdictRank(b) : b[tableSort.key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1; if (vb == null) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * tableSort.dir;
    });
  document.getElementById("tableCount").textContent = fmt.format(rows.length) + " loans";
  const thead = document.querySelector("#loanTable thead");
  thead.innerHTML = "<tr>" + TABLE_COLS.map((c) => `<th data-key="${c.key}" class="${c.num ? "num" : ""}">${c.label}${tableSort.key === c.key ? (tableSort.dir < 0 ? " ↓" : " ↑") : ""}</th>`).join("") + "</tr>";
  thead.querySelectorAll("th").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.key;
    if (tableSort.key === k) tableSort.dir *= -1; else { tableSort.key = k; tableSort.dir = -1; }
    renderTable();
  }));
  const tbody = document.querySelector("#loanTable tbody");
  tbody.innerHTML = rows.slice(0, 2000).map((l) => `
    <tr>
      <td>${l.loan_id || "–"}</td><td>${l.order_id || "–"}</td>
      <td>${l.disbursement_date || "–"}</td><td class="num">${l.amount ? inr(l.amount) : "–"}</td>
      <td><span class="badge ${l.status}">${l.status}</span></td>
      <td>${verdictCell(l)}</td>
      <td class="num">${l.interest_rate != null ? l.interest_rate.toFixed(2) + "%" : "–"}</td>
      <td class="num">${l.tenure != null ? l.tenure + " mo" : "–"}</td>
      <td class="num">${l.score != null ? Math.round(l.score) : "–"}</td>
      <td class="num">${l.dpd ? Math.round(l.dpd) : "–"}</td>
      <td class="num">${l.total_received ? inr(l.total_received) : "–"}</td>
      <td class="num">${l.interest_received ? inr(l.interest_received) : "–"}</td>
      <td class="num">${l.pnl ? inr(l.pnl) : "–"}</td>
    </tr>`).join("") + (rows.length > 2000 ? `<tr><td colspan="13" class="muted">Showing first 2,000 of ${fmt.format(rows.length)} — narrow the search to see more.</td></tr>` : "");
}

/* tier rank for sorting the register's Verdict column (core first, avoid last) */
function verdictRank(l) {
  const rank = { core: 0, support: 1, gate: 2, unproven: 3, avoid: 4 };
  const picks = (window.INSIGHTS_DATA || {}).xirr_picks || {};
  const map = {};
  (picks.cells || []).forEach((c) => { map[c.key] = c; });
  let band = null;
  if (l.score != null) {
    if (l.score >= 775) band = "775+";
    else if (l.score >= 750) band = "750–774";
    else if (l.score >= 725) band = "725–749";
    else if (l.score >= 700) band = "700–724";
  }
  const key = band ? `${Math.round(l.tenure)}mo·${band}` : null;
  const c = key ? map[key] : null;
  return c ? rank[c.tier] : 3; // unranked sorts with unproven
}
