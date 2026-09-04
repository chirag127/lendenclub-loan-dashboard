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
    (amount out at disbursement; (received - fee) spread over the EMI months).
    Loans that defaulted with zero recovery contribute a pure loss."""
    gross_cf, net_cf = [], []
    per_gross, per_net = {}, {}
    for l in sel:
        t = int(l["tenure"] or 1)
        amt, tot, fee = l["amount"], l["total_received"] or 0, l["platform_fee"] or 0
        g_emi, n_emi = tot / t, (tot - fee) / t
        cf_g = [(0, -amt)]
        cf_n = [(0, -amt)]
        for i in range(1, t + 1):
            d = _days(l["disbursement_date"], _add_months(l["repayment_start"], i - 1))
            cf_g.append((d, g_emi))
            cf_n.append((d, n_emi))
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
    # fee rate per tenure (% of disbursed, on closed loans)
    fee_rate = _rate(closed, "platform_fee", "amount")

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
        fut_fee = max(0.0, amt * fee_rate[t] - fee_paid)
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
    fee) spread over the actual monthly EMIs — are pooled per cell and solved
    for the annualized IRR (same solver as ``xirr_returns``). NPA loans enter as
    losses (full principal out, only recovered rupees back, zero-recovery loans
    as total losses), so each cell's XIRR is the honest default-inclusive
    annualized net return — every fee and every default is inside the number.

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
        net_cf = []
        for l in sel:
            amt = l["amount"] or 0
            tot = l["total_received"] or 0
            fee = l["platform_fee"] or 0
            t_ = int(l["tenure"] or 1)
            emi = (tot - fee) / t_
            net_cf.append((0, -amt))
            for i in range(1, t_ + 1):
                d = _days(l["disbursement_date"], _add_months(l["repayment_start"], i - 1))
                net_cf.append((d, emi))
        xirr_all = round(100 * _irr(_norm(net_cf)), 1) if net_cf else None
        # success-only reference: same pool minus the NPA loans
        if closed:
            ok_cf = []
            for l in closed:
                amt = l["amount"] or 0
                tot = l["total_received"] or 0
                fee = l["platform_fee"] or 0
                t_ = int(l["tenure"] or 1)
                emi = (tot - fee) / t_
                ok_cf.append((0, -amt))
                for i in range(1, t_ + 1):
                    d = _days(l["disbursement_date"], _add_months(l["repayment_start"], i - 1))
                    ok_cf.append((d, emi))
            xirr = round(100 * _irr(_norm(ok_cf)), 1) if ok_cf else None
        else:
            xirr = None
        cells.append({
            "key": f"{t}mo·{band}", "tenure": t, "band": band,
            "matured": len(sel), "npa": len(npa), "closed": len(closed),
            "def_rate": round(def_rate, 1),
            "xirr": xirr, "xirr_all": xirr_all,
            "disb": round(disb, 2),
            "avg_rate": round(avg_rate, 1) if avg_rate else None,
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