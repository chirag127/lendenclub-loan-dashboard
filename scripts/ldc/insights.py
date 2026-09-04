"""Analysis layer: tenure × score risk matrix and returns economics.

Every figure here is recomputed from the raw loan records so the dashboard's
JavaScript numbers can be independently cross-checked (see audit.py).
"""

TENURES = [2, 3, 4, 5, 6, 12]
SCORE_BANDS = [
    (700, 724), (725, 749), (750, 774), (775, 799),
    (800, 824), (825, 849), (850, 878),
]


def score_band(score):
    """'700-724', '725-749', … — None when outside the known bands."""
    if score is None:
        return None
    for lo, hi in SCORE_BANDS:
        if lo <= score <= hi:
            return f"{lo}-{hi}"
    return None


# ---------------------------------------------------------------------------
# Platform-fee model — verified against the report, not assumed.
#
# The fee accrues per EMI as a fixed % of the PRINCIPAL RETURNED in that EMI
# (reducing balance), confirmed in the data: on every loan that has received
# principal, fee ÷ principal-returned equals the schedule rate to within
# rounding — for CLOSED, ACTIVE and NPA loans alike. The schedule (current):
#   2mo 1.0% · 3mo 1.0% · 4mo 3.0% · 5mo 3.0% · 6mo 3.0% · 12mo 6.0%
# with two documented mid-book changes: 4-month loans disbursed before
# Apr-2026 paid 2.3%, 5-month before Jun-2026 paid 2.5%.
# Note: the report's own 'pnl' column records receipts − amount (fee NOT
# deducted) — the platform's P&L ignores its fee; every net figure on this
# dashboard deducts the fee explicitly.
FEE_SCHEDULE = {2: 1.0, 3: 1.0, 4: 3.0, 5: 3.0, 6: 3.0, 12: 6.0}
FEE_ERA = {  # tenure -> (from disb month, {old_pct, new_pct})
    4: ("2026-04", 2.3, 3.0),
    5: ("2026-06", 2.5, 3.0),
}


def _fee_rate(tenure, disb_month):
    """Fee % of principal returned for a loan, honouring its disbursement era."""
    t = int(tenure or 0)
    era = FEE_ERA.get(t)
    if era:
        return era[2] if (disb_month and disb_month >= era[0]) else era[1]
    return FEE_SCHEDULE.get(t)


