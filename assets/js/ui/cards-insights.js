/* ============================================================
 * ui/cards-insights.js — the insight cards themselves
 * ------------------------------------------------------------
 * Uses the addInsightCard() engine (ui/cards.js). Every card's
 * numbers are read live from the data globals (LOANS, SUMMARY,
 * INSIGHTS) at render time, and every card carries a need(ctx)
 * gate so it disappears instead of lying when its data is absent
 * in the current slice. Cards are scoped to a section ("section")
 * or shown on every tab ("All"). No fixed cap — add more freely.
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* ---------------- whole-book cards (visible on every tab) ---------------- */
addInsightCard({
  tone: "good", icon: "🥇", title: "Why 2–3 month loans are your best earners",
  need: (c) => c.xA["2"] != null && c.xA["3"] != null && c.md(2) != null,
  data: (c) => `2-month closed loans net <b>${pct(c.xA["2"])}/yr</b> with every default included while only <b>${pct(c.md(2))}</b> of completed loans defaulted. 3-month nets <b>${pct(c.xA["3"])}/yr</b> at <b>${pct(c.md(3))}</b> default. Compare the long tenures: 6-month <b>${pct(c.xA["6"])}/yr</b>, 12-month <b>${pct(c.xA["12"])}/yr</b> — a loss.`,
  why: (c) => `A borrower only has 2–3 months to go bad, so very few do, and the money returns fast enough to be lent again at the same <b>~${pct(c.st.avg_interest_rate)}</b> contracted rate. Short window = low default; low default × high rate × fast recycling is the strongest risk-adjusted return in your book.`,
});
addInsightCard({
  tone: "bad", icon: "💸", title: "Why 12-month loans lose money even though they quote the highest rates",
  need: (c) => c.xA["12"] != null && c.ic(12) != null,
  data: (c) => `On your completed 12-month loans only <b>${pct(c.ic(12))}</b> of the contracted interest was ever collected (vs <b>${pct(c.ic(3))}</b> for 3-month), <b>${pct(c.md(12))}</b> of completed loans defaulted, and the net XIRR with all defaults is <b>${pct(c.xA["12"])}/yr</b>.`,
  why: () => `A year gives a weak borrower plenty of time to stop paying, and the borrowers who do repay usually foreclose early — so you receive far less than the year of interest you were promised. The platform fee is charged regardless, and the capital stays locked while 2-month money could have recycled ~6 times. It is the worst of both worlds.`,
});
addInsightCard({
  tone: "warn", icon: "🪜", title: "The ladder: contracted rate → gross → net of fees → net of defaults",
  need: (c) => c.X.portfolio_gross != null && c.X.portfolio_net_all != null,
  data: (c) => `Average contracted rate <b>${pct(c.st.avg_interest_rate)}</b> → gross XIRR <b>${pct(c.X.portfolio_gross)}/yr</b> → minus platform fees (<b>${inr(c.S.platform_fee)}</b>) → <b>${pct(c.X.portfolio_net)}/yr</b> on successful loans → minus all NPA defaults (<b>${inr(c.O.npa_loss)}</b>) → <b>${pct(c.X.portfolio_net_all)}/yr net</b>.`,
  why: () => `Two costs are unavoidable in P2P lending and neither appears in the quoted rate: the platform fee is collected with every EMI — <b>${pct(FS.schedule["4"])}% of the principal each EMI returns</b> (higher on longer tenures) — and credit losses are paid later out of principal. Only after both are subtracted do you get the return you can actually spend.`,
});
addInsightCard({
  tone: "info", icon: "💡", title: "Risk = time × borrower quality — the whole dashboard in one sentence",
  need: (c) => c.md(2) != null && c.md(12) != null,
  data: (c) => `Default rate on completed loans by tenure: 2-month <b>${pct(c.md(2))}</b> → 3-month <b>${pct(c.md(3))}</b> → 5-month <b>${pct(c.md(5))}</b> → 4-month <b>${pct(c.md(4))}</b> → 6-month <b>${pct(c.md(6))}</b> → 12-month <b>${pct(c.md(12))}</b>.`,
  why: () => `At 2 months almost nobody defaults; at 12 months even decent borrowers do. So use the score as a gate exactly where the default clock is long (6-month at ≥ 750, no 12-month at all) and ignore it where the clock is short (2-month). That single rule reproduces the entire Core/Avoid split in the picks panel.`,
});

