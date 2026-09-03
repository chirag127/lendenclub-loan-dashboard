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

    def _norm(cfs):
        t0 = min(d for d, a in cfs)
        return [(d - t0, a) for d, a in cfs]

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