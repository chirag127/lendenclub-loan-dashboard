/* ============================================================
 * ui/filters.js — renderChips (status chips + wiring)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ---------------- filters ---------------- */
function renderChips() {
  const el = document.getElementById("statusChips");
  const counts = {};
  LOANS.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });
  el.innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([st, cnt]) => `<span class="chip ${state.status.has(st) ? "active" : "off"}" data-status="${st}"><span class="dot" style="background:${STATUS_COLORS[st]}"></span>${st} <span class="cnt">${fmt.format(cnt)}</span></span>`)
    .join("");
  el.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const st = chip.dataset.status;
      if (state.status.has(st)) { if (state.status.size > 1) state.status.delete(st); }
      else state.status.add(st);
      renderChips(); renderAll(); renderKPIs(); renderTable();
    });
  });
}