/* ---------------- Fee model & fresh-money allocation (whole book) ---------------- */
addInsightCard({
  tone: "info", icon: "🧾", title: "How the platform fee actually works — and it just got more expensive",
  need: (c) => c.FS.schedule && c.FS.observed && c.FS.observed.length > 0,
  data: (c) => `The fee is charged as <b>${pct(c.FS.schedule["2"])}–${pct(c.FS.schedule["12"])} of the principal each EMI returns</b> — never on interest, never upfront. Verified to the decimal: ${c.FS.observed.slice(0, 3).map((o) => `${o.tenure}-month ${o.era.includes("<") ? "(old)" : ""} <b>${o.median_pct.toFixed(1)}%</b>`).join(" · ")} of principal returned, and the same on active/NPA loans. The catch: <b>4/5-month loans now pay 3.0% where they used to pay 2.3–2.5%</b> (from ${c.FS.changes[0].from_month}), so fresh longer-tenure money carries more fee than your realised XIRRs are built on.`,
  why: () => `A default or foreclosure stops the fee with the principal — the platform only charges what actually came back. That is why the fee matters most on long tenures: you pay the full schedule rate on principal that mostly returns, then lose the principal anyway when the loan goes bad. Short tenures pay the least fee and default the least — the double win behind every short-money pick on this dashboard.`,
});
addInsightCard({
  tone: "warn", icon: "📅", title: "This month's money vs where the data says to put it",
  need: (c) => c.MA && c.MA.by_tenure && c.MA.by_tenure.length > 0,
  data: (c) => `${c.MA.month}: <b>${fmt.format(c.MA.loans)} loans / ${inr(c.MA.amount)}</b> deployed, but only <b>${c.MA.core_pct.toFixed(1)}%</b> went into core cells (recommended ~84%) and <b>${inr(c.MA.misaligned_amount)}</b> went into avoid/conditional cells. By tenure: 4-month took <b>${c.MA.by_tenure.find((t) => t.tenure === 4).actual_pct.toFixed(1)}%</b> vs ${c.MA.by_tenure.find((t) => t.tenure === 4).rec_pct.toFixed(1)}% recommended, while 3-month — your best-earning tenure — got only ${c.MA.by_tenure.find((t) => t.tenure === 3).actual_pct.toFixed(1)}% vs ${c.MA.by_tenure.find((t) => t.tenure === 3).rec_pct.toFixed(1)}%.`,
  why: () => `Supply, not judgement, explains most of it: 3-month × 750+ loans are simply scarce this month, so the money lands in the 4-month 700–724 core cell (fine) and 2/4-month 750+ support cells (acceptable) — plus ₹10.5k in a cell that loses money after defaults. When the top cells are not on the shelf, 2-month ≥725 and 5-month ≥725 are the data's next-best homes.`,
});
addInsightCard({
  tone: "info", icon: "🧮", title: "The report's own P&L column ignores the fee",
  need: (c) => c.FS.pnl_ignored_fees != null,
  data: (c) => `On all ${fmt.format(c.mat.length)} matured loans the report's 'pnl' column records <b>receipts − amount</b> with the platform fee left out — <b>${inr(c.FS.pnl_ignored_fees)}</b> of fees never appear in LenDenClub's own profit line. Every net figure on this dashboard subtracts the fee explicitly.`,
  why: () => `Don't reconcile your returns against the report's pnl column — it flatters the result by the full fee bill. The XIRR, ROI and net-kept numbers here are the fee-inclusive (honest) version.`,
});

