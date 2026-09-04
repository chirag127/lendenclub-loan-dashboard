/* ============================================================
 * charts/atlas.js — xa01..xa42: the net-XIRR atlas
 * ------------------------------------------------------------
 * 42 heatmaps of the SAME 42 fine buckets (tenure × LenDenClub
 * score in 10-point bands: 700-709 … 790-799, 800+) — one
 * heatmap per metric per slice:
 *     14 metrics  ×  3 slices (whole book / 2025 / 2026)  =  42
 * Metrics computed per bucket by scripts/ldc/insights.py
 * (xirr_atlas()) and reconciled by audit checks W1–W2:
 *   xirr_all    pooled net XIRR incl. every default & fee
 *   xirr_ok     same pool, repaying loans only (upper bound)
 *   drag        xirr_ok − xirr_all (annual points defaults eat)
 *   loan_med    median per-loan annualized net return incl. fees
 *               & defaults (per-loan layer, losses capped −100%/yr)
 *   loan_mean   mean of the same
 *   def_rate    matured default rate over the loan's life
 *   def_ann     default rate per year (× 12/tenure)
 *   loss_life   NPA principal as % of ₹ lent (life)
 *   loss_ann    the same per year
 *   fee_pct     realized platform fee as % of ₹ lent
 *   sticker     average borrower interest rate
 *   net_1000    net kept ₹ per ₹1,000 lent (realized, matured)
 *   matured     evidence: matured loans in the bucket
 *   npa         NPA count in the bucket
 * Matured basis (CLOSED + NPA) everywhere; cells with < 5
 * matured loans report counts only (grey). Whole book — like the
 * other bucket maps these do not react to the month filter.
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

const atlasData = () => (window.INSIGHTS_DATA && INSIGHTS_DATA.xirr_atlas) || null;

const ATLAS_SLICE_LABEL = { ALL: "whole book", 2025: "originated 2025", 2026: "originated 2026" };
const ATLAS_SLICE_HINT = {
  ALL: "Whole book — the full matured history across both years.",
  2025: "Only the Dec-2025 vintage (the platform's earliest months).",
  2026: "Only loans originated in 2026 — the book's current behaviour.",
};

const ATLAS_METRICS = [
  { key: "xirr_all", label: "Net XIRR incl. every default", unit: "%/yr", dp: 0, dir: 1,
    hint: "Money-weighted annualized net return of every matured loan in the bucket — each platform fee and every default (zero-recovery NPAs as total losses) is inside the number. This is the bucket's true annual return; the picks panel is built from it." },
  { key: "xirr_ok", label: "XIRR — repaying loans only", unit: "%/yr", dp: 0, dir: 1,
    hint: "The same pooled XIRR after removing the bucket's NPAs entirely. What repaying borrowers earn — an upper bound that ignores the default bill." },
  { key: "drag", label: "Default drag (repaying − incl. defaults)", unit: "pts/yr", dp: 0, dir: -1,
    hint: "XIRR of repaying loans minus XIRR incl. all defaults: the annual-return points that defaults erase in each bucket. A large drag = the interest looks great until the default bill lands." },
  { key: "loan_med", label: "Median single loan's net return", unit: "%/yr", dp: 0, dir: 1,
    hint: "Middle of every individual loan's annualized net return incl. fees & its own default (losses capped at −100%/yr). The typical loan experience, where pooled XIRR is the money-weighted average." },
  { key: "loan_mean", label: "Mean single loan's net return", unit: "%/yr", dp: 0, dir: 1,
    hint: "Average of the same per-loan annualized returns — pulled down by the worst defaults, so it sits below the median in risky buckets." },
  { key: "def_rate", label: "Matured default rate — loan life", unit: "%", dp: 0, dir: -1,
    hint: "NPA loans ÷ matured loans over the whole term. Over the bucket's own life, before annualizing." },
  { key: "def_ann", label: "Default rate per year", unit: "%/yr", dp: 0, dir: -1,
    hint: "The same default rate scaled to a year of lending (× 12/tenure, money recycles). 2-month money's small default rate stacks up ~6× a year; a 12-month rate doesn't scale." },
  { key: "loss_life", label: "Principal loss % of ₹ lent — life", unit: "%", dp: 0, dir: -1,
    hint: "NPA principal (unrecovered) ÷ rupees disbursed on the same matured loans, over the term. The money actually gone per ₹ lent." },
  { key: "loss_ann", label: "Principal loss % of ₹ lent — per year", unit: "%/yr", dp: 0, dir: -1,
    hint: "The ₹ loss annualized by turnover — puts the rupee cost of 2-month and 12-month defaults on the same per-year footing." },
  { key: "fee_pct", label: "Platform fee % of ₹ lent", unit: "%", dp: 1, dir: -1,
    hint: "Platform fee actually paid on the bucket's matured loans ÷ rupees lent. Longer tenures carry the bigger fee schedule (≈1% at 2 mo up to ≈6% at 12 mo)." },
  { key: "sticker", label: "Borrower interest rate (avg)", unit: "%/yr", dp: 0, dir: 1,
    hint: "The average interest rate the borrower signed — the sticker before fees and defaults. Compare it with the net XIRR to see what actually reaches you." },
  { key: "net_1000", label: "Net kept ₹ per ₹1,000 lent", unit: "₹", dp: 0, dir: 1,
    hint: "Realized net kept (interest received − fees − NPA principal) per ₹1,000 lent on the bucket's matured loans, over the loan life. Negative = the bucket's defaults and fees ate the interest." },
  { key: "matured", label: "Evidence — matured loans", unit: "loans", dp: 0, dir: 0,
    hint: "How many CLOSED + NPA loans back each bucket's rates. Read every other heatmap next to this one: bright cells here are proven, pale or grey cells are thin evidence." },
  { key: "npa", label: "NPA count", unit: "loans", dp: 0, dir: -1,
    hint: "How many of the bucket's matured loans went NPA. The raw count behind the default-rate heatmaps." },
];

/* colour ramps: dir 1 = higher is better (green), dir -1 = higher is worse (red), 0 = neutral (blue) */
const ATLAS_RAMP = {
  1: ["#7f1d1d", "#ef4444", "#fbbf24", "#bbf7d0", "#22c55e", "#166534"],
  "-1": ["#166534", "#22c55e", "#bbf7d0", "#fbbf24", "#ef4444", "#7f1d1d"],
  0: ["#0b1f3a", "#1e3a8a", "#2563eb", "#60a5fa", "#bae6fd"],
};

