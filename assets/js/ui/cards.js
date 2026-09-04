/* ============================================================
 * ui/cards.js — the insight-card engine + registry
 * ------------------------------------------------------------
 * A generic "What the data shows / Why it happens" card system.
 * Anyone (or any future module) can add a card with:
 *
 *   addInsightCard({
 *     section: "What loans actually pay — net of fees & defaults", // or "All"
 *     tone: "good" | "bad" | "warn" | "info",
 *     icon: "🥇",
 *     title: "...",
 *     data: (ctx) => `html with <b>${pct(ctx.X.portfolio_net)}/yr</b>`,
 *     why:  (ctx) => `plain-language explanation`,
 *     need: (ctx) => true | false,   // data-presence gate: a card whose data
 *   });                              // is missing renders nowhere (no stubs)
 *
 * renderInsightCards() re-renders the card grids for the ACTIVE tab only,
 * skipping cards whose need() returns false — so cards vanish rather than
 * lie when a slice has no loans (filters) or the payload lacks a key.
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

const INSIGHT_CARDS = [];

function addInsightCard(def) {
  INSIGHT_CARDS.push(def);
}

function cardCtx() {
  const S = (window.SUMMARY_DATA || {}).summary || {};
  const st = (window.SUMMARY_DATA || {}).stats || {};
  const INS = window.INSIGHTS_DATA || {};
  const all = LOANS || [];
  const mat = all.filter((l) => l.status === "CLOSED" || l.status === "NPA");
  const npaLs = all.filter((l) => l.status === "NPA");
  const act = all.filter((l) => l.status === "ACTIVE");
  const T = (t) => all.filter((l) => l.tenure === t);
  const md = (t) => {
    const m = T(t).filter((l) => l.status === "CLOSED" || l.status === "NPA");
    const n = m.filter((l) => l.status === "NPA").length;
    return m.length ? 100 * n / m.length : null;
  };
  const npaDisb = npaLs.reduce((a, l) => a + (l.amount || 0), 0);
  const npaRec = npaLs.reduce((a, l) => a + (l.total_received || 0), 0);
  const zeros = npaLs.filter((l) => (l.total_received || 0) <= 0);
  const picks = INS.xirr_picks || {};
  return {
    S, st, INS, all, mat, npaLs, act, T, md, npaDisb, npaRec, zeros, picks,
    O: INS.overall_returns || {},
    X: INS.xirr_returns || {},
    AX: INS.active_xirr || {},
    IC: INS.interest_collection_rates || {},
    A: INS.xirr_atlas || null,
    FS: INS.fee_schedule || {},
    MA: INS.month_allocation || null,
    xA: (INS.xirr_returns || {}).net_all_by_tenure || {},
    ic: (t) => (((INS.interest_collection_rates || {})[t] || {}).collection_rate),
    cell: (t, b) => (picks.cells || []).find((c) => c.tenure === t && c.band === b),
  };
}

function renderInsightCards() {
  const ctx = cardCtx();
  const curView = state.view;
  const groups = {};
  INSIGHT_CARDS.forEach((c) => {
    if (c.need && !c.need(ctx)) return; // data-presence gate: no stubs, no lies
    (groups[c.section || "All"] = groups[c.section || "All"] || []).push(c);
  });
  const hosts = [];
  if (curView === "All") {
    document.querySelectorAll(".insight-cards[id^='insight-cards-']").forEach((h) => hosts.push(h));
  } else {
    const h = document.getElementById("insight-cards-" + CSS.escape(curView));
    if (h) hosts.push(h);
  }
  hosts.forEach((host, hi) => {
    const secName = host.dataset ? host.dataset.section : null;
    /* whole-book cards render once — in the FIRST card host of the active view —
       so the All tab does not repeat them in every section */
    const globals = hi === 0 ? (groups["All"] || []) : [];
    const list = globals.concat(secName ? (groups[secName] || []) : []);
    host.innerHTML = list.length
      ? `<div class="card-grid">${list.map(cardHtml).join("")}</div>`
      : "";
  });
}

function cardHtml(c) {
  let data = "", why = "";
  try { data = typeof c.data === "function" ? c.data(cardCtx()) : (c.data || ""); } catch (e) { return ""; }
  try { why = typeof c.why === "function" ? c.why(cardCtx()) : (c.why || ""); } catch (e) { return ""; }
  if (!data && !why) return "";
  return `
    <div class="reason-card tone-${c.tone || "info"}">
      <div class="reason-head"><span class="reason-ico">${c.icon || "📌"}</span><div class="reason-title">${c.title}</div></div>
      <div class="reason-sec"><div class="reason-sectag">What the data shows</div><div class="reason-body">${data}</div></div>
      <div class="reason-sec"><div class="reason-sectag">Why it happens</div><div class="reason-body">${why}</div></div>
    </div>`;
}
