/* ============================================================
 * ui/decision-table.js — the ONE-TABLE decision view + verdict tags
 * ------------------------------------------------------------
 * renderDecisionTable() renders every ranked tenure × score cell as
 * a plain-HTML sortable table: net XIRR incl. all defaults, the
 * repaying-only XIRR (upper bound), matured default rate, net kept
 * ₹ per ₹1,000 lent, realised fee % of lent, quoted rate, tier and
 * the recommended ₹ per ₹1,000 — plus how much fresh money went
 * into that cell this month (availability / drift signal).
 *
 * cellVerdict(l) is reused by the loan register: it tags each loan
 * with its cell's tier so the register itself answers "should I
 * fund this loan?".
 * All numbers come live from INSIGHTS.xirr_picks (pipeline
 * xirr_picks(), which already nets fees + every default).
 * ============================================================ */

let dtSort = { key: "rec", dir: -1 };

function cellVerdict(loans) {
  const picks = (window.INSIGHTS_DATA || {}).xirr_picks || {};
  const map = {};
  (picks.cells || []).forEach((c) => { map[c.key] = c; });
  const bandOf = (s) => {
    if (s == null) return null;
    if (s >= 775) return "775+";
    if (s >= 750) return "750–774";
    if (s >= 725) return "725–749";
    if (s >= 700) return "700–724";
    return null; // below 700 — no band
  };
  const ver = [];
  loans.forEach((l) => {
    const band = bandOf(l.score);
    const key = band ? `${Math.round(l.tenure)}mo·${band}` : null;
    ver.push({ loan: l, cell: key ? map[key] : null });
  });
  return ver;
}

const TIER_META_DT = {
  core:    { label: "Lend",        color: "#34d399" },
  support: { label: "Small",       color: "#38bdf8" },
  gate:    { label: "Conditional", color: "#fbbf24" },
  avoid:   { label: "Never",       color: "#f87171" },
  unproven:{ label: "Unproven",    color: "#94a3b8" },
};