const ATLAS_CHART_IDS = [];
ATLAS_METRICS.forEach((m, mi) => {
  ["ALL", "2025", "2026"].forEach((sk, si) => {
    const id = "xa" + String(mi * 3 + si + 1).padStart(2, "0");
    ATLAS_CHART_IDS.push(id);
    addChart(
      "The net-XIRR atlas — 42 heatmaps of the fine buckets",
      "The same 42 tenure × score buckets (tenures × 10-point score bands 700-709 … 790-799, 800+) mapped 42 ways: 14 metrics — pooled net XIRR incl. every default, repaying-loans-only XIRR, default drag, per-loan median/mean annualized return, default & loss rates (over life and per year), fees, sticker rate, net kept per ₹1,000, and evidence — each across the whole book, the 2025 vintage and the 2026 vintage. Every number is computed by xirr_atlas() in the Python pipeline (audit W1–W2).",
      id,
      m.label + " · " + ATLAS_SLICE_LABEL[sk],
      m.hint + " " + ATLAS_SLICE_HINT[sk] + " Matured basis; grey cells = no loans or fewer than 5 matured (rates would be noise).",
      300,
      () => {
        const at = atlasData();
        if (!at || !at.slices) return null;
        const sl = at.slices[sk];
        const cells = sl ? sl.cells : {};
        const yI = {}; at.tenures.forEach((t, i) => { yI[t] = i; });
        const xI = {}; at.band_labels.forEach((b, i) => { xI[b] = i; });
        const pts = [];
        Object.values(cells).forEach((c) => {
          if (c[m.key] == null) return;
          pts.push([xI[c.band], yI[c.t], c[m.key]]);
        });
        const vals = pts.map((p) => p[2]);
        if (!vals.length) return null;
        const lo = Math.min(...vals), hi = Math.max(...vals);
        const pad = Math.max(1, (hi - lo) * 0.08);
        const ext = m.dir !== 0 ? Math.max(Math.abs(lo), Math.abs(hi), 5) : null;
        const vmin = m.dir !== 0 ? (lo >= 0 ? 0 : -ext) : lo - pad;
        const vmax = m.dir !== 0 ? (hi <= 0 ? 0 : ext) : hi + pad;
        const fmtV = (v) => {
          if (v == null) return "–";
          if (m.key === "matured" || m.key === "npa") return fmt.format(v);
          const s = v.toFixed(m.dp);
          return (m.unit === "%/yr" || m.unit === "%") ? s + "%" : (m.unit === "₹" ? "₹" + v.toFixed(0) : s);
        };
        return {
          ...baseOption(),
          animation: false,
          tooltip: {
            ...baseOption().tooltip,
            trigger: "item",
            formatter: (p) => {
              const b = at.band_labels[p.value[0]];
              const t = at.tenures[p.value[1]];
              const c = cells[t + "|" + b];
              if (!c) return "";
              const small = c.matured < 10 ? " <span style='color:#fcd34d'>† small sample</span>" : "";
              return `<b>${t} mo × score ${b}</b>${small}<br/>` +
                `<span style='color:#8fa3c0'>${fmt.format(c.matured)} matured · ${fmt.format(c.npa)} NPA · ₹${fmt.format(Math.round(c.disb))} lent</span><br/>` +
                `<b style='color:#e6edf7'>${m.label}: ${fmtV(p.value[2])}</b><br/>` +
                `<span style='color:#8fa3c0'>${ATLAS_SLICE_HINT[sk]}</span>`;
            },
          },
          grid: { left: 40, right: 30, top: 10, bottom: 24 },
          xAxis: { type: "category", data: at.band_labels, axisLine: AXIS.axisLine, axisLabel: { color: "#8fa3c0", fontSize: 9.5, interval: 0, rotate: 0 } },
          yAxis: { type: "category", data: at.tenures.map((t) => t + " mo"), inverse: true, axisLine: AXIS.axisLine, axisLabel: { color: "#8fa3c0", fontSize: 10 } },
          visualMap: {
            min: Math.round(vmin * 10) / 10, max: Math.round(vmax * 10) / 10,
            calculable: false, orient: "vertical", right: 2, top: "center",
            textStyle: { color: "#8fa3c0", fontSize: 9.5 },
            inRange: { color: ATLAS_RAMP[m.dir] },
            formatter: (v) => (m.unit === "%/yr" || m.unit === "%" ? Math.round(v) + "%" : (m.unit === "₹" ? "₹" + Math.round(v) : Math.round(v))),
          },
          series: [{
            type: "heatmap",
            data: pts,
            label: { show: true, color: "#fff", fontSize: 9, fontWeight: 600, formatter: (p) => (m.key === "matured" || m.key === "npa" ? fmt.format(p.value[2]) : (Math.abs(p.value[2]) >= 100 ? Math.round(p.value[2]) : p.value[2].toFixed(m.dp))) },
            itemStyle: { borderColor: "#0f1a2e", borderWidth: 1.5 },
            emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(148,163,184,0.5)", borderColor: "#fff", borderWidth: 1.5 } },
          }],
        };
      }
    );
  });
});
window.ATLAS_CHART_IDS = ATLAS_CHART_IDS;
