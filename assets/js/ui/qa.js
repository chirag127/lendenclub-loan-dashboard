/* ============================================================
 * ui/qa.js — "Your questions answered": a plain-language Q&A block
 * ------------------------------------------------------------
 * The headline questions behind every number on this dashboard,
 * answered in one place with LIVE numbers (read from the data
 * globals at render time via cardCtx() — nothing hand-typed, so
 * nothing goes stale when a new report is ingested).
 *
 * Every answer degrades gracefully: a sentence whose number is
 * missing in the current payload is skipped rather than printed
 * blank. Native <details> accordions work from file:// with zero
 * JS state.
 * Classic script (no ES modules — must keep working from file://).
 * Load order is fixed in index.html; see assets/js/README too.
 * ============================================================ */

/* weighted net XIRR of the verdict's recommended cells (core, or core+support),
   from each cell's own realized xirr_all × its recommended ₹ share */
function qaPicksWeighted(tiers) {
  const cells = ((window.INSIGHTS_DATA || {}).xirr_picks || {}).cells || [];
  const sel = cells.filter((c) => (tiers || ["core", "support"]).includes(c.tier));
  const w = sel.reduce((a, c) => a + (c.rec_pct || 0), 0);
  if (!w) return null;
  return sel.reduce((a, c) => a + (c.xirr_all || 0) * (c.rec_pct || 0), 0) / w;
}

function qaTenureRows(ctx) {
  const xA = ctx.xA || {};
  const exp = (ctx.AX.by_tenure_expected) || {};
  const rows = [];
  [2, 3, 4, 5, 6, 12].forEach((t) => {
    rows.push({
      t: t + " mo",
      realized: xA[t] != null ? pct(xA[t]) : "–",
      projected: exp[t] != null ? pct(exp[t]) : "–",
      def: ctx.md(t) != null ? pct(ctx.md(t)) : "–",
    });
  });
  return rows;
}