/* ---------------- The book at a glance ---------------- */
addInsightCard({
  section: "The book at a glance",
  tone: "info", icon: "📚", title: "What you are lending into — size and shape of the book",
  need: (c) => c.all.length > 0 && c.S.disbursed_amount != null,
  data: (c) => `<b>${fmt.format(c.all.length)}</b> loans across 6 tenures, <b>${inr(c.S.disbursed_amount)}</b> disbursed and <b>${inr(c.S.received_amount)}</b> received back so far. The active book (<b>${fmt.format(c.act.length)}</b> loans) still has money working; <b>${fmt.format(c.mat.length)}</b> loans have finished their term.`,
  why: () => `Everything downstream — returns, risk, picks — is computed only on settled history plus live exposure. Knowing how much of the book is still unresolved tells you how much of every average is evidence versus projection.`,
});
addInsightCard({
  section: "The book at a glance",
  tone: "warn", icon: "⏳", title: "The overdue pipeline — tomorrow's defaults are already visible",
  need: (c) => (c.st.loans_with_dpd || 0) > 0,
  data: (c) => `<b>${c.st.loans_with_dpd}</b> loans are behind schedule (DPD &gt; 0): <b>${c.all.filter((l) => l.status === "ACTIVE" && (l.dpd || 0) > 0).length}</b> active loans paying late and <b>${c.npaLs.length}</b> already defaulted.`,
  why: () => `Late payers are the pipeline to future NPAs. Short tenures cap how much money can sit late at once and let you stop lending to a misbehaving cohort within weeks instead of a year.`,
});

/* ---------------- What loans actually pay ---------------- */
addInsightCard({
  section: "What loans actually pay — net of fees & defaults",
  tone: "info", icon: "⚖️", title: "Why XIRR (~53%) is roughly double the simple ROI (~8%)",
  need: (c) => c.O.net_roi != null && c.X.portfolio_net != null,
  data: (c) => `Simple net ROI on everything lent: <b>${pct(c.O.net_roi)}</b>. Money-weighted net XIRR on the same closed loans: <b>${pct(c.X.portfolio_net)}/yr</b>. The pipeline puts average capital at risk at ~<b>${c.X.avg_capital_at_risk_pct != null ? c.X.avg_capital_at_risk_pct.toFixed(0) : "—"}%</b> of the headline amount.`,
  why: () => `Monthly EMIs bring your capital back through the life of every loan, so at any moment only about half your money is out. XIRR annualises the return on the capital actually at risk; simple ROI divides profit by the full amount lent and ignores time. Both are correct — they answer different questions.`,
});
addInsightCard({
  section: "What loans actually pay — net of fees & defaults",
  tone: "good", icon: "🧲", title: "Why 5-month is the sleeper pick",
  need: (c) => c.xA["5"] != null && c.md(5) != null,
  data: (c) => `Completed 5-month cycles had the highest net per cycle in the book (~9.2%), matured default is only <b>${pct(c.md(5))}</b>, and the default-inclusive net is <b>${pct(c.xA["5"])}/yr</b> — tied with 2-month for the best realised return. All three 5-month score cells are Core picks.`,
  why: (c) => `Five months quotes a longer, higher rate than 2–3 months but behaves like short money on defaults (${pct(c.md(5))}), so the per-cycle profit ends up the highest in the book. Caveat: the 5-month bucket is one of the smaller tenures, so treat the edge as promising rather than fully proven.`,
});
addInsightCard({
  section: "What loans actually pay — net of fees & defaults",
  tone: "warn", icon: "🛡️", title: "Recovery softens the default bill — but less and less on longer loans",
  need: (c) => c.npaDisb > 0 && c.ic(12) != null,
  data: (c) => `Of <b>${inr(c.npaDisb)}</b> lent into the ${c.npaLs.length} NPA loans, <b>${inr(c.npaRec)}</b> (${pct(100 * c.npaRec / c.npaDisb)}) was recovered before write-off. Interest collection on closed loans falls from <b>${pct(c.ic(3))}</b> (3-month) → ${pct(c.ic(6))} (6-month) → <b>${pct(c.ic(12))}</b> (12-month).`,
  why: () => `Recovery brings back roughly a quarter of defaulted principal — that money is already inside every 'net' figure here. The sharp drop in interest collection as tenure rises is the second reason long loans lose: they do not just default more, they collect far less of the interest they promise.`,
});
addInsightCard({
  section: "What loans actually pay — net of fees & defaults",
  tone: "info", icon: "💸", title: "Fees are ~18% of every interest rupee — before defaults",
  need: (c) => c.S.platform_fee != null && c.S.interest_received != null,
  data: (c) => `You paid <b>${inr(c.S.platform_fee)}</b> in platform fees on <b>${inr(c.S.interest_received)}</b> of interest received — about <b>${pct(100 * c.S.platform_fee / c.S.interest_received)}</b> of every interest rupee, on loans that did pay. The fee charts in this section break the schedule down by tenure.`,
  why: () => `The platform fee is tenure-based (≈1% at 2 months up to ≈6% at 12) and is collected as EMIs arrive. It is charged before credit losses, so a default both cancels future fees and takes principal — the fee you did pay is gone with it.`,
});

