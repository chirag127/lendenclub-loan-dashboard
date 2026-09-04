/* ============================================================
 * ui/loan-groups.js — grouped loan decision view
 * ------------------------------------------------------------
 * Groups the current filtered loan slice in several useful ways:
 *   • Decision verdict: Core / Support / Conditional / Avoid / Unproven
 *   • Tenure: 2 / 3 / 4 / 5 / 6 / 12 months
 *   • Score band: 700–724 / 725–749 / 750–774 / 775+
 *   • Ticket size: ₹250 / ₹500 / ₹1,000 / ₹2,500 / ₹5,000+
 *
 * The panel is descriptive and decision-focused. Clicking a row filters
 * only the loan register to that group; charts and KPIs retain the normal
 * global filters. All metrics are recalculated from the current slice.
 * Classic script (no ES modules — must keep working from file://).
 * ============================================================ */

const LOAN_GROUP_MODES = {
  decision: { label: "Decision verdict" },
  tenure: { label: "Tenure" },
  score: { label: "Score band" },
  ticket: { label: "Ticket size" },
};

const DECISION_GROUPS = [
  { key: "core", label: "Core · Lend", color: "#22c55e", desc: "Highest evidence-backed return cells" },
  { key: "support", label: "Support · Small", color: "#38bdf8", desc: "Profitable, but keep allocation smaller" },
  { key: "gate", label: "Conditional", color: "#f59e0b", desc: "Only with a specific risk condition" },
  { key: "avoid", label: "Avoid · Never", color: "#ef4444", desc: "Net-negative after defaults" },
  { key: "unproven", label: "Unproven", color: "#94a3b8", desc: "Insufficient ranked evidence or missing cell" },
];

const TENURE_GROUPS = [2, 3, 4, 5, 6, 12].map((t) => ({
  key: String(t), label: `${t}-month`, color: t <= 3 ? "#22c55e" : t >= 6 ? "#f59e0b" : "#38bdf8",
}));
const SCORE_GROUPS = [
  { key: "700–724", label: "700–724", color: "#f59e0b" },
  { key: "725–749", label: "725–749", color: "#38bdf8" },
  { key: "750–774", label: "750–774", color: "#22c55e" },
  { key: "775+", label: "775+", color: "#a78bfa" },
  { key: "unproven", label: "Below 700 / no score", color: "#94a3b8" },
];
const TICKET_GROUPS = [
  { key: "₹250", label: "₹250", color: "#38bdf8" },
  { key: "₹500", label: "₹500", color: "#22c55e" },
  { key: "₹1,000", label: "₹1,000", color: "#a78bfa" },
  { key: "₹2,500", label: "₹2,500", color: "#ef4444" },
  { key: "₹5,000+", label: "₹5,000+", color: "#f59e0b" },
];

function loanCellFor(l) {
  const picks = (window.INSIGHTS_DATA || {}).xirr_picks || {};
  const score = l.score;
  let band = null;
  if (score != null) {
    if (score >= 775) band = "775+";
    else if (score >= 750) band = "750–774";
    else if (score >= 725) band = "725–749";
    else if (score >= 700) band = "700–724";
  }
  const key = band ? `${Math.round(l.tenure)}mo·${band}` : null;
  return key ? (picks.cells || []).find((c) => c.key === key) || null : null;
}

function loanDecisionGroup(l) {
  const cell = loanCellFor(l);
  return cell && cell.tier ? cell.tier : "unproven";
}

function loanScoreGroup(l) {
  if (l.score == null || l.score < 700) return "unproven";
  if (l.score >= 775) return "775+";
  if (l.score >= 750) return "750–774";
  if (l.score >= 725) return "725–749";
  return "700–724";
}

function loanTicketGroup(l) {
  const amount = Number(l.amount || 0);
  if (amount <= 250) return "₹250";
  if (amount <= 500) return "₹500";
  if (amount <= 1000) return "₹1,000";
  if (amount <= 2500) return "₹2,500";
  return "₹5,000+";
}

function loanGroupKey(l, mode) {
  if (mode === "decision") return loanDecisionGroup(l);
  if (mode === "tenure") return l.tenure == null ? "unproven" : String(Math.round(l.tenure));
  if (mode === "score") return loanScoreGroup(l);
  if (mode === "ticket") return loanTicketGroup(l);
  return "unproven";
}

function loanGroupDefinitions(mode) {
  if (mode === "decision") return DECISION_GROUPS;
  if (mode === "tenure") return TENURE_GROUPS;
  if (mode === "score") return SCORE_GROUPS;
  return TICKET_GROUPS;
}

