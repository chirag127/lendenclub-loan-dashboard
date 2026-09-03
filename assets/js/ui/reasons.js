/* ============================================================
 * ui/reasons.js — renderReasons ('why' cards + lend-only verdict strip)
 * ------------------------------------------------------------
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ---------------- "why" — plain-language reasons (whole-book narrative, data-driven text) ---------------- */
function renderReasons() {
  const el = document.getElementById("reasons");
  if (!el) return;
  const S = (window.SUMMARY_DATA || {}).summary || {};
  const st = (window.SUMMARY_DATA || {}).stats || {};
  const INS = window.INSIGHTS_DATA || {};
  const O = INS.overall_returns || {};
  const X = INS.xirr_returns || {};
  const AX = INS.active_xirr || {};
  const IC = INS.interest_collection_rates || {};
  const P = INS.xirr_picks || {};
  const cells = (P.cells || []).slice();
  if (!O.disbursed) { el.innerHTML = `<div class="v-foot">Reasons are unavailable — the data file is missing or stale. Rebuild with <code>python scripts/build.py</code>.</div>`; return; }

  /* whole-book facts recomputed from the same loan records the charts use */
  const all = LOANS || [];
  const T = (t) => all.filter((l) => l.tenure === t);
  const md = (t) => { const m = T(t).filter((l) => l.status === "CLOSED" || l.status === "NPA"); const n = T(t).filter((l) => l.status === "NPA").length; return m.length ? (n / m.length) * 100 : null; };
  const d = { 2: md(2), 3: md(3), 4: md(4), 5: md(5), 6: md(6), 12: md(12) };
  const npaLs = all.filter((l) => l.status === "NPA");
  const npaDisb = npaLs.reduce((a, l) => a + (l.amount || 0), 0);
  const npaRec = npaLs.reduce((a, l) => a + (l.total_received || 0), 0);
  const zeros = npaLs.filter((l) => (l.total_received || 0) <= 0);
  const zeroAmt = zeros.reduce((a, l) => a + (l.amount || 0), 0);
  const recPct = npaDisb ? (npaRec / npaDisb) * 100 : 0;
  const t6share = all.length ? (T(6).length / all.length) * 100 : 0;
  const npa6share = npaLs.length ? (T(6).filter((l) => l.status === "NPA").length / npaLs.length) * 100 : 0;

  const xA = X.net_all_by_tenure || {};
  const ic = (t) => ((IC[t] || {}).collection_rate);
  const cell = (t, b) => cells.find((c) => c.tenure === t && c.band === b);
  const c61 = cell(6, "700–724");
  const c2lo = cell(2, "700–724");
  const gX = X.portfolio_gross, nX = X.portfolio_net, aX = X.portfolio_net_all;
  const feePp = gX != null && nX != null ? gX - nX : null;
  const defPp = nX != null && aX != null ? nX - aX : null;

  const cards = [
    { tone: "good", icon: "🥇", title: "Why 2–3 month loans are your best earners",
      data: `2-month closed loans net <b>${pct(xA["2"])}/yr</b> with every default included while only <b>${pct(d[2])}</b> of completed loans defaulted. 3-month nets <b>${pct(xA["3"])}/yr</b> at <b>${pct(d[3])}</b> default. Compare the long tenures: 6-month <b>${pct(xA["6"])}/yr</b>, 12-month <b>${pct(xA["12"])}/yr</b> — a loss.`,
      why: `A borrower only has 2–3 months to go bad, so very few do, and the money returns fast enough to be lent again at the same <b>~${pct(st.avg_interest_rate)}</b> contracted rate. Short window = low default; low default × high rate × fast recycling is the strongest risk-adjusted return in your book.` },
    { tone: "bad", icon: "💸", title: "Why 12-month loans lose money even though they quote the highest rates",
      data: `On your completed 12-month loans only <b>${pct(ic(12))}</b> of the contracted interest was ever collected (vs <b>${pct(ic(3))}</b> for 3-month), <b>${pct(d[12])}</b> of completed loans defaulted, and the net XIRR with all defaults is <b>${pct(xA["12"])}/yr</b>.`,
      why: `A year gives a weak borrower plenty of time to stop paying, and the borrowers who do repay usually foreclose early — so you receive far less than the year of interest you were promised. You still pay the platform fee up front, and the capital is locked for 12 months while 2-month money could have recycled ~6 times. It is the worst of both worlds.` },
    { tone: "bad", icon: "🎲", title: "Why 6-month is your NPA engine — and exactly where",
      data: `6-month loans are <b>${pct(t6share)}</b> of the book by count but <b>${pct(npa6share)}</b> of all NPAs, with <b>${pct(d[6])}</b> of completed loans defaulting. The single worst cell is 6-month × score 700–724: <b>${c61 && c61.matured ? c61.matured : "—"} completed loans, ${pct(c61 ? c61.def_rate : null)} defaulting</b>, netting <b>${pct(c61 ? c61.xirr_all : null)}/yr</b>.`,
      why: `Six months is long enough for defaults to actually happen, and the extra interest that longer tenure quotes is nowhere near enough to pay for ${pct(d[6])} of loans going bad. Below score 750 the pricing advantage disappears entirely — which is why the picks gate 6-month at score ≥ 750.` },
    { tone: "info", icon: "🎯", title: "Why the LenDenClub score barely matters on 2-month loans",
      data: `Only <b>0.8%</b> of all 2-month loans ever went NPA (3 of 359). Across score bands the realised net XIRR is <b>${pct(c2lo ? c2lo.xirr_all : null)}–${pct(cell(2, "725–749") ? cell(2, "725–749").xirr_all : null)}/yr</b> — the lowest-score 2-month band still made money.`,
      why: `At 2 months there is simply not enough time for a weak borrower to fail. The score differences that predict 12-month behaviour have almost no room to show up, so on very short money you should optimise for rate and availability rather than score.` },
    { tone: "info", icon: "⚖️", title: "Why the XIRR numbers (~53%) are roughly double the simple ROI (~8%)",
      data: `Simple net ROI on everything lent: <b>${pct(O.net_roi)}</b>. Money-weighted net XIRR on the same closed loans: <b>${pct(X.portfolio_net)}/yr</b>. The pipeline puts average capital at risk at ~<b>${X.avg_capital_at_risk_pct != null ? X.avg_capital_at_risk_pct.toFixed(0) : "—"}%</b> of the headline amount.`,
      why: `Monthly EMIs bring your capital back through the life of every loan, so at any moment you only have about half your money out. XIRR annualises the return on the capital actually at risk and compounds it as the money recycles; simple ROI divides profit by the full amount lent and ignores both time and payback speed. Both are correct — they answer different questions.` },
    { tone: "warn", icon: "🪜", title: "Why your ~46% average contracted rate becomes ~22% net — the full ladder",
      data: `Average contracted rate <b>${pct(st.avg_interest_rate)}</b> → gross XIRR <b>${pct(gX)}/yr</b> → minus platform fees (<b>${inr(S.platform_fee)}</b>, ~${feePp != null ? feePp.toFixed(1) : "—"} pts) → <b>${pct(nX)}/yr</b> on successful loans → minus all NPA defaults (<b>${inr(O.npa_loss)}</b> at risk, ~${defPp != null ? defPp.toFixed(1) : "—"} pts) → <b>${pct(aX)}/yr net</b>.`,
      why: `Two costs are unavoidable in P2P lending and neither appears in the quoted rate: the platform fee is charged up front on every loan, and credit losses are paid later out of principal. Only after both are subtracted do you get the return you can actually spend — about <b>${pct(aX)}/yr</b>.` },
    { tone: "bad", icon: "🕳️", title: "Why 'successful loans' (53.2%) and 'all defaults' (22.2%) differ by ~31 points",
      data: `<b>${npaLs.length}</b> NPAs put <b>${inr(npaDisb)}</b> of principal at risk; only <b>${inr(npaRec)}</b> (${pct(recPct)}) ever came back — and <b>${zeros.length}</b> of those loans returned literally nothing: <b>${inr(zeroAmt)}</b> of total loss.`,
      why: `Every default is counted as your money going out with only actual receipts coming back, and a zero-recovery loan is a 100% loss. That is the ~${defPp != null ? defPp.toFixed(0) : "—"}-point gap between the two lines. The 53% figure excludes the NPA book entirely — treat it as an upper bound, not a promise.` },
    { tone: "warn", icon: "⏳", title: "Why the active book projects ~29% while you have realised ~22%",
      data: `<b>${AX.loans_used || "—"}</b> active loans with <b>${inr(AX.outstanding)}</b> still outstanding: <b>${pct(AX.portfolio_expected)}/yr</b> if new defaults behave like your history, <b>${pct(AX.portfolio_no_default)}/yr</b> if everyone repays.`,
      why: `Active loans are young — most of their late payments and defaults have not happened yet, so their cashflows still look clean. Expect most of the gap between ${pct(AX.portfolio_no_default)} and ${pct(AX.portfolio_expected)} to close as the book matures: ~${pct(AX.portfolio_expected)} is the 'if history repeats' figure, not a guarantee.` },
    { tone: "good", icon: "🔁", title: "Why 2-month money beats 6-month money year after year",
      data: `2-month: <b>${pct(xA["2"])}/yr</b> with all defaults in, matured default <b>${pct(d[2])}</b>. 6-month: <b>${pct(xA["6"])}/yr</b>, default <b>${pct(d[6])}</b>. Completed 2-month cycles net ~4.6% each and can run ~6× a year; completed 6-month cycles net ~1.4% and run 2×.`,
      why: `Annualised return = profit per cycle × how many times a year the money turns over. Two-month money compounds about six times a year and almost never defaults; 6-month money only turns twice and loses ${pct(d[6])} of what completes. The same ₹5,000 does several more productive round-trips in a year when lent for 2 months.` },
    { tone: "info", icon: "🧲", title: "Why 5-month is the sleeper pick",
      data: `Completed 5-month cycles had the highest net per cycle in the book (~9.2%), matured default is only <b>${pct(d[5])}</b>, and the default-inclusive net is <b>${pct(xA["5"])}/yr</b> — tied with 2-month for the best realised return. All three 5-month score cells are Core picks.`,
      why: `Five months quotes a longer, higher rate than 2–3 months but behaves like short money on defaults (${pct(d[5])}), so the per-cycle profit ends up the highest in the book. One caveat: only 225 loans total, so treat the edge as promising rather than fully proven.` },
    { tone: "warn", icon: "⚠️", title: "Why one 4-month cell (score 725–749) shows red — sample size, not a rule",
      data: `That cell nets <b>${pct(cell(4, "725–749") ? cell(4, "725–749").xirr_all : null)}/yr</b> after defaults even though only ${pct(cell(4, "725–749") ? cell(4, "725–749").def_rate : null)} of its ${cell(4, "725–749") ? cell(4, "725–749").matured : "—"} completed loans defaulted.`,
      why: `Those two defaults were zero-recovery ₹2,500 loans, and together they erased the entire profit (₹4,735) of the 42 loans that repaid. On small tickets one bad loan equals dozens of good ones — so this single red cell, sitting between two profitable neighbours (700–724: +42.4%, 750–774: +20.9%), is a warning about small samples, not a verdict on 4-month money.` },
    { tone: "good", icon: "🛡️", title: "Why NPA losses are softened by recovery — and why longer loans collect so much less",
      data: `Of <b>${inr(npaDisb)}</b> lent into the ${npaLs.length} NPA loans, <b>${inr(npaRec)}</b> (${pct(recPct)}) was recovered before write-off. Interest collection on closed loans falls from <b>${pct(ic(3))}</b> (3-month) → ${pct(ic(6))} (6-month) → <b>${pct(ic(12))}</b> (12-month).`,
      why: `Recovery brings back roughly a quarter of defaulted principal — that money is already inside every 'net' figure on this dashboard. And the sharp drop in interest collection as tenure rises is exactly why long loans must be avoided: they do not just default more, they collect far less of the interest they promise.` },
    { tone: "warn", icon: "📉", title: "Why your book is behind schedule — and why the future may be a little worse than the past",
      data: `<b>${st.loans_with_dpd || "—"}</b> loans are currently overdue (DPD &gt; 0): <b>${all.filter((l) => l.status === "ACTIVE" && (l.dpd || 0) > 0).length} active loans</b> paying late and <b>${all.filter((l) => l.status === "NPA").length}</b> already defaulted.`,
      why: `Late payers are the pipeline to future NPAs. With roughly ${pct(st.loans_with_dpd ? (st.loans_with_dpd / all.length) * 100 : 0)} of the book behind schedule, new vintages will likely land below your own historical returns — which is another reason short tenures win: they cap how much money can go late at any one time, and they let you stop lending to a cohort the moment it starts misbehaving.` },
    { tone: "info", icon: "💡", title: "Why 'risk = time × borrower quality' is the whole dashboard in one sentence",
      data: `Default rate on completed loans by tenure: 2-month <b>${pct(d[2])}</b> → 3-month <b>${pct(d[3])}</b> → 5-month <b>${pct(d[5])}</b> → 4-month <b>${pct(d[4])}</b> → 6-month <b>${pct(d[6])}</b> → 12-month <b>${pct(d[12])}</b>.`,
      why: `At 2 months almost nobody defaults; at 12 months even decent borrowers do. So use the score as a gate exactly where the default clock is long (6-month at ≥ 750, no 12-month at all) and ignore it where the clock is short (2-month). That single rule reproduces the entire Core/Avoid split in the picks panel above.` },
  ];

  /* verdict strip — the "only lend these" answer, computed from the same picks the panel shows */
  const coreCells = cells.filter((c) => c.tier === "core").sort((a, b) => b.rec_pct - a.rec_pct);
  const supCells = cells.filter((c) => c.tier === "support" && c.xirr_all > 0).sort((a, b) => b.rec_pct - a.rec_pct);
  const noCells = cells.filter((c) => c.xirr_all != null && c.xirr_all <= 0);
  const chipHtml = (c) => `<span class="v-chip" title="${c.tenure} mo · ${c.band}: net ${pct(c.xirr_all)}/yr incl. all defaults, ${pct(c.def_rate)} matured default">${c.tenure} mo · ${c.band} <b>₹${(c.rec_pct * 10).toFixed(0)}</b>/₹1k</span>`;
  const tp = P.tier_pcts || {};

  el.innerHTML = `
    <div class="verdict">
      <div class="verdict-block v-lend">
        <div class="v-hdr">🟢 Lend these — your money engine</div>
        <div class="v-sub">The Core cells of the recommendation, in order. Lend them every month; per-₹1,000 is the share of each ₹1,000 the data says to put there.</div>
        <div class="v-chips">${coreCells.map(chipHtml).join("")}</div>
      </div>
      <div class="verdict-block v-little">
        <div class="v-hdr">🔵 Keep these small</div>
        <div class="v-sub">Profitable Support cells — fine to take, but each gets only a small slice of the allocation.</div>
        <div class="v-chips">${supCells.map(chipHtml).join("")}</div>
      </div>
      <div class="verdict-block v-no">
        <div class="v-hdr">🔴 Never lend these — they lose money once defaults are counted</div>
        <div class="v-sub">Net XIRR ≤ 0%/yr after fees and every default. In plain terms: no 12-month, no 6-month below score 750, and watch the mid-score 4-month cell (small sample).</div>
        <div class="v-chips">${noCells.map((c) => `<span class="v-chip no" title="${c.tenure} mo · ${c.band}: ${pct(c.def_rate)} matured default">${c.tenure} mo · ${c.band} <b>${pct(c.xirr_all)}</b></span>`).join("")}</div>
      </div>
    </div>
    <div class="v-foot">Split of your next ₹1,000, computed by <code>scripts/ldc/insights.py → xirr_picks()</code>: Core <b>${tp.core != null ? tp.core.toFixed(0) + "%" : "—"}</b> · Support <b>${tp.support != null ? tp.support.toFixed(0) + "%" : "—"}</b> · everything else <b>₹0</b>. Whole book — the filters above do not change this section.</div>
    <div class="reason-grid">${cards.map((c) => `
      <div class="reason-card tone-${c.tone}">
        <div class="reason-head"><span class="reason-ico">${c.icon}</span><div class="reason-title">${c.title}</div></div>
        <div class="reason-sec"><div class="reason-sectag">What the data shows</div><div class="reason-body">${c.data}</div></div>
        <div class="reason-sec"><div class="reason-sectag">Why it happens</div><div class="reason-body">${c.why}</div></div>
      </div>`).join("")}</div>`;
}
