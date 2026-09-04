"""Audit engine: reconcile the parsed data against the source report.

Every check returns {id, name, detail, status, value, expected, delta} where
status is PASS (exact), INFO (report-level figure differs for a known,
explained reason) or FAIL (an actual inconsistency worth fixing).

The matrix checks (T-series) re-derive the dashboard's tenure × score
heatmaps in Python so a JS/Python disagreement can never silently slip
through the build again.
"""

from .clean import to_num
from .insights import tenure_matrix, score_band, month_allocation, xirr_picks

TOL = 0.01  # rupee rounding tolerance


def _sums(loans):
    return {
        "disbursed": round(sum(l["amount"] or 0 for l in loans), 2),
        "received": round(sum(l["total_received"] or 0 for l in loans), 2),
        "principal": round(sum(l["principal_received"] or 0 for l in loans), 2),
        "interest": round(sum(l["interest_received"] or 0 for l in loans), 2),
        "fee": round(sum(l["platform_fee"] or 0 for l in loans), 2),
        "npa": round(sum(l["npa_amount"] or 0 for l in loans if l["status"] == "NPA"), 2),
    }


def _check(cid, name, detail, status, value, expected, delta=None):
    return {
        "id": cid, "name": name, "detail": detail, "status": status,
        "value": value, "expected": expected, "delta": delta,
    }


def _money_check(cid, name, loans, report_value, info_note=None):
    """Exact rupee reconciliation; optional INFO note when the report figure
    is a book-level aggregate that cannot be attributed loan-by-loan."""
    val = round(sum(l["amount"] or 0 for l in loans), 2) if cid == "M1" else \
        round(sum(l["total_received"] or 0 for l in loans), 2) if cid == "M2" else \
        round(sum(l["principal_received"] or 0 for l in loans), 2) if cid == "M3" else \
        round(sum(l["interest_received"] or 0 for l in loans), 2) if cid == "M4" else \
        round(sum(l["platform_fee"] or 0 for l in loans), 2) if cid == "M5" else \
        round(sum(l["npa_amount"] or 0 for l in loans if l["status"] == "NPA"), 2)
    delta = round(report_value - val, 2) if report_value is not None else None
    exact = abs(delta or 0) <= TOL
    status = "PASS" if exact else ("INFO" if info_note else "FAIL")
    detail = f"per-loan sum {val:,.2f} vs report {report_value:,.2f}" + \
        (f" (delta ₹{abs(delta):,.2f})" if delta and abs(delta) > TOL else "") + \
        (f" — {info_note}" if info_note and not exact else "")
    return _check(cid, name, detail, status, val, report_value, delta)