function loanGroupMetric(rows, mode, key) {
  const disb = rows.reduce((a, l) => a + (l.amount || 0), 0);
  const matured = rows.filter((l) => l.status === "CLOSED" || l.status === "NPA");
  const npa = matured.filter((l) => l.status === "NPA");
  const net = matured.reduce((a, l) => a + (l.interest_received || 0) - (l.platform_fee || 0) - (l.npa_amount || 0), 0);
  const maturedDisb = matured.reduce((a, l) => a + (l.amount || 0), 0);
  const annFactor = maturedDisb ? matured.reduce((a, l) => a + (l.amount || 0) * (12 / Math.max(1, l.tenure || 1)), 0) / maturedDisb : 0;
  const xCells = {};
  matured.forEach((l) => {
    const cell = loanCellFor(l);
    if (cell && cell.xirr_all != null) {
      const k = cell.key;
      if (!xCells[k]) xCells[k] = { x: cell.xirr_all, n: 0 };
      xCells[k].n += 1;
    }
  });
  const xN = Object.values(xCells).reduce((a, v) => a + v.n, 0);
  const decisionXirr = mode === "decision" && xN ? Object.values(xCells).reduce((a, v) => a + v.x * v.n, 0) / xN : null;
  const avgRate = disb ? rows.reduce((a, l) => a + (l.amount || 0) * (l.interest_rate || 0), 0) / disb : null;
  /* Forward signal: use the pipeline's active-book expected XIRR by tenure,
     weighted by outstanding principal in this group. This is only a projection
     for ACTIVE loans; matured rows keep their realized net-return measure. */
  const ax = ((window.INSIGHTS_DATA || {}).active_xirr || {}).by_tenure_expected || {};
  let forwardNum = 0, forwardDen = 0;
  rows.filter((l) => l.status === "ACTIVE").forEach((l) => {
    const out = Math.max(0, (l.amount || 0) - (l.principal_received || 0));
    const x = ax[l.tenure];
    if (out > 0 && x != null) { forwardNum += out * x; forwardDen += out; }
  });
  const projectedXirr = forwardDen ? forwardNum / forwardDen : null;
  return {
    key,
    count: rows.length,
    disb,
    active: rows.filter((l) => l.status === "ACTIVE").length,
    closed: rows.filter((l) => l.status === "CLOSED").length,
    npa: npa.length,
    matured: matured.length,
    npaRate: matured.length ? (100 * npa.length / matured.length) : null,
    netRoi: maturedDisb ? (100 * net / maturedDisb) : null,
    annualizedNet: maturedDisb ? (100 * net / maturedDisb) * annFactor : null,
    decisionXirr,
    projectedXirr,
    avgRate,
  };
}

function registerMatches(l, mode, key) {
  return key === "All" || loanGroupKey(l, mode) === key;
}

function registerFilteredLoans() {
  const mode = state.registerGroupMode || "decision";
  const key = state.registerGroup || "All";
  return filtered().filter((l) => registerMatches(l, mode, key));
}

function applyLoanGroup(mode, key) {
  state.registerGroupMode = mode;
  state.registerGroup = key;
  renderLoanGroups();
  renderTable();
}

function groupMetricValue(m, mode) {
  if (mode === "decision" && m.decisionXirr != null) return `${pct(m.decisionXirr)}/yr XIRR`;
  return m.annualizedNet == null ? "–" : `${pct(m.annualizedNet)}/yr net ROI`;
}
function groupForwardValue(m) {
  return m.projectedXirr == null ? "–" : `${pct(m.projectedXirr)}/yr expected`;
}