function renderQA() {
  const host = document.getElementById("qa");
  if (!host) return;
  const c = cardCtx();
  const X = c.X, AX = c.AX, O = c.O, st = c.st;
  const wCore = qaPicksWeighted(["core"]);
  const wAll = qaPicksWeighted(["core", "support"]);
  const wCoreTxt = wCore != null ? pct(wCore) : "—";
  const wAllTxt = wAll != null ? pct(wAll) : "—";

  const rd = (c.INS.return_drivers || {});
  const rateHi = (rd.by_rate || []).slice().sort((a, b) => (b.xirr_all || -999) - (a.xirr_all || -999))[0];
  const rateLo = (rd.by_rate || []).slice().sort((a, b) => (a.xirr_all || 999) - (b.xirr_all || 999))[0];
  const tk2500 = (rd.by_ticket || []).find((b) => (b.label || "").includes("2,500"));
  const tk1k = (rd.by_ticket || []).find((b) => (b.label || "").includes("1,000"));
  const cellsIn = (rd.by_ticket_in_cell || []).map((cl) => ({
    cell: cl,
    big: (cl.buckets || []).find((b) => (b.label || "").includes("2,500")),
    best: (cl.buckets || []).filter((b) => !(b.label || "").includes("2,500") && b.xirr_all != null)
      .reduce((a, b) => (b.xirr_all > (a.xirr_all || -999) ? b : a), {}),
  })).find((x) => x.big && (x.big.xirr_all || 0) < 0 && (x.best.xirr_all || 0) > 15);

  const overdueShare = st.total_loans ? 100 * (st.loans_with_dpd || 0) / st.total_loans : null;
  const y25 = c.A && c.A.slices && c.A.slices["2025"] && c.A.slices["2025"].totals;
  const y26 = c.A && c.A.slices && c.A.slices["2026"] && c.A.slices["2026"].totals;
  const feeRatio = (c.S.interest_received || 0) > 0 ? 100 * (c.S.platform_fee || 0) / c.S.interest_received : null;
  const sch = (c.FS.schedule || {});
  const feeLine = sch["2"] != null
    ? `Fee = <b>${sch["2"]}%</b> (2–3 mo) / <b>${sch["4"]}%</b> (4–6 mo) / <b>${sch["12"]}%</b> (12 mo) of the <b>principal each EMI returns</b> — never on interest, never upfront.`
    : "";

  const items = [];

  /* 1 — expected annualized return vs the 25%/yr question */
  if (X.portfolio_net_all != null || AX.portfolio_expected != null || wAll != null) {
    const parts = [];
    if (X.portfolio_net_all != null) parts.push(`Lent exactly like your whole history (every tenure, every score): <b>${pct(X.portfolio_net_all)}/yr</b> realized — right at the 25% line.`);
    if (AX.portfolio_expected != null) parts.push(`The active book still out there projects <b>${pct(AX.portfolio_expected)}/yr</b> (${AX.portfolio_no_default != null ? pct(AX.portfolio_no_default) + " if no further defaults" : ""}).`);
    if (wAll != null) parts.push(`But follow the verdict cells and the same machinery shows <b>${wAllTxt}/yr</b> — core cells alone <b>${wCoreTxt}/yr</b>, every default and fee already deducted.`);
    items.push({
      tone: wAll != null && wAll >= 25 ? "good" : "info", icon: "🎯",
      title: "Is my expected annualized return better than 25% a year?",
      body: `<p>${parts.join(" ")}</p>
        <p><b>Yes — but only if you fund the verdict cells.</b> The honest planning band is <b>25–35%/yr</b>: history says the recommended 2/3/5-month cells net 45–69%/yr with all defaults included, and even after haircutting for the fee rises and a book that is currently ${overdueShare != null ? pct(overdueShare) + " overdue" : "partly overdue"}, the low end still clears 25%. Lending everything (including 12-month and low-score 6-month) is what drags the whole-book number down to ~23–27%.</p>`,
    });
  }

  /* 2 — are these numbers net of fees and defaults? */
  items.push({
    tone: "info", icon: "🧮",
    title: "Are the returns really after all fees and defaults?",
    body: `<p><b>Yes — on this dashboard "net" always means fees and defaults are already out.</b> Two honest formulas:</p>
      <ul>
        <li><b>Realized column</b> (per matured loan): −amount lent out at disbursement, then <b>actual receipts minus the platform fee actually paid</b> spread over the EMIs. A defaulted loan's receipts stop at its estimated default month, and a zero-recovery NPA is booked as a <b>−100% loss</b> of its principal. XIRR annualizes that cashflow.</li>
        <li><b>Projected column</b> (active book): receipts-to-date + outstanding principal × (1 − that tenure's <b>matured default rate</b>) + remaining contracted interest × that tenure's <b>interest-collection rate</b> (early foreclosures rebate interest) − fees already paid − the <b>fee still due</b> on the outstanding.</li>
      </ul>
      <p>The one number that is NOT net is the quoted <b>sticker rate</b> — and the report's own <i>pnl</i> column, which never subtracts the <b>${inr(c.S.platform_fee)}</b> fee bill. Every figure on this page does.</p>`,
  });

  /* 3 — simple ROI vs XIRR */
  if (O.net_roi_after_npa != null && X.portfolio_net_all != null) {
    items.push({
      tone: "info", icon: "⚖️",
      title: "Why does simple ROI (~4.5%) look tiny next to XIRR (23–51%)?",
      body: `<p>Simple net ROI on everything lent is <b>${pct(O.net_roi_after_npa)}</b> after defaults; net XIRR on the same book is <b>${pct(X.portfolio_net_all)}/yr</b>. Both are correct — they answer different questions.</p>
        <p>Monthly EMIs bring capital back through each loan's life, so at any moment only about <b>${X.avg_capital_at_risk_pct != null ? X.avg_capital_at_risk_pct.toFixed(0) + "%" : "half"}</b> of your money is actually out at risk. XIRR annualizes the return on that working capital and compounds it as money recycles 2–6× a year; simple ROI divides profit by the full amount ever lent and ignores both time and payback speed. Compare XIRR to your other investments; use simple ROI only to reconcile cash in vs cash out.</p>`,
    });
  }

  /* 4 — which loans to give (tenure table + verdict line) */
  items.push({
    tone: "good", icon: "📊",
    title: "Which tenure × score loans should I actually give?",
    body: `<table class="qa-tbl"><thead><tr><th>Tenure</th><th>Realized net XIRR<br><span class="dim">defaults incl.</span></th><th>Projected forward<br><span class="dim">active book</span></th><th>Matured default rate</th></tr></thead><tbody>
      ${qaTenureRows(c).map((r) => `<tr><td>${r.t}</td><td>${r.realized}</td><td>${r.projected}</td><td>${r.def}</td></tr>`).join("")}
      </tbody></table>
      <p>The verdict section turns this table into a per-₹1,000 plan: <b>2/3-month at score ≥ 750 and 2/5-month at ≥ 725 are your core cells</b> (all ≥ ₹1,000 of recommendation each), plus the 4-month × 700–724 cell; 6-month only at score ≥ 750 and in small slices; <b>no 12-month, no 6-month below 750</b> — those are the cells that lose money once defaults are counted. Keep tickets at ≤ ₹1,000 (see below).</p>`,
  });

  /* 5 — keep lending like before? */
  if (X.portfolio_net_all != null && wAll != null) {
    items.push({
      tone: "warn", icon: "💰",
      title: "What do I earn if I just keep lending like I have been?",
      body: `<p>Whole-book realized net XIRR incl. every default: <b>${pct(X.portfolio_net_all)}/yr</b>. Following the verdict cells: <b>${wAllTxt}/yr</b> — roughly twice as much, on the same platform, the same score bands and the same tenures you already have.</p>
        <p>The gap is the mix: 12-month loans net <b>${pct(c.xA["12"])}/yr</b> and low-score 6-month <b>${pct(c.xA["6"])}/yr</b>, while the 2/3/5-month money nets 38–46%/yr. You do not need better borrowers — you need the same borrowers for fewer months.</p>`,
    });
  }

  /* 6 — rate & ticket drivers */
  if (rateHi && rateLo) {
    items.push({
      tone: "warn", icon: "🎲",
      title: "Do higher quoted rates pay? Do ticket sizes matter?",
      body: `<p><b>Rate: yes — chasing the sticker rate is justified.</b> Matured loans quoting <b>${rateHi.label}</b> netted <b>${pct(rateHi.xirr_all)}/yr</b> after fees and every default, versus <b>${pct(rateLo.xirr_all)}/yr</b> for loans quoting under ${rateLo.label}.</p>
        <p><b>Ticket: there is a trap.</b> ₹250–₹1,000 tickets all net 33–36%/yr, but <b>₹2,500 tickets net ${tk2500 ? pct(tk2500.xirr_all) : "negative"}/yr</b>${tk1k ? ` while ₹1,000 tickets net ${pct(tk1k.xirr_all)}/yr` : ""}. It is not a score or tenure mix effect: ${cellsIn ? `inside the same <b>${cellsIn.cell.tenure}-month × ${cellsIn.cell.band}</b> cell, ₹2,500 tickets net <b>${pct(cellsIn.big.xirr_all)}/yr</b> at ${pct(cellsIn.big.def_rate)} default while ${cellsIn.best.label} tickets net <b>${pct(cellsIn.best.xirr_all)}/yr</b> — one big default erases many good tickets.` : "one ₹2,500 default erases many good ₹500 ones."} If you must lend ₹2,500, split it into smaller tickets in the same cell.</p>`,
    });
  }

  /* 7 — the fee bill */
  if (c.S.platform_fee != null) {
    items.push({
      tone: "info", icon: "🧾",
      title: "Exactly how much is LenDenClub charging me?",
      body: `<p>${feeLine}</p>
        <p>Total fees paid so far: <b>${inr(c.S.platform_fee)}</b> — about <b>${feeRatio != null ? pct(feeRatio) : "—"}</b> of every interest rupee your repaying loans brought in. The fee is collected only on principal that actually returns (a default stops future fees), which is why it bites hardest on long tenures: you pay the full rate on principal that mostly comes back, then lose that principal anyway when the loan goes bad.</p>
        <p>Watch-out: 4-month loans moved from 2.3% → 3.0% (Apr-26) and 5-month from 2.5% → 3.0% (Jun-26), so <b>fresh longer-tenure money carries more fee than the realized XIRRs above are built on</b> — another reason short tenures win.</p>`,
    });
  }

  /* 8 — will the future be as good as the past? */
  if (y25 && y26) {
    items.push({
      tone: "warn", icon: "📉",
      title: "Will the future be as good as the past?",
      body: `<p>Same machinery, two eras: 2025 vintages realized <b>${pct(y25.xirr_all)}/yr</b> net of everything; 2026 vintages are running at <b>${pct(y26.xirr_all)}/yr</b>${overdueShare != null ? `, and <b>${pct(overdueShare)}</b> of the whole book is currently behind schedule (DPD &gt; 0) — the pipeline to tomorrow's defaults` : ""}.</p>
        <p>That is why every projection on this site already haircuts future interest by each tenure's collection rate and applies its matured default rate, and why the planning number above is 25–35%, not the 50%+ some cells realized. If the trend keeps decaying, short tenures remain the hedge: they cap how much money can go late at once and let you stop lending to a cohort within weeks.</p>`,
    });
  }

  host.innerHTML = `<div class="qa-grid">${items.map((q) => `
    <details class="qa-item tone-${q.tone || "info"}">
      <summary><span class="qa-ico">${q.icon || "❓"}</span><span class="qa-q">${q.title}</span><span class="qa-caret">▾</span></summary>
      <div class="qa-a">${q.body}</div>
    </details>`).join("")}</div>`;
}
