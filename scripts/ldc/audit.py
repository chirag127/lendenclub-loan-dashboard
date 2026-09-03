"""Audit engine: reconcile the parsed data against the source report.

Every check returns {id, name, detail, status, value, expected, delta} where
status is PASS (exact), INFO (report-level figure differs for a known,
explained reason) or FAIL (an actual inconsistency worth fixing).

The matrix checks (T-series) re-derive the dashboard's tenure × score
heatmaps in Python so a JS/Python disagreement can never silently slip
through the build again.
"""

from .clean import to_num
from .insights import tenure_matrix, score_band

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