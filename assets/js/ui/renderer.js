/* ============================================================
 * ui/renderer.js — buildLayout, renderAll, safeTooltip, chart lifecycle
 * ------------------------------------------------------------
 * Sections are independent wrappers so they can be shown/hidden by the
 * tab bar (ui/tabs.js) and the density switch (state.density):
 *   - "All views" tab shows every curated section (plus the Full registry
 *     only when density = "everything");
 *   - a section tab shows just that section (Full registry is its own tab);
 *   - density limits charts inside every shown section:
 *       compact    = charts flagged essential (c.essential; falls back to
 *                    all when a section flags none)
 *       standard   = the full curated set (default)
 *       everything = curated set + the Full-registry section (no cap)
 *   - a section whose filtered slice has none of the loans it needs
 *     (hasLoansInSlice) renders a friendly empty-state instead of zeros;
 *     whole-book sections (whole: true) ignore filters and never empty-state.
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

const instances = {};
const cardsEl = document.getElementById("charts");

/* layout fingerprint — rebuild the DOM only when the visible set really changes
   (tabs, density, or any filter that changes how many loans are in the slice) */
let lastLayoutKey = "";

function layoutKey() {
  const slice = filtered().length + "|" + state.repay + "|" + state.window + "|" + [...state.status].sort().join(",");
  const vis = activeSections().map((sec) =>
    sec.name + ":" + visibleCharts(sec).map((c) => c.id).join(",")).join("|");
  return slice + "#" + state.view + "#" + state.density + "#" + vis;
}

function activeSections() {
  if (state.view === "All") {
    const full = "Full chart registry — everything else the code can show";
    return SECTIONS.filter((sec) => sec.name !== full || state.density === "everything");
  }
  return SECTIONS.filter((sec) => sec.name === state.view);
}

function visibleCharts(sec) {
  if (state.density === "compact") {
    const ess = sec.charts.filter((c) => c.essential);
    return ess.length ? ess : sec.charts.slice();
  }
  return sec.charts.slice();
}

function disposeAllCharts() {
  Object.keys(instances).forEach((id) => {
    try { instances[id].dispose(); } catch (e) { /* already gone */ }
    delete instances[id];
  });
}

function emptyStateHtml(sec) {
  const whole = sec.whole
    ? `This view reads the <b>whole book</b> (cohort and bucket analysis needs the full history), so it stays populated even when the filters above match nothing.`
    : `Loosen the status chips, repayment type or data window above — every chart in this view reacts to them.`;
  return `<div class="empty-state"><b>No loans match the current filters for this view.</b><span>${whole}</span></div>`;
}

function buildLayout() {
  const key = layoutKey();
  if (key === lastLayoutKey) return;
  lastLayoutKey = key;
  disposeAllCharts();
  cardsEl.innerHTML = "";
  activeSections().forEach((sec) => {
    const secEl = document.createElement("section");
    secEl.className = "section-title";
    secEl.dataset.section = sec.name;
    secEl.innerHTML = `<h2>${sec.name}</h2><p>${sec.sub}</p>`;
    cardsEl.appendChild(secEl);

    /* data-presence gate: a filtered slice with none of the loans this section
       needs shows a friendly explanation instead of empty charts */
    if (!sec.whole && !hasLoansInSlice(sec)) {
      secEl.insertAdjacentHTML("afterend", emptyStateHtml(sec));
      return;
    }

    if (sec.guardrails) cardsEl.insertAdjacentHTML("beforeend", `<div class="guardrails" id="guardrails"></div>`);
    if (sec.returnsStatement) cardsEl.insertAdjacentHTML("beforeend", `<div class="returns-statement" id="returns-statement"></div>`);
    if (sec.riskMatrix) cardsEl.insertAdjacentHTML("beforeend", `<div class="risk-matrix" id="risk-matrix"></div>`);
    if (sec.npaYearTable) cardsEl.insertAdjacentHTML("beforeend", `<div class="npa-year-table" id="npa-year-table"></div>`);
    if (sec.vintageTable) cardsEl.insertAdjacentHTML("beforeend", `<div class="vintage-table" id="vintage-table"></div>`);
    if (sec.loanPicks) cardsEl.insertAdjacentHTML("beforeend", `<div class="loan-picks" id="loan-picks"></div>`);
    if (sec.why) cardsEl.insertAdjacentHTML("beforeend", `<div class="reasons" id="reasons"></div>`);
    if (sec.cards) cardsEl.insertAdjacentHTML("beforeend", `<div class="insight-cards" id="insight-cards-${CSS.escape(sec.name)}" data-section="${sec.name}"></div>`);

    if (sec.charts.length) {
      const grid = document.createElement("div");
      grid.className = "grid";
      grid.dataset.section = sec.name;
      visibleCharts(sec).forEach((c) => {
        const card = document.createElement("div");
        card.className = "chart-card";
        card.innerHTML = `<div class="chart-head"><h3>${c.title}</h3><div class="chart-sub">${c.sub}</div></div><div class="chart-body" id="ch-${c.id}"></div>`;
        grid.appendChild(card);
      });
      cardsEl.appendChild(grid);
    }
  });
}

function renderAll() {
  buildLayout();
  const L = filtered();
  const emptySlice = !L.length;
  activeSections().forEach((sec) => {
    if (!sec.whole && emptySlice) return; // layout already rendered the empty-state
    visibleCharts(sec).forEach((c) => {
      const host = document.getElementById("ch-" + c.id);
      if (!host) return;
      try {
        const opt = c.builder(L, SUMMARY);
        if (!opt) { // data gap — say so instead of a blank box
          host.innerHTML = `<div class="chart-empty">Not enough data in this slice to plot this view.</div>`;
          return;
        }
        host.innerHTML = "";
        let inst = instances[c.id];
        if (!inst) {
          inst = echarts.init(host, null, { renderer: "canvas" });
          instances[c.id] = inst;
        }
        inst.resize();
        inst.setOption(safeTooltip(polish(opt)), true);
      } catch (err) {
        host.innerHTML = `<div class="chart-empty">This chart hit a data edge case (${String(err && err.message || err).slice(0, 90)}).</div>`;
      }
    });
  });
  /* panels re-render only if their host still exists in this layout */
  if (document.getElementById("guardrails")) renderGuardrails();
  if (document.getElementById("returns-statement")) renderReturnsStatement();
  if (document.getElementById("loan-picks")) renderLoanPicks();
  if (document.getElementById("risk-matrix")) renderRiskMatrix();
  if (document.getElementById("npa-year-table")) renderNpaYearTable();
  if (document.getElementById("vintage-table")) renderVintageTable();
  if (document.getElementById("reasons")) renderReasons();
  renderInsightCards();
}

/* one global resize handler for every live chart instance */
window.addEventListener("resize", resizeAllCharts);

function resizeAllCharts() {
  Object.values(instances).forEach((inst) => { try { inst.resize(); } catch (e) { /* gone */ } });
}

/* make every tooltip formatter immune to axis-vs-item params shape */
function safeTooltip(opt) {
  if (opt && opt.tooltip && typeof opt.tooltip.formatter === "function") {
    const trig = opt.tooltip.trigger || "axis";
    const orig = opt.tooltip.formatter;
    opt.tooltip.formatter = function (p) {
      try {
        if (trig === "axis") {
          const a = Array.isArray(p) ? p : p && p.value != null ? [p] : [];
          return a.length ? orig(a) : "";
        }
        return orig(p);
      } catch (e) {
        return "";
      }
    };
  }
  return opt;
}