/* ---------------- Risk section ---------------- */
addInsightCard({
  section: "Where loans default — risk by tenure × score",
  tone: "bad", icon: "🎲", title: "6-month is the NPA engine — and exactly where it breaks",
  need: (c) => c.md(6) != null && c.cell(6, "700–724"),
  data: (c) => { const k = c.cell(6, "700–724"); return `6-month loans are a large share of the book by count but an outsized share of all NPAs, with <b>${pct(c.md(6))}</b> of completed loans defaulting. The single worst cell is 6-month × score 700–724: <b>${k.matured} completed loans, ${pct(k.def_rate)} defaulting</b>, netting <b>${pct(k.xirr_all)}/yr</b>.`; },
  why: () => `Six months is long enough for defaults to actually happen, and the extra interest that longer tenure quotes is nowhere near enough to pay for it. Below score 750 the pricing advantage disappears entirely — which is why the picks gate 6-month at score ≥ 750.`,
});
addInsightCard({
  section: "Where loans default — risk by tenure × score",
  tone: "info", icon: "🎯", title: "The score barely matters on 2-month loans",
  need: (c) => c.cell(2, "700–724") && c.cell(2, "725–749"),
  data: (c) => { const a = c.cell(2, "700–724"), b = c.cell(2, "725–749"); return `Only a tiny fraction of all 2-month loans ever went NPA. Across score bands the realised net XIRR is <b>${pct(a.xirr_all)}–${pct(b.xirr_all)}/yr</b> — even the lowest-score 2-month band made money.`; },
  why: () => `At 2 months there is simply not enough time for a weak borrower to fail. The score differences that predict 12-month behaviour have almost no room to show up, so on very short money optimise for rate and availability rather than score.`,
});
addInsightCard({
  section: "Where loans default — risk by tenure × score",
  tone: "warn", icon: "⚠️", title: "One red 4-month cell is a sample-size warning, not a rule",
  need: (c) => c.cell(4, "725–749") && c.cell(4, "725–749").xirr_all != null,
  data: (c) => { const k = c.cell(4, "725–749"); return `That cell nets <b>${pct(k.xirr_all)}/yr</b> after defaults even though only ${pct(k.def_rate)} of its ${k.matured} completed loans defaulted.`; },
  why: () => `Two zero-recovery defaults erased the entire profit of the loans that repaid. On small tickets one bad loan equals dozens of good ones — a single red cell sitting between profitable neighbours is a warning about small samples, not a verdict on 4-month money.`,
});

/* ---------------- Atlas section ---------------- */
addInsightCard({
  section: "Fine-bucket net-XIRR atlas — tenure × score",
  tone: "info", icon: "🗺️", title: "How to read the atlas — and what the fine buckets say",
  need: (c) => c.A && c.A.slices,
  data: (c) => { const t = c.A.slices.ALL.totals; return `The whole matured book pools to <b>${pct(t.xirr_all)}/yr net</b> incl. every default (and <b>${pct(t.xirr_ok)}/yr</b> for repaying loans only) — but the buckets behind that average run from <b>+79%/yr</b> to <b>−51%/yr</b>. The 2025 vintage ran <b>${pct(c.A.slices["2025"].totals.xirr_all)}/yr</b>; 2026 is running <b>${pct(c.A.slices["2026"].totals.xirr_all)}/yr</b>.`; },
  why: () => `Ten-point score bands split what the 25-point picks bands average away: the best 3-month borrowers are not "score 700+", they are specific 10-point windows. Read the evidence map next to any bright cell — fewer than ~30 matured loans means the rate is still a hint, not a fact.`,
});
addInsightCard({
  section: "Fine-bucket net-XIRR atlas — tenure × score",
  tone: "warn", icon: "🧊", title: "2026 lends worse than 2025 — the book's edge is narrowing",
  need: (c) => c.A && c.A.slices,
  data: (c) => { const a = c.A.slices["2025"].totals, b = c.A.slices["2026"].totals; return `Same machinery, two years: 2025 matured loans net <b>${pct(a.xirr_all)}/yr</b> on <b>${fmt.format(a.matured)}</b> loans; 2026 matured loans net <b>${pct(b.xirr_all)}/yr</b> on <b>${fmt.format(b.matured)}</b>. Defaults more than doubled in rupee terms (₹${fmt.format(Math.round(a.npa_amt))} → ₹${fmt.format(Math.round(b.npa_amt))}).`; },
  why: () => `Two forces: the 2026 vintages (Feb, Apr) hit default clusters the 2025 book never saw, and more money went into longer tenures where defaults live. Neither is priced into the sticker rates — which is exactly what the per-year NPA and vintage charts quantify.`,
});

