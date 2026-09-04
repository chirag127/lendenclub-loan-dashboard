/* ============================================================
 * ui/tabs.js — renderViewbar: tab bar + chart-density control
 * ------------------------------------------------------------
 * One toolbar, two controls:
 *   • Tabs — "All views" plus one tab per section (each shows its
 *     live chart count). Switching a tab re-lays out the page to
 *     just that section; the "Full chart registry" tab exposes every
 *     non-curated definition the code can show (no cap, no min).
 *   • Density — Compact / Standard / Everything:
 *       compact    = only charts flagged essential (c.essential in
 *                    charts/*.js); sections that flag none keep all
 *       standard   = the full curated set (default)
 *       everything = curated set + the Full-registry section
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

function switchView(name) {
  state.view = name;
  renderTabs();
  renderAll();
  renderInsightCards();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setDensity(mode) {
  state.density = mode;
  renderTabs();
  renderAll();
  renderInsightCards();
}

/* short chip labels for the group jump-nav (full titles stay in the tab bar) */
const GROUP_CHIP_LABELS = {
  "The book at a glance": "Glance",
  "Borrower supply & ticket sizes": "Supply & tickets",
  "What loans actually pay — net of fees & defaults": "What loans pay",
  "Expected future returns — what the book should earn next": "Future returns",
  "Where loans default — risk by tenure × score": "Where loans default",
  "Fine-bucket net-XIRR atlas — tenure × score": "XIRR atlas",
  "NPA by origination year — tenure-level vs annualized": "NPA by year",
  "Defaults by origination cohort — curves, rates & the ₹ bill": "Cohort curves",
  "Cashflow & watch-outs": "Cashflow",
  "Your questions answered": "Q&A",
  "The verdict — lend only these": "The verdict",
};
function groupChipLabel(sec) {
  const full = "Full chart registry — everything else the code can show";
  if (sec.name === full) return "Full registry";
  const hit = GROUP_CHIP_LABELS[sec.name];
  if (hit) return hit;
  const short = sec.name.split(" — ")[0];
  return short.length > 26 ? short.slice(0, 24) + "…" : short;
}

function renderTabs() {
  const bar = document.getElementById("viewTabs");
  if (!bar) return;
  const full = "Full chart registry — everything else the code can show";
  const tabs = [{ name: "All", label: "All views", count: activeSections().reduce((a, s) => a + visibleCharts(s).length, 0) }]
    .concat(SECTIONS.map((s) => ({
      name: s.name,
      label: s.name === full ? "Full registry" : s.name,
      count: visibleCharts(s).length,
      hideCount: !!s.qa, // Q&A group holds no charts — its pill would lie
    })));
  const chips = state.view === "All"
    ? activeSections().map((s, i) => `
        <button class="jchip" data-jump="${s.name.replace(/"/g, "&quot;")}" title="Jump to group ${String(i + 1).padStart(2, "0")} — ${s.name}">
          <span class="jchip-n">${String(i + 1).padStart(2, "0")}</span>${groupChipLabel(s)}
        </button>`).join("")
    : "";
  bar.innerHTML = `
    <div class="tab-row" role="tablist">
      ${tabs.map((t) => `
        <button class="vtab ${state.view === t.name ? "on" : ""}" role="tab"
          aria-selected="${state.view === t.name}" data-view="${t.name}" title="${t.name}">
          ${t.label}${t.hideCount ? "" : `<span class="vtab-n">${t.count}</span>`}
        </button>`).join("")}
    </div>
    <div class="density-row">
      <span class="filter-label">Chart density</span>
      ${["compact", "standard", "everything"].map((d) => `
        <button class="dbtn ${state.density === d ? "on" : ""}" data-density="${d}"
          title="${d === "compact" ? "Only the essential charts per section" : d === "standard" ? "The full curated set" : "Curated set + the full chart registry — every definition the code has"}">${d[0].toUpperCase() + d.slice(1)}</button>`).join("")}
    </div>
    ${chips ? `<div class="jump-row"><span class="filter-label">Jump to</span><div class="jump-chips">${chips}</div></div>` : ""}`;
  bar.querySelectorAll(".vtab").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.view)));
  bar.querySelectorAll(".dbtn").forEach((b) => b.addEventListener("click", () => setDensity(b.dataset.density)));
  bar.querySelectorAll(".jchip").forEach((b) =>
    b.addEventListener("click", () => {
      const target = b.dataset.jump;
      const grp = [...document.querySelectorAll(".group")].find((g) => g.dataset.section === target);
      if (grp) grp.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
}