function renderLoanGroups() {
  const el = document.getElementById("loan-groups");
  if (!el) return;
  const L = filtered();
  const mode = state.registerGroupMode || "decision";
  const selected = state.registerGroup || "All";
  const defs = loanGroupDefinitions(mode);
  const allMatured = L.filter((l) => l.status === "CLOSED" || l.status === "NPA");
  const totalDisb = L.reduce((a, l) => a + (l.amount || 0), 0);
  const rows = defs.map((d) => loanGroupMetric(L.filter((l) => loanGroupKey(l, mode) === d.key), mode, d.key));
  const selectedLabel = selected === "All" ? "All groups" : ((defs.find((d) => d.key === selected) || {}).label || selected);
  const modeOptions = Object.entries(LOAN_GROUP_MODES).map(([k, v]) => `<option value="${k}" ${mode === k ? "selected" : ""}>${v.label}</option>`).join("");
  const metricNote = mode === "decision"
    ? "Decision groups show the weighted cell net XIRR where ranked evidence exists; all groups also show realized net ROI/year."
    : "Net ROI/year = (interest − platform fees − NPA principal) ÷ disbursed, annualized by each loan's tenure; it is not a forecast."
  ;
  el.innerHTML = `
    <div class="lg-wrap">
      <div class="lg-head">
        <div>
          <h3>🧩 Loan groups — compare the groups before you lend</h3>
          <p class="lg-sub">${fmt.format(L.length)} loans · ${inr(totalDisb)} in the current global slice · ${fmt.format(allMatured.length)} matured. Choose a grouping, then click any row to filter the loan register to exactly that group.</p>
        </div>
        <label class="lg-select-label">Group by
          <select id="loanGroupMode" class="select">${modeOptions}</select>
        </label>
      </div>
      <div class="lg-filter"><span>Register filter: <b>${selectedLabel}</b></span>${selected !== "All" ? `<button class="lg-clear" type="button">Clear group filter</button>` : ""}</div>
      <div class="lg-grid">
        ${rows.map((m, i) => {
          const d = defs[i];
          const isSelected = selected === d.key;
          const tone = m.annualizedNet != null && m.annualizedNet < 0 ? "negative" : "";
          return `<button type="button" class="lg-card ${isSelected ? "selected" : ""} ${tone}" data-lg-key="${d.key}" style="--lg-ac:${d.color}">
            <span class="lg-card-top"><span class="lg-dot"></span><b>${d.label}</b><span class="lg-arrow">→</span></span>
            <span class="lg-desc">${d.desc || ""}</span>
            <span class="lg-big">${fmt.format(m.count)} <small>loans</small></span>
            <span class="lg-stats"><i>${inrCompact(m.disb)}</i><i>${fmt.format(m.active)} active</i><i>${fmt.format(m.npa)} NPA</i></span>
            <span class="lg-return"><b>${groupMetricValue(m, mode)}</b>${m.npaRate != null ? ` · ${pct(m.npaRate)} matured NPA` : ""}</span>
            <span class="lg-forward">${groupForwardValue(m)}</span>
          </button>`;
        }).join("")}
      </div>
      <div class="lg-table-scroll"><table class="lg-table"><thead><tr><th>Group</th><th class="num">Loans</th><th class="num">Disbursed</th><th class="num">Active</th><th class="num">Closed</th><th class="num">NPA</th><th class="num">Matured NPA</th><th class="num">Realized net return</th><th class="num">Forward expected</th><th class="num">Avg rate</th></tr></thead><tbody>      ${rows.map((m, i) => { const d = defs[i]; return `<tr class="${selected === d.key ? "on" : ""}"><td><button type="button" class="lg-row-btn" data-lg-key="${d.key}" style="color:${d.color}">${d.label}</button></td><td class="num">${fmt.format(m.count)}</td><td class="num">${inrCompact(m.disb)}</td><td class="num">${fmt.format(m.active)}</td><td class="num">${fmt.format(m.closed)}</td><td class="num">${fmt.format(m.npa)}</td><td class="num">${m.npaRate == null ? "–" : pct(m.npaRate)}</td><td class="num"><b>${groupMetricValue(m, mode)}</b></td><td class="num">${m.projectedXirr == null ? "–" : pct(m.projectedXirr)}</td><td class="num">${m.avgRate == null ? "–" : pct(m.avgRate)}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="lg-note">${metricNote} <b>Forward expected</b> uses only ACTIVE loans and the pipeline's tenure-level projected XIRR (historical defaults + fee/interest haircuts); a dash means that group has no active exposure. Click a group to make the register show only that group; click <b>Clear group filter</b> to restore it. Empty groups are shown as zero rather than hidden so you can see whether a category actually exists in the current filters.</p>
    </div>`;
  const modeEl = document.getElementById("loanGroupMode");
  if (modeEl) modeEl.addEventListener("change", (e) => applyLoanGroup(e.target.value, "All"));
  el.querySelectorAll("[data-lg-key]").forEach((btn) => btn.addEventListener("click", () => applyLoanGroup(mode, btn.dataset.lgKey)));
  const clear = el.querySelector(".lg-clear");
  if (clear) clear.addEventListener("click", () => applyLoanGroup(mode, "All"));
}