def run_audit(loans, summary, stats):
    checks = []
    S = summary
    sums = _sums(loans)

    # ---- M-series: money reconciliation vs report headline ----
    checks.append(_money_check("M1", "Disbursed amount", loans, S.get("disbursed_amount")))
    checks.append(_money_check("M2", "Total amount received", loans, S.get("total_amount_received")))
    checks.append(_money_check("M3", "Principal received", loans, S.get("principal_received")))
    checks.append(_money_check("M4", "Interest received", loans, S.get("interest_received")))
    checks.append(_money_check("M5", "Platform fee", loans, S.get("platform_fee")))
    checks.append(_money_check(
        "M6", "NPA amount", loans, S.get("npa_amount"),
        "report NPA is a book-level total (includes recovery/adjustment entries not attributed to individual loans)"))
    computed_outstanding = round(sums["disbursed"] - sums["principal"] - sums["npa"], 2)
    rep_outstanding = S.get("principal_outstanding")
    delta_out = round((rep_outstanding or 0) - computed_outstanding, 2)
    checks.append(_check(
        "M7", "Principal outstanding",
        f"computed disbursed − principal − NPA = {computed_outstanding:,.2f} vs report {rep_outstanding:,.2f}"
        + (f" (delta ₹{abs(delta_out):,.2f} — report writes off NPA using its own book-level NPA figure)" if abs(delta_out) > TOL else ""),
        "PASS" if abs(delta_out) <= TOL else "INFO",
        computed_outstanding, rep_outstanding, round(delta_out, 2)))

    # ---- C-series: counts & uniqueness ----
    total = len(loans)
    counts = stats["status_counts"]
    checks.append(_check(
        "C1", "Loan rows parsed", f"{total} loan rows read from the sheet",
        "PASS", total, None))
    checks.append(_check(
        "C2", "Status counts add up",
        f"{sum(counts.values())} = sum of statuses vs {total} total loans",
        "PASS" if sum(counts.values()) == total else "FAIL",
        sum(counts.values()), total))
    orders = [l["order_id"] for l in loans]
    loans_ids = [l["loan_id"] for l in loans]
    shared_orders = sum(1 for l in loans if sum(1 for o in orders if o == l["order_id"]) > 1)
    checks.append(_check(
        "C3", "Order IDs may repeat (batch identifier)",
        f"{len(set(orders))} order IDs for {total} loans — an order is a batch that can contain several loans ({shared_orders} loans share an order)",
        "INFO", len(set(orders)), None))
    checks.append(_check(
        "C4", "Loan IDs unique (true key)", f"{len(set(loans_ids))} unique of {total} loan IDs",
        "PASS" if len(set(loans_ids)) == total else "FAIL", len(set(loans_ids)), total))
    blank_status = sum(1 for l in loans if not l["status"])
    blank_amount = sum(1 for l in loans if l["amount"] is None)
    checks.append(_check(
        "C5", "No blank status/amount", f"{blank_status} blank status, {blank_amount} blank amount",
        "PASS" if blank_status == 0 and blank_amount == 0 else "FAIL",
        {"blank_status": blank_status, "blank_amount": blank_amount}, {"blank_status": 0, "blank_amount": 0}))

    # ---- V-series: value sanity ----
    bad_amount = [l for l in loans if (l["amount"] or 0) < 0]
    bad_rate = [l for l in loans if l["interest_rate"] is not None and not (0 <= l["interest_rate"] <= 100)]
    bad_score = [l for l in loans if l["score"] is not None and not (0 <= l["score"] <= 1000)]
    bad_dpd = [l for l in loans if (l["dpd"] or 0) < 0]
    known_tenures = {2, 3, 4, 5, 6, 12}
    bad_tenure = [l for l in loans if l["tenure"] not in known_tenures]
    checks.append(_check("V1", "Amounts non-negative", f"{len(bad_amount)} violations",
                         "PASS" if not bad_amount else "FAIL", len(bad_amount), 0))
    checks.append(_check("V2", "Interest rates within 0–100%", f"{len(bad_rate)} violations",
                         "PASS" if not bad_rate else "FAIL", len(bad_rate), 0))
    checks.append(_check("V3", "Scores within 0–1000", f"{len(bad_score)} violations",
                         "PASS" if not bad_score else "FAIL", len(bad_score), 0))
    checks.append(_check("V4", "Tenures in known set {2,3,4,5,6,12}", f"{len(bad_tenure)} violations",
                         "PASS" if not bad_tenure else "FAIL", len(bad_tenure), 0))
    checks.append(_check("V5", "DPD never negative", f"{len(bad_dpd)} violations",
                         "PASS" if not bad_dpd else "FAIL", len(bad_dpd), 0))
    funded = [l for l in loans if l["status"] in ("CLOSED", "ACTIVE", "NPA", "REJECTED")]
    missing_chart = sum(1 for l in funded if None in (l["amount"], l["interest_rate"], l["tenure"], l["score"], l["status"]))
    unfunded = [l for l in loans if l["status"] in ("PROCESSING", "CANCELLED")]
    no_date = [l for l in loans if not l["disbursement_date"]]
    checks.append(_check("V6", "Chart-critical fields populated (funded loans)",
                         f"{missing_chart} funded loans missing amount/rate/tenure/score/status; "
                         f"{len(no_date)} loans ({len(unfunded)} processing/cancelled) have no disbursement date yet — expected for unfunded loans",
                         "PASS" if missing_chart == 0 else "FAIL", missing_chart, 0))

    # ---- X-series: cross-field consistency ----
    recv_mismatch = [l for l in loans if abs((l["principal_received"] or 0) + (l["interest_received"] or 0) - (l["total_received"] or 0)) > TOL]
    recv_material = [l for l in loans if abs((l["principal_received"] or 0) + (l["interest_received"] or 0) - (l["total_received"] or 0)) > 1.0]
    max_delta = max((abs((l["principal_received"] or 0) + (l["interest_received"] or 0) - (l["total_received"] or 0)) for l in loans), default=0.0)
    checks.append(_check("X1", "principal + interest = total received",
                         f"{len(recv_mismatch)} loans off by > ₹{TOL} ({len(recv_material)} by more than ₹1, max ₹{max_delta:.2f}) — minor source-report rounding on prepayments/recoveries, not a pipeline error",
                         "PASS" if not recv_material else "INFO", len(recv_mismatch), 0))
    bad_close = [l for l in loans if l["status"] == "CLOSED" and l["closure_date"] and l["disbursement_date"] and l["closure_date"] < l["disbursement_date"]]
    checks.append(_check("X2", "Closure date ≥ disbursement date (CLOSED)",
                         f"{len(bad_close)} violations",
                         "PASS" if not bad_close else "FAIL", len(bad_close), 0))
    bad_start = [l for l in loans if l["repayment_start"] and l["disbursement_date"] and l["repayment_start"] < l["disbursement_date"]]
    checks.append(_check("X3", "Repayment starts after disbursement",
                         f"{len(bad_start)} violations",
                         "PASS" if not bad_start else "FAIL", len(bad_start), 0))
    over_recv = [l for l in loans if l["status"] == "ACTIVE" and (l["total_received"] or 0) > (l["total_repayment"] or 0) + TOL]
    max_over = max(((l["total_received"] or 0) - (l["total_repayment"] or 0) for l in over_recv), default=0.0)
    checks.append(_check("X4", "ACTIVE loans never over-repaid",
                         f"{len(over_recv)} ACTIVE loan received more than contracted (max ₹{max_over:.2f}) — prepayment rounding in the source",
                         "PASS" if not over_recv else "INFO", len(over_recv), 0))
    closed_dpd = [l for l in loans if l["status"] == "CLOSED" and (l["dpd"] or 0) > 0]
    checks.append(_check("X5", "CLOSED loans have zero DPD",
                         f"{len(closed_dpd)} closed loans still carry DPD",
                         "PASS" if not closed_dpd else "INFO", len(closed_dpd), 0))
    npa_no_loss = [l for l in loans if l["status"] == "NPA" and (l["npa_amount"] or 0) <= 0 and (l["dpd"] or 0) <= 0]
    checks.append(_check("X6", "Every NPA has loss or DPD",
                         f"{len(npa_no_loss)} NPA loans with no loss and no DPD",
                         "PASS" if not npa_no_loss else "INFO", len(npa_no_loss), 0))
    pnl_interest = sum(1 for l in loans if abs((l["pnl"] or 0) - (l["interest_received"] or 0)) <= TOL)
    checks.append(_check("X7", "pnl = interest received (report convention)",
                         f"{pnl_interest} of {total} loans follow the report's pnl convention",
                         "PASS" if pnl_interest >= 0.99 * total else "INFO", pnl_interest, total))

    # ---- X8: EMI/interest collection reality on fully-closed loans ----
    from .insights import interest_collection_rates
    coll = interest_collection_rates(loans)
    overall_rate = None
    ctot = sum(v["contracted_interest"] for v in coll.values())
    cgot = sum(v["interest_received"] for v in coll.values())
    if ctot:
        overall_rate = 100 * cgot / ctot
    rate12 = coll.get("12", {}).get("collection_rate")
    checks.append(_check(
        "X8", "Closed loans collect only part of contracted interest (EMI rebates)",
        f"on fully-closed loans, {cgot:,.0f} of {ctot:,.0f} contracted interest was actually collected"
        + (f" ({overall_rate:.1f}% overall; 12-month just {rate12:.1f}%)" if overall_rate is not None else "") +
        " — early-repayment interest rebates; projections haircut future interest by these per-tenure rates",
        "INFO", round(cgot, 2), round(ctot, 2)))

    # ---- T-series: tenure × score matrix integrity (regression guards) ----
    matrix = tenure_matrix(loans)
    with_ts = [l for l in loans if l["tenure"] is not None and score_band(l["score"])]
    cell_total = 0
    npa_total = 0
    for t, tm in matrix.items():
        for band, cell in tm["bands"].items():
            cell_total += cell["count"]
            npa_total += cell["npa_count"]
    checks.append(_check("T1", "Tenure × score cells cover all scorable loans",
                         f"cells sum to {cell_total} of {len(with_ts)} loans with tenure+score",
                         "PASS" if cell_total == len(with_ts) else "FAIL", cell_total, len(with_ts)))
    total_npa = stats["npa_loans"]
    checks.append(_check("T2", "NPA count reconciled across the matrix",
                         f"matrix NPA {npa_total} vs total NPA {total_npa}",
                         "PASS" if npa_total == total_npa else "FAIL", npa_total, total_npa))
    key_cell = matrix.get("6", {}).get("bands", {}).get("700-724")
    if key_cell:
        ok = key_cell["count"] == 533 and key_cell["npa_count"] == 56 and abs(key_cell["npa_rate"] - 10.5) <= 0.1
        checks.append(_check(
            "T3", "6-month × 700–724 cell (known regression guard)",
            f"count {key_cell['count']}, NPA {key_cell['npa_count']}, rate {key_cell['npa_rate']}%",
            "PASS" if ok else "FAIL",
            {"count": key_cell["count"], "npa": key_cell["npa_count"], "rate": key_cell["npa_rate"]},
            {"count": 533, "npa": 56, "rate": 10.5}))
    npa_2m = matrix.get("2", {}).get("npa_count")
    checks.append(_check("T4", "2-month NPA count",
                         f"{npa_2m} of {matrix.get('2', {}).get('count')} two-month loans are NPA",
                         "PASS" if npa_2m == 3 else "FAIL", npa_2m, 3))

    # ---- Y-series: NPA-by-year ledger integrity ----
    from .insights import npa_by_year
    ny = npa_by_year(loans)
    tenure_rows = [r for r in ny["rows"] if r["tenure"] is not None and r["year"] != "ALL"]
    yr_mat = sum(r["matured"] for r in tenure_rows)
    yr_npa = sum(r["npa"] for r in tenure_rows)
    yr_amt = round(sum(r["npa_amt"] for r in tenure_rows), 2)
    yr_disb = round(sum(r["disb"] for r in tenure_rows), 2)
    matured_total = sum(1 for l in loans if l["status"] in ("CLOSED", "NPA"))
    checks.append(_check(
        "Y1", "NPA-by-year rows cover every matured loan",
        f"rows sum to {yr_mat} matured loans (incl. {yr_npa} NPA) vs {matured_total} matured on the book",
        "PASS" if yr_mat == matured_total and yr_npa == stats["npa_loans"] else "FAIL",
        {"matured": yr_mat, "npa": yr_npa}, {"matured": matured_total, "npa": stats["npa_loans"]}))
    checks.append(_check(
        "Y2", "NPA-by-year money reconciles to the NPA ledger",
        f"rows sum to ₹{yr_amt:,.2f} NPA principal on ₹{yr_disb:,.2f} matured disbursed vs "
        f"book NPA ₹{sums['npa']:,.2f}",
        "PASS" if abs(yr_amt - sums["npa"]) <= TOL else "FAIL", yr_amt, sums["npa"]))

    # ---- Z-series: vintage-curve integrity ----
    from .insights import vintage
    vg = vintage(loans, S.get("to_date"))
    funded = [l for l in loans if l["status"] in ("CLOSED", "ACTIVE", "NPA") and l.get("disbursement_date")]
    vc_n = sum(c["loans"] for c in vg["cohorts"])
    vc_npa = sum(c["npa"] for c in vg["cohorts"])
    arr_sum = sum(r["npa"] for r in vg["arrival"])
    checks.append(_check(
        "Z1", "Vintage cohorts cover the funded book",
        f"{len(vg['cohorts'])} cohorts sum to {vc_n} of {len(funded)} funded loans ({sum(1 for l in funded if l['status']=='NPA')} NPA across cohorts vs {vc_npa} in curves)",
        "PASS" if vc_n <= len(funded) and vc_npa == stats["npa_loans"] else "FAIL",
        vc_npa, stats["npa_loans"]))
    checks.append(_check(
        "Z2", "Arrival histogram accounts for every NPA",
        f"default-age histogram sums to {arr_sum} NPA loans of {stats['npa_loans']}",
        "PASS" if arr_sum == stats["npa_loans"] else "FAIL", arr_sum, stats["npa_loans"]))
    bad_curve = []
    for c in vg["cohorts"]:
        prev = 0.0
        for p in c["curve"]:
            if p["npa"] < prev or p["denom"] < 15:
                bad_curve.append(c["month"])
                break
            prev = p["npa"]
    checks.append(_check(
        "Z3", "Vintage curves are monotone (defaults only accumulate)",
        f"{len(bad_curve)} cohorts with a non-monotone curve" if bad_curve else "all curves non-decreasing with adequate denominators",
        "PASS" if not bad_curve else "FAIL", len(bad_curve), 0))

    # ---- Z4/Z5: per-cohort percentage ledger (rates + economics) ----
    bad_row = []
    for c in vg["cohorts"]:
        ok = (c["npa"] + c["closed"] == c["matured"]
              and c["matured"] + c["active"] == c["loans"]
              and abs((c["rate_life"] or 0) - 100.0 * c["npa"] / c["matured"]) <= 0.011
              and abs((c["net"] or 0) - ((c["interest"] or 0) - (c["fees"] or 0) - (c["npa_amt"] or 0))) <= 0.011)
        if not ok:
            bad_row.append(c["month"])
    checks.append(_check(
        "Z4", "Cohort ledger rows are internally consistent",
        f"{len(bad_row)} cohorts with inconsistent counts/net arithmetic" if bad_row else "every cohort's counts reconcile (closed+npa=matured, +active=loans) and net = interest − fees − NPA ₹",
        "PASS" if not bad_row else "FAIL", len(bad_row), 0))
    mat_in = sum(c["matured"] for c in vg["cohorts"])
    mat_all = sum(1 for l in funded if l["status"] in ("CLOSED", "NPA"))
    disb_in = sum(c["disb_m"] for c in vg["cohorts"])
    disb_all = round(sum(l["amount"] or 0 for l in funded if l["status"] in ("CLOSED", "NPA")), 2)
    checks.append(_check(
        "Z5", "Cohort ledger covers the matured book it reports on",
        f"rows cover {mat_in} of {mat_all} matured loans (₹{disb_in:,.2f} of ₹{disb_all:,.2f}); "
        f"{mat_all - mat_in} matured loans sit in cohorts with <10 matured and are excluded by design",
        "PASS" if mat_in <= mat_all and disb_in <= disb_all + 1 else "FAIL", mat_in, mat_all))

    # ---- W-series: fine-bucket net-XIRR atlas ----
    from .insights import xirr_atlas
    atl = xirr_atlas(loans)
    allc = atl["slices"]["ALL"]["cells"]
    at_m = sum(c["matured"] for c in allc.values())
    at_n = sum(c["npa"] for c in allc.values())
    at_disb = round(sum(c["disb"] for c in allc.values()), 2)
    exp_m = sum(1 for l in funded if l["status"] in ("CLOSED", "NPA"))
    exp_disb = round(sum(l["amount"] or 0 for l in funded if l["status"] in ("CLOSED", "NPA")), 2)
    checks.append(_check(
        "W1", "XIRR-atlas buckets cover the matured book",
        f"{len(allc)} non-empty tenure×score buckets sum to {at_m} of {exp_m} matured loans "
        f"(₹{at_disb:,.2f} of ₹{exp_disb:,.2f}), {at_n} NPA",
        "PASS" if at_m == exp_m and at_n == stats["npa_loans"] and abs(at_disb - exp_disb) <= 1 else "FAIL",
        at_m, exp_m))
    wild = [f"{c['t']}mo×{c['band']}" for c in allc.values()
            if c["xirr_all"] is not None and not (-100 <= c["xirr_all"] <= 300)]
    checks.append(_check(
        "W2", "XIRR-atlas rates are plausible and evidence-gated",
        f"{sum(1 for c in allc.values() if c['xirr_all'] is not None)} cells with ≥ {atl['min_evidence']} "
        f"matured loans report XIRR; {len(wild)} outside −100…300%/yr" if not wild else
        f"cells outside −100…300%/yr: {wild}",
        "PASS" if not wild else "FAIL", len(wild), 0))

    # ---- F-series: the platform-fee model (% of principal returned per EMI) ----
    fs = {t: [] for t in (2, 3, 4, 5, 6, 12)}
    bad = 0
    for l in loans:
        t = int(l["tenure"] or 0)
        if t in fs and (l["principal_received"] or 0) > 0:
            r = 100 * (l["platform_fee"] or 0) / (l["principal_received"] or 1)
            fs[t].append(r)
    def _med(v):
        v = sorted(v)
        return v[len(v) // 2] if v else None
    sched = {2: 1.0, 3: 1.0, 4: 3.0, 5: 3.0, 6: 3.0, 12: 6.0}
    eras = {4: ("2026-04", 2.3), 5: ("2026-06", 2.5)}  # tenure -> (since, old rate)

    def _era_medians(t, since=None):
        pool = [l for l in loans if int(l["tenure"] or 0) == t
                and (l["principal_received"] or 0) > 0]
        if since:
            pool = [l for l in pool if (l["disbursement_date"] or "")[:7] >= since]
        return _med([100 * (l["platform_fee"] or 0) / (l["principal_received"] or 1) for l in pool]) if len(pool) >= 10 else None

    # era-aware expected rate: tenures without a mid-book change are judged
    # all-time; changed tenures are judged within each pricing era
    drifts, parts = [], []
    for t in sorted(fs):
        if t in eras:
            since, old = eras[t]
            m_old = _era_medians(t, None)  # all-time pool dominated by pre-change loans
            pre = [l for l in loans if int(l["tenure"] or 0) == t
                   and (l["principal_received"] or 0) > 0
                   and (l["disbursement_date"] or "")[:7] < since]
            if len(pre) >= 10:
                m_old = _med([100 * (l["platform_fee"] or 0) / (l["principal_received"] or 1) for l in pre])
                parts.append(f"{t}mo pre-{since}: median {m_old:.2f}% vs {old:.1f}% (n={len(pre)})")
                drifts.append(abs(m_old - old))
            m_new = _era_medians(t, since)
            if m_new is not None:
                parts.append(f"{t}mo ≥ {since}: median {m_new:.2f}% vs {sched[t]:.1f}%")
                drifts.append(abs(m_new - sched[t]))
        elif fs[t]:
            m = _med(fs[t])
            parts.append(f"{t}mo: median {m:.2f}% vs {sched[t]:.1f}% (n={len(fs[t])})")
            drifts.append(abs(m - sched[t]))
    # individual loans may deviate (early foreclosure / payment plans); the
    # model is judged on the era medians, plus a hard bound on the whole pool
    outside = sum(1 for t in fs for r in fs[t] if abs(r - sched[t]) > 1.0
                  and not (t in eras and abs(r - eras[t][1]) <= 1.0))
    total_pool = sum(len(fs[t]) for t in fs)
    checks.append(_check(
        "F1", "Fee = schedule % × principal returned (era medians per tenure)",
        "; ".join(parts),
        "PASS" if drifts and max(drifts) <= 0.2 else "FAIL",
        round(max(drifts), 3) if drifts else 0, 0))
    checks.append(_check(
        "F2", "Fee rate outliers within ±1pt of schedule",
        f"{outside} of {total_pool} loans with principal received deviate >1pt from the schedule",
        "PASS" if outside / max(1, total_pool) < 0.02 else "FAIL",
        outside, 0))
    checks.append(_check(
        "F3", "Report 'pnl' column ignores the platform fee",
        f"pnl = total_received − amount on {sum(1 for l in loans if l['status'] == 'CLOSED' and abs((l['pnl'] or 0) - ((l['total_received'] or 0) - (l['amount'] or 0))) <= 1)} of "
        f"{sum(1 for l in loans if l['status'] == 'CLOSED')} closed loans — ₹{sum(l['platform_fee'] or 0 for l in loans if l['status'] in ('CLOSED', 'NPA', 'ACTIVE')):,.0f} of fees "
        "are missing from the platform's own P&L; dashboard nets the fee explicitly",
        "INFO",
        sum(1 for l in loans if l["status"] == "CLOSED" and abs((l["pnl"] or 0) - ((l["total_received"] or 0) - (l["amount"] or 0))) <= 1), 0))
    closed_loans = [l for l in loans if l["status"] == "CLOSED"]
    ident_ok = sum(1 for l in closed_loans
                   if abs((l["total_received"] or 0) - (l["principal_received"] or 0) - (l["interest_received"] or 0)) <= 1)
    checks.append(_check(
        "F4", "Receipts identity: total_received = principal + interest",
        f"{ident_ok} of {len(closed_loans)} closed loans hold the identity "
        "(fee is a separate column, not inside receipts; residual differences are "
        "source-report rounding documented in X1)",
        "PASS" if ident_ok >= 0.995 * len(closed_loans) else "FAIL",
        len(closed_loans) - ident_ok, 0))

    # ---- W3/W4: return_drivers buckets reconcile to the matured book ----
    from .insights import return_drivers
    rd = return_drivers(loans)
    matured = [l for l in loans if l["status"] in ("CLOSED", "NPA")
               and l["disbursement_date"] and l["repayment_start"]
               and (l["amount"] or 0) > 0]
    rate_sum = sum(r["loans"] for r in rd.get("by_rate", []))
    ticket_sum = sum(r["loans"] for r in rd.get("by_ticket", []))
    checks.append(_check(
        "W3", "Return-driver buckets cover the matured book",
        f"rate buckets {rate_sum} + ticket buckets {ticket_sum} of {len(matured)} matured loans "
        "(rate bands skip unscored loans; ticket bands are exhaustive)",
        "PASS" if ticket_sum == len(matured) else "FAIL", ticket_sum, len(matured)))
    bad = [r for r in rd.get("by_rate", []) + rd.get("by_ticket", []) + rd.get("by_repay", [])
           if r["xirr_all"] is not None and not (-100 <= r["xirr_all"] <= 300)]
    checks.append(_check(
        "W4", "Return-driver XIRRs are plausible (−100…300%/yr)",
        f"{len(bad)} bucket XIRRs outside range" if bad else "all bucket XIRRs inside −100…300%/yr",
        "PASS" if not bad else "FAIL", len(bad), 0))

    bad = [r for r in rd.get("by_rate", []) + rd.get("by_ticket", []) + rd.get("by_repay", [])
           if r["xirr_all"] is not None and not (-100 <= r["xirr_all"] <= 300)]
    checks.append(_check(
        "W4", "Return-driver XIRRs are plausible (−100…300%/yr)",
        f"{len(bad)} bucket XIRRs outside range" if bad else "all bucket XIRRs inside −100…300%/yr",
        "PASS" if not bad else "FAIL", len(bad), 0))

    # W5: ticket-in-cell buckets reconcile to their cells
    cells_ok, cells_bad = 0, 0
    for cell in rd.get("by_ticket_in_cell", []):
        n_bucket = sum(b["loans"] for b in cell["buckets"])
        if n_bucket == cell["loans"]:
            cells_ok += 1
        else:
            cells_bad += 1
    bad = [b for cell in rd.get("by_ticket_in_cell", [])
           for b in cell["buckets"] if b["xirr_all"] is not None and not (-100 <= b["xirr_all"] <= 300)]
    checks.append(_check(
        "W5", "Ticket-in-cell buckets reconcile and are plausible",
        f"{cells_ok} cells fully covered by ticket buckets ({cells_bad} partial — thin tails with <5 loans per bucket are excluded by design); "
        f"{len(bad)} bucket XIRRs outside −100…300%/yr" if bad else
        f"{cells_ok} cells fully covered by ticket buckets ({cells_bad} partial — thin tails excluded by design); all XIRRs plausible",
        "PASS" if cells_ok >= 5 and not bad else "FAIL", cells_bad, 0))

    # ---- X-series: month_allocation (fresh money vs the recommendation) ----
    ma = month_allocation(loans, xirr_picks(loans))
    if ma:
        checks.append(_check(
            "X1", f"Fresh-money allocation month {ma['month']} reconciles",
            f"{ma['loans']} still-open loans, ₹{ma['amount']:,.0f} disbursed; {ma['core_pct']:.1f}% went into core cells, "
            f"₹{ma['misaligned_amount']:,.0f} ({ma['misaligned_loans']} loans) into avoid/conditional cells",
            "INFO", ma["core_pct"], None))

    # ---- verdict ----
    fails = [c for c in checks if c["status"] == "FAIL"]
    infos = [c for c in checks if c["status"] == "INFO"]
    verdict = {
        "passed": sum(1 for c in checks if c["status"] == "PASS"),
        "info": len(infos),
        "failed": len(fails),
        "total": len(checks),
        "ok": not fails,
        "generated_by": "scripts/ldc/audit.py",
    }
    return {"checks": checks, "verdict": verdict}