function renderDecisionTable() {
  const el = document.getElementById("decision-table");
  if (!el) return;
  const INS = window.INSIGHTS_DATA || {};
  const p = INS.xirr_picks || {};
  const MA = INS.month_allocation || null;
  if (!p.cells || !p.cells.length) { el.style.display = "none"; return; }
  el.style.display = "";
  const avail = {};
  if (MA && MA.by_bucket) MA.by_bucket.forEach((b) => { avail[b.key] = b.amount; });

  const order = {
    cell: (r) => r.c.key, rec: (r) => r.c.rec_pct || 0, xirr_all: (r) => r.c.xirr_all ?? -999,
    xirr: (r) => r.c.xirr ?? -999, def: (r) => r.c.def_rate, net: (r) => r.c.net_1000 ?? -999,
    fee: (r) => r.c.fee_pct ?? -999, rate: (r) => r.c.avg_rate ?? -999, n: (r) => r.c.matured,
    tier: (r) => ({ core: 0, support: 1, gate: 2, unproven: 3, avoid: 4 }[r.c.tier] ?? 5),
    avail: (r) => r.availAmt ?? -1,
  };
  const cmp = (a, b) => {
    const va = order[dtSort.key](a), vb = order[dtSort.key](b);
    if (typeof va === "string") return va.localeCompare(vb) * dtSort.dir;
    return (va < vb ? -1 : va > vb ? 1 : 0) * dtSort.dir;
  };
  const rows = p.cells.map((c) => {
    const tm = TIER_META_DT[c.tier] || TIER_META_DT.gate;
    const availAmt = avail[c.key];
    return { c, tm, availAmt, rec: c.rec_pct || 0 };
  }).sort((a, b) => (b.rec - a.rec) || (a.c.tier === "avoid" ? 1 : b.c.tier === "avoid" ? -1 : 0));

  el.innerHTML = `
    <div class="dt-wrap">
      <div class="dt-head">
        <h3>🧭 The one-table decision — every ranked tenure × score cell</h3>
        <p class="dt-sub">Net XIRR below is <b>after everything</b>: all NPA defaults are counted in (zero-recovery booked as total losses) and <b>all platform and other fees are deducted</b> — nothing further to subtract. Ranked on matured loans only (≥ ${p.min_matured} completed). "Net ₹/₹1k" = interest − fees − NPA principal per ₹1,000 lent over the loan's life. "This month ₹" = fresh money that actually went into the cell in ${MA ? MA.month : "the latest month"} (availability + drift).</p>
      </div>
      <div class="table-scroll">
      <table class="dt-table">
        <thead><tr>
          <th data-k="cell">Cell</th><th data-k="rec" class="num">₹ per ₹1k rec.</th>
          <th data-k="xirr_all" class="num">Net XIRR (all defaults)</th>
          <th data-k="xirr" class="num">Repaying-only XIRR</th>
          <th data-k="def" class="num">Matured default</th>
          <th data-k="net" class="num">Net ₹/₹1k</th>
          <th data-k="fee" class="num">Fee % of lent</th>
          <th data-k="rate" class="num">Quoted rate</th>
          <th data-k="n" class="num">Matured loans</th>
          <th data-k="tier">Tier</th>
          <th data-k="avail" class="num">This month ₹</th>
        </tr></thead>
        <tbody>
        ${rows.map(({ c, tm, availAmt }) => `
          <tr class="dt-${c.tier}">
            <td><b>${c.key}</b></td>
            <td class="num">${(c.rec_pct || 0).toFixed(1)}</td>
            <td class="num"><b style="color:${c.xirr_all != null && c.xirr_all < 0 ? "#f87171" : "#6ee7b7"}">${c.xirr_all != null ? c.xirr_all.toFixed(1) + "%" : "–"}</b></td>
            <td class="num">${c.xirr != null ? c.xirr.toFixed(1) + "%" : "–"}</td>
            <td class="num">${c.def_rate.toFixed(1)}%</td>
            <td class="num">${c.net_1000 != null ? "₹" + fmt.format(Math.round(c.net_1000)) : "–"}</td>
            <td class="num">${c.fee_pct != null ? c.fee_pct.toFixed(1) + "%" : "–"}</td>
            <td class="num">${c.avg_rate != null ? c.avg_rate.toFixed(1) + "%" : "–"}</td>
            <td class="num">${fmt.format(c.matured)}</td>
            <td><span class="dt-tier" style="color:${tm.color};border-color:${tm.color}44;background:${tm.color}1a">${tm.label}</span></td>
            <td class="num" style="color:${availAmt ? "#cbd5e1" : "#475569"}">${availAmt ? inrCompact(availAmt) : "—"}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      </div>
      <p class="dt-foot muted">Cells ranked by recommended ₹ per ₹1,000 (avoid cells always last, at ₹0). "Unproven" cells (fewer than ${p.min_matured} matured loans) are not ranked and get no recommendation until evidence builds — check the Fine-bucket atlas evidence map for how close they are. Whole book: this table needs the full matured history and does not react to the month filter.</p>
    </div>`;

  el.querySelectorAll("th[data-k]").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.k;
    dtSort = { key: k, dir: dtSort.key === k ? -dtSort.dir : -1 };
    const sorted = rows.slice().sort(cmp);
    const body = el.querySelector("tbody");
    if (body) {
      body.innerHTML = sorted.map(({ c, tm, availAmt }) => `
        <tr class="dt-${c.tier}">
          <td><b>${c.key}</b></td>
          <td class="num">${(c.rec_pct || 0).toFixed(1)}</td>
          <td class="num"><b style="color:${c.xirr_all != null && c.xirr_all < 0 ? "#f87171" : "#6ee7b7"}">${c.xirr_all != null ? c.xirr_all.toFixed(1) + "%" : "–"}</b></td>
          <td class="num">${c.xirr != null ? c.xirr.toFixed(1) + "%" : "–"}</td>
          <td class="num">${c.def_rate.toFixed(1)}%</td>
          <td class="num">${c.net_1000 != null ? "₹" + fmt.format(Math.round(c.net_1000)) : "–"}</td>
          <td class="num">${c.fee_pct != null ? c.fee_pct.toFixed(1) + "%" : "–"}</td>
          <td class="num">${c.avg_rate != null ? c.avg_rate.toFixed(1) + "%" : "–"}</td>
          <td class="num">${fmt.format(c.matured)}</td>
          <td><span class="dt-tier" style="color:${tm.color};border-color:${tm.color}44;background:${tm.color}1a">${tm.label}</span></td>
          <td class="num" style="color:${availAmt ? "#cbd5e1" : "#475569"}">${availAmt ? inrCompact(availAmt) : "—"}</td>
        </tr>`).join("");
    }
  }));
}

/* verdict tag for the loan register — "should I fund this loan?" per row */
function verdictCell(l) {
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
  if (!c) {
    const lab = l.score == null ? "no score" : l.score < 700 ? "score <700" : l.tenure == null ? "no tenure" : "unranked";
    return `<span class="badge verdict-unproven" title="Cell not ranked (${lab})">?</span>`;
  }
  const tm = TIER_META_DT[c.tier] || TIER_META_DT.gate;
  const title = `${c.key} · net XIRR ${c.xirr_all != null ? c.xirr_all.toFixed(1) + "%/yr" : "—"} incl. defaults · ${fmt.format(c.matured)} matured loans`;
  return `<span class="badge verdict-${c.tier}" style="color:${tm.color};border-color:${tm.color}55" title="${title}">${tm.label}</span>`;
}