def fee_schedule(loans):
    """Empirically verify the fee model and emit the schedule.

    For each tenure (and each pricing era for the tenures that changed), the
    median fee ÷ principal-returned over every loan that has received
    principal — CLOSED, ACTIVE and NPA alike — is shown next to the schedule
    rate the model claims. Also emits the ₹ the platform's own 'pnl' column
    ignores (it records receipts − amount, without the fee).
    """
    observed = []
    for t in TENURES:
        pool = [l for l in loans
                if int(l["tenure"] or 0) == t and (l["principal_received"] or 0) > 0]
        if not pool:
            continue
        eras = [("all time", None)]
        if t in FEE_ERA:
            since, old, new = FEE_ERA[t]
            eras = [(f"disbursed < {since} ({old}%)", ("<", since)),
                    (f"disbursed ≥ {since} ({new}%)", (">=", since))]
        for label, cond in eras:
            sel = pool
            if cond:
                op, since = cond
                sel = [l for l in pool
                       if ((l["disbursement_date"] or "")[:7] and (
                           (l["disbursement_date"])[:7] < since if op == "<"
                           else (l["disbursement_date"])[:7] >= since))]
            if not sel:
                continue
            rates = sorted(100 * (l["platform_fee"] or 0) / (l["principal_received"] or 1)
                           for l in sel)
            n = len(rates)
            observed.append({
                "tenure": t, "era": label, "loans": n,
                "median_pct": round(rates[n // 2], 2),
                "p10_pct": round(rates[max(0, n // 10)], 2),
                "p90_pct": round(rates[min(n - 1, 9 * n // 10)], 2),
                "schedule_pct": _fee_rate(t, sel[0]["disbursement_date"][:7] if cond else None),
            })
    pnl_ignored = round(sum((l["platform_fee"] or 0) for l in loans
                            if l["status"] in ("CLOSED", "NPA", "ACTIVE")), 2)
    return {
        "model": "fee = schedule % × the principal returned in each EMI (collected as "
                 "principal is repaid — a default stops future fees; a foreclosure "
                 "never pays the remaining ones)",
        "schedule": {str(t): FEE_SCHEDULE[t] for t in TENURES},
        "changes": [
            {"tenure": t, "from_pct": FEE_ERA[t][1], "to_pct": FEE_ERA[t][2],
             "from_month": FEE_ERA[t][0]}
            for t in sorted(FEE_ERA)
        ],
        "observed": observed,
        "pnl_note": "the report's own 'pnl' column = total_received − amount (fee NOT "
                    "deducted); every net figure on this dashboard deducts the fee",
        "pnl_ignored_fees": pnl_ignored,
    }


def _default_month(l):
    """EMI index at which an NPA is estimated to have stopped paying, from the
    principal actually received (equal principal per EMI — the same convention
    the dashboard discloses everywhere)."""
    t = int(l["tenure"] or 1)
    amt = l["amount"] or 0
    pr = l["principal_received"] or 0
    if amt <= 0 or t < 1:
        return 1
    return max(1, min(t, round(pr / (amt / t))))


def _loan_net_flows(l):
    """One matured loan's daily NET cashflows (fee deducted): −amount at
    disbursement, then (received − fee) spread over the EMIs — full tenure for
    CLOSED loans, but only up to the estimated default month for NPAs (their
    receipts are front-loaded under the per-EMI fee model, not spread over the
    full term — spreading them over a term the loan never reached mis-times
    the default loss and biases XIRR)."""
    amt = l["amount"] or 0
    t = int(l["tenure"] or 1)
    net = (l["total_received"] or 0) - (l["platform_fee"] or 0)
    k = _default_month(l) if l["status"] == "NPA" else t
    k = max(1, min(t, k))
    emi = net / k
    cf = [(0, -amt)]
    for i in range(k):
        d = _days(l["disbursement_date"], _add_months(l["repayment_start"], i))
        cf.append((d, emi))
    return cf


def _money(loans):
    """Aggregate money fields over a loan list."""
    return {
        "count": len(loans),
        "disb": round(sum(l["amount"] or 0 for l in loans), 2),
        "received": round(sum(l["total_received"] or 0 for l in loans), 2),
        "principal": round(sum(l["principal_received"] or 0 for l in loans), 2),
        "interest": round(sum(l["interest_received"] or 0 for l in loans), 2),
        "fee": round(sum(l["platform_fee"] or 0 for l in loans), 2),
        "npa_amt": round(sum(l["npa_amount"] or 0 for l in loans if l["status"] == "NPA"), 2),
        "npa_count": sum(1 for l in loans if l["status"] == "NPA"),
        "active_count": sum(1 for l in loans if l["status"] == "ACTIVE"),
        "closed_count": sum(1 for l in loans if l["status"] == "CLOSED"),
    }


def tenure_matrix(loans):
    """tenure → score-band → {count, npa, npa_rate, matured_rate, money…}.

    'matured' = loans that are no longer active/processing (CLOSED + NPA), so
    the matured default rate is an honest figure that ignores still-open risk.
    """
    out = {}
    for t in TENURES:
        tloans = [l for l in loans if l["tenure"] == t]
        if not tloans:
            continue
        bands = {}
        for lo, hi in SCORE_BANDS:
            cell = [l for l in tloans if score_band(l["score"]) == f"{lo}-{hi}"]
            if not cell:
                continue
            m = _money(cell)
            matured = [l for l in cell if l["status"] in ("CLOSED", "NPA")]
            m_npa = sum(1 for l in matured if l["status"] == "NPA")
            m["band"] = f"{lo}-{hi}"
            m["npa_rate"] = round(100 * m["npa_count"] / m["count"], 2)
            m["matured_count"] = len(matured)
            m["matured_npa"] = m_npa
            m["matured_rate"] = round(100 * m_npa / len(matured), 2) if matured else None
            m["net"] = round(m["interest"] - m["fee"] - m["npa_amt"], 2)
            m["net_roi"] = round(100 * m["net"] / m["disb"], 2) if m["disb"] else None
            bands[f"{lo}-{hi}"] = m
        tm = _money(tloans)
        tm["bands"] = bands
        out[str(t)] = tm
    return out


def returns_by_tenure(loans):
    """Per-tenure net economics + annualized return (turnover-adjusted)."""
    out = []
    for t in TENURES:
        rows = [l for l in loans if l["tenure"] == t]
        if not rows:
            continue
        m = _money(rows)
        net = m["interest"] - m["fee"] - m["npa_amt"]
        roi = 100 * net / m["disb"] if m["disb"] else None
        ann = roi * 12 / t if roi is not None else None
        out.append({
            "tenure": t,
            **m,
            "net": round(net, 2),
            "net_roi": round(roi, 2) if roi is not None else None,
            "annualized_net_roi": round(ann, 2) if ann is not None else None,
        })
    return out


def interest_collection_rates(loans):
    """Of the contracted interest on fully-closed loans, what % actually came in?

    LenDenClub borrowers who repay early get an interest rebate, so closed loans
    routinely collect far less than the contracted interest — 2-month loans ~87%,
    12-month loans ~25%. Projections must haircut future interest by these rates.
    """
    out = {}
    closed = [l for l in loans if l["status"] == "CLOSED"]
    for t in TENURES:
        r = [l for l in closed if l["tenure"] == t]
        ci = sum((l["total_repayment"] or 0) - (l["amount"] or 0) for l in r)
        ii = sum(l["interest_received"] or 0 for l in r)
        ct = sum(l["total_repayment"] or 0 for l in r)
        rt = sum(l["total_received"] or 0 for l in r)
        out[str(t)] = {
            "collection_rate": round(100 * ii / ci, 1) if ci else None,
            "contracted_interest": round(ci, 2),
            "interest_received": round(ii, 2),
            "contracted_total": round(ct, 2),
            "received_total": round(rt, 2),
            "total_collection_rate": round(100 * rt / ct, 1) if ct else None,
        }
    return out


def _add_months(iso, n):
    """YYYY-MM-DD + n months -> YYYY-MM-DD."""
    y, m, d = int(iso[:4]), int(iso[5:7]), int(iso[8:10])
    m += n
    y += (m - 1) // 12
    m = (m - 1) % 12 + 1
    return f"{y:04d}-{m:02d}-{d:02d}"


def _days(d1, d2):
    from datetime import date
    a = date(*map(int, d1.split("-")))
    b = date(*map(int, d2.split("-")))
    return (b - a).days


def _norm(cfs):
    """Shift a pooled cashflow list so day 0 is the earliest outflow."""
    t0 = min(d for d, a in cfs)
    return [(d - t0, a) for d, a in cfs]


def _irr(cashflows):
    """Annualized IRR by bisection on daily cashflows [(day_offset, amount)]."""
    lo, hi = -0.5, 5.0
    for _ in range(300):
        r = (lo + hi) / 2
        npv = sum(a / (1 + r) ** (d / 365.0) for d, a in cashflows)
        if abs(npv) < 1e-9:
            break
        if npv > 0:
            lo = r
        else:
            hi = r
    return (lo + hi) / 2


def _xirr_cashflows(sel):
    """Build per-loan gross/net daily cashflows for a matured loan set
    (amount out at disbursement; gross receipts spread over the EMI months;
    net = receipts − fee with NPA receipts front-loaded to the estimated
    default month — see _loan_net_flows for why). Loans that defaulted with
    zero recovery contribute a pure loss."""
    gross_cf, net_cf = [], []
    per_gross, per_net = {}, {}
    for l in sel:
        t = int(l["tenure"] or 1)
        amt, tot = l["amount"], l["total_received"] or 0
        g_emi = tot / t
        cf_g = [(0, -amt)]
        for i in range(1, t + 1):
            d = _days(l["disbursement_date"], _add_months(l["repayment_start"], i - 1))
            cf_g.append((d, g_emi))
        cf_n = _loan_net_flows(l)
        gross_cf.extend(cf_g)
        net_cf.extend(cf_n)
        per_gross.setdefault(t, []).extend(cf_g)
        per_net.setdefault(t, []).extend(cf_n)
    return gross_cf, net_cf, per_gross, per_net


def xirr_returns(loans):
    """Time-weighted (XIRR) returns on matured loans, using the actual monthly
    EMI schedule (repayment_start + 1..tenure months). Two views are emitted:

    * ``portfolio_net`` / ``net_by_tenure`` — successful CLOSED loans only
      (survivorship; what repaying loans earn).
    * ``portfolio_net_all`` / ``net_all_by_tenure`` — the whole matured book
      (CLOSED + NPA, including defaults with zero recovery booked as total
      losses) — the honest default-inclusive annualized return.
    """
    closed = [l for l in loans if l["status"] == "CLOSED"
              and l["disbursement_date"] and l["repayment_start"]
              and (l["amount"] or 0) > 0 and (l["total_received"] or 0) > 0]
    matured = [l for l in loans if l["status"] in ("CLOSED", "NPA")
               and l["disbursement_date"] and l["repayment_start"]
               and (l["amount"] or 0) > 0]
    g_cf, n_cf, g_per, n_per = _xirr_cashflows(closed)
    ga_cf, na_cf, ga_per, na_per = _xirr_cashflows(matured)

    def _by_tenure(per):
        return {str(t): round(100 * _irr(_norm(per[t])), 1) for t in per}

    return {
        "portfolio_gross": round(100 * _irr(_norm(g_cf)), 1),
        "portfolio_net": round(100 * _irr(_norm(n_cf)), 1),
        "portfolio_net_all": round(100 * _irr(_norm(na_cf)), 1),
        "avg_capital_at_risk_pct": 50.0,  # even-principal monthly amortization
        "gross_by_tenure": _by_tenure(g_per),
        "net_by_tenure": _by_tenure(n_per),
        "net_all_by_tenure": _by_tenure(na_per),
        "loans_used": len(closed),
        "loans_used_all": len(matured),
    }


def active_xirr(loans):
    """Projected net XIRR on the ACTIVE book (loans still repaying).

    Closed-loan XIRR answers "what did completed cycles earn"; this answers
    "what will the money still out there earn" by solving the same monthly-EMI
    IRR on each active loan's expected future cashflows. Because the report has
    no per-EMI dates, received money is spread evenly across the tenure's EMI
    months — the same convention as ``xirr_returns``.

    Per active loan (expected case):
      * -amount out at disbursement (day 0);
      * net inflow spread over the tenure's EMIs from repayment_start:
        received + outstanding principal x (1 - matured default rate of that
        tenure) + remaining contracted interest x that tenure's closed-loan
        interest-collection rate (early-repayment rebates) - total fees
        (platform fee paid + expected future fee on the outstanding);
      * defaults therefore eat principal at each tenure's own matured rate and
        future interest is haircut by how much interest closed loans actually
        collected.

    A "best case" variant is also emitted: same schedule but zero defaults on
    the outstanding principal (collection haircut still applies).
    """
    closed = [l for l in loans if l["status"] == "CLOSED"
              and l["disbursement_date"] and l["repayment_start"]
              and (l["amount"] or 0) > 0 and (l["total_received"] or 0) > 0]
    matured = [l for l in loans if l["status"] in ("CLOSED", "NPA")
               and l["disbursement_date"] and l["repayment_start"]
               and (l["amount"] or 0) > 0]
    active = [l for l in loans if l["status"] == "ACTIVE"
              and l["disbursement_date"] and l["repayment_start"]
              and (l["amount"] or 0) > 0 and (l["total_repayment"] or 0) > 0]

    def _rate(pool, key, denom_key):
        out = {}
        for t in TENURES:
            r = [l for l in pool if l["tenure"] == t]
            d = sum(l[denom_key] or 0 for l in r)
            out[t] = (sum(l[key] or 0 for l in r) / d) if d else 0.0
        return out

    # matured default rate per tenure: NPA count / (closed + NPA) count
    def_rate = {}
    for t in TENURES:
        m = [l for l in matured if l["tenure"] == t]
        def_rate[t] = (100.0 * sum(1 for l in m if l["status"] == "NPA") / len(m)) if m else 0.0
    # closed-loan interest collection rate per tenure
    coll = {}
    for t in TENURES:
        r = [l for l in closed if l["tenure"] == t]
        ci = sum((l["total_repayment"] or 0) - (l["amount"] or 0) for l in r)
        ii = sum(l["interest_received"] or 0 for l in r)
        coll[t] = (100.0 * ii / ci) if ci else 70.0
    # fee rate per tenure (% of principal returned; era-aware for the
    # tenures whose schedule changed mid-book)
    def _fee_rate_for(l):
        return (_fee_rate(l["tenure"], (l["disbursement_date"] or "")[:7]) or 0.0) / 100.0

    def _loan_flows(l, default_on):
        t = int(l["tenure"] or 1)
        amt = l["amount"] or 0
        rec = l["total_received"] or 0
        prin = l["principal_received"] or 0
        intr = l["interest_received"] or 0
        outstanding = max(0.0, amt - prin)
        fut_int = max(0.0, (l["total_repayment"] or 0) - amt - intr)
        loss = outstanding * (def_rate[t] / 100.0) if default_on else 0.0
        expected_in = rec + (outstanding - loss) + fut_int * (coll[t] / 100.0)
        fee_paid = l["platform_fee"] or 0
        fut_fee = max(0.0, amt * _fee_rate_for(l) - fee_paid)
        net_in = max(0.0, expected_in - fee_paid - fut_fee)
        cf = [(0, -amt)]
        emi = net_in / t
        for i in range(1, t + 1):
            d = _days(l["disbursement_date"], _add_months(l["repayment_start"], i - 1))
            cf.append((d, emi))
        return cf

    def _irr_by(sel, default_on):
        pooled, per = [], {}
        for l in sel:
            cf = _loan_flows(l, default_on)
            pooled.extend(cf)
            per.setdefault(int(l["tenure"]), []).extend(cf)
        if not pooled:
            return None, {}
        return round(100 * _irr(_norm(pooled)), 1), {
            str(t): round(100 * _irr(_norm(per[t])), 1) for t in per
        }

    port_exp, ten_exp = _irr_by(active, default_on=True)
    port_best, ten_best = _irr_by(active, default_on=False)
    return {
        "loans_used": len(active),
        "outstanding": round(sum((l["amount"] or 0) - (l["principal_received"] or 0)
                                  for l in active), 2),
        "portfolio_expected": port_exp,
        "portfolio_no_default": port_best,
        "by_tenure_expected": ten_exp,
        "by_tenure_no_default": ten_best,
        "note": "expected = received to date + outstanding principal minus the tenure's matured "
                "default rate + remaining contracted interest haircut by the tenure's closed-loan "
                "collection rate, minus platform fees; EMIs spread across the tenure's months "
                "(report has no per-EMI dates), same convention as closed-loan XIRR",
    }


SCORE_PICK_BANDS = [
    (700, 725, "700–724"), (725, 750, "725–749"), (750, 775, "750–774"),
    (775, 100000, "775+"),
]


def _annualize(rate_pct, months):
    """Per-cycle rate -> per-year equivalent by turnover: rate x (12 / months).

    Same convention as the dashboard's annualized ROI (money at a t-month tenure
    recycles 12/t times a year), so an annualized NPA sits on the same footing
    as an annualized return and tenures compare fairly.
    """
    if rate_pct is None or not months or months <= 0:
        return None
    return round(rate_pct * 12.0 / months, 1)


def npa_by_year(loans):
    """NPA ledger by origination year x tenure on the matured book.

    'Matured' = CLOSED + NPA loans only: still-active loans can still default, so
    including them would understate every rate (same convention as tenure_matrix).
    For every bucket two figures are reported side by side:

      * ``rate_life``  — NPA over the loan's whole term (matured basis);
      * ``rate_ann``   — annualized NPA: same rate scaled to a full year of
        lending by turnover, rate x 12/tenure (2-month money recycles 6x a year,
        so its small default rate stacks up; a 12-month rate does not scale).
        Same convention as the dashboard's annualized returns, so NPA can be set
        directly against annualized net return per tenure.

    The money side mirrors the count side: ``loss_life`` / ``loss_ann`` = NPA
    principal as % of the rupees disbursed on the same matured loans, over the
    term and per year. Year-total rows blend tenures at the pool's average
    tenure (months weighted by matured loan count), so an annualized figure
    exists for "2025" and "2026" too.
    """
    def _pool_stats(pool):
        matured = len(pool)
        npa = sum(1 for l in pool if l["status"] == "NPA")
        closed = matured - npa
        disb = round(sum(l["amount"] or 0 for l in pool), 2)
        npa_amt = round(sum(l["npa_amount"] or 0 for l in pool if l["status"] == "NPA"), 2)
        return matured, closed, npa, disb, npa_amt

    matured_all = [l for l in loans if l["status"] in ("CLOSED", "NPA")
                   and l.get("disbursement_date")]
    years = sorted({l["disbursement_date"][:4] for l in matured_all})

    def _rows_for(pool):
        """Tenure rows for a pool, then its blended all-tenure row."""
        out = []
        tot_m, tot_n, tot_disb, tot_npa_amt = 0, 0, 0.0, 0.0
        months_weighted = 0
        for t in TENURES:
            sel = [l for l in pool if l["tenure"] == t]
            if not sel:
                continue
            m, c, n, disb, amt = _pool_stats(sel)
            rate_life = round(100 * n / m, 1) if m else None
            out.append({
                "year": None, "tenure": t, "matured": m, "closed": c, "npa": n,
                "disb": disb, "npa_amt": amt,
                "rate_life": rate_life,
                "rate_ann": _annualize(rate_life, t),
                "loss_life": round(100 * amt / disb, 1) if disb else None,
                "loss_ann": _annualize(100 * amt / disb, t) if disb else None,
                "avg_months": t, "small": m < 10,
            })
            tot_m += m; tot_n += n; tot_disb += disb; tot_npa_amt += amt
            months_weighted += m * t
        if pool:
            avg_months = round(months_weighted / tot_m, 1) if tot_m else None
            rate_life = round(100 * tot_n / tot_m, 1) if tot_m else None
            out.append({
                "year": None, "tenure": None, "matured": tot_m, "closed": tot_m - tot_n,
                "npa": tot_n, "disb": round(tot_disb, 2), "npa_amt": round(tot_npa_amt, 2),
                "rate_life": rate_life,
                "rate_ann": _annualize(rate_life, avg_months),
                "loss_life": round(100 * tot_npa_amt / tot_disb, 1) if tot_disb else None,
                "loss_ann": _annualize(100 * tot_npa_amt / tot_disb, avg_months) if tot_disb else None,
                "avg_months": avg_months, "small": False,
            })
        return out

    rows = []
    for y in years:
        pool = [l for l in matured_all if l["disbursement_date"][:4] == y]
        for r in _rows_for(pool):
            r["year"] = y
            rows.append(r)
    for r in _rows_for(matured_all):
        r["year"] = "ALL"
        rows.append(r)

    return {
        "years": years,
        "tenures": TENURES,
        "rows": rows,
        "note": "matured = CLOSED + NPA loans only (active loans can still default); "
                "rate_life = NPA loans / matured over the loan's whole term; "
                "rate_ann = annualized by turnover rate x 12/tenure (same convention as "
                "annualized returns, so NPA compares directly with return per tenure); "
                "loss_life / loss_ann = NPA principal as % of rupees disbursed on the "
                "same matured loans, over the term and per year; year totals blend "
                "tenures at the pool's average tenure",
    }


def xirr_picks(loans, min_matured=10):
    """Rank tenure × score cells by default-inclusive net XIRR and derive a
    recommended lending allocation from the lender's own completed-loan history.

    Method: every matured loan (CLOSED + NPA) is assigned to a (tenure, score)
    cell. Its net cashflows — amount out at disbursement, (received − platform
    fee) over the actual monthly EMIs, NPA receipts front-loaded to the
    estimated default month (the fee model is % of principal returned per EMI,
    so defaulted loans stop early rather than paying over the full term) — are
    pooled per cell and solved for the annualized IRR (same solver as
    ``xirr_returns``). NPA loans enter as losses (full principal out, only
    recovered rupees back, zero-recovery loans as total losses), so each cell's
    XIRR is the honest default-inclusive annualized net return — every fee and
    every default is inside the number.

    Allocation rule (deterministic and stated on the dashboard):
      * only cells with >= min_matured completed loans are ranked;
      * tiered by default-inclusive XIRR and matured default rate:
          core     XIRR_all >= 40%/yr AND matured default <= 6%
          support  XIRR_all >= 15%/yr AND matured default <= 12%
          gate     XIRR_all >  0 but below the support bar (conditional only)
          avoid    XIRR_all <= 0 — money-losing after fees and defaults
      * recommended split: weight W = XIRR_all × (100 − default)/100 per cell
        (risk-adjusted annual return); core cells count 2×, support 1×, gate
        0.2×, avoid 0 — shares normalized to sum to 100% of monthly lending.
    """
    buckets = {}  # (tenure, band_label) -> list of matured loans
    for l in loans:
        if l["status"] not in ("CLOSED", "NPA"):
            continue
        if not l["disbursement_date"] or not l["repayment_start"] or (l["amount"] or 0) <= 0:
            continue
        band = None
        for lo, hi, lab in SCORE_PICK_BANDS:
            if l["score"] is not None and lo <= l["score"] < hi:
                band = lab
                break
        if band is None:
            continue
        buckets.setdefault((int(l["tenure"]), band), []).append(l)

    cells = []
    for (t, band), sel in buckets.items():
        if len(sel) < min_matured:
            continue
        npa = [l for l in sel if l["status"] == "NPA"]
        closed = [l for l in sel if l["status"] == "CLOSED"]
        disb = sum(l["amount"] or 0 for l in sel)
        def_rate = 100 * len(npa) / len(sel)
        avg_rate = (sum(l["interest_rate"] or 0 for l in sel if l["interest_rate"]) /
                    sum(1 for l in sel if l["interest_rate"])) if any(l["interest_rate"] for l in sel) else None
        # pooled net cashflows across the cell's matured loans
        # (per-EMI fee model: NPA receipts front-loaded to the default month)
        net_cf = []
        for l in sel:
            net_cf.extend(_loan_net_flows(l))
        xirr_all = round(100 * _irr(_norm(net_cf)), 1) if net_cf else None
        # success-only reference: same pool minus the NPA loans
        if closed:
            ok_cf = []
            for l in closed:
                ok_cf.extend(_loan_net_flows(l))
            xirr = round(100 * _irr(_norm(ok_cf)), 1) if ok_cf else None
        else:
            xirr = None
        _interest = sum(l["interest_received"] or 0 for l in sel)
        _fee = sum(l["platform_fee"] or 0 for l in sel)
        _npa_amt = sum(l["npa_amount"] or 0 for l in sel if l["status"] == "NPA")
        _net = _interest - _fee - _npa_amt
        cells.append({
            "key": f"{t}mo·{band}", "tenure": t, "band": band,
            "matured": len(sel), "npa": len(npa), "closed": len(closed),
            "def_rate": round(def_rate, 1),
            "xirr": xirr, "xirr_all": xirr_all,
            "disb": round(disb, 2),
            "avg_rate": round(avg_rate, 1) if avg_rate else None,
            "net_1000": round(1000.0 * _net / disb, 1) if disb else None,
            "fee_pct": round(100.0 * _fee / disb, 2) if disb else None,
        })

    # tier + allocation
    def _tier(c):
        xa = c["xirr_all"] if c["xirr_all"] is not None else -1
        if xa <= 0:
            return "avoid"
        if xa >= 40 and c["def_rate"] <= 6:
            return "core"
        if xa >= 15 and c["def_rate"] <= 12:
            return "support"
        return "gate"

    for c in cells:
        c["tier"] = _tier(c)
    factor = {"core": 2.0, "support": 1.0, "gate": 0.2, "avoid": 0.0}
    weights = []
    total_w = 0.0
    for c in cells:
        xa = c["xirr_all"] or 0
        r = max(0.0, xa) * max(0.0, 100 - c["def_rate"]) / 100.0
        w = r * factor[c["tier"]]
        weights.append(w)
        total_w += w
    for c, w in zip(cells, weights):
        c["rec_pct"] = round(100 * w / total_w, 1) if total_w else 0.0
    cells.sort(key=lambda c: (-(c["xirr_all"] if c["xirr_all"] is not None else -1), -c["rec_pct"]))
    tier_pcts = {"core": 0.0, "support": 0.0, "gate": 0.0, "avoid": 0.0}
    for c in cells:
        tier_pcts[c["tier"]] += c["rec_pct"]
    for k in tier_pcts:
        tier_pcts[k] = round(tier_pcts[k], 1)
    return {
        "min_matured": min_matured,
        "rule": "default-inclusive net XIRR on matured loans (fees + every NPA included); "
                "weight W = XIRR × (100 − default)/100, core cells weighted 2×, support 1×, "
                "gate 0.2×, avoid 0 — normalized to 100% of monthly lending",
        "cells": cells,
        "tier_pcts": tier_pcts,
    }


def month_allocation(loans, picks):
    """The newest month's actual lending vs the dashboard's own recommendation.

    Takes the latest disbursement month that has still-open money (ACTIVE /
    PROCESSING loans) and buckets those fresh loans into the same tenure ×
    score cells the picks panel ranks, so the page can show "where this
    month's money actually went" next to "where the data says it should go".
    Money that went into avoid/conditional cells is called out explicitly.
    """
    month = max(((l["disbursement_date"] or "")[:7] for l in loans
                 if l["status"] in ("ACTIVE", "PROCESSING") and l["disbursement_date"]),
                default=None)
    if not month:
        return None
    fresh = [l for l in loans
             if (l["disbursement_date"] or "")[:7] == month
             and l["status"] in ("ACTIVE", "PROCESSING")]
    if not fresh:
        return None

    cell_by_key = {c["key"]: c for c in picks.get("cells", [])}
    agg = {}
    for l in fresh:
        t = int(l["tenure"] or 0)
        band = None
        for lo, hi, lab in SCORE_PICK_BANDS:
            if l["score"] is not None and lo <= l["score"] < hi:
                band = lab
                break
        key = f"{t}mo·{band}" if band else None
        a = agg.setdefault((t, band), {"loans": 0, "amount": 0.0})
        a["loans"] += 1
        a["amount"] += l["amount"] or 0

    total_amt = sum(a["amount"] for a in agg.values())
    buckets = []
    misaligned_amt = 0.0
    misaligned_loans = 0
    for (t, band), a in sorted(agg.items(), key=lambda kv: (-kv[1]["amount"])):
        key = f"{t}mo·{band}" if band else None
        cell = cell_by_key.get(key)
        tier = cell["tier"] if cell else ("unproven" if band else "unbanded")
        rec = cell["rec_pct"] if cell else None
        actual = round(100 * a["amount"] / total_amt, 1) if total_amt else 0.0
        if cell and cell["tier"] in ("avoid", "gate"):
            misaligned_amt += a["amount"]
            misaligned_loans += a["loans"]
        buckets.append({
            "tenure": t, "band": band, "key": key,
            "loans": a["loans"], "amount": round(a["amount"], 2),
            "actual_pct": actual, "rec_pct": rec, "tier": tier,
            "xirr_all": cell["xirr_all"] if cell else None,
        })

    # tenure-level rollup (the verdict's first gate is the tenure)
    ten = {}
    for b in buckets:
        d = ten.setdefault(b["tenure"], {"loans": 0, "amount": 0.0, "rec": 0.0})
        d["loans"] += b["loans"]
        d["amount"] += b["amount"]
        d["rec"] += b["rec_pct"] or 0.0
    by_tenure = [{
        "tenure": t,
        "loans": d["loans"], "amount": round(d["amount"], 2),
        "actual_pct": round(100 * d["amount"] / total_amt, 1) if total_amt else 0.0,
        "rec_pct": round(d["rec"], 1),
    } for t, d in sorted(ten.items())]

    core_amt = sum(b["amount"] for b in buckets if b["tier"] == "core")
    return {
        "month": month,
        "loans": len(fresh),
        "amount": round(total_amt, 2),
        "by_bucket": buckets,
        "by_tenure": by_tenure,
        "core_pct": round(100 * core_amt / total_amt, 1) if total_amt else 0.0,
        "misaligned_amount": round(misaligned_amt, 2),
        "misaligned_loans": misaligned_loans,
    }


def vintage(loans, report_end=None):
    """Vintage curves: how each origination cohort's defaults arrive month by month.

    A cohort = all funded loans (CLOSED/ACTIVE/NPA with a disbursement date)
    originated in one calendar month. For every cohort, ``curve`` gives the
    cumulative default (NPA) rate at each loan age in months — so you can read
    a vintage's default bill as it builds and whether the curve has flattened
    (the cohort has paid its bill) or is still climbing (recent cohorts are
    unproven). ``arrival`` pools all NPAs into a histogram of the month-of-life
    each default struck, answering "how fast do defaults actually hit?".

    Every cohort also carries a percentage ledger (same fields the NPA-by-year
    tables use, plus the economics): ``rate_life`` / ``rate_ann`` = NPA count ÷
    matured loans, over the loan's term and annualized by turnover (x 12 / the
    cohort's average tenure); ``loss_life`` / ``loss_ann`` = the same for NPA
    rupees ÷ rupees disbursed on those matured loans. Then the realized money
    side over the whole cohort (active included, to the report date):
    ``interest`` received, ``fees`` deducted, ``npa_amt`` unrecovered principal
    booked on NPAs, and ``net`` = interest - fees - npa_amt, with ``net_pct``
    and ``net_ann`` (per year by the cohort's average tenure). ``open`` flags a
    cohort where more than 10% of loans are still ACTIVE - its net is only
    realized-to-date and can still degrade.

    Default timing note: the report records only an NPA *declaration* date
    (all 148 declarations landed in one May–Sep 2026 batch, lagging the true
    default by months), so that date cannot drive the curve. Instead each NPA's
    default month is estimated from how much principal it actually repaid —
    EMIs paid ≈ principal_received ÷ (amount ÷ tenure), the same even-EMI
    convention the XIRR charts disclose — defaulted = the month it missed its
    next EMI. CLOSED loans never default; ACTIVE loans are survivors only up to
    their observed age at the report date (they can still default later).
    """
    import datetime

    if report_end is None:
        report_end = "2026-09-02"
    end = datetime.date.fromisoformat(str(report_end)[:10])

    def _months_elapsed(d0, d1):
        return max(0, (d1.year - d0.year) * 12 + (d1.month - d0.month))

    funded = [l for l in loans if l["status"] in ("CLOSED", "ACTIVE", "NPA")
              and l.get("disbursement_date")]
    cohorts = {}
    hist = {}
    for l in funded:
        d0 = datetime.date.fromisoformat(l["disbursement_date"])
        m = l["disbursement_date"][:7]
        row = cohorts.setdefault(m, {"closed": 0, "npa": 0, "active": 0,
                                    "def_ages": [], "loans": []})
        row["loans"].append(l)
        st = l["status"]
        if st == "CLOSED":
            row["closed"] += 1
        elif st == "NPA":
            row["npa"] += 1
            a = l["amount"] or 0
            t = int(l["tenure"] or 0) or 6
            paid = (l["principal_received"] or 0) / (a / t) if a else 0
            d = max(1, min(12, int(round(paid)) + 1))
            row["def_ages"].append(d)
            hist[d] = hist.get(d, 0) + 1
        else:
            row["active"] += 1
            row["act_obs"] = row.get("act_obs", []) + [_months_elapsed(d0, end)]

    out_cohorts = []
    for m in sorted(cohorts):
        c = cohorts[m]
        n = c["closed"] + c["npa"] + c["active"]
        matured = c["closed"] + c["npa"]
        if matured < 10:
            continue  # too little resolved evidence to draw a meaningful curve
        # a cohort can only be observed up to the report date: cap the curve at
        # the months its oldest loan (originated on the 1st) has actually lived,
        # so an unproven cohort never renders flat tails at ages no loan reached
        cohort_start = datetime.date(int(m[:4]), int(m[5:7]), 1)
        max_obs = _months_elapsed(cohort_start, end) + 1
        curve = []
        for age in range(1, min(12, max_obs) + 1):
            denom = matured + sum(1 for o in c.get("act_obs", []) if o >= age)
            if denom < 15:
                continue
            num = sum(1 for d in c["def_ages"] if d <= age)
            curve.append({
                "age": age, "npa": num, "denom": denom,
                "rate": round(100.0 * num / denom, 2),
            })
        if not curve:
            continue
        # ---- percentage & money ledger for this cohort (see module docstring) ----
        def _ann(v, tmo):
            return round(v * 12.0 / tmo, 2) if v is not None and tmo else None

        mat_loans = [l for l in c["loans"] if l["status"] != "ACTIVE"]
        npa_loans = [l for l in c["loans"] if l["status"] == "NPA"]
        avg_ten_m = (round(sum((l["tenure"] or 0) for l in mat_loans) / len(mat_loans), 1)
                     if mat_loans else None)
        avg_ten = round(sum((l["tenure"] or 0) for l in c["loans"]) / n, 1) if n else None
        disb_m = round(sum(l["amount"] or 0 for l in mat_loans), 2)
        npa_amt_m = round(sum(l["npa_amount"] or 0 for l in npa_loans), 2)
        rate_life = round(100.0 * c["npa"] / matured, 2) if matured else None
        loss_life = round(100.0 * npa_amt_m / disb_m, 2) if disb_m else None
        disb = round(sum(l["amount"] or 0 for l in c["loans"]), 2)
        interest = round(sum(l["interest_received"] or 0 for l in c["loans"]), 2)
        fees = round(sum(l["platform_fee"] or 0 for l in c["loans"]), 2)
        npa_amt = round(sum(l["npa_amount"] or 0 for l in npa_loans), 2)
        net = round(interest - fees - npa_amt, 2)
        net_pct = round(100.0 * net / disb, 2) if disb else None
        out_cohorts.append({
            "month": m, "loans": n, "matured": matured,
            "closed": c["closed"], "npa": c["npa"], "active": c["active"],
            "open": n and c["active"] / n > 0.10,
            "avg_tenure_m": avg_ten_m, "avg_tenure": avg_ten,
            "rate_life": rate_life, "rate_ann": _ann(rate_life, avg_ten_m),
            "loss_life": loss_life, "loss_ann": _ann(loss_life, avg_ten_m),
            "disb_m": disb_m, "npa_amt_m": npa_amt_m,
            "disb": disb, "interest": interest, "fees": fees,
            "npa_amt": npa_amt, "net": net,
            "net_pct": net_pct, "net_ann": _ann(net_pct, avg_ten),
            "curve": curve,
        })

    # pooled arrival histogram across every NPA (month-of-life 1..12)
    arrival = []
    for age in range(1, 13):
        cnt = hist.get(age, 0)
        if cnt:
            arrival.append({"age": age, "npa": cnt})
    total_npa = sum(h for h in hist.values())
    cum = 0
    for r in arrival:
        cum += r["npa"]
        r["pct_of_all"] = round(100.0 * r["npa"] / total_npa, 1) if total_npa else 0
        r["cum_pct"] = round(100.0 * cum / total_npa, 1) if total_npa else 0

    return {
        "report_end": str(end),
        "cohorts": out_cohorts,
        "arrival": arrival,
        "note": "cohort = funded loans (CLOSED/ACTIVE/NPA) originated that month; "
                "each NPA's default month-of-life is estimated from principal repaid "
                "(EMIs paid ≈ principal ÷ (amount ÷ tenure), the same even-EMI "
                "convention the XIRR charts disclose) because the report's NPA "
                "declaration dates are batched and lag the true default; curve rate = "
                "NPA loans with estimated default age ≤ that month ÷ (matured loans + "
                "still-active loans that have already survived that many months); a "
                "flat tail means the cohort has finished paying its default bill, a "
                "still-rising end means recent cohorts are unproven; rate/loss per-year "
                "figures annualize the matured rates by the cohort's average tenure "
                "(x 12/avg tenure); net kept = interest received to date - fees - NPA "
                "principal booked (npa_amount = unrecovered principal), realized across "
                "the whole cohort including still-active loans, and open cohorts "
                "(more than 10% active) can still degrade",
    }


def return_drivers(loans):
    """Realized net return after fees & every default, cut by the loan
    attributes a lender actually chooses — quoted rate, ticket size and
    repayment type. Answers "does picking a higher-rate or bigger-ticket loan
    actually pay more?" with the same per-EMI fee + front-loaded-NPA cashflow
    model as the XIRR engine, so every figure is directly comparable to the
    picks' net XIRR (audit W3 reconciles the buckets to the matured book)."""
    matured = [l for l in loans if l["status"] in ("CLOSED", "NPA")
               and l["disbursement_date"] and l["repayment_start"]
               and (l["amount"] or 0) > 0]

    def _stats(pool):
        if not pool:
            return None
        cf = []
        for l in pool:
            cf.extend(_loan_net_flows(l))
        disb = sum(l["amount"] or 0 for l in pool)
        interest = sum(l["interest_received"] or 0 for l in pool)
        fee = sum(l["platform_fee"] or 0 for l in pool)
        npa_amt = sum(l["npa_amount"] or 0 for l in pool if l["status"] == "NPA")
        npa = sum(1 for l in pool if l["status"] == "NPA")
        net = interest - fee - npa_amt
        return {
            "loans": len(pool), "npa": npa,
            "disb": round(disb, 2),
            "def_rate": round(100.0 * npa / len(pool), 1),
            "xirr_all": round(100 * _irr(_norm(cf)), 1) if cf else None,
            "net_1000": round(1000.0 * net / disb, 1) if disb else None,
            "fee_pct": round(100.0 * fee / disb, 2) if disb else None,
            "avg_rate": (round(sum(l["interest_rate"] or 0 for l in pool) / len(pool), 1)
                         if any(l["interest_rate"] for l in pool) else None),
        }

    by_rate = []
    for lo, hi, lab in ((0, 42, "<42%"), (42, 44, "42–43%"), (44, 46, "44–45%"),
                        (46, 48, "46–47%"), (48, 100, "48%+")):
        pool = [l for l in matured
                if l["interest_rate"] is not None and lo <= l["interest_rate"] < hi]
        s = _stats(pool)
        if s:
            s["label"] = lab
            by_rate.append(s)

    by_ticket = []
    for lo, hi, lab in ((0, 251, "₹250"), (251, 501, "₹500"), (501, 1001, "₹1,000"),
                        (1001, 2501, "₹2,500"), (2501, 100000, "₹5,000+")):
        pool = [l for l in matured if lo <= (l["amount"] or 0) < hi]
        s = _stats(pool)
        if s:
            s["label"] = lab
            by_ticket.append(s)

    by_repay = []
    for rt in ("MONTHLY", "DAILY"):
        pool = [l for l in matured if (l.get("repayment_type") or "").upper() == rt]
        s = _stats(pool)
        if s:
            s["label"] = rt.title()
            by_repay.append(s)

    # ticket size WITHIN each tenure × score cell: is the ₹2,500 dip a mix
    # effect or a real ticket-level risk? Holds the cell constant and cuts it
    # by ticket bucket, so a bad ticket bucket can't be blamed on the cell mix.
    def _pick_band(s):
        for lo, hi, lab in SCORE_PICK_BANDS:
            if s is not None and lo <= s < hi:
                return lab
        return None

    ticket_buckets = ((0, 251, "₹250"), (251, 501, "₹500"), (501, 1001, "₹1,000"),
                      (1001, 2501, "₹2,500"), (2501, 100000, "₹5,000+"))
    by_ticket_in_cell = []
    cell_pool = {}
    for l in matured:
        b = _pick_band(l.get("score"))
        key = (int(l["tenure"] or 0), b)
        if b:
            cell_pool.setdefault(key, []).append(l)
    for (t, b), sel in sorted(cell_pool.items()):
        if len(sel) < 15:
            continue  # cell too thin to cut by ticket
        buckets = []
        for lo, hi, lab in ticket_buckets:
            sub = [l for l in sel if lo <= (l["amount"] or 0) < hi]
            if len(sub) < 5:
                continue
            s = _stats(sub)
            if s:
                s["label"] = lab
                buckets.append(s)
        if len(buckets) >= 2:
            by_ticket_in_cell.append({
                "tenure": t, "band": b,
                "loans": len(sel),
                "buckets": buckets,
            })

    return {
        "by_rate": by_rate,
        "by_ticket": by_ticket,
        "by_repay": by_repay,
        "by_ticket_in_cell": by_ticket_in_cell,
        "note": "matured loans only (CLOSED + NPA); net XIRR incl. every default and fee, "
                "same cashflow model as xirr_picks (per-EMI fee on principal returned, "
                "NPA receipts front-loaded to the estimated default month); net_1000 = "
                "(interest − fees − NPA principal) per ₹1,000 lent over the loan's life",
    }


def expected_emi_timeline(loans):
    """Month-by-month future EMI receipts from the ACTIVE book (contractual).
    Each active loan still owes (total_repayment - total_received); the remaining
    EMIs are scheduled from the first unpaid month through the tenure end."""
    buckets = {}
    active = [l for l in loans if l["status"] == "ACTIVE" and l["repayment_start"]
              and (l["total_repayment"] or 0) > (l["total_received"] or 0)]
    for l in active:
        t = int(l["tenure"] or 1)
        emi = (l["total_repayment"] or 0) / t
        paid = round((l["total_received"] or 0) / emi)
        remaining = t - paid
        for i in range(paid, t):
            m = _add_months(l["repayment_start"], i)[:7]
            buckets[m] = buckets.get(m, 0) + emi
    return {"months": sorted(buckets), "receipts": [round(buckets[m], 2) for m in sorted(buckets)]}


def overall_returns(loans):
    """Whole-book P&L statement."""
    m = _money(loans)
    net = m["interest"] - m["fee"]
    net_all = net - m["npa_amt"]
    outstanding = m["disb"] - m["principal"] - m["npa_amt"]
    closed = [l for l in loans if l["status"] == "CLOSED"]
    c = _money(closed)
    return {
        "disbursed": m["disb"],
        "received": m["received"],
        "principal_received": m["principal"],
        "interest_received": m["interest"],
        "platform_fee": m["fee"],
        "npa_loss": m["npa_amt"],
        "net_earnings": round(net, 2),
        "net_after_npa": round(net_all, 2),
        "outstanding": round(outstanding, 2),
        "gross_roi": round(100 * m["interest"] / m["disb"], 2) if m["disb"] else None,
        "net_roi": round(100 * net / m["disb"], 2) if m["disb"] else None,
        "net_roi_after_npa": round(100 * net_all / m["disb"], 2) if m["disb"] else None,
        "closed_net": round(c["interest"] - c["fee"], 2),
        "closed_disb": c["disb"],
        "closed_net_roi": round(100 * (c["interest"] - c["fee"]) / c["disb"], 2) if c["disb"] else None,
    }

# ---------------------------------------------------------------------------
# xirr_atlas: the fine-bucket net-XIRR atlas — "which bucket earns what, per year"
# ---------------------------------------------------------------------------
ATLAS_BANDS = []
for _lo in range(700, 800, 10):
    ATLAS_BANDS.append((_lo, _lo + 9, "%d-%d" % (_lo, _lo + 9)))
ATLAS_BANDS.append((800, 999, "800+"))
ATLAS_SLICES = ["ALL", "2025", "2026"]


def _atlas_band(score):
    """Index into ATLAS_BANDS for a score, or None above/below the range."""
    if score is None:
        return None
    for i, (lo, hi, _lab) in enumerate(ATLAS_BANDS):
        if lo <= score <= hi:
            return i
    return None


def _pool_xirr(pool, closed_only=False):
    """Money-weighted net XIRR of a matured-loan pool (same convention as
    xirr_returns / xirr_picks: amount out at disbursement, receipts − fee over
    the EMIs, NPAs front-loaded to their estimated default month).
    closed_only drops NPA loans entirely."""
    cfs = []
    for l in pool:
        if closed_only and l["status"] != "CLOSED":
            continue
        amt = l["amount"] or 0
        t = int(l["tenure"] or 1)
        if amt <= 0 or t < 1 or not l["repayment_start"]:
            continue
        cfs.extend(_loan_net_flows(l))
    if not cfs:
        return None
    return round(100 * _irr(_norm(cfs)), 1)


def _per_loan_ann(l):
    """One matured loan's realised annualized net return incl. fees & its default:
    profit = received − amount − fee over the loan's life, annualized by turnover
    (× 12/tenure — the same convention as the rest of the dashboard). A total loss
    of principal is capped at −100%/yr (the money is lost once, whatever the term)."""
    amt = l["amount"] or 0
    t = int(l["tenure"] or 1)
    if amt <= 0 or t < 1:
        return None
    prof = (l["total_received"] or 0) - amt - (l["platform_fee"] or 0)
    ann = 100.0 * prof / amt * 12.0 / t
    return max(-100.0, ann)


def xirr_atlas(loans):
    """Per-bucket net-XIRR atlas over the matured book.

    Buckets = tenure (2/3/4/5/6/12 months) × LenDenClub score in 10-point bands
    from 700 (700-709 … 790-799, then 800+). For every non-empty bucket, on the
    matured loans (CLOSED + NPA — active loans can still default and are left
    out), this computes:

      * ``xirr_all`` / ``xirr_ok`` — money-weighted annualized net XIRR of the
        whole bucket (every default and fee inside the number) and of its
        repaying loans only (the upper bound);
      * ``drag`` — xirr_ok − xirr_all, the annual-return points defaults eat;
      * ``loan_med`` / ``loan_mean`` — median/mean of every individual loan's
        annualized net return incl. fees & defaults (per-loan layer);
      * the count and money side: matured / npa, default rate over the loan's
        life and per year, principal-loss % of ₹ lent (life + per year),
        realised platform fee % of ₹ lent, average borrower rate, and net kept
        ₹ per ₹1,000 lent.

    Slices: the whole matured book and each origination year (2025 / 2026).
    Cells with < 5 matured loans report counts only (the rates would be noise).
    """
    matured = [l for l in loans
               if l["status"] in ("CLOSED", "NPA") and l.get("disbursement_date")
               and l.get("repayment_start") and (l["amount"] or 0) > 0]
    pools = {"ALL": matured,
             "2025": [l for l in matured if l["disbursement_date"][:4] == "2025"],
             "2026": [l for l in matured if l["disbursement_date"][:4] == "2026"]}
    MIN_EV = 5  # minimum matured loans before a rate is trustworthy enough to print

    def _bucket_cells(pool):
        import statistics
        cells = {}
        for t in TENURES:
            tsel = [l for l in pool if l["tenure"] == t]
            for bi, (_lo, _hi, lab) in enumerate(ATLAS_BANDS):
                sel = [l for l in tsel if _atlas_band(l["score"]) == bi]
                if not sel:
                    continue
                npa = [l for l in sel if l["status"] == "NPA"]
                closed = [l for l in sel if l["status"] == "CLOSED"]
                disb = sum(l["amount"] or 0 for l in sel)
                amt_npa = sum(l["npa_amount"] or 0 for l in npa)
                fee = sum(l["platform_fee"] or 0 for l in sel)
                interest = sum(l["interest_received"] or 0 for l in sel)
                matured_n = len(sel)
                ok = matured_n >= MIN_EV
                def_rate = (100.0 * len(npa) / matured_n) if matured_n else None
                loss_life = (100.0 * amt_npa / disb) if disb else None
                sticker = (sum(l["interest_rate"] or 0 for l in sel if l["interest_rate"])
                           / sum(1 for l in sel if l["interest_rate"])) \
                    if any(l["interest_rate"] for l in sel) else None
                per_loan = [v for v in (_per_loan_ann(l) for l in sel) if v is not None]
                cell = {
                    "t": t, "band": lab, "matured": matured_n,
                    "npa": len(npa), "disb": round(disb, 2),
                    "npa_amt": round(amt_npa, 2),
                    "xirr_all": _pool_xirr(sel) if ok else None,
                    "xirr_ok": _pool_xirr(closed, closed_only=True) if ok and closed else None,
                    "drag": None, "loan_med": None, "loan_mean": None,
                    "def_rate": round(def_rate, 1) if ok and def_rate is not None else None,
                    "def_ann": _annualize(def_rate, t) if ok and def_rate is not None else None,
                    "loss_life": round(loss_life, 1) if ok and loss_life is not None else None,
                    "loss_ann": _annualize(loss_life, t) if ok and loss_life is not None else None,
                    "fee_pct": round(100.0 * fee / disb, 2) if ok and disb else None,
                    "sticker": round(sticker, 1) if ok and sticker is not None else None,
                    "net_1000": round(1000.0 * (interest - fee - amt_npa) / disb, 1)
                                if ok and disb else None,
                }
                if per_loan:
                    cell["loan_med"] = round(statistics.median(per_loan), 1)
                    cell["loan_mean"] = round(sum(per_loan) / len(per_loan), 1)
                if cell["xirr_all"] is not None and cell["xirr_ok"] is not None:
                    cell["drag"] = round(cell["xirr_ok"] - cell["xirr_all"], 1)
                cells["%d|%s" % (t, lab)] = cell
        return cells

    slices_out = {}
    for key in ATLAS_SLICES:
        pool = pools[key]
        xa = _pool_xirr(pool)
        xo = _pool_xirr(pool, closed_only=True)
        slices_out[key] = {
            "label": {"ALL": "Whole book", "2025": "Originated 2025",
                      "2026": "Originated 2026"}[key],
            "totals": {
                "matured": len(pool),
                "npa": sum(1 for l in pool if l["status"] == "NPA"),
                "disb": round(sum(l["amount"] or 0 for l in pool), 2),
                "interest": round(sum(l["interest_received"] or 0 for l in pool), 2),
                "fee": round(sum(l["platform_fee"] or 0 for l in pool), 2),
                "npa_amt": round(sum(l["npa_amount"] or 0 for l in pool if l["status"] == "NPA"), 2),
                "xirr_all": xa, "xirr_ok": xo,
            },
            "cells": _bucket_cells(pool),
        }

    return {
        "band_labels": [lab for (_lo, _hi, lab) in ATLAS_BANDS],
        "tenures": TENURES,
        "slices": slices_out,
        "min_evidence": MIN_EV,
        "note": "buckets = tenure × LenDenClub score in 10-point bands (700-709 … 790-799, 800+); "
                "matured = CLOSED + NPA loans (active loans can still default); xirr_all = money-weighted "
                "net XIRR incl. every default and fee (same even-EMI convention as xirr_returns); "
                "xirr_ok = same pool minus its NPAs (upper bound); drag = xirr_ok − xirr_all; per-loan "
                "figures annualize each loan's (received − amount − fee) by 12/tenure, losses capped at "
                "−100%/yr (a total loss of principal is at most −100%/yr); cells with < 5 matured loans "
                "report counts only",
    }
