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