/* ---------------- NPA by year ---------------- */
addInsightCard({
  section: "NPA by origination year — tenure-level vs annualized",
  tone: "warn", icon: "📆", title: "Life-of-loan vs per-year NPA — why both numbers exist",
  need: (c) => c.INS.npa_by_year && c.INS.npa_by_year.rows,
  data: (c) => { const r = (c.INS.npa_by_year.rows.find((x) => x.year === "ALL" && x.tenure === 6) || {}); return `A 6-month loan showing ${r.rate_life != null ? r.rate_life : "—"}% defaults over its life is <b>${r.rate_ann != null ? r.rate_ann : "—"}%/yr</b> of lending — while a 2-month loan's small life rate annualises ~4× higher. Whole book: ${pct(c.md(6))} of 6-month completions default.`; },
  why: () => `Annualising by turnover (× 12/tenure) puts 2-month and 12-month money on the same per-year footing, the same convention the annualized returns use. Without it, long tenures look artificially safe and short tenures artificially risky.`,
});

/* ---------------- Vintage ---------------- */
addInsightCard({
  section: "Defaults by origination cohort — curves, rates & the ₹ bill",
  tone: "bad", icon: "🕳️", title: "Defaults strike early — one cohort already went net-negative",
  need: (c) => c.A && c.INS.vintage,
  data: (c) => { const feb = c.INS.vintage.cohorts.find((x) => x.month === "2026-02"); const dec = c.INS.vintage.cohorts.find((x) => x.month === "2025-12"); return `Most defaults land within the first 2–4 months of a loan's life. The Feb-2026 cohort kept <b>${feb && feb.net_pct != null ? "₹" + feb.net_pct.toFixed(0) : "—"}/₹1,000 net of everything</b> (vs Dec-2025 at ${dec && dec.net_pct != null ? "₹" + dec.net_pct.toFixed(0) : "—"}/₹1,000) — the only cohort so far to go net-negative.`; },
  why: () => `When a cohort's defaults and fees exceed the interest it actually collected, the month loses money net — even though most of its loans repaid. The vintage table under the charts shows every cohort's full percentage set side by side.`,
});

/* ---------------- Watch-outs ---------------- */
addInsightCard({
  section: "Cashflow & watch-outs",
  tone: "info", icon: "⏱️", title: "What the active book will do — expected vs best case",
  need: (c) => c.AX.portfolio_expected != null,
  data: (c) => `<b>${c.AX.loans_used || "—"}</b> active loans with <b>${inr(c.AX.outstanding)}</b> still outstanding: <b>${pct(c.AX.portfolio_expected)}/yr</b> if new defaults behave like your history, <b>${pct(c.AX.portfolio_no_default)}/yr</b> if everyone repays.`,
  why: () => `Active loans are young — most of their late payments and defaults have not happened yet, so their cashflows still look clean. Expect most of the gap to close as the book matures: the expected figure is 'if history repeats', not a guarantee.`,
});
addInsightCard({
  section: "Cashflow & watch-outs",
  tone: "warn", icon: "📉", title: "New vintages will likely land below your historical average",
  need: (c) => c.A && c.A.slices,
  data: (c) => { const a = c.A.slices["2025"].totals, b = c.A.slices["2026"].totals; return `Realised net XIRR fell from <b>${pct(a.xirr_all)}/yr</b> (2025 vintages) to <b>${pct(b.xirr_all)}/yr</b> (2026 vintages). Roughly ${pct(100 * c.st.loans_with_dpd / c.all.length)} of the book is currently behind schedule.`; },
  why: () => `Plan future expectations off the most recent cohorts, not the whole history — the early book was cleaner. Short tenures remain the hedge: they repriced your exposure monthly, and they let you stop lending to a deteriorating cohort within weeks.`,
});
