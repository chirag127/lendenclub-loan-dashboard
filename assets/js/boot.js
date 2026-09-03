/* ============================================================
 * boot.js — chart-library CDN fallback, showError, init() and filter listeners; LOAD LAST
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ---------------- chart library loading (CDN fallback chain) ---------------- */
const ECHARTS_CDNS = [
  "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js",
  "https://unpkg.com/echarts@5.5.1/dist/echarts.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.1/echarts.min.js",
];
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => { s.remove(); reject(new Error("Failed to load " + src)); };
    document.head.appendChild(s);
  });
}
async function ensureECharts() {
  if (window.echarts) return;
  for (const cdn of ECHARTS_CDNS) {
    try { await loadScript(cdn); if (window.echarts) return; } catch (e) { /* try next CDN */ }
  }
  throw new Error("Could not load the chart library from any CDN.");
}

function showError(msg) {
  const box = document.createElement("div");
  box.style.cssText = "max-width:1400px;margin:20px auto;padding:14px 18px;border:1px solid #ef4444;border-radius:10px;background:rgba(239,68,68,0.12);color:#fca5a5;font-size:13px";
  box.textContent = msg;
  document.body.insertBefore(box, document.body.firstChild);
  console.error(msg);
}

/* ---------------- init ---------------- */
async function init() {
  try {
    /* data always ships as script-tag globals (data/*.js) so the page works from file:// with no server and no CORS.
       The fetch below is only a fallback for http(s) hosting where the scripts were omitted. */
    const loadJson = (g, url) =>
      window[g] ? Promise.resolve(window[g])
        : location.protocol === "file:" ? Promise.reject(new Error(url.replace(".json", ".js") + " did not load — keep the data/*.js files next to index.html"))
        : fetch(url).then((r) => r.json());
    const [loans, summary] = await Promise.all([
      loadJson("LOAN_DATA", "data/loans.json"),
      loadJson("SUMMARY_DATA", "data/summary.json"),
    ]);
    if (!Array.isArray(loans) || !loans.length || !summary || !summary.summary) {
      throw new Error("Loan data failed to load.");
    }
    LOANS = loans;
    SUMMARY = summary;
    MONTHS = [...new Set(loans.map((l) => (l.disbursement_date || "").slice(0, 7)).filter(Boolean))].sort();
    const s = summary.summary;
    document.getElementById("headerMeta").innerHTML =
      `<strong>${summary.lender.name}</strong> · ID ${summary.lender.user_id}<br>${s.from_date} → ${s.to_date} · <strong>${fmt.format(summary.stats.total_loans)}</strong> loans · <strong>${inr(s.disbursed_amount)}</strong> disbursed`;
    buildLayout();
    renderChips();
    renderKPIs();
    renderTable();
    renderGuardrails();
    renderReasons();
    renderAudit();
    await ensureECharts();
    renderAll();
    console.log("Dashboard ready —", SECTIONS.reduce((a, s) => a + s.charts.length, 0), "charts");
  } catch (err) {
    showError("Something went wrong: " + err.message + " — try reloading the page.");
  }
}

document.getElementById("repayFilter").addEventListener("change", (e) => { state.repay = e.target.value; renderAll(); renderKPIs(); renderTable(); });
document.getElementById("windowFilter").addEventListener("change", (e) => { state.window = e.target.value; renderAll(); renderKPIs(); renderTable(); });
document.getElementById("resetBtn").addEventListener("click", () => {
  state.status = new Set(["CLOSED", "ACTIVE", "NPA", "PROCESSING", "REJECTED", "CANCELLED"]);
  state.repay = "All"; state.window = "All";
  document.getElementById("repayFilter").value = "All";
  document.getElementById("windowFilter").value = "All";
  document.getElementById("tableSearch").value = "";
  renderChips(); renderAll(); renderKPIs(); renderTable();
});
document.getElementById("tableSearch").addEventListener("input", renderTable);

init();
