/* ============================================================
 * ui/renderer.js — buildLayout, renderAll, safeTooltip, chart instance lifecycle
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ---------------- renderer ---------------- */
const instances = {};
const cardsEl = document.getElementById("charts");

function buildLayout() {
  cardsEl.innerHTML = "";
  SECTIONS.forEach((sec) => {
    const secEl = document.createElement("section");
    secEl.className = "section-title";
    secEl.innerHTML = `<h2>${sec.name}</h2><p>${sec.sub}</p>`;
    cardsEl.appendChild(secEl);
    if (sec.guardrails) {
      const g = document.createElement("div");
      g.className = "guardrails";
      g.id = "guardrails";
      cardsEl.appendChild(g);
    }
    if (sec.returnsStatement) {
      const rs = document.createElement("div");
      rs.className = "returns-statement";
      rs.id = "returns-statement";
      cardsEl.appendChild(rs);
    }
    if (sec.riskMatrix) {
      const mx = document.createElement("div");
      mx.className = "risk-matrix";
      mx.id = "risk-matrix";
      cardsEl.appendChild(mx);
    }
    if (sec.loanPicks) {
      const lp = document.createElement("div");
      lp.className = "loan-picks";
      lp.id = "loan-picks";
      cardsEl.appendChild(lp);
    }
    if (sec.why) {
      const w = document.createElement("div");
      w.className = "reasons";
      w.id = "reasons";
      cardsEl.appendChild(w);
    }
    if (sec.charts.length) {
      const grid = document.createElement("div");
      grid.className = "grid";
      sec.charts.forEach((c) => {
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
  const L = filtered();
  SECTIONS.forEach((sec) => {
    sec.charts.forEach((c) => {
      let inst = instances[c.id];
      if (!inst) {
        inst = echarts.init(document.getElementById("ch-" + c.id), null, { renderer: "canvas" });
        instances[c.id] = inst;
        window.addEventListener("resize", () => inst.resize());
      }
      inst.setOption(safeTooltip(polish(c.builder(L, SUMMARY))), true);
    });
  });
  renderGuardrails();
  renderReturnsStatement();
  renderLoanPicks();
  renderRiskMatrix();